import React from 'react';
import { Printer, X, ShieldCheck, Wrench, Package, CheckCircle2 } from 'lucide-react';
import type { ServiceReport, Ticket } from '../../types/domain';

interface Props {
  report: ServiceReport;
  ticket?: Ticket | null;
  onClose: () => void;
}

export function ServiceReportDrawer({ report, ticket, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
              {report.report_number} {ticket ? `· ${ticket.ticket_number}` : ''} ·{' '}
              {new Date(report.created_at).toLocaleString()}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Field Service Report
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {ticket && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ticket.title}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {ticket.ticket_number} · Priority {ticket.priority} · State {ticket.state}
              </p>
            </div>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Executive Summary
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {report.summary_narrative}
            </p>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Root Cause &amp; Diagnosis
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {report.diagnosis}
            </p>
          </section>

          <div className="grid gap-6 sm:grid-cols-2">
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Wrench className="h-3.5 w-3.5" /> Actions Taken
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                {report.actions_taken.map((a, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Package className="h-3.5 w-3.5" /> Parts &amp; Procurement
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                {report.parts_used.length > 0 ? (
                  report.parts_used.map((p, i) => (
                    <li key={i} className="font-mono text-xs">
                      • {p}
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-slate-500 dark:text-slate-400">No parts consumed.</li>
                )}
              </ul>
            </section>
          </div>

          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" /> Safety &amp; LOTO Compliance
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
              {report.safety_checks.map((s, i) => (
                <li key={i}>• {s}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Preventive Recommendations
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
              {report.recommendations.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
