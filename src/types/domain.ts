export type UserRole = 'requester' | 'technician' | 'dispatcher' | 'supervisor' | 'admin';

export type TicketType = 'INCIDENT' | 'SERVICE_REQUEST' | 'WORK_ORDER';

export type TicketState =
  | 'NEW'
  | 'ASSIGNED'
  | 'WORK_IN_PROGRESS'
  | 'PENDING'
  | 'ESCALATED'
  | 'WORKAROUND_PROVIDED'
  | 'RESOLVED'
  | 'CLOSED_COMPLETE'
  | 'CLOSED_INCOMPLETE'
  | 'OUT_OF_SCOPE'
  | 'CANCELLED';

export type PendingReason =
  | 'Awaiting Part'
  | 'Awaiting Customer'
  | 'Awaiting Vendor'
  | 'Awaiting Approval'
  | 'Awaiting Change Window';

export type EscalationTarget = 'supervisor' | 'L2' | 'vendor';

export type ResolutionCode =
  | 'Fixed'
  | 'Workaround'
  | 'Part Replaced'
  | 'No Fault Found'
  | 'Duplicate'
  | 'Out of Coverage'
  | 'Customer Unresponsive';

export type ImpactLevel = 'High' | 'Medium' | 'Low';
export type UrgencyLevel = 'High' | 'Medium' | 'Low';
export type PriorityLevel = 'P1' | 'P2' | 'P3' | 'P4';

export type OrderStatus =
  | 'Pending Approval'
  | 'Approved'
  | 'Ordered'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
export type RiskLevel = 'read' | 'write' | 'critical';

export interface Site {
  id: string;
  name: string;
  code: string;
  city: string;
  address?: string;
  timezone: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  tech_code?: string | null;
  skills: string[];
  site_id?: string | null;
  phone?: string;
  is_active: boolean;
}

export interface AssignmentGroup {
  id: string;
  name: string;
  code: string;
  description?: string;
  site_id?: string | null;
  lead_id?: string | null;
  skills: string[];
  member_ids: string[];
}

export interface Category {
  id: string;
  name: string;
  code: string;
  default_group_id?: string | null;
  default_impact: ImpactLevel;
  default_urgency: UrgencyLevel;
  requires_safety_sop: boolean;
  description?: string;
}

export interface Equipment {
  id: string;
  asset_tag: string;
  name: string;
  category: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  site_id: string;
  location_detail?: string;
  status: 'operational' | 'degraded' | 'down' | 'maintenance' | 'decommissioned';
  install_date?: string;
  last_service_at?: string;
  next_pm_at?: string;
  specs: Record<string, string | number>;
}

export interface EquipmentHistory {
  id: string;
  equipment_id: string;
  ticket_id?: string | null;
  event_type: 'incident' | 'repair' | 'part_replaced' | 'pm_service' | 'inspection' | 'workaround';
  summary: string;
  performed_by?: string | null;
  performed_at: string;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  type: TicketType;
  state: TicketState;
  title: string;
  description: string;
  category_id?: string | null;
  site_id?: string | null;
  equipment_id?: string | null;
  requester_id: string;
  assigned_to?: string | null;
  assignment_group_id?: string | null;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  priority: PriorityLevel;
  pending_reason?: PendingReason | null;
  escalation_target?: EscalationTarget | null;
  workaround_description?: string | null;
  resolution_code?: ResolutionCode | null;
  resolution_notes?: string | null;
  out_of_scope_justification?: string | null;
  out_of_scope_redirect?: string | null;
  closed_incomplete_reason?: string | null;
  reopen_count: number;
  last_reopen_reason?: string | null;
  source: 'portal' | 'voice' | 'email' | 'automation' | 'field';
  sla_paused: boolean;
  resolved_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketActivity {
  id: string;
  ticket_id: string;
  actor_id?: string | null;
  actor_name: string;
  actor_type: 'user' | 'ai' | 'system';
  activity_type:
    | 'comment'
    | 'work_note'
    | 'state_change'
    | 'assignment'
    | 'tool_execution'
    | 'voice_link'
    | 'sla_event'
    | 'approval'
    | 'attachment';
  is_internal: boolean;
  body: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface TicketStateHistory {
  id: string;
  ticket_id: string;
  from_state: TicketState | null;
  to_state: TicketState;
  reason?: string | null;
  via: 'ui' | 'voice' | 'automation';
  changed_by?: string | null;
  actor_name?: string;
  created_at: string;
}

export interface WorkLogEntry {
  id: string;
  ticket_id: string;
  user_id: string;
  user_name: string;
  minutes_spent: number;
  work_type: string;
  notes: string;
  logged_at: string;
}

export interface WorkOrderTask {
  id: string;
  ticket_id: string;
  step_order: number;
  title: string;
  description?: string;
  is_safety_step: boolean;
  is_completed: boolean;
  completed_by?: string | null;
  completed_at?: string | null;
}

export interface SlaDefinition {
  id: string;
  name: string;
  priority: PriorityLevel;
  response_minutes: number;
  resolution_minutes: number;
  auto_escalate_at_pct: number;
  is_active: boolean;
}

export interface SlaInstance {
  id: string;
  ticket_id: string;
  sla_definition_id: string;
  started_at: string;
  response_due_at: string;
  resolution_due_at: string;
  first_responded_at?: string | null;
  paused_at?: string | null;
  total_paused_seconds: number;
  elapsed_pct: number;
  status: 'active' | 'paused' | 'met' | 'breached';
}

export interface CatalogField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  required?: boolean;
}

export interface CatalogItem {
  id: string;
  name: string;
  code: string;
  category_id?: string | null;
  description: string;
  icon: string;
  estimated_hours: number;
  requires_approval: boolean;
  default_group_id?: string | null;
  form_schema: CatalogField[];
  is_active: boolean;
}

export interface Approval {
  id: string;
  ticket_id: string;
  request_type: 'catalog_request' | 'purchase_order' | 'out_of_scope' | 'escalation';
  reference_id?: string | null;
  approver_id?: string | null;
  requested_by: string;
  status: ApprovalStatus;
  comments?: string;
  decided_at?: string | null;
  created_at: string;
}

export interface Escalation {
  id: string;
  ticket_id: string;
  escalated_by?: string | null;
  target: EscalationTarget;
  reason: string;
  previous_priority: PriorityLevel;
  new_priority: PriorityLevel;
  status: 'open' | 'acknowledged' | 'resolved';
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  created_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  site_id?: string | null;
  city: string;
  is_regional: boolean;
  lead_time_hours: number;
}

export interface Part {
  id: string;
  part_number: string;
  name: string;
  category: string;
  unit_cost: number;
  alternate_part_id?: string | null;
  specs: Record<string, string | number>;
}

export interface InventoryRecord {
  id: string;
  warehouse_id: string;
  part_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  reorder_point: number;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  ticket_id?: string | null;
  warehouse_id: string;
  part_id: string;
  quantity: number;
  is_urgent: boolean;
  status: OrderStatus;
  requested_by: string;
  approved_by?: string | null;
  idempotency_key?: string | null;
  notes?: string;
  expected_delivery_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KbDocument {
  id: string;
  title: string;
  doc_type: 'manual' | 'sop' | 'troubleshooting' | 'past_fix';
  category_id?: string | null;
  equipment_model?: string | null;
  hazard_level: 'none' | 'caution' | 'high_pressure' | 'refrigerant' | 'electrical';
  safety_sop?: string | null;
  content: string;
  tags: string[];
  is_published: boolean;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  ticket_id?: string | null;
  title: string;
  body: string;
  level: 'info' | 'warning' | 'critical' | 'success';
  category: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger_event: string;
  description: string;
  is_active: boolean;
  priority_order: number;
  executions_count: number;
}

export interface VoiceSession {
  id: string;
  user_id: string;
  ticket_id?: string | null;
  channel_name: string;
  status: 'active' | 'ended' | 'failed';
  started_at: string;
  ended_at?: string | null;
  summary?: string | null;
}

export interface TranscriptEntry {
  id: string;
  session_id: string;
  ticket_id?: string | null;
  speaker: 'user' | 'assistant' | 'expert' | 'system';
  text: string;
  created_at: string;
}

export interface ToolExecution {
  id: string;
  session_id?: string | null;
  ticket_id?: string | null;
  tool_name: string;
  risk: RiskLevel;
  input_args: Record<string, unknown>;
  output_result?: unknown;
  status: 'success' | 'error' | 'pending_confirmation' | 'cancelled';
  duration_ms: number;
  executed_by?: string | null;
  created_at: string;
}

export interface ConfirmationRequest {
  id: string;
  session_id?: string | null;
  ticket_id?: string | null;
  tool_name: string;
  risk: RiskLevel;
  args: Record<string, unknown>;
  summary_text: string;
  idempotency_key: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  resolved_via?: 'voice' | 'click' | 'timeout';
  resolved_by?: string | null;
  expires_at: string;
  resolved_at?: string | null;
  created_at: string;
}

export interface ServiceReport {
  id: string;
  ticket_id: string;
  session_id?: string | null;
  report_number: string;
  summary_narrative: string;
  diagnosis: string;
  actions_taken: string[];
  parts_used: string[];
  safety_checks: string[];
  recommendations: string[];
  generated_by?: string | null;
  created_at: string;
}

export interface FollowupTask {
  id: string;
  ticket_id: string;
  equipment_id?: string | null;
  title: string;
  description?: string;
  followup_type: 'part_arrival_revisit' | 'preventive_sibling_check' | 'customer_confirm' | 'permanent_fix';
  scheduled_for: string;
  assigned_to?: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

export interface ExpertInvite {
  id: string;
  session_id?: string | null;
  ticket_id: string;
  channel_name: string;
  invited_by: string;
  expert_user_id?: string | null;
  status: 'pending' | 'joined' | 'ended';
  ai_diagnosis_summary: string;
  created_at: string;
}

export interface ImpactMetric {
  id: string;
  session_id?: string | null;
  ticket_id?: string | null;
  baseline_minutes: number;
  actual_minutes: number;
  time_saved_minutes: number;
  actions_automated: number;
  manual_steps_avoided: number;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id?: string | null;
  actor_name: string;
  actor_role?: UserRole | null;
  action: string;
  table_name: string;
  record_id?: string | null;
  details: string;
  via: string;
  created_at: string;
}

export interface StoreSnapshot {
  sites: Site[];
  profiles: Profile[];
  assignmentGroups: AssignmentGroup[];
  categories: Category[];
  equipment: Equipment[];
  equipmentHistory: EquipmentHistory[];
  tickets: Ticket[];
  ticketActivities: TicketActivity[];
  stateHistory: TicketStateHistory[];
  workLogs: WorkLogEntry[];
  workOrderTasks: WorkOrderTask[];
  slaDefinitions: SlaDefinition[];
  slaInstances: SlaInstance[];
  catalogItems: CatalogItem[];
  approvals: Approval[];
  escalations: Escalation[];
  warehouses: Warehouse[];
  parts: Part[];
  inventory: InventoryRecord[];
  purchaseOrders: PurchaseOrder[];
  kbDocuments: KbDocument[];
  notifications: NotificationItem[];
  automationRules: AutomationRule[];
  sessions: VoiceSession[];
  transcripts: TranscriptEntry[];
  toolExecutions: ToolExecution[];
  confirmations: ConfirmationRequest[];
  serviceReports: ServiceReport[];
  followups: FollowupTask[];
  expertInvites: ExpertInvite[];
  impactMetrics: ImpactMetric[];
  auditLog: AuditLogEntry[];
}
