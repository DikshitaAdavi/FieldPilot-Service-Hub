import React, { useState } from 'react';
import { BarChart3, Download, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ServiceReportDrawer } from '../components/reports/ServiceReportDrawer';
import type { ServiceReport } from '../types/domain';

export function ReportsPage() {
  const { store } = useApp();
  const [activeReport, setActiveReport] = useState<ServiceReport | null>(null);

  if (!store) return null;

  const resolvedTickets = store.tickets.filter((t) =>
    ['RESOLVED', 'CLOSED_COMPLETE'].includes(t.state)
  );
  const firstTimeFixPct = resolvedTickets.length
    ? Math.round(
        (resolvedTickets.filter((t) => t.reopen_count === 0).length / resolvedTickets.length) *
          1000
      ) / 10
    : 100;

  const siteBreakdown = store.sites.map((s) => {
    const siteTickets = store.tickets.filter((t) => t.site_id === s.id);
    const open = siteTickets.filter(
      (t) => !['RESOLVED', 'CLOSED_COMPLETE', 'CLOSED_INCOMPLETE', 'OUT_OF_SCOPE', 'CANCELLED'].includes(t.state)
    ).length;
    return { site: s, total: siteTickets.length, open };
  });

  function exportAllCsv() {
    const headers = ['Ticket', 'Type', 'Priority', 'State', 'Title', 'Reopens', 'Created'];
    const rows = store!.tickets.map((t) => [
      t.ticket_number,
      t.type,
      t.priority,
      t.state,
      `"${t.title.replace(/"/g, '""')}"`,
      t.reopen_count,
      t.created_at,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fieldpilot-operations-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Operational Reports &amp; Service Archive
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            First-time fix rate, campus workload distribution, and AI-generated field service reports
          </p>
        </div>
        <button
          type="button"
          onClick={exportAllCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Download className="h-3.5 w-3.5" />
          Export Operations CSV
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500">First-Time Fix Rate</p>
          <p className="mt-1 font-mono text-3xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
            {firstTimeFixPct}%
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Across {resolvedTickets.length} resolved tickets
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500">Total Purchase Orders</p>
          <p className="mt-1 font-mono text-3xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
            {store.purchaseOrders.length}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {store.purchaseOrders.filter((p) => p.is_urgent).length} urgent field dispatches
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500">Generated Service Reports</p>
          <p className="mt-1 font-mono text-3xl font-bold text-blue-600 tabular-nums dark:text-blue-400">
            {store.serviceReports.length}
          </p>
          <p className="mt-1 text-xs text-slate-400">Structured PDF-ready reports</p>
        </div>
      </div>

      {/* Campus Workload */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <BarChart3 className="h-4 w-4 text-slate-500" />
          Ticket Volume by Campus
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {siteBreakdown.map((item) => (
            <div
              key={item.site.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
            >
              <p className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                {item.site.code}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.site.name}
              </p>
              <p className="mt-2 font-mono text-xs text-slate-600 tabular-nums dark:text-slate-400">
                {item.total} total · {item.open} active
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Service Reports Archive */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <FileText className="h-4 w-4 text-slate-500" />
          Service Reports Archive
        </h2>
        {store.serviceReports.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            No service reports generated yet. Open any ticket (e.g. INC0010001) and click &ldquo;Generate Service Report&rdquo;.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {store.serviceReports.map((rpt) => {
              const t = store.tickets.find((tk) => tk.id === rpt.ticket_id);
              return (
                <div
                  key={rpt.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div>
                    <p className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {rpt.report_number} · {t?.ticket_number}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
                      {rpt.summary_narrative}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveReport(rpt)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    View Report
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeReport && (
        <ServiceReportDrawer
          report={activeReport}
          ticket={store.tickets.find((t) => t.id === activeReport.ticket_id)}
          onClose={() => setActiveReport(null)}
        />
      )}
    </div>
  );
}
