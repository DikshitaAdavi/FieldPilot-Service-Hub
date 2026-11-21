import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Cpu,
  FileText,
  Mic,
  Package,
  Send,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useVoice } from '../context/VoiceContext';
import { PriorityLabel, SlaBar, StateLabel } from '../components/common/Chips';
import { StateTransitionModal } from '../components/tickets/StateTransitionModal';
import { ServiceReportDrawer } from '../components/reports/ServiceReportDrawer';
import {
  ACTIVE_RIBBON_STATES,
  formatRelativeTime,
  formatStateLabel,
  getAllowedTransitions,
} from '../lib/stateMachine';
import type { ServiceReport, TicketState } from '../types/domain';

export function TicketDetailPage({ ticketNumber }: { ticketNumber: string }) {
  const {
    store,
    currentUser,
    navigate,
    assignTicket,
    addActivity,
    logWork,
    toggleWoTask,
    generateReport,
  } = useApp();
  const { launchForTicket } = useVoice();

  const [transitionTarget, setTransitionTarget] = useState<TicketState | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(true);
  const [workMins, setWorkMins] = useState(30);
  const [workNote, setWorkNote] = useState('');
  const [activeReport, setActiveReport] = useState<ServiceReport | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  if (!store) return null;

  const ticket = store.tickets.find(
    (t) => t.ticket_number.toLowerCase() === ticketNumber.toLowerCase() || t.id === ticketNumber
  );

  if (!ticket) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Ticket {ticketNumber} not found
        </h2>
        <button
          type="button"
          onClick={() => navigate('/incidents')}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white"
        >
          Back to Incidents
        </button>
      </div>
    );
  }

  const site = store.sites.find((s) => s.id === ticket.site_id);
  const category = store.categories.find((c) => c.id === ticket.category_id);
  const requester = store.profiles.find((p) => p.id === ticket.requester_id);
  const assignee = store.profiles.find((p) => p.id === ticket.assigned_to);
  const equipment = store.equipment.find((e) => e.id === ticket.equipment_id);
  const equipmentHistory = equipment
    ? store.equipmentHistory.filter((h) => h.equipment_id === equipment.id)
    : [];
  const sla = store.slaInstances.find((s) => s.ticket_id === ticket.id);
  const woTasks = store.workOrderTasks
    .filter((w) => w.ticket_id === ticket.id)
    .sort((a, b) => a.step_order - b.step_order);
  const linkedPos = store.purchaseOrders.filter((p) => p.ticket_id === ticket.id);
  const ticketReports = store.serviceReports.filter((r) => r.ticket_id === ticket.id);
  const ticketFollowups = store.followups.filter((f) => f.ticket_id === ticket.id);
  const workLogs = store.workLogs.filter((w) => w.ticket_id === ticket.id);

  const isRequester = currentUser?.role === 'requester';
  const activities = store.ticketActivities.filter(
    (a) => a.ticket_id === ticket.id && (!isRequester || !a.is_internal)
  );

  const allowedTransitions = getAllowedTransitions(
    ticket.state,
    currentUser?.role ?? 'technician',
    ticket.requester_id === currentUser?.id
  );

  const techs = store.profiles.filter(
    (p) => p.is_active && ['technician', 'dispatcher'].includes(p.role)
  );

  async function handleNoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    await addActivity(ticket!.id, noteBody.trim(), isRequester ? false : isInternalNote);
    setNoteBody('');
  }

  async function handleWorkLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workNote.trim()) return;
    await logWork(ticket!.id, workMins, 'field_repair', workNote.trim());
    setWorkNote('');
  }

  async function handleGenerateReport() {
    setGeneratingReport(true);
    try {
      const rpt = await generateReport(ticket!.ticket_number);
      setActiveReport(rpt);
    } finally {
      setGeneratingReport(false);
    }
  }

  const currentRibbonIndex = ACTIVE_RIBBON_STATES.indexOf(ticket.state);

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Primary Action Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(isRequester ? '/portal' : '/incidents')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Queue
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
              {ticket.ticket_number}
            </span>
            <PriorityLabel priority={ticket.priority} />
            <StateLabel state={ticket.state} />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {site?.name ?? 'Campus'} · {category?.name ?? ticket.type}
            </span>
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            {ticket.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={generatingReport}
            onClick={handleGenerateReport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <FileText className="h-3.5 w-3.5" />
            {generatingReport ? 'Generating...' : 'Generate Service Report'}
          </button>
          <button
            type="button"
            onClick={() => launchForTicket(ticket.ticket_number)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
          >
            <Mic className="h-3.5 w-3.5" />
            Launch Voice Copilot
          </button>
        </div>
      </div>

      {/* State Ribbon */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-w-max items-center gap-1.5">
          {ACTIVE_RIBBON_STATES.map((st, idx) => {
            const isCurrent = ticket.state === st;
            const isPast = currentRibbonIndex >= 0 && idx < currentRibbonIndex;
            return (
              <div
                key={st}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  isCurrent
                    ? 'bg-slate-900 text-white dark:bg-blue-600'
                    : isPast
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-slate-50 text-slate-400 dark:bg-slate-950 dark:text-slate-500'
                }`}
              >
                <span className="font-mono text-[11px]">{idx + 1}.</span>
                <span className="whitespace-nowrap">{formatStateLabel(st)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transition Actions Bar */}
      {allowedTransitions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Available Lifecycle Transitions
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {allowedTransitions.map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => setTransitionTarget(target)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  target === 'RESOLVED' || target === 'CLOSED_COMPLETE'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : target === 'ESCALATED'
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {formatStateLabel(target)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main 2-Column Workspace */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Description, Checklist, POs, Activity Stream */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Incident Summary &amp; Context
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {ticket.description}
            </p>

            {(ticket.pending_reason ||
              ticket.workaround_description ||
              ticket.resolution_notes ||
              ticket.out_of_scope_justification) && (
              <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 text-xs dark:border-slate-800">
                {ticket.pending_reason && (
                  <p>
                    <span className="font-semibold text-amber-700 dark:text-amber-300">
                      Pending Reason:
                    </span>{' '}
                    {ticket.pending_reason}
                  </p>
                )}
                {ticket.workaround_description && (
                  <p>
                    <span className="font-semibold text-teal-700 dark:text-teal-300">
                      Active Workaround:
                    </span>{' '}
                    {ticket.workaround_description}
                  </p>
                )}
                {ticket.resolution_notes && (
                  <p>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      Resolution ({ticket.resolution_code}):
                    </span>{' '}
                    {ticket.resolution_notes}
                  </p>
                )}
                {ticket.out_of_scope_justification && (
                  <p>
                    <span className="font-semibold text-orange-700 dark:text-orange-300">
                      Out of Scope:
                    </span>{' '}
                    {ticket.out_of_scope_justification} ({ticket.out_of_scope_redirect})
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Work Order / Field Checklist */}
          {woTasks.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Field Execution &amp; LOTO Safety Checklist
              </h2>
              <div className="mt-3 space-y-2">
                {woTasks.map((task) => (
                  <label
                    key={task.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  >
                    <input
                      type="checkbox"
                      checked={task.is_completed}
                      disabled={isRequester}
                      onChange={() => toggleWoTask(task.id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${
                            task.is_completed
                              ? 'line-through text-slate-400'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {task.step_order}. {task.title}
                        </span>
                        {task.is_safety_step && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                            <ShieldAlert className="h-3 w-3" /> Safety SOP
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Linked Purchase Orders & Follow-ups */}
          {(linkedPos.length > 0 || ticketFollowups.length > 0 || ticketReports.length > 0) && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900">
              {linkedPos.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Package className="h-3.5 w-3.5" /> Linked Spare Parts Orders
                  </h3>
                  <div className="mt-2 space-y-2">
                    {linkedPos.map((po) => {
                      const part = store.parts.find((p) => p.id === po.part_id);
                      const wh = store.warehouses.find((w) => w.id === po.warehouse_id);
                      return (
                        <div
                          key={po.id}
                          className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                        >
                          <div>
                            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                              {po.po_number}
                            </span>{' '}
                            · {part?.part_number} x{po.quantity} from {wh?.name}
                          </div>
                          <span className="font-medium text-blue-600 dark:text-blue-400">
                            {po.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {ticketFollowups.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Scheduled Follow-Ups
                  </h3>
                  <div className="mt-2 space-y-2">
                    {ticketFollowups.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                      >
                        <span>{f.title}</span>
                        <span className="font-mono text-slate-500">
                          {new Date(f.scheduled_for).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ticketReports.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Generated Service Reports
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ticketReports.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setActiveReport(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs font-medium text-blue-600 hover:bg-slate-50 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-slate-800"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {r.report_number}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Stream & Note Composer */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Activity Stream &amp; Work Notes
            </h2>

            <form onSubmit={handleNoteSubmit} className="mt-3 space-y-2.5">
              <textarea
                rows={2}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder={
                  isRequester
                    ? 'Post a public update for the assigned technician...'
                    : 'Log an internal work note or customer-visible comment...'
                }
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="flex items-center justify-between">
                {!isRequester ? (
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Internal Work Note (hidden from requester)
                  </label>
                ) : (
                  <span className="text-xs text-slate-400">Visible to service team</span>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  <Send className="h-3 w-3" />
                  Post Entry
                </button>
              </div>
            </form>

            <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
              {activities.map((act) => (
                <div key={act.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {act.actor_name}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {act.is_internal ? 'Internal Note' : act.activity_type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {formatRelativeTime(act.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                    {act.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar: SLA, Assignment, Equipment & History, Work Log */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Clock className="h-3.5 w-3.5" /> SLA Health
            </h3>
            <div className="mt-3">
              <SlaBar sla={sla} />
            </div>
            {sla && (
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-medium capitalize text-slate-900 dark:text-slate-100">
                    {sla.status}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Resolution Target</dt>
                  <dd className="font-mono text-slate-700 tabular-nums dark:text-slate-300">
                    {new Date(sla.resolution_due_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <UserPlus className="h-3.5 w-3.5" /> Ownership &amp; Routing
            </h3>
            <dl className="mt-3 space-y-2.5 text-xs">
              <div>
                <dt className="text-slate-500">Requester</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                  {requester?.full_name ?? 'Unknown'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Assigned Technician</dt>
                <dd className="mt-1">
                  {!isRequester ? (
                    <select
                      value={ticket.assigned_to ?? ''}
                      onChange={(e) => assignTicket(ticket.id, e.target.value || null)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="">Unassigned</option>
                      {techs.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name} ({t.tech_code || t.role})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {assignee?.full_name ?? 'Pending Dispatch'}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {equipment && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Cpu className="h-3.5 w-3.5" /> Linked Equipment
              </h3>
              <p className="mt-2 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                {equipment.asset_tag} · {equipment.model}
              </p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {equipment.name}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {equipment.location_detail} · Status: {equipment.status}
              </p>
              {equipmentHistory.length > 0 && (
                <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    Past Service History
                  </p>
                  <ul className="mt-1.5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {equipmentHistory.slice(0, 3).map((h) => (
                      <li key={h.id}>
                        • {h.summary}{' '}
                        <span className="text-slate-400">({formatRelativeTime(h.performed_at)})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!isRequester && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Log Field Time
              </h3>
              <form onSubmit={handleWorkLogSubmit} className="mt-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={workMins}
                    onChange={(e) => setWorkMins(Number(e.target.value))}
                    className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  <span className="text-xs text-slate-500">minutes</span>
                </div>
                <input
                  type="text"
                  required
                  value={workNote}
                  onChange={(e) => setWorkNote(e.target.value)}
                  placeholder="Inspection or repair summary..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Add Work Log
                </button>
              </form>
              {workLogs.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
                  {workLogs.map((wl) => (
                    <li key={wl.id} className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span className="truncate">{wl.notes}</span>
                      <span className="font-mono shrink-0 ml-2">{wl.minutes_spent}m</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {transitionTarget && (
        <StateTransitionModal
          ticket={ticket}
          targetState={transitionTarget}
          onClose={() => setTransitionTarget(null)}
        />
      )}

      {activeReport && (
        <ServiceReportDrawer
          report={activeReport}
          ticket={ticket}
          onClose={() => setActiveReport(null)}
        />
      )}
    </div>
  );
}
