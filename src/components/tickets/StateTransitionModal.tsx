import React, { useState } from 'react';
import { X } from 'lucide-react';
import type {
  EscalationTarget,
  PendingReason,
  ResolutionCode,
  Ticket,
  TicketState,
} from '../../types/domain';
import {
  ESCALATION_TARGETS,
  PENDING_REASONS,
  RESOLUTION_CODES,
  formatStateLabel,
} from '../../lib/stateMachine';
import { useApp } from '../../context/AppContext';

interface Props {
  ticket: Ticket;
  targetState: TicketState;
  onClose: () => void;
}

export function StateTransitionModal({ ticket, targetState, onClose }: Props) {
  const { transitionTicket, store } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingReason, setPendingReason] = useState<PendingReason>('Awaiting Part');
  const [escalationTarget, setEscalationTarget] = useState<EscalationTarget>('supervisor');
  const [reason, setReason] = useState('');
  const [workaroundDescription, setWorkaroundDescription] = useState('');
  const [resolutionCode, setResolutionCode] = useState<ResolutionCode>('Fixed');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [outOfScopeJustification, setOutOfScopeJustification] = useState('');
  const [outOfScopeRedirect, setOutOfScopeRedirect] = useState('Workplace Services Desk');
  const [closedIncompleteReason, setClosedIncompleteReason] = useState('');
  const [assignedTo, setAssignedTo] = useState(ticket.assigned_to ?? '');

  const isReopen =
    ['RESOLVED', 'CLOSED_COMPLETE', 'CLOSED_INCOMPLETE', 'OUT_OF_SCOPE', 'CANCELLED'].includes(
      ticket.state
    ) && targetState === 'WORK_IN_PROGRESS';

  const techs =
    store?.profiles.filter((p) => p.is_active && ['technician', 'dispatcher'].includes(p.role)) ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await transitionTicket(ticket.id, {
        to_state: targetState,
        via: 'ui',
        reason: reason.trim() || undefined,
        pending_reason: targetState === 'PENDING' ? pendingReason : undefined,
        escalation_target: targetState === 'ESCALATED' ? escalationTarget : undefined,
        workaround_description:
          targetState === 'WORKAROUND_PROVIDED' ? workaroundDescription.trim() : undefined,
        resolution_code: targetState === 'RESOLVED' ? resolutionCode : undefined,
        resolution_notes: targetState === 'RESOLVED' ? resolutionNotes.trim() : undefined,
        out_of_scope_justification:
          targetState === 'OUT_OF_SCOPE' ? outOfScopeJustification.trim() : undefined,
        out_of_scope_redirect:
          targetState === 'OUT_OF_SCOPE' ? outOfScopeRedirect.trim() : undefined,
        closed_incomplete_reason:
          targetState === 'CLOSED_INCOMPLETE' ? closedIncompleteReason.trim() : undefined,
        assigned_to: targetState === 'ASSIGNED' && assignedTo ? assignedTo : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
              {ticket.ticket_number} · {formatStateLabel(ticket.state)} → {formatStateLabel(targetState)}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {isReopen ? 'Reopen Ticket' : `Move to ${formatStateLabel(targetState)}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {targetState === 'ASSIGNED' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Assign Technician
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">Select technician...</option>
                {techs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.tech_code || t.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetState === 'PENDING' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Pending Reason (SLA clock will pause)
              </label>
              <select
                value={pendingReason}
                onChange={(e) => setPendingReason(e.target.value as PendingReason)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {PENDING_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetState === 'ESCALATED' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Escalation Target
                </label>
                <select
                  value={escalationTarget}
                  onChange={(e) => setEscalationTarget(e.target.value as EscalationTarget)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {ESCALATION_TARGETS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Escalation Reason
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe safety concern, repeated failures, or specialist support needed..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </>
          )}

          {targetState === 'WORKAROUND_PROVIDED' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Workaround Description (auto-schedules 48h permanent-fix follow-up)
              </label>
              <textarea
                rows={3}
                required
                value={workaroundDescription}
                onChange={(e) => setWorkaroundDescription(e.target.value)}
                placeholder="e.g. Isolated Circuit A on CH-07 and shifted cooling load to redundant loop..."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}

          {targetState === 'RESOLVED' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Resolution Code
                </label>
                <select
                  value={resolutionCode}
                  onChange={(e) => setResolutionCode(e.target.value as ResolutionCode)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {RESOLUTION_CODES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Resolution Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Summarize root cause, corrective repair, and verified post-fix telemetry..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </>
          )}

          {targetState === 'OUT_OF_SCOPE' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Out of Scope Justification
                </label>
                <textarea
                  rows={3}
                  required
                  value={outOfScopeJustification}
                  onChange={(e) => setOutOfScopeJustification(e.target.value)}
                  placeholder="Explain why this request falls outside FieldPilot facility maintenance coverage..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Redirect Team / Desk
                </label>
                <input
                  type="text"
                  value={outOfScopeRedirect}
                  onChange={(e) => setOutOfScopeRedirect(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </>
          )}

          {targetState === 'CLOSED_INCOMPLETE' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Closed Incomplete Reason
              </label>
              <textarea
                rows={3}
                required
                value={closedIncompleteReason}
                onChange={(e) => setClosedIncompleteReason(e.target.value)}
                placeholder="e.g. Customer unresponsive after 3 contact attempts..."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}

          {(isReopen ||
            targetState === 'CANCELLED' ||
            targetState === 'PENDING' ||
            targetState === 'WORK_IN_PROGRESS' ||
            targetState === 'CLOSED_COMPLETE') && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {isReopen || targetState === 'CANCELLED' ? 'Mandatory Reason' : 'Notes (Optional)'}
              </label>
              <textarea
                rows={2}
                required={isReopen || targetState === 'CANCELLED'}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  isReopen
                    ? 'State why this ticket is being reopened...'
                    : 'Add context for the activity timeline...'
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Updating...' : 'Confirm Transition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
