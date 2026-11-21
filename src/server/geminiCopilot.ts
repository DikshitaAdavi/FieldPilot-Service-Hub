import { FunctionDeclaration, GoogleGenAI, ThinkingLevel, Type, type Content, type Part } from '@google/genai';
import crypto from 'crypto';
import type {
  ConfirmationRequest,
  EscalationTarget,
  PendingReason,
  ResolutionCode,
  RiskLevel,
  TicketState,
  ToolExecution,
} from '../types/domain';
import { broadcastEvent, store } from './store';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const MODEL_NAME = 'gemini-3.1-flash-lite';

const COPILOT_TOOLS: FunctionDeclaration[] = [
  {
    name: 'search_knowledge_base',
    description:
      'Search engineering manuals, safety SOPs, troubleshooting trees, and past fix reports. Always call this first when diagnosing equipment faults or before physical repair steps.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Technical symptom, fault code, part name, or asset model query.' },
        equipment_model: { type: Type.STRING, description: 'Optional equipment model e.g. 30XA-350' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_ticket_context',
    description: 'Fetch full details of a ticket, linked equipment, past incidents on that asset, SLA status, and work order steps.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ticket_number: { type: Type.STRING, description: 'Ticket number such as INC0010001' },
      },
      required: ['ticket_number'],
    },
  },
  {
    name: 'check_part_availability',
    description: 'Check local site store and regional warehouse inventory for a spare part and compatible alternates.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        part_query: { type: Type.STRING, description: 'Part number or name e.g. CFM-30XA-480V or condenser fan motor' },
        site_id: { type: Type.STRING, description: 'Optional site ID to prioritize local store.' },
      },
      required: ['part_query'],
    },
  },
  {
    name: 'log_work_note',
    description: 'Append an internal technician work note or public comment to a ticket.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ticket_number: { type: Type.STRING },
        body: { type: Type.STRING },
        is_internal: { type: Type.BOOLEAN, description: 'True for technician work notes, false for customer-visible comment.' },
      },
      required: ['ticket_number', 'body'],
    },
  },
  {
    name: 'transition_ticket_state',
    description:
      'Move a ticket to a new lifecycle state. Moving to RESOLVED, OUT_OF_SCOPE, or CLOSED_INCOMPLETE requires human confirmation and creates a confirmation card.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ticket_number: { type: Type.STRING },
        to_state: {
          type: Type.STRING,
          description:
            'Target state: ASSIGNED, WORK_IN_PROGRESS, PENDING, ESCALATED, WORKAROUND_PROVIDED, RESOLVED, CLOSED_COMPLETE, CLOSED_INCOMPLETE, OUT_OF_SCOPE, CANCELLED',
        },
        reason: { type: Type.STRING, description: 'Reason for transition, escalation, cancellation, or reopen.' },
        pending_reason: {
          type: Type.STRING,
          description: 'Required for PENDING: Awaiting Part | Awaiting Customer | Awaiting Vendor | Awaiting Approval | Awaiting Change Window',
        },
        escalation_target: { type: Type.STRING, description: 'Required for ESCALATED: supervisor | L2 | vendor' },
        workaround_description: { type: Type.STRING, description: 'Required for WORKAROUND_PROVIDED' },
        resolution_code: {
          type: Type.STRING,
          description: 'Required for RESOLVED: Fixed | Workaround | Part Replaced | No Fault Found | Duplicate | Out of Coverage | Customer Unresponsive',
        },
        resolution_notes: { type: Type.STRING, description: 'Required for RESOLVED' },
        out_of_scope_justification: { type: Type.STRING, description: 'Required for OUT_OF_SCOPE' },
      },
      required: ['ticket_number', 'to_state'],
    },
  },
  {
    name: 'create_purchase_order',
    description:
      'Order a spare part from a warehouse. CRITICAL ACTION: Calling this creates a pending confirmation card that the technician must confirm before stock is reserved.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ticket_number: { type: Type.STRING },
        part_number: { type: Type.STRING, description: 'Exact part number e.g. CFM-30XA-480V' },
        warehouse: { type: Type.STRING, description: 'Warehouse name e.g. Bengaluru Regional Hub or Orion Site Store' },
        quantity: { type: Type.INTEGER },
        is_urgent: { type: Type.BOOLEAN },
        notes: { type: Type.STRING },
      },
      required: ['part_number', 'warehouse', 'quantity'],
    },
  },
  {
    name: 'schedule_followup',
    description: 'Schedule a preventive or revisit follow-up task for an asset or ticket.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ticket_number: { type: Type.STRING },
        title: { type: Type.STRING },
        followup_type: {
          type: Type.STRING,
          description: 'part_arrival_revisit | preventive_sibling_check | customer_confirm | permanent_fix',
        },
        hours_from_now: { type: Type.NUMBER },
        description: { type: Type.STRING },
      },
      required: ['ticket_number', 'title', 'followup_type'],
    },
  },
  {
    name: 'escalate_to_expert',
    description: 'Create an invite for a remote supervisor or L2 expert to join this ticket diagnostic session.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ticket_number: { type: Type.STRING },
        ai_diagnosis_summary: { type: Type.STRING, description: 'Concise technical summary for the expert.' },
      },
      required: ['ticket_number', 'ai_diagnosis_summary'],
    },
  },
  {
    name: 'create_ticket',
    description: 'Create a new incident, service request, or work order ticket when the user asks to open or log a new ticket.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Concise summary title of the issue or request.' },
        description: { type: Type.STRING, description: 'Detailed description of symptoms or request.' },
        type: { type: Type.STRING, description: 'INCIDENT | SERVICE_REQUEST | WORK_ORDER' },
        impact: { type: Type.STRING, description: 'High | Medium | Low' },
        urgency: { type: Type.STRING, description: 'High | Medium | Low' },
      },
      required: ['title', 'description'],
    },
  },
];

export interface CopilotTurnResult {
  reply: string;
  toolExecutions: ToolExecution[];
  ragSources: Array<{ id: string; title: string; doc_type: string; hazard_level: string; safety_sop?: string | null }>;
  confirmations: ConfirmationRequest[];
}

export async function runCopilotChat(params: {
  sessionId: string;
  actorId: string;
  ticketNumber?: string | null;
  pageContext?: string;
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<CopilotTurnResult> {
  const ai = getAiClient();
  const actor = store.getSnapshot().profiles.find((p) => p.id === params.actorId);
  const ticketCtx = params.ticketNumber ? store.getTicketContext(params.ticketNumber) : null;

  const systemInstruction = [
    'You are FieldPilot AI, an enterprise field-service voice & operations copilot.',
    'Style: concise, spoken-friendly, clear engineering precision (2-4 crisp sentences unless giving a step-by-step SOP).',
    'Rules:',
    '1. Whenever a technician describes a symptom or equipment fault, call search_knowledge_base FIRST and lead with any mandatory SAFETY SOP / LOTO hazard warning.',
    '2. Ground every diagnosis in real tool outputs (ticket context, equipment history, warehouse stock, KB SOPs). Never invent part numbers, stock counts, or ticket states.',
    '3. For critical actions (create_purchase_order, or transitioning to RESOLVED / OUT_OF_SCOPE / CLOSED_INCOMPLETE), invoke the tool so a confirmation card is queued, then give a concise read-back asking "Shall I go ahead?"',
    `Current user: ${actor?.full_name ?? 'Technician'} (role: ${actor?.role ?? 'technician'}).`,
    params.pageContext ? `Active UI view: ${params.pageContext}.` : '',
    ticketCtx
      ? `Active ticket context: ${ticketCtx.ticket.ticket_number} (${ticketCtx.ticket.state}, ${ticketCtx.ticket.priority}) - "${ticketCtx.ticket.title}" on asset ${ticketCtx.equipment?.asset_tag ?? 'N/A'} (${ticketCtx.equipment?.model ?? 'N/A'}) at ${ticketCtx.site?.name ?? 'N/A'}.`
      : 'No specific ticket locked yet; ask or infer from conversation.',
  ]
    .filter(Boolean)
    .join('\n');

  const contents: Content[] = params.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));

  const executedTools: ToolExecution[] = [];
  const ragSources: CopilotTurnResult['ragSources'] = [];
  const createdConfirmations: ConfirmationRequest[] = [];

  // Allow up to 4 iterative tool-calling hops
  let currentContents = [...contents];
  let finalReply = '';

  for (let step = 0; step < 4; step++) {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: currentContents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: COPILOT_TOOLS }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        abortSignal: AbortSignal.timeout(15000),
      },
    });

    const candidateContent = response.candidates?.[0]?.content;
    const calls = response.functionCalls;

    if (!calls || calls.length === 0) {
      finalReply = response.text?.trim() || 'Action completed.';
      break;
    }

    if (candidateContent) {
      currentContents.push(candidateContent);
    }

    const functionResponseParts: Part[] = [];

    for (const call of calls) {
      const startMs = Date.now();
      const toolName = call.name ?? 'unknown';
      const args = (call.args ?? {}) as Record<string, unknown>;
      let risk: RiskLevel = 'read';
      let resultObj: unknown = {};
      let status: ToolExecution['status'] = 'success';

      try {
        if (toolName === 'search_knowledge_base') {
          risk = 'read';
          const hits = store.hybridKbSearch(String(args.query ?? ''), args.equipment_model ? String(args.equipment_model) : undefined, 4);
          for (const h of hits) {
            if (!ragSources.some((r) => r.id === h.id)) {
              ragSources.push({
                id: h.id,
                title: h.title,
                doc_type: h.doc_type,
                hazard_level: h.hazard_level,
                safety_sop: h.safety_sop,
              });
            }
          }
          resultObj = {
            results: hits.map((h) => ({
              title: h.title,
              doc_type: h.doc_type,
              hazard_level: h.hazard_level,
              safety_sop: h.safety_sop,
              content: h.content,
            })),
          };
        } else if (toolName === 'get_ticket_context') {
          risk = 'read';
          const ctx = store.getTicketContext(String(args.ticket_number ?? params.ticketNumber ?? ''));
          resultObj = ctx ?? { error: 'Ticket not found' };
        } else if (toolName === 'check_part_availability') {
          risk = 'read';
          resultObj = store.checkPartAvailability(
            String(args.part_query ?? ''),
            args.site_id ? String(args.site_id) : ticketCtx?.site?.id
          );
        } else if (toolName === 'log_work_note') {
          risk = 'write';
          const tNum = String(args.ticket_number ?? params.ticketNumber ?? '');
          const t = store.findTicketByIdOrNumber(tNum);
          if (!t) throw new Error(`Ticket ${tNum} not found`);
          const act = {
            id: `act-${crypto.randomUUID().slice(0, 8)}`,
            ticket_id: t.id,
            actor_id: params.actorId,
            actor_name: `${actor?.full_name ?? 'Technician'} (via Copilot)`,
            actor_type: 'ai' as const,
            activity_type: args.is_internal === false ? ('comment' as const) : ('work_note' as const),
            is_internal: args.is_internal !== false,
            body: String(args.body ?? ''),
            created_at: new Date().toISOString(),
          };
          store.getSnapshot().ticketActivities.unshift(act);
          store.persist();
          broadcastEvent('activity_added', act);
          resultObj = { ok: true, ticket_number: t.ticket_number, activity_id: act.id };
        } else if (toolName === 'transition_ticket_state') {
          const toState = String(args.to_state) as TicketState;
          const tNum = String(args.ticket_number ?? params.ticketNumber ?? '');
          const t = store.findTicketByIdOrNumber(tNum);
          if (!t) throw new Error(`Ticket ${tNum} not found`);

          if (['RESOLVED', 'OUT_OF_SCOPE', 'CLOSED_INCOMPLETE'].includes(toState)) {
            risk = 'critical';
            status = 'pending_confirmation';
            const conf = store.createConfirmation({
              sessionId: params.sessionId,
              ticketId: t.id,
              toolName: 'transition_ticket_state',
              risk: 'critical',
              args: { ...args, ticket_id: t.id, ticket_number: t.ticket_number },
              summaryText: `Transition ${t.ticket_number} from ${t.state} to ${toState}${args.resolution_code ? ` (${args.resolution_code})` : ''}.`,
            });
            createdConfirmations.push(conf);
            resultObj = {
              awaiting_confirmation: true,
              confirmation_id: conf.id,
              summary: conf.summary_text,
            };
          } else {
            risk = 'write';
            resultObj = store.transitionTicket({
              ticketId: t.id,
              toState,
              actorId: params.actorId,
              via: 'voice',
              reason: args.reason ? String(args.reason) : undefined,
              pendingReason: args.pending_reason ? (String(args.pending_reason) as PendingReason) : undefined,
              escalationTarget: args.escalation_target ? (String(args.escalation_target) as EscalationTarget) : undefined,
              workaroundDescription: args.workaround_description ? String(args.workaround_description) : undefined,
              resolutionCode: args.resolution_code ? (String(args.resolution_code) as ResolutionCode) : undefined,
              resolutionNotes: args.resolution_notes ? String(args.resolution_notes) : undefined,
              outOfScopeJustification: args.out_of_scope_justification ? String(args.out_of_scope_justification) : undefined,
            });
          }
        } else if (toolName === 'create_purchase_order') {
          risk = 'critical';
          status = 'pending_confirmation';
          const tNum = String(args.ticket_number ?? params.ticketNumber ?? '');
          const t = tNum ? store.findTicketByIdOrNumber(tNum) : undefined;
          const partNum = String(args.part_number ?? '');
          const wh = String(args.warehouse ?? 'Bengaluru Regional Hub');
          const qty = Number(args.quantity ?? 1);
          const urgent = Boolean(args.is_urgent ?? true);
          const conf = store.createConfirmation({
            sessionId: params.sessionId,
            ticketId: t?.id ?? null,
            toolName: 'create_purchase_order',
            risk: 'critical',
            args: {
              ticket_id: t?.id ?? null,
              ticket_number: t?.ticket_number ?? null,
              part_number: partNum,
              warehouse: wh,
              quantity: qty,
              is_urgent: urgent,
              notes: args.notes ? String(args.notes) : undefined,
            },
            summaryText: `${urgent ? 'Urgent' : 'Standard'} Purchase Order: ${partNum} x${qty} from ${wh}${t ? ` for ${t.ticket_number}` : ''}.`,
          });
          createdConfirmations.push(conf);
          resultObj = {
            awaiting_confirmation: true,
            confirmation_id: conf.id,
            summary: conf.summary_text,
          };
        } else if (toolName === 'schedule_followup') {
          risk = 'write';
          const tNum = String(args.ticket_number ?? params.ticketNumber ?? '');
          const t = store.findTicketByIdOrNumber(tNum);
          if (!t) throw new Error(`Ticket ${tNum} not found`);
          const hrs = Number(args.hours_from_now ?? 24);
          const fup = {
            id: `fup-${crypto.randomUUID().slice(0, 8)}`,
            ticket_id: t.id,
            equipment_id: t.equipment_id ?? null,
            title: String(args.title ?? 'Follow-up check'),
            description: args.description ? String(args.description) : undefined,
            followup_type: (String(args.followup_type ?? 'preventive_sibling_check') as
              | 'part_arrival_revisit'
              | 'preventive_sibling_check'
              | 'customer_confirm'
              | 'permanent_fix'),
            scheduled_for: new Date(Date.now() + hrs * 3600 * 1000).toISOString(),
            assigned_to: t.assigned_to ?? params.actorId,
            status: 'scheduled' as const,
            created_at: new Date().toISOString(),
          };
          store.getSnapshot().followups.unshift(fup);
          store.persist();
          broadcastEvent('followup_created', fup);
          resultObj = { ok: true, followup: fup };
        } else if (toolName === 'escalate_to_expert') {
          risk = 'write';
          const tNum = String(args.ticket_number ?? params.ticketNumber ?? '');
          const t = store.findTicketByIdOrNumber(tNum);
          if (!t) throw new Error(`Ticket ${tNum} not found`);
          const invite = {
            id: `exp-${crypto.randomUUID().slice(0, 8)}`,
            session_id: params.sessionId,
            ticket_id: t.id,
            channel_name: `fp-${t.ticket_number}`,
            invited_by: params.actorId,
            expert_user_id: 'usr-sup-priya',
            status: 'pending' as const,
            ai_diagnosis_summary: String(args.ai_diagnosis_summary ?? ''),
            created_at: new Date().toISOString(),
          };
          store.getSnapshot().expertInvites.unshift(invite);
          store.persist();
          broadcastEvent('expert_invited', invite);
          resultObj = { ok: true, channel_name: invite.channel_name, expert_url: `/expert/${invite.channel_name}` };
        } else if (toolName === 'create_ticket') {
          risk = 'write';
          const created = store.createTicket({
            title: String(args.title ?? 'Field Support Request'),
            description: String(args.description ?? 'Created via FieldPilot Voice Copilot.'),
            type: (['INCIDENT', 'SERVICE_REQUEST', 'WORK_ORDER'].includes(String(args.type))
              ? String(args.type)
              : 'INCIDENT') as 'INCIDENT' | 'SERVICE_REQUEST' | 'WORK_ORDER',
            requester_id: params.actorId || 'usr-tech-arjun',
            impact: (['High', 'Medium', 'Low'].includes(String(args.impact))
              ? String(args.impact)
              : 'Medium') as 'High' | 'Medium' | 'Low',
            urgency: (['High', 'Medium', 'Low'].includes(String(args.urgency))
              ? String(args.urgency)
              : 'Medium') as 'High' | 'Medium' | 'Low',
            source: 'voice',
            auto_assign: true,
          });
          resultObj = {
            ok: true,
            ticket_number: created.ticket_number,
            state: created.state,
            priority: created.priority,
            title: created.title,
          };
        }
      } catch (err) {
        status = 'error';
        resultObj = { error: err instanceof Error ? err.message : String(err) };
      }

      const te: ToolExecution = {
        id: `te-${crypto.randomUUID().slice(0, 8)}`,
        session_id: params.sessionId,
        ticket_id: ticketCtx?.ticket.id ?? null,
        tool_name: toolName,
        risk,
        input_args: args,
        output_result: resultObj,
        status,
        duration_ms: Date.now() - startMs,
        executed_by: params.actorId,
        created_at: new Date().toISOString(),
      };
      store.getSnapshot().toolExecutions.unshift(te);
      executedTools.push(te);

      functionResponseParts.push({
        functionResponse: {
          id: call.id,
          name: toolName,
          response: resultObj as Record<string, unknown>,
        },
      });
    }

    currentContents.push({
      role: 'user',
      parts: functionResponseParts,
    });
  }

  store.persist();
  return {
    reply: finalReply || 'Completed requested action.',
    toolExecutions: executedTools,
    ragSources,
    confirmations: createdConfirmations,
  };
}

export async function analyzeEquipmentSnapshot(params: {
  imageBase64: string;
  mimeType: string;
  prompt?: string;
  ticketNumber?: string | null;
}) {
  const ai = getAiClient();
  const ticketCtx = params.ticketNumber ? store.getTicketContext(params.ticketNumber) : null;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType,
            data: params.imageBase64,
          },
        },
        {
          text: [
            'You are FieldPilot AI Visual Diagnostics Inspector.',
            ticketCtx
              ? `Inspecting asset ${ticketCtx.equipment?.asset_tag ?? ''} (${ticketCtx.equipment?.model ?? ''}) for ticket ${ticketCtx.ticket.ticket_number}: ${ticketCtx.ticket.title}.`
              : 'Inspect this industrial equipment photo.',
            params.prompt || 'Identify visible nameplate readings, gauges, mechanical anomalies, safety hazards, and recommended next field check.',
            'Return a concise structured diagnostic assessment with: Observed Readings, Likely Fault Indicators, Immediate Safety Note, and Recommended Action.',
          ].join('\n'),
        },
      ],
    },
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      abortSignal: AbortSignal.timeout(15000),
    },
  });

  return response.text?.trim() || 'Unable to extract visual observations.';
}

export async function transcribeAudioWithGemini(params: {
  audioBase64: string;
  mimeType: string;
}): Promise<string> {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-transcribe',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType || 'audio/webm',
            data: params.audioBase64,
          },
        },
        {
          text: 'Transcribe this field service technician voice command accurately. Return only the spoken words without extra commentary.',
        },
      ],
    },
  });
  return response.text?.trim() || '';
}

export async function synthesizeSpeechWithGemini(text: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const ai = getAiClient();
  const cleanText = text.replace(/[*_`#]/g, '').slice(0, 2400);
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: cleanText,
            speechMetadata: {
              style: 'Clear, calm, concise industrial field operations advisor',
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('Gemini TTS returned no audio data.');
  }
  return {
    buffer: Buffer.from(base64Audio, 'base64'),
    mimeType: 'audio/wav',
  };
}

export async function generateServiceReportWithAI(params: {
  ticketNumber: string;
  actorId: string;
  sessionId?: string | null;
}) {
  const ctx = store.getTicketContext(params.ticketNumber);
  if (!ctx) throw new Error('Ticket not found');

  const activities = store
    .getSnapshot()
    .ticketActivities.filter((a) => a.ticket_id === ctx.ticket.id)
    .slice(0, 12);

  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      `Generate a crisp, factual Field Service Report for ticket ${ctx.ticket.ticket_number}.`,
      `Title: ${ctx.ticket.title}`,
      `Asset: ${ctx.equipment?.asset_tag ?? 'N/A'} — ${ctx.equipment?.name ?? 'N/A'} (${ctx.equipment?.model ?? ''})`,
      `Site: ${ctx.site?.name ?? 'N/A'}`,
      `State: ${ctx.ticket.state}`,
      `Resolution: ${ctx.ticket.resolution_code ?? 'Pending'} — ${ctx.ticket.resolution_notes ?? ctx.ticket.workaround_description ?? 'Ongoing diagnostics'}`,
      `Recent Activity: ${activities.map((a) => `${a.actor_name}: ${a.body}`).join(' | ')}`,
      `Linked POs: ${ctx.purchase_orders.map((po) => `${po.po_number} (${po.status})`).join(', ') || 'None'}`,
    ].join('\n'),
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      abortSignal: AbortSignal.timeout(15000),
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary_narrative: { type: Type.STRING },
          diagnosis: { type: Type.STRING },
          actions_taken: { type: Type.ARRAY, items: { type: Type.STRING } },
          parts_used: { type: Type.ARRAY, items: { type: Type.STRING } },
          safety_checks: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'summary_narrative',
          'diagnosis',
          'actions_taken',
          'parts_used',
          'safety_checks',
          'recommendations',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    summary_narrative: string;
    diagnosis: string;
    actions_taken: string[];
    parts_used: string[];
    safety_checks: string[];
    recommendations: string[];
  };

  return store.saveServiceReport({
    ticket_id: ctx.ticket.id,
    session_id: params.sessionId ?? null,
    summary_narrative: parsed.summary_narrative,
    diagnosis: parsed.diagnosis,
    actions_taken: parsed.actions_taken ?? [],
    parts_used: parsed.parts_used ?? [],
    safety_checks: parsed.safety_checks ?? [],
    recommendations: parsed.recommendations ?? [],
    generated_by: params.actorId,
  });
}
