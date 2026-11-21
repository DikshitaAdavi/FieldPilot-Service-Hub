import React from 'react';
import { Check, CheckSquare, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatRelativeTime } from '../lib/stateMachine';

export function ApprovalsPage() {
  const { store, currentUser, decideApproval, navigate } = useApp();
  if (!store) return null;

  const canApprove =
    currentUser?.role === 'supervisor' || currentUser?.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Approvals Inbox
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Purchase orders ≥ ₹15,000 and restricted catalog requests awaiting supervisor sign-off
        </p>
      </div>

      <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {store.approvals.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            <CheckSquare className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2">All approval requests have been processed.</p>
          </div>
        ) : (
          store.approvals.map((apr) => {
            const ticket = store.tickets.find((t) => t.id === apr.ticket_id);
            const requester = store.profiles.find((p) => p.id === apr.requested_by);
            return (
              <div
                key={apr.id}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-semibold uppercase text-blue-600 dark:text-blue-400">
                      {apr.request_type.replace('_', ' ')}
                    </span>
                    <span>·</span>
                    {ticket && (
                      <button
                        type="button"
                        onClick={() => navigate(`/tickets/${ticket.ticket_number}`)}
                        className="font-mono font-semibold hover:underline"
                      >
                        {ticket.ticket_number}
                      </button>
                    )}
                    <span>·</span>
                    <span className="text-slate-500">
                      Requested by {requester?.full_name ?? 'Staff'} ·{' '}
                      {formatRelativeTime(apr.created_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {apr.comments}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {apr.status === 'Pending' ? (
                    canApprove ? (
                      <>
                        <button
                          type="button"
                          onClick={() => decideApproval(apr.id, 'Rejected')}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => decideApproval(apr.id, 'Approved')}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </button>
                      </>
                    ) : (
                      <span className="font-mono text-xs text-amber-600 dark:text-amber-400">
                        Pending Supervisor
                      </span>
                    )
                  ) : (
                    <span
                      className={`font-mono text-xs font-semibold ${
                        apr.status === 'Approved'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {apr.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
