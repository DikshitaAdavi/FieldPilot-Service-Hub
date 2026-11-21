import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { broadcastEvent, store, subscribeEvents } from './src/server/store';
import {
  analyzeEquipmentSnapshot,
  generateServiceReportWithAI,
  runCopilotChat,
  synthesizeSpeechWithGemini,
  transcribeAudioWithGemini,
} from './src/server/geminiCopilot';
import {
  generateAgoraRtcToken,
  getIntegrationsStatus,
  isMurfConfigured,
  synthesizeSpeechWithMurf,
} from './src/server/integrations';
import type {
  EscalationTarget,
  PendingReason,
  ResolutionCode,
  TicketState,
  TicketType,
} from './src/types/domain';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // SSE Realtime stream
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'connected', payload: { ts: Date.now() } })}\n\n`);

    const unsubscribe = subscribeEvents((evt) => {
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  // Health, integration readiness & full snapshot
  app.get('/api/health', (_req, res) => {
    const integrations = getIntegrationsStatus();
    res.json({
      ok: true,
      geminiConfigured: integrations.gemini.configured,
      integrations,
      ticketsCount: store.getSnapshot().tickets.length,
    });
  });

  app.get('/api/integrations/status', (_req, res) => {
    res.json(getIntegrationsStatus());
  });

  app.get('/api/agora/token', (req, res) => {
    try {
      const channel = String(req.query.channelName || req.query.channel || 'fp-INC0010001');
      const uid = req.query.uid ? Number(req.query.uid) : 0;
      const result = generateAgoraRtcToken({ channelName: channel, uid });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/agora/token', (req, res) => {
    try {
      const channel = String(req.body.channelName || req.body.channel || 'fp-INC0010001');
      const uid = req.body.uid ? Number(req.body.uid) : 0;
      const result = generateAgoraRtcToken({ channelName: channel, uid });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/voice/transcribe', async (req, res) => {
    try {
      const { audio_base64, mime_type } = req.body;
      if (!audio_base64) {
        res.status(400).json({ error: 'audio_base64 is required' });
        return;
      }
      const transcript = await transcribeAudioWithGemini({
        audioBase64: String(audio_base64),
        mimeType: String(mime_type || 'audio/webm'),
      });
      res.json({ ok: true, transcript });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/voice/tts', async (req, res) => {
    try {
      const text = String(req.body.text ?? '').trim();
      if (!text) {
        res.status(400).json({ error: 'text is required' });
        return;
      }
      if (isMurfConfigured()) {
        try {
          const murf = await synthesizeSpeechWithMurf(text, req.body.voice_id);
          res.setHeader('Content-Type', murf.mimeType);
          res.setHeader('X-TTS-Provider', 'murf-falcon');
          res.setHeader('X-TTS-Voice', murf.voiceId);
          res.send(murf.buffer);
          return;
        } catch (murfErr) {
          console.warn('Murf Falcon TTS failed, falling back to Gemini TTS:', murfErr);
        }
      }
      const gem = await synthesizeSpeechWithGemini(text);
      res.setHeader('Content-Type', gem.mimeType);
      res.setHeader('X-TTS-Provider', 'gemini-tts');
      res.send(gem.buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/store', (_req, res) => {
    res.json(store.getSnapshot());
  });

  // Ticket endpoints
  app.post('/api/tickets', (req, res) => {
    try {
      const ticket = store.createTicket(req.body);
      res.status(201).json({ ok: true, ticket });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/tickets/:idOrNumber/context', (req, res) => {
    const ctx = store.getTicketContext(req.params.idOrNumber);
    if (!ctx) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    res.json(ctx);
  });

  app.post('/api/tickets/:idOrNumber/transition', (req, res) => {
    try {
      const result = store.transitionTicket({
        ticketId: req.params.idOrNumber,
        toState: req.body.to_state as TicketState,
        actorId: req.body.actor_id,
        via: req.body.via ?? 'ui',
        reason: req.body.reason,
        pendingReason: req.body.pending_reason as PendingReason | undefined,
        escalationTarget: req.body.escalation_target as EscalationTarget | undefined,
        workaroundDescription: req.body.workaround_description,
        resolutionCode: req.body.resolution_code as ResolutionCode | undefined,
        resolutionNotes: req.body.resolution_notes,
        outOfScopeJustification: req.body.out_of_scope_justification,
        outOfScopeRedirect: req.body.out_of_scope_redirect,
        closedIncompleteReason: req.body.closed_incomplete_reason,
        assignedTo: req.body.assigned_to,
        assignmentGroupId: req.body.assignment_group_id,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/tickets/:idOrNumber/assign', (req, res) => {
    const ticket = store.findTicketByIdOrNumber(req.params.idOrNumber);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    const { assigned_to, assignment_group_id, actor_id } = req.body;
    const snap = store.getSnapshot();
    const actor = snap.profiles.find((p) => p.id === actor_id);
    const tech = snap.profiles.find((p) => p.id === assigned_to);

    if (ticket.state === 'NEW' && assigned_to) {
      const result = store.transitionTicket({
        ticketId: ticket.id,
        toState: 'ASSIGNED',
        actorId: actor_id,
        via: 'ui',
        reason: `Assigned to ${tech?.full_name ?? 'Technician'}`,
        assignedTo: assigned_to,
        assignmentGroupId: assignment_group_id ?? ticket.assignment_group_id,
      });
      res.json(result);
      return;
    }

    ticket.assigned_to = assigned_to ?? ticket.assigned_to;
    ticket.assignment_group_id = assignment_group_id ?? ticket.assignment_group_id;
    ticket.updated_at = new Date().toISOString();
    snap.ticketActivities.unshift({
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      ticket_id: ticket.id,
      actor_id: actor_id ?? null,
      actor_name: actor?.full_name ?? 'Dispatcher',
      actor_type: 'user',
      activity_type: 'assignment',
      is_internal: true,
      body: `Reassigned to ${tech?.full_name ?? 'Unassigned'}.`,
      created_at: new Date().toISOString(),
    });
    store.persist();
    broadcastEvent('ticket_updated', { ticket });
    res.json({ ok: true, ticket });
  });

  app.post('/api/tickets/:idOrNumber/activity', (req, res) => {
    const ticket = store.findTicketByIdOrNumber(req.params.idOrNumber);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    const snap = store.getSnapshot();
    const actor = snap.profiles.find((p) => p.id === req.body.actor_id);
    const act = {
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      ticket_id: ticket.id,
      actor_id: req.body.actor_id ?? null,
      actor_name: actor?.full_name ?? 'User',
      actor_type: 'user' as const,
      activity_type: req.body.is_internal ? ('work_note' as const) : ('comment' as const),
      is_internal: Boolean(req.body.is_internal),
      body: String(req.body.body ?? '').trim(),
      created_at: new Date().toISOString(),
    };
    snap.ticketActivities.unshift(act);
    store.persist();
    broadcastEvent('activity_added', act);
    res.status(201).json(act);
  });

  app.post('/api/tickets/:idOrNumber/work-log', (req, res) => {
    const ticket = store.findTicketByIdOrNumber(req.params.idOrNumber);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    const snap = store.getSnapshot();
    const user = snap.profiles.find((p) => p.id === req.body.user_id);
    const entry = {
      id: `wl-${crypto.randomUUID().slice(0, 8)}`,
      ticket_id: ticket.id,
      user_id: req.body.user_id,
      user_name: user?.full_name ?? 'Technician',
      minutes_spent: Number(req.body.minutes_spent ?? 15),
      work_type: String(req.body.work_type ?? 'field_repair'),
      notes: String(req.body.notes ?? ''),
      logged_at: new Date().toISOString(),
    };
    snap.workLogs.unshift(entry);
    store.persist();
    res.status(201).json(entry);
  });

  app.post('/api/work-order-tasks/:taskId/toggle', (req, res) => {
    const snap = store.getSnapshot();
    const task = snap.workOrderTasks.find((t) => t.id === req.params.taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    task.is_completed = !task.is_completed;
    task.completed_by = task.is_completed ? req.body.actor_id ?? null : null;
    task.completed_at = task.is_completed ? new Date().toISOString() : null;
    store.persist();
    broadcastEvent('task_toggled', task);
    res.json(task);
  });

  // Catalog Requests
  app.post('/api/catalog-requests', (req, res) => {
    try {
      const snap = store.getSnapshot();
      const item = snap.catalogItems.find((c) => c.id === req.body.catalog_item_id);
      if (!item) {
        res.status(404).json({ error: 'Catalog item not found' });
        return;
      }
      const details = Object.entries(req.body.form_data ?? {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      const ticket = store.createTicket({
        title: `${item.name}${details ? ` (${details})` : ''}`,
        description: `${item.description}\nRequested details: ${details || 'Standard request'}`,
        type: 'SERVICE_REQUEST' as TicketType,
        category_id: item.category_id,
        site_id: req.body.site_id ?? 'site-blr-otp',
        requester_id: req.body.requester_id,
        impact: 'Medium',
        urgency: 'Medium',
        source: 'portal',
        auto_assign: !item.requires_approval,
      });

      if (item.requires_approval) {
        const sup = snap.profiles.find((p) => p.role === 'supervisor' && p.is_active);
        snap.approvals.unshift({
          id: `apr-${crypto.randomUUID().slice(0, 8)}`,
          ticket_id: ticket.id,
          request_type: 'catalog_request',
          reference_id: item.id,
          approver_id: sup?.id ?? null,
          requested_by: req.body.requester_id,
          status: 'Pending',
          comments: `Approval required for ${item.name} (${ticket.ticket_number})`,
          decided_at: null,
          created_at: new Date().toISOString(),
        });
        store.persist();
      }
      res.status(201).json({ ok: true, ticket });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Approvals
  app.post('/api/approvals/:id/decide', (req, res) => {
    const snap = store.getSnapshot();
    const apr = snap.approvals.find((a) => a.id === req.params.id);
    if (!apr) {
      res.status(404).json({ error: 'Approval not found' });
      return;
    }
    const decision = req.body.status as 'Approved' | 'Rejected';
    apr.status = decision;
    apr.decided_at = new Date().toISOString();
    if (req.body.comments) apr.comments = req.body.comments;

    if (apr.request_type === 'purchase_order' && apr.reference_id) {
      const po = snap.purchaseOrders.find((p) => p.id === apr.reference_id);
      if (po) {
        po.status = decision === 'Approved' ? 'Ordered' : 'Cancelled';
        po.approved_by = req.body.actor_id ?? null;
        po.updated_at = new Date().toISOString();
      }
    } else if (apr.request_type === 'catalog_request' && decision === 'Approved') {
      store.autoAssignTicket(apr.ticket_id);
    }

    store.persist();
    broadcastEvent('approval_decided', apr);
    res.json({ ok: true, approval: apr });
  });

  // Inventory & Purchase Orders
  app.get('/api/parts/availability', (req, res) => {
    const query = String(req.query.q ?? '');
    const siteId = req.query.siteId ? String(req.query.siteId) : null;
    res.json(store.checkPartAvailability(query, siteId));
  });

  app.post('/api/purchase-orders', (req, res) => {
    try {
      const result = store.createPurchaseOrderTx({
        ticketId: req.body.ticket_id,
        warehouseIdOrName: req.body.warehouse_id,
        partIdOrNumber: req.body.part_id,
        quantity: Number(req.body.quantity ?? 1),
        isUrgent: Boolean(req.body.is_urgent),
        requestedBy: req.body.requested_by,
        notes: req.body.notes,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/purchase-orders/:id/status', (req, res) => {
    const po = store.getSnapshot().purchaseOrders.find((p) => p.id === req.params.id);
    if (!po) {
      res.status(404).json({ error: 'Purchase order not found' });
      return;
    }
    po.status = req.body.status;
    po.updated_at = new Date().toISOString();
    if (po.status === 'Delivered') {
      const inv = store
        .getSnapshot()
        .inventory.find((i) => i.warehouse_id === po.warehouse_id && i.part_id === po.part_id);
      if (inv) {
        inv.quantity_reserved = Math.max(0, inv.quantity_reserved - po.quantity);
        inv.quantity_on_hand = Math.max(0, inv.quantity_on_hand - po.quantity);
      }
    }
    store.persist();
    broadcastEvent('po_updated', po);
    res.json(po);
  });

  // Knowledge Base
  app.get('/api/kb/search', (req, res) => {
    const q = String(req.query.q ?? '');
    const model = req.query.model ? String(req.query.model) : undefined;
    const hits = q.trim()
      ? store.hybridKbSearch(q, model, 12)
      : store.getSnapshot().kbDocuments.filter((d) => d.is_published);
    res.json({ results: hits });
  });

  app.post('/api/kb', (req, res) => {
    const snap = store.getSnapshot();
    const doc = {
      id: `kb-${crypto.randomUUID().slice(0, 8)}`,
      title: String(req.body.title ?? '').trim(),
      doc_type: req.body.doc_type ?? 'troubleshooting',
      category_id: req.body.category_id ?? null,
      equipment_model: req.body.equipment_model || null,
      hazard_level: req.body.hazard_level ?? 'none',
      safety_sop: req.body.safety_sop || null,
      content: String(req.body.content ?? '').trim(),
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      is_published: true,
      created_at: new Date().toISOString(),
    };
    snap.kbDocuments.unshift(doc);
    store.persist();
    res.status(201).json(doc);
  });

  // Notifications
  app.post('/api/notifications/mark-read', (req, res) => {
    const snap = store.getSnapshot();
    const { user_id, notification_id } = req.body;
    for (const n of snap.notifications) {
      if (notification_id && n.id === notification_id) n.is_read = true;
      else if (!notification_id && n.user_id === user_id) n.is_read = true;
    }
    store.persist();
    res.json({ ok: true });
  });

  // Voice Sessions & Confirmations & Gemini AI Copilot
  app.post('/api/sessions/start', (req, res) => {
    const snap = store.getSnapshot();
    const ticket = req.body.ticket_number ? store.findTicketByIdOrNumber(req.body.ticket_number) : undefined;
    const session = {
      id: `sess-${crypto.randomUUID().slice(0, 8)}`,
      user_id: req.body.user_id,
      ticket_id: ticket?.id ?? null,
      channel_name: ticket ? `fp-${ticket.ticket_number}` : `fp-global-${Date.now()}`,
      status: 'active' as const,
      started_at: new Date().toISOString(),
      ended_at: null,
      summary: null,
    };
    snap.sessions.unshift(session);
    store.persist();
    res.status(201).json(session);
  });

  app.post('/api/sessions/:id/end', (req, res) => {
    const snap = store.getSnapshot();
    const session = snap.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    session.status = 'ended';
    session.ended_at = new Date().toISOString();
    session.summary = req.body.summary ?? 'Copilot session completed.';

    const actualMins = Math.max(
      1,
      Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 6000) / 10
    );
    const toolsCount = snap.toolExecutions.filter(
      (te) => te.session_id === session.id && te.status === 'success'
    ).length;
    const baseline = 22;
    const metric = {
      id: `imp-${crypto.randomUUID().slice(0, 8)}`,
      session_id: session.id,
      ticket_id: session.ticket_id ?? null,
      baseline_minutes: baseline,
      actual_minutes: actualMins,
      time_saved_minutes: Math.max(0, Math.round((baseline - actualMins) * 10) / 10),
      actions_automated: toolsCount,
      manual_steps_avoided: toolsCount * 3,
      created_at: new Date().toISOString(),
    };
    snap.impactMetrics.unshift(metric);
    store.persist();
    res.json({ session, impact: metric });
  });

  app.post('/api/copilot/chat', async (req, res) => {
    try {
      const { session_id, actor_id, ticket_number, page_context, messages } = req.body;
      const snap = store.getSnapshot();
      const lastUser = [...(messages ?? [])].reverse().find((m) => m.role === 'user');
      if (lastUser && session_id) {
        snap.transcripts.push({
          id: `tr-${crypto.randomUUID().slice(0, 8)}`,
          session_id,
          ticket_id: ticket_number ? store.findTicketByIdOrNumber(ticket_number)?.id ?? null : null,
          speaker: 'user',
          text: lastUser.text,
          created_at: new Date().toISOString(),
        });
      }

      const result = await runCopilotChat({
        sessionId: session_id,
        actorId: actor_id,
        ticketNumber: ticket_number,
        pageContext: page_context,
        messages: messages ?? [],
      });

      if (session_id) {
        snap.transcripts.push({
          id: `tr-${crypto.randomUUID().slice(0, 8)}`,
          session_id,
          ticket_id: ticket_number ? store.findTicketByIdOrNumber(ticket_number)?.id ?? null : null,
          speaker: 'assistant',
          text: result.reply,
          created_at: new Date().toISOString(),
        });
        store.persist();
      }

      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/copilot/vision', async (req, res) => {
    try {
      const { image_base64, mime_type, prompt, ticket_number, session_id, actor_id } = req.body;
      if (!image_base64) {
        res.status(400).json({ error: 'image_base64 is required' });
        return;
      }
      const analysis = await analyzeEquipmentSnapshot({
        imageBase64: image_base64,
        mimeType: mime_type || 'image/jpeg',
        prompt,
        ticketNumber: ticket_number,
      });

      const snap = store.getSnapshot();
      const ticket = ticket_number ? store.findTicketByIdOrNumber(ticket_number) : undefined;
      if (ticket) {
        const actor = snap.profiles.find((p) => p.id === actor_id);
        snap.ticketActivities.unshift({
          id: `act-${crypto.randomUUID().slice(0, 8)}`,
          ticket_id: ticket.id,
          actor_id: actor_id ?? null,
          actor_name: actor ? `${actor.full_name} (Vision Inspection)` : 'FieldPilot Vision AI',
          actor_type: 'ai',
          activity_type: 'work_note',
          is_internal: true,
          body: analysis,
          created_at: new Date().toISOString(),
        });
      }
      if (session_id) {
        snap.toolExecutions.unshift({
          id: `te-${crypto.randomUUID().slice(0, 8)}`,
          session_id,
          ticket_id: ticket?.id ?? null,
          tool_name: 'vision_analyze',
          risk: 'read',
          input_args: { ticket_number, prompt: prompt || 'Equipment inspection' },
          output_result: { analysis_preview: analysis.slice(0, 140) },
          status: 'success',
          duration_ms: 900,
          executed_by: actor_id ?? null,
          created_at: new Date().toISOString(),
        });
      }
      store.persist();
      res.json({ ok: true, analysis });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/confirmations/:id/resolve', (req, res) => {
    try {
      const result = store.resolveConfirmation({
        confirmationId: req.params.id,
        decision: req.body.decision,
        via: req.body.via ?? 'click',
        actorId: req.body.actor_id,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Service Reports
  app.post('/api/reports/generate', async (req, res) => {
    try {
      const report = await generateServiceReportWithAI({
        ticketNumber: req.body.ticket_number,
        actorId: req.body.actor_id,
        sessionId: req.body.session_id,
      });
      res.status(201).json(report);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Expert Collaboration
  app.post('/api/expert-invites/:id/join', (req, res) => {
    const snap = store.getSnapshot();
    const inv = snap.expertInvites.find((i) => i.id === req.params.id || i.channel_name === req.params.id);
    if (!inv) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }
    inv.status = req.body.status ?? 'joined';
    store.persist();
    broadcastEvent('expert_updated', inv);
    res.json(inv);
  });

  // Admin & Automation Controls
  app.post('/api/admin/rules/:id/toggle', (req, res) => {
    const rule = store.getSnapshot().automationRules.find((r) => r.id === req.params.id);
    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    rule.is_active = !rule.is_active;
    store.persist();
    res.json(rule);
  });

  app.post('/api/admin/sla-tick', (_req, res) => {
    const result = store.slaTick();
    res.json(result);
  });

  app.post('/api/admin/reset-demo', (_req, res) => {
    const fresh = store.resetDemo();
    res.json({ ok: true, ticketsCount: fresh.tickets.length });
  });

  // Guarantee every /api/* route returns JSON instead of falling through to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api')) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
      return;
    }
    next(err);
  });

  // Start periodic SLA monitor (every 60s)
  setInterval(() => {
    store.slaTick();
  }, 60000);

  // Vite or production static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FieldPilot Service Hub running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
