import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  ConfirmationRequest,
  EscalationTarget,
  KbDocument,
  OrderStatus,
  PendingReason,
  PriorityLevel,
  PurchaseOrder,
  ResolutionCode,
  RiskLevel,
  ServiceReport,
  StoreSnapshot,
  Ticket,
  TicketState,
  TicketType,
  UserRole,
} from '../types/domain';
import { createInitialSeed } from './seedData';

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'fieldpilot-store.json');

const ALLOWED_TRANSITIONS: Record<TicketState, TicketState[]> = {
  NEW: ['ASSIGNED', 'OUT_OF_SCOPE', 'CANCELLED', 'ESCALATED'],
  ASSIGNED: ['WORK_IN_PROGRESS', 'PENDING', 'ESCALATED', 'OUT_OF_SCOPE', 'CANCELLED'],
  WORK_IN_PROGRESS: ['PENDING', 'ESCALATED', 'WORKAROUND_PROVIDED', 'RESOLVED', 'OUT_OF_SCOPE'],
  PENDING: ['WORK_IN_PROGRESS', 'ESCALATED', 'CLOSED_INCOMPLETE', 'CANCELLED'],
  ESCALATED: ['ASSIGNED', 'WORK_IN_PROGRESS', 'WORKAROUND_PROVIDED', 'RESOLVED', 'PENDING'],
  WORKAROUND_PROVIDED: ['WORK_IN_PROGRESS', 'RESOLVED', 'CLOSED_INCOMPLETE'],
  RESOLVED: ['CLOSED_COMPLETE', 'CLOSED_INCOMPLETE', 'WORK_IN_PROGRESS'],
  CLOSED_COMPLETE: ['WORK_IN_PROGRESS'],
  CLOSED_INCOMPLETE: ['WORK_IN_PROGRESS'],
  OUT_OF_SCOPE: ['WORK_IN_PROGRESS'],
  CANCELLED: ['WORK_IN_PROGRESS'],
};

type SseListener = (event: { type: string; payload: unknown }) => void;
const listeners = new Set<SseListener>();

export function subscribeEvents(fn: SseListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function broadcastEvent(type: string, payload: unknown): void {
  for (const fn of listeners) {
    try {
      fn({ type, payload });
    } catch {
      // ignore disconnected client
    }
  }
}

class FieldPilotStore {
  private data: StoreSnapshot;

  constructor() {
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): StoreSnapshot {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        const parsed = JSON.parse(raw) as StoreSnapshot;
        if (parsed && Array.isArray(parsed.tickets) && parsed.tickets.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback to fresh seed
    }
    const seed = createInitialSeed();
    this.saveToDisk(seed);
    return seed;
  }

  private saveToDisk(snapshot: StoreSnapshot = this.data): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to persist store:', err);
    }
  }

  public getSnapshot(): StoreSnapshot {
    return this.data;
  }

  public resetDemo(): StoreSnapshot {
    this.data = createInitialSeed();
    this.saveToDisk();
    broadcastEvent('store_reset', { timestamp: new Date().toISOString() });
    return this.data;
  }

  public findTicketByIdOrNumber(idOrNumber: string): Ticket | undefined {
    return this.data.tickets.find(
      (t) =>
        t.id === idOrNumber ||
        t.ticket_number.toLowerCase() === idOrNumber.trim().toLowerCase()
    );
  }

  public calcPriority(impact: Ticket['impact'], urgency: Ticket['urgency']): PriorityLevel {
    if (impact === 'High' && urgency === 'High') return 'P1';
    if ((impact === 'High' && urgency === 'Medium') || (impact === 'Medium' && urgency === 'High')) return 'P2';
    if (impact === 'Low' && urgency === 'Low') return 'P4';
    return 'P3';
  }

  public createTicket(input: {
    title: string;
    description: string;
    type?: TicketType;
    category_id?: string | null;
    site_id?: string | null;
    equipment_id?: string | null;
    requester_id: string;
    impact?: Ticket['impact'];
    urgency?: Ticket['urgency'];
    source?: Ticket['source'];
    auto_assign?: boolean;
  }): Ticket {
    const type: TicketType = input.type ?? 'INCIDENT';
    const prefix = type === 'INCIDENT' ? 'INC' : type === 'SERVICE_REQUEST' ? 'REQ' : 'WO';
    const existingNums = this.data.tickets
      .filter((t) => t.ticket_number.startsWith(prefix))
      .map((t) => parseInt(t.ticket_number.replace(/\D/g, ''), 10) || 10000);
    const nextNum = (existingNums.length ? Math.max(...existingNums) : 10000) + 1;
    const ticket_number = `${prefix}${String(nextNum).padStart(7, '0')}`;

    const cat = this.data.categories.find((c) => c.id === input.category_id);
    const impact = input.impact ?? cat?.default_impact ?? 'Medium';
    const urgency = input.urgency ?? cat?.default_urgency ?? 'Medium';
    const priority = this.calcPriority(impact, urgency);
    const now = new Date().toISOString();

    const ticket: Ticket = {
      id: `tkt-${crypto.randomUUID().slice(0, 8)}`,
      ticket_number,
      type,
      state: 'NEW',
      title: input.title.trim(),
      description: input.description.trim(),
      category_id: input.category_id ?? cat?.id ?? 'cat-fac',
      site_id: input.site_id ?? 'site-blr-otp',
      equipment_id: input.equipment_id ?? null,
      requester_id: input.requester_id,
      assigned_to: null,
      assignment_group_id: cat?.default_group_id ?? 'grp-desk',
      impact,
      urgency,
      priority,
      reopen_count: 0,
      source: input.source ?? 'portal',
      sla_paused: false,
      created_at: now,
      updated_at: now,
    };

    this.data.tickets.unshift(ticket);

    const def = this.data.slaDefinitions.find((d) => d.priority === priority) ?? this.data.slaDefinitions[2];
    const startMs = Date.now();
    this.data.slaInstances.unshift({
      id: `sla-${ticket.id}`,
      ticket_id: ticket.id,
      sla_definition_id: def.id,
      started_at: now,
      response_due_at: new Date(startMs + def.response_minutes * 60000).toISOString(),
      resolution_due_at: new Date(startMs + def.resolution_minutes * 60000).toISOString(),
      first_responded_at: null,
      paused_at: null,
      total_paused_seconds: 0,
      elapsed_pct: 0,
      status: 'active',
    });

    if (type === 'WORK_ORDER') {
      this.data.workOrderTasks.push(
        {
          id: `wot-${crypto.randomUUID().slice(0, 8)}`,
          ticket_id: ticket.id,
          step_order: 1,
          title: 'Verify Lockout-Tagout (LOTO) & Zero-Energy State',
          is_safety_step: true,
          is_completed: false,
        },
        {
          id: `wot-${crypto.randomUUID().slice(0, 8)}`,
          ticket_id: ticket.id,
          step_order: 2,
          title: 'Inspect asset assembly and execute diagnostic test',
          is_safety_step: false,
          is_completed: false,
        }
      );
    }

    const req = this.data.profiles.find((p) => p.id === input.requester_id);
    this.data.ticketActivities.unshift({
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      ticket_id: ticket.id,
      actor_id: input.requester_id,
      actor_name: req?.full_name ?? 'Requester',
      actor_type: input.source === 'voice' ? 'ai' : 'user',
      activity_type: 'state_change',
      is_internal: false,
      body: `Ticket ${ticket.ticket_number} created (${priority}) via ${ticket.source}.`,
      created_at: now,
    });

    if (input.auto_assign !== false) {
      this.autoAssignTicket(ticket.id);
    }

    this.saveToDisk();
    broadcastEvent('ticket_created', ticket);
    return this.findTicketByIdOrNumber(ticket.id)!;
  }

  public autoAssignTicket(ticketId: string): { assigned: boolean; assigned_to?: string } {
    const ticket = this.data.tickets.find((t) => t.id === ticketId);
    if (!ticket) return { assigned: false };
    const cat = this.data.categories.find((c) => c.id === ticket.category_id);
    const groupId = ticket.assignment_group_id ?? cat?.default_group_id ?? 'grp-desk';
    const group = this.data.assignmentGroups.find((g) => g.id === groupId);

    const candidates = this.data.profiles.filter(
      (p) =>
        p.is_active &&
        (p.role === 'technician' || p.role === 'dispatcher') &&
        (!group || group.member_ids.includes(p.id))
    );

    if (candidates.length === 0) return { assigned: false };

    candidates.sort((a, b) => {
      const siteA = a.site_id === ticket.site_id ? 0 : 1;
      const siteB = b.site_id === ticket.site_id ? 0 : 1;
      if (siteA !== siteB) return siteA - siteB;
      const loadA = this.data.tickets.filter(
        (t) => t.assigned_to === a.id && ['ASSIGNED', 'WORK_IN_PROGRESS', 'ESCALATED'].includes(t.state)
      ).length;
      const loadB = this.data.tickets.filter(
        (t) => t.assigned_to === b.id && ['ASSIGNED', 'WORK_IN_PROGRESS', 'ESCALATED'].includes(t.state)
      ).length;
      return loadA - loadB;
    });

    const chosen = candidates[0];
    if (ticket.state === 'NEW') {
      this.transitionTicket({
        ticketId: ticket.id,
        toState: 'ASSIGNED',
        via: 'automation',
        reason: `Auto-assigned to ${chosen.full_name}`,
        assignedTo: chosen.id,
        assignmentGroupId: groupId,
      });
    } else {
      ticket.assigned_to = chosen.id;
      ticket.assignment_group_id = groupId;
      ticket.updated_at = new Date().toISOString();
    }

    this.data.notifications.unshift({
      id: `ntf-${crypto.randomUUID().slice(0, 8)}`,
      user_id: chosen.id,
      ticket_id: ticket.id,
      title: `Assigned: ${ticket.ticket_number}`,
      body: ticket.title,
      level: ticket.priority === 'P1' ? 'critical' : 'info',
      category: 'assignment',
      is_read: false,
      action_url: `/tickets/${ticket.ticket_number}`,
      created_at: new Date().toISOString(),
    });

    const rule = this.data.automationRules.find((r) => r.id === 'rule-1');
    if (rule) rule.executions_count += 1;

    this.saveToDisk();
    return { assigned: true, assigned_to: chosen.id };
  }

  public transitionTicket(params: {
    ticketId: string;
    toState: TicketState;
    actorId?: string | null;
    via?: 'ui' | 'voice' | 'automation';
    reason?: string | null;
    pendingReason?: PendingReason | null;
    escalationTarget?: EscalationTarget | null;
    workaroundDescription?: string | null;
    resolutionCode?: ResolutionCode | null;
    resolutionNotes?: string | null;
    outOfScopeJustification?: string | null;
    outOfScopeRedirect?: string | null;
    closedIncompleteReason?: string | null;
    assignedTo?: string | null;
    assignmentGroupId?: string | null;
  }): { ok: boolean; ticket: Ticket; message: string } {
    const ticket = this.findTicketByIdOrNumber(params.ticketId);
    if (!ticket) throw new Error(`Ticket ${params.ticketId} not found`);

    const fromState = ticket.state;
    const toState = params.toState;
    if (fromState === toState) {
      return { ok: true, ticket, message: `Ticket is already in ${toState}` };
    }

    const allowed = ALLOWED_TRANSITIONS[fromState] ?? [];
    if (!allowed.includes(toState)) {
      throw new Error(`Transition from ${fromState} to ${toState} is not permitted.`);
    }

    const actor = params.actorId ? this.data.profiles.find((p) => p.id === params.actorId) : undefined;
    const via = params.via ?? 'ui';

    const isReopen =
      ['RESOLVED', 'CLOSED_COMPLETE', 'CLOSED_INCOMPLETE', 'OUT_OF_SCOPE', 'CANCELLED'].includes(fromState) &&
      toState === 'WORK_IN_PROGRESS';

    if (isReopen) {
      if (!params.reason?.trim()) throw new Error('A reopen reason is mandatory.');
      if (fromState !== 'RESOLVED' && actor && !['supervisor', 'admin'].includes(actor.role)) {
        throw new Error(`Only supervisors or admins can reopen a ticket from ${fromState}.`);
      }
    }

    if (actor?.role === 'requester') {
      if (!(ticket.requester_id === actor.id && fromState === 'RESOLVED' && (toState === 'CLOSED_COMPLETE' || toState === 'WORK_IN_PROGRESS'))) {
        throw new Error('Requesters can only confirm closure or reopen their own resolved tickets.');
      }
    }

    if (toState === 'PENDING' && !params.pendingReason) {
      throw new Error('Pending reason is mandatory when moving to PENDING.');
    }
    if (toState === 'ESCALATED') {
      if (!params.reason?.trim()) throw new Error('Escalation reason is mandatory.');
      if (!params.escalationTarget) throw new Error('Escalation target is mandatory.');
    }
    if (toState === 'WORKAROUND_PROVIDED' && !params.workaroundDescription?.trim()) {
      throw new Error('Workaround description is mandatory.');
    }
    if (toState === 'RESOLVED') {
      if (!params.resolutionCode) throw new Error('Resolution code is mandatory.');
      if (!params.resolutionNotes?.trim()) throw new Error('Resolution notes are mandatory.');
    }
    if (toState === 'CLOSED_INCOMPLETE' && !params.closedIncompleteReason?.trim()) {
      throw new Error('Closed incomplete reason is mandatory.');
    }
    if (toState === 'OUT_OF_SCOPE' && !params.outOfScopeJustification?.trim()) {
      throw new Error('Out of scope justification is mandatory.');
    }
    if (toState === 'CANCELLED' && !params.reason?.trim()) {
      throw new Error('Cancellation reason is mandatory.');
    }

    const prevPriority = ticket.priority;
    let nextPriority = ticket.priority;
    if (toState === 'ESCALATED') {
      nextPriority = ticket.priority === 'P4' ? 'P3' : ticket.priority === 'P3' ? 'P2' : 'P1';
    }

    const now = new Date().toISOString();
    ticket.state = toState;
    ticket.priority = nextPriority;
    if (params.assignedTo) ticket.assigned_to = params.assignedTo;
    if (params.assignmentGroupId) ticket.assignment_group_id = params.assignmentGroupId;
    ticket.pending_reason = toState === 'PENDING' ? params.pendingReason! : null;
    if (toState === 'ESCALATED') ticket.escalation_target = params.escalationTarget!;
    if (params.workaroundDescription) ticket.workaround_description = params.workaroundDescription;
    if (isReopen) {
      ticket.resolution_code = null;
      ticket.resolution_notes = null;
      ticket.resolved_at = null;
      ticket.closed_at = null;
      ticket.reopen_count += 1;
      ticket.last_reopen_reason = params.reason ?? 'Reopened';
    } else {
      if (params.resolutionCode) ticket.resolution_code = params.resolutionCode;
      if (params.resolutionNotes) ticket.resolution_notes = params.resolutionNotes;
      if (toState === 'RESOLVED') ticket.resolved_at = now;
      if (['CLOSED_COMPLETE', 'CLOSED_INCOMPLETE', 'OUT_OF_SCOPE', 'CANCELLED'].includes(toState)) {
        ticket.closed_at = now;
      }
    }
    if (params.outOfScopeJustification) ticket.out_of_scope_justification = params.outOfScopeJustification;
    if (params.outOfScopeRedirect) ticket.out_of_scope_redirect = params.outOfScopeRedirect;
    if (params.closedIncompleteReason) ticket.closed_incomplete_reason = params.closedIncompleteReason;
    ticket.sla_paused = toState === 'PENDING';
    ticket.updated_at = now;

    // Update SLA Instance
    const sla = this.data.slaInstances.find((s) => s.ticket_id === ticket.id);
    if (sla) {
      if (!sla.first_responded_at && (toState === 'ASSIGNED' || toState === 'WORK_IN_PROGRESS')) {
        sla.first_responded_at = now;
      }
      if (toState === 'PENDING' && sla.status === 'active') {
        sla.status = 'paused';
        sla.paused_at = now;
      } else if (fromState === 'PENDING' && toState !== 'PENDING' && sla.paused_at) {
        const pausedDelta = Math.max(0, Math.floor((Date.now() - new Date(sla.paused_at).getTime()) / 1000));
        sla.total_paused_seconds += pausedDelta;
        sla.paused_at = null;
        sla.resolution_due_at = new Date(new Date(sla.resolution_due_at).getTime() + pausedDelta * 1000).toISOString();
        sla.status = ['RESOLVED', 'CLOSED_COMPLETE', 'CLOSED_INCOMPLETE', 'OUT_OF_SCOPE', 'CANCELLED'].includes(toState)
          ? 'met'
          : 'active';
      } else if (['RESOLVED', 'CLOSED_COMPLETE', 'CLOSED_INCOMPLETE', 'OUT_OF_SCOPE', 'CANCELLED'].includes(toState)) {
        if (sla.status !== 'breached') sla.status = 'met';
        sla.paused_at = null;
      } else if (isReopen) {
        sla.status = 'active';
        sla.paused_at = null;
      }
    }

    // Side effects
    if (toState === 'ESCALATED') {
      this.data.escalations.unshift({
        id: `esc-${crypto.randomUUID().slice(0, 8)}`,
        ticket_id: ticket.id,
        escalated_by: actor?.id ?? null,
        target: params.escalationTarget!,
        reason: params.reason!,
        previous_priority: prevPriority,
        new_priority: nextPriority,
        status: 'open',
        created_at: now,
      });
    }

    if (toState === 'WORKAROUND_PROVIDED') {
      this.data.followups.unshift({
        id: `fup-${crypto.randomUUID().slice(0, 8)}`,
        ticket_id: ticket.id,
        equipment_id: ticket.equipment_id ?? null,
        title: `Permanent fix for ${ticket.ticket_number}`,
        description: `Workaround active: ${params.workaroundDescription}`,
        followup_type: 'permanent_fix',
        scheduled_for: hoursFromNow(48),
        assigned_to: ticket.assigned_to ?? null,
        status: 'scheduled',
        created_at: now,
      });
    }

    const detailSuffix =
      toState === 'PENDING'
        ? ` (${params.pendingReason})`
        : toState === 'ESCALATED'
        ? ` to ${params.escalationTarget}: ${params.reason}`
        : toState === 'RESOLVED'
        ? ` [${params.resolutionCode}]: ${params.resolutionNotes}`
        : toState === 'WORKAROUND_PROVIDED'
        ? `: ${params.workaroundDescription}`
        : params.reason
        ? `: ${params.reason}`
        : '';

    const message = `State changed from ${fromState} to ${toState}${detailSuffix}`;

    this.data.stateHistory.unshift({
      id: `sh-${crypto.randomUUID().slice(0, 8)}`,
      ticket_id: ticket.id,
      from_state: fromState,
      to_state: toState,
      reason:
        params.pendingReason ??
        params.reason ??
        params.closedIncompleteReason ??
        params.outOfScopeJustification ??
        params.resolutionNotes ??
        null,
      via,
      changed_by: actor?.id ?? null,
      actor_name: actor?.full_name ?? 'Automation',
      created_at: now,
    });

    this.data.ticketActivities.unshift({
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      ticket_id: ticket.id,
      actor_id: actor?.id ?? null,
      actor_name: actor?.full_name ?? 'Automation',
      actor_type: via === 'voice' ? 'ai' : via === 'automation' ? 'system' : 'user',
      activity_type: 'state_change',
      is_internal: false,
      body: message,
      metadata: { from_state: fromState, to_state: toState, via },
      created_at: now,
    });

    if (ticket.requester_id && ticket.requester_id !== actor?.id) {
      this.data.notifications.unshift({
        id: `ntf-${crypto.randomUUID().slice(0, 8)}`,
        user_id: ticket.requester_id,
        ticket_id: ticket.id,
        title: `${ticket.ticket_number} → ${toState.replace(/_/g, ' ')}`,
        body: message,
        level: toState === 'RESOLVED' ? 'success' : toState === 'ESCALATED' ? 'warning' : 'info',
        category: 'ticket',
        is_read: false,
        action_url: `/tickets/${ticket.ticket_number}`,
        created_at: now,
      });
    }

    this.data.auditLog.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      actor_id: actor?.id ?? null,
      actor_name: actor?.full_name ?? 'Automation',
      actor_role: actor?.role ?? null,
      action: 'transition_ticket',
      table_name: 'tickets',
      record_id: ticket.id,
      details: `${ticket.ticket_number}: ${fromState} -> ${toState}`,
      via,
      created_at: now,
    });

    this.saveToDisk();
    broadcastEvent('ticket_updated', { ticket, message });
    return { ok: true, ticket, message };
  }

  public getTicketContext(idOrNumber: string) {
    const ticket = this.findTicketByIdOrNumber(idOrNumber);
    if (!ticket) return null;
    const site = this.data.sites.find((s) => s.id === ticket.site_id) ?? null;
    const category = this.data.categories.find((c) => c.id === ticket.category_id) ?? null;
    const requester = this.data.profiles.find((p) => p.id === ticket.requester_id) ?? null;
    const assignee = this.data.profiles.find((p) => p.id === ticket.assigned_to) ?? null;
    const group = this.data.assignmentGroups.find((g) => g.id === ticket.assignment_group_id) ?? null;
    const equipment = this.data.equipment.find((e) => e.id === ticket.equipment_id) ?? null;
    const equipment_history = equipment
      ? this.data.equipmentHistory.filter((h) => h.equipment_id === equipment.id)
      : [];
    const similar_past_incidents = equipment
      ? this.data.tickets.filter((t) => t.equipment_id === equipment.id && t.id !== ticket.id).slice(0, 5)
      : [];
    const sla = this.data.slaInstances.find((s) => s.ticket_id === ticket.id) ?? null;
    const slaDef = sla ? this.data.slaDefinitions.find((d) => d.id === sla.sla_definition_id) ?? null : null;
    const purchase_orders = this.data.purchaseOrders.filter((po) => po.ticket_id === ticket.id);
    const work_order_tasks = this.data.workOrderTasks
      .filter((w) => w.ticket_id === ticket.id)
      .sort((a, b) => a.step_order - b.step_order);

    return {
      ticket,
      site,
      category,
      requester,
      assignee,
      group,
      equipment,
      equipment_history,
      similar_past_incidents,
      sla,
      sla_definition: slaDef,
      purchase_orders,
      work_order_tasks,
    };
  }

  public hybridKbSearch(query: string, equipmentModel?: string, limit = 5): Array<KbDocument & { score: number }> {
    const qTokens = query
      .toLowerCase()
      .split(/[^a-z0-9-]+/)
      .filter((t) => t.length > 1);

    const scored = this.data.kbDocuments
      .filter((d) => d.is_published)
      .map((doc) => {
        const hay = `${doc.title} ${doc.safety_sop ?? ''} ${doc.content} ${doc.tags.join(' ')} ${doc.equipment_model ?? ''}`.toLowerCase();
        let score = 0;
        for (const tok of qTokens) {
          if (doc.title.toLowerCase().includes(tok)) score += 3.2;
          if (doc.tags.some((t) => t.toLowerCase().includes(tok))) score += 2.5;
          if (hay.includes(tok)) score += 1.4;
        }
        if (equipmentModel && doc.equipment_model && doc.equipment_model.toLowerCase().includes(equipmentModel.toLowerCase())) {
          score += 4.5;
        }
        if (doc.doc_type === 'sop' && (doc.hazard_level === 'high_pressure' || doc.hazard_level === 'electrical' || doc.hazard_level === 'refrigerant')) {
          score += 1.2;
        }
        return { ...doc, score };
      })
      .filter((d) => d.score > 0)
      .sort((a, b) => {
        const aHazard = a.hazard_level !== 'none' && a.hazard_level !== 'caution' ? 1 : 0;
        const bHazard = b.hazard_level !== 'none' && b.hazard_level !== 'caution' ? 1 : 0;
        if (aHazard !== bHazard && Math.abs(a.score - b.score) < 2) return bHazard - aHazard;
        return b.score - a.score;
      });

    return scored.slice(0, limit);
  }

  public checkPartAvailability(partQuery: string, siteId?: string | null) {
    const q = partQuery.trim().toLowerCase();
    const matchedParts = this.data.parts.filter(
      (p) =>
        p.part_number.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );

    const matches = matchedParts.slice(0, 5).map((part) => {
      const alt = part.alternate_part_id
        ? this.data.parts.find((p) => p.id === part.alternate_part_id) ?? null
        : null;

      const stock_by_warehouse = this.data.warehouses
        .map((w) => {
          const inv = this.data.inventory.find((i) => i.warehouse_id === w.id && i.part_id === part.id);
          const onHand = inv?.quantity_on_hand ?? 0;
          const reserved = inv?.quantity_reserved ?? 0;
          return {
            warehouse_id: w.id,
            warehouse_name: w.name,
            warehouse_code: w.code,
            city: w.city,
            is_local_site: Boolean(siteId && w.site_id === siteId),
            is_regional: w.is_regional,
            lead_time_hours: w.lead_time_hours,
            quantity_on_hand: onHand,
            quantity_reserved: reserved,
            available: Math.max(0, onHand - reserved),
          };
        })
        .sort((a, b) => {
          if (a.is_local_site !== b.is_local_site) return a.is_local_site ? -1 : 1;
          return a.lead_time_hours - b.lead_time_hours;
        });

      const alternate_stock = alt
        ? this.data.warehouses
            .map((w) => {
              const inv = this.data.inventory.find((i) => i.warehouse_id === w.id && i.part_id === alt.id);
              const avail = Math.max(0, (inv?.quantity_on_hand ?? 0) - (inv?.quantity_reserved ?? 0));
              return {
                warehouse_id: w.id,
                warehouse_name: w.name,
                lead_time_hours: w.lead_time_hours,
                available: avail,
              };
            })
            .filter((s) => s.available > 0)
        : [];

      return {
        part_id: part.id,
        part_number: part.part_number,
        part_name: part.name,
        category: part.category,
        unit_cost: part.unit_cost,
        alternate_part_id: alt?.id ?? null,
        alternate_part_number: alt?.part_number ?? null,
        alternate_part_name: alt?.name ?? null,
        stock_by_warehouse,
        alternate_stock,
      };
    });

    return { query: partQuery, matches };
  }

  public createPurchaseOrderTx(params: {
    ticketId?: string | null;
    warehouseIdOrName: string;
    partIdOrNumber: string;
    quantity: number;
    isUrgent: boolean;
    requestedBy: string;
    idempotencyKey?: string;
    notes?: string;
  }) {
    if (params.idempotencyKey) {
      const existing = this.data.purchaseOrders.find((po) => po.idempotency_key === params.idempotencyKey);
      if (existing) return { ok: true, idempotent_replay: true, purchase_order: existing };
    }

    const wh = this.data.warehouses.find(
      (w) =>
        w.id === params.warehouseIdOrName ||
        w.code.toLowerCase() === params.warehouseIdOrName.toLowerCase() ||
        w.name.toLowerCase().includes(params.warehouseIdOrName.toLowerCase())
    );
    const part = this.data.parts.find(
      (p) =>
        p.id === params.partIdOrNumber ||
        p.part_number.toLowerCase() === params.partIdOrNumber.toLowerCase() ||
        p.name.toLowerCase().includes(params.partIdOrNumber.toLowerCase())
    );

    if (!wh || !part) {
      throw new Error('Warehouse or spare part not found.');
    }

    const inv = this.data.inventory.find((i) => i.warehouse_id === wh.id && i.part_id === part.id);
    const available = inv ? inv.quantity_on_hand - inv.quantity_reserved : 0;
    if (!inv || available < params.quantity) {
      throw new Error(`OUT_OF_STOCK: Only ${available} available for ${part.part_number} at ${wh.name}.`);
    }

    inv.quantity_reserved += params.quantity;
    inv.updated_at = new Date().toISOString();

    const maxPoNum = Math.max(
      1000,
      ...this.data.purchaseOrders.map((po) => parseInt(po.po_number.replace(/\D/g, ''), 10) || 1000)
    );
    const poNumber = `PO-${String(maxPoNum + 1).padStart(5, '0')}`;
    const needsApproval = part.unit_cost * params.quantity >= 15000;
    const status: OrderStatus = needsApproval ? 'Pending Approval' : 'Ordered';
    const leadHrs = Math.max(1, params.isUrgent ? Math.min(wh.lead_time_hours, 12) : wh.lead_time_hours);
    const now = new Date().toISOString();

    const po: PurchaseOrder = {
      id: `po-${crypto.randomUUID().slice(0, 8)}`,
      po_number: poNumber,
      ticket_id: params.ticketId ?? null,
      warehouse_id: wh.id,
      part_id: part.id,
      quantity: params.quantity,
      is_urgent: params.isUrgent,
      status,
      requested_by: params.requestedBy,
      idempotency_key: params.idempotencyKey ?? null,
      notes: params.notes ?? `${params.isUrgent ? 'Urgent' : 'Standard'} dispatch from ${wh.name}`,
      expected_delivery_at: hoursFromNow(leadHrs),
      created_at: now,
      updated_at: now,
    };

    this.data.purchaseOrders.unshift(po);

    if (needsApproval && params.ticketId) {
      const sup = this.data.profiles.find((p) => p.role === 'supervisor' && p.is_active);
      this.data.approvals.unshift({
        id: `apr-${crypto.randomUUID().slice(0, 8)}`,
        ticket_id: params.ticketId,
        request_type: 'purchase_order',
        reference_id: po.id,
        approver_id: sup?.id ?? null,
        requested_by: params.requestedBy,
        status: 'Pending',
        comments: `Urgent PO ${po.po_number} for ${part.part_number} x${params.quantity} (${wh.name})`,
        decided_at: null,
        created_at: now,
      });
    }

    if (params.ticketId) {
      this.data.ticketActivities.unshift({
        id: `act-${crypto.randomUUID().slice(0, 8)}`,
        ticket_id: params.ticketId,
        actor_id: params.requestedBy,
        actor_name: 'FieldPilot Copilot',
        actor_type: 'ai',
        activity_type: 'tool_execution',
        is_internal: false,
        body: `Purchase Order ${po.po_number} created for ${part.name} (${part.part_number}) x${params.quantity} from ${wh.name}. Status: ${po.status}.`,
        metadata: { po_number: po.po_number, status: po.status, urgent: params.isUrgent },
        created_at: now,
      });
    }

    this.saveToDisk();
    broadcastEvent('po_created', po);
    return {
      ok: true,
      idempotent_replay: false,
      purchase_order: po,
      part_number: part.part_number,
      part_name: part.name,
      warehouse_name: wh.name,
    };
  }

  public createConfirmation(params: {
    sessionId?: string | null;
    ticketId?: string | null;
    toolName: string;
    risk?: RiskLevel;
    args: Record<string, unknown>;
    summaryText: string;
  }): ConfirmationRequest {
    const now = new Date();
    const conf: ConfirmationRequest = {
      id: `cnf-${crypto.randomUUID().slice(0, 8)}`,
      session_id: params.sessionId ?? null,
      ticket_id: params.ticketId ?? null,
      tool_name: params.toolName,
      risk: params.risk ?? 'critical',
      args: params.args,
      summary_text: params.summaryText,
      idempotency_key: `idem-${crypto.randomUUID().slice(0, 12)}`,
      status: 'pending',
      expires_at: new Date(now.getTime() + 90 * 1000).toISOString(),
      created_at: now.toISOString(),
    };
    this.data.confirmations.unshift(conf);
    this.saveToDisk();
    broadcastEvent('confirmation_created', conf);
    return conf;
  }

  public resolveConfirmation(params: {
    confirmationId: string;
    decision: 'confirmed' | 'cancelled';
    via: 'voice' | 'click';
    actorId: string;
  }) {
    const conf = this.data.confirmations.find((c) => c.id === params.confirmationId);
    if (!conf) throw new Error('Confirmation request not found.');
    if (conf.status !== 'pending') {
      return { confirmation: conf, executed: null, already_resolved: true };
    }
    if (new Date(conf.expires_at).getTime() < Date.now()) {
      conf.status = 'expired';
      conf.resolved_via = 'timeout';
      conf.resolved_at = new Date().toISOString();
      this.saveToDisk();
      return { confirmation: conf, executed: null, expired: true };
    }

    conf.status = params.decision;
    conf.resolved_via = params.via;
    conf.resolved_by = params.actorId;
    conf.resolved_at = new Date().toISOString();

    let executed: unknown = null;

    if (params.decision === 'confirmed') {
      if (conf.tool_name === 'create_purchase_order') {
        const a = conf.args as {
          ticket_id?: string;
          warehouse?: string;
          part_number?: string;
          quantity?: number;
          is_urgent?: boolean;
          notes?: string;
        };
        executed = this.createPurchaseOrderTx({
          ticketId: a.ticket_id ?? conf.ticket_id,
          warehouseIdOrName: a.warehouse ?? 'Bengaluru Regional Hub',
          partIdOrNumber: a.part_number ?? 'CFM-30XA-480V',
          quantity: Number(a.quantity ?? 1),
          isUrgent: Boolean(a.is_urgent ?? true),
          requestedBy: params.actorId,
          idempotencyKey: conf.idempotency_key,
          notes: a.notes,
        });

        // Optionally move ticket to PENDING awaiting part if currently WIP/ASSIGNED
        const t = conf.ticket_id ? this.findTicketByIdOrNumber(conf.ticket_id) : undefined;
        if (t && (t.state === 'ASSIGNED' || t.state === 'WORK_IN_PROGRESS')) {
          this.transitionTicket({
            ticketId: t.id,
            toState: 'PENDING',
            actorId: params.actorId,
            via: params.via === 'voice' ? 'voice' : 'ui',
            pendingReason: 'Awaiting Part',
            reason: `Awaiting delivery for ${a.part_number ?? 'ordered part'}`,
          });
        }
      } else if (conf.tool_name === 'transition_ticket_state') {
        const a = conf.args as {
          ticket_id?: string;
          to_state: TicketState;
          reason?: string;
          pending_reason?: PendingReason;
          escalation_target?: EscalationTarget;
          workaround_description?: string;
          resolution_code?: ResolutionCode;
          resolution_notes?: string;
          out_of_scope_justification?: string;
          closed_incomplete_reason?: string;
        };
        executed = this.transitionTicket({
          ticketId: a.ticket_id ?? conf.ticket_id ?? '',
          toState: a.to_state,
          actorId: params.actorId,
          via: params.via === 'voice' ? 'voice' : 'ui',
          reason: a.reason,
          pendingReason: a.pending_reason,
          escalationTarget: a.escalation_target,
          workaroundDescription: a.workaround_description,
          resolutionCode: a.resolution_code,
          resolutionNotes: a.resolution_notes,
          outOfScopeJustification: a.out_of_scope_justification,
          closedIncompleteReason: a.closed_incomplete_reason,
        });
      }

      this.data.toolExecutions.unshift({
        id: `te-${crypto.randomUUID().slice(0, 8)}`,
        session_id: conf.session_id,
        ticket_id: conf.ticket_id,
        tool_name: conf.tool_name,
        risk: conf.risk,
        input_args: conf.args,
        output_result: executed,
        status: 'success',
        duration_ms: 85,
        executed_by: params.actorId,
        created_at: new Date().toISOString(),
      });
    } else {
      this.data.toolExecutions.unshift({
        id: `te-${crypto.randomUUID().slice(0, 8)}`,
        session_id: conf.session_id,
        ticket_id: conf.ticket_id,
        tool_name: conf.tool_name,
        risk: conf.risk,
        input_args: conf.args,
        output_result: { cancelled: true },
        status: 'cancelled',
        duration_ms: 12,
        executed_by: params.actorId,
        created_at: new Date().toISOString(),
      });
    }

    this.saveToDisk();
    broadcastEvent('confirmation_resolved', { confirmation: conf, executed });
    return { confirmation: conf, executed };
  }

  public slaTick(): { alerts_sent: number; auto_escalated: number; breached: number; expired_confirmations: number } {
    let alerts_sent = 0;
    let auto_escalated = 0;
    let breached = 0;
    let expired_confirmations = 0;

    const nowMs = Date.now();
    for (const conf of this.data.confirmations) {
      if (conf.status === 'pending' && new Date(conf.expires_at).getTime() < nowMs) {
        conf.status = 'expired';
        conf.resolved_via = 'timeout';
        conf.resolved_at = new Date().toISOString();
        expired_confirmations++;
      }
    }

    for (const sla of this.data.slaInstances) {
      if (sla.status !== 'active') continue;
      const ticket = this.data.tickets.find((t) => t.id === sla.ticket_id);
      if (!ticket || ['RESOLVED', 'CLOSED_COMPLETE', 'CLOSED_INCOMPLETE', 'OUT_OF_SCOPE', 'CANCELLED'].includes(ticket.state)) {
        continue;
      }
      const def = this.data.slaDefinitions.find((d) => d.id === sla.sla_definition_id);
      const totalMs = Math.max(60000, new Date(sla.resolution_due_at).getTime() - new Date(sla.started_at).getTime() - sla.total_paused_seconds * 1000);
      const elapsedMs = Math.max(0, nowMs - new Date(sla.started_at).getTime() - sla.total_paused_seconds * 1000);
      const pct = Math.min(999, Math.round((elapsedMs / totalMs) * 1000) / 10);
      sla.elapsed_pct = pct;

      if (pct >= 100 && sla.status === 'active') {
        sla.status = 'breached';
        breached++;
        alerts_sent++;
      } else if (def && pct >= def.auto_escalate_at_pct && ['NEW', 'ASSIGNED', 'WORK_IN_PROGRESS'].includes(ticket.state)) {
        const rule = this.data.automationRules.find((r) => r.id === 'rule-2');
        if (rule?.is_active) {
          this.transitionTicket({
            ticketId: ticket.id,
            toState: 'ESCALATED',
            via: 'automation',
            reason: `Auto-escalated at ${def.auto_escalate_at_pct}% SLA consumption`,
            escalationTarget: 'supervisor',
          });
          rule.executions_count += 1;
          auto_escalated++;
        }
      }
    }

    if (alerts_sent > 0 || auto_escalated > 0 || breached > 0 || expired_confirmations > 0) {
      this.saveToDisk();
      broadcastEvent('sla_tick', { alerts_sent, auto_escalated, breached, expired_confirmations });
    }
    return { alerts_sent, auto_escalated, breached, expired_confirmations };
  }

  public saveServiceReport(report: Omit<ServiceReport, 'id' | 'report_number' | 'created_at'>): ServiceReport {
    const maxNum = Math.max(
      1000,
      ...this.data.serviceReports.map((r) => parseInt(r.report_number.replace(/\D/g, ''), 10) || 1000)
    );
    const saved: ServiceReport = {
      ...report,
      id: `rpt-${crypto.randomUUID().slice(0, 8)}`,
      report_number: `RPT-${String(maxNum + 1).padStart(5, '0')}`,
      created_at: new Date().toISOString(),
    };
    this.data.serviceReports.unshift(saved);

    this.data.ticketActivities.unshift({
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      ticket_id: report.ticket_id,
      actor_id: report.generated_by ?? null,
      actor_name: 'FieldPilot AI',
      actor_type: 'ai',
      activity_type: 'tool_execution',
      is_internal: false,
      body: `Generated Service Report ${saved.report_number}.`,
      created_at: saved.created_at,
    });

    this.saveToDisk();
    broadcastEvent('report_ready', saved);
    return saved;
  }

  public persist(): void {
    this.saveToDisk();
  }
}

export const store = new FieldPilotStore();
