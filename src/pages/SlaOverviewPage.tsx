import React from 'react';
import { Timer } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PriorityLabel, SlaBar, StateLabel } from '../components/common/Chips';

export function SlaOverviewPage() {
  const { store, navigate, runSlaTick } = useApp();
  if (!store) return null;

  const active = store.slaInstances.filter((s) => s.status === 'active').length;
  const paused = store.slaInstances.filter((s) => s.status === 'paused').length;
  const met = store.slaInstances.filter((s) => s.status === 'met').length;
  const breached = store.slaInstances.filter((s) => s.status === 'breached').length;
  const compliance =
    met + breached > 0 ? Math.round((met / (met + breached)) * 1000) / 10 : 100;

  const watchlist = store.slaInstances
    .filter((s) => s.status === 'breached' || (s.status === 'active' && s.elapsed_pct >= 40))
    .sort((a, b) => b.elapsed_pct - a.elapsed_pct)
    .slice(0, 15);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            SLA Health &amp; Governance
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Active, paused (PENDING), met, and breached SLA timers across all priorities
          </p>
        </div>

        <button
          type="button"
          onClick={runSlaTick}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Timer className="h-3.5 w-3.5" />
          Run SLA Sweep Now
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'SLA Compliance', val: `${compliance}%` },
          { label: 'Active Clocks', val: active },
          { label: 'Paused (Pending)', val: paused },
          { label: 'Met Targets', val: met },
          { label: 'Breached', val: breached },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
              {kpi.val}
            </p>
          </div>
        ))}
      </div>

      {/* SLA Definitions */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Configured SLA Policy Targets
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          {store.slaDefinitions.map((def) => (
            <div
              key={def.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="flex items-center justify-between">
                <PriorityLabel priority={def.priority} />
                <span className="font-mono text-[11px] text-slate-500">
                  Escalate @ {def.auto_escalate_at_pct}%
                </span>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                {def.name}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                Resp: {def.response_minutes}m · Res: {def.resolution_minutes}m
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Watchlist */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            At-Risk &amp; Breached SLA Watchlist
          </h2>
        </div>
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">SLA Consumption</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {watchlist.map((sla) => {
              const t = store.tickets.find((tk) => tk.id === sla.ticket_id);
              if (!t) return null;
              return (
                <tr
                  key={sla.id}
                  onClick={() => navigate(`/tickets/${t.ticket_number}`)}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                    {t.ticket_number}
                  </td>
                  <td className="px-4 py-3">
                    <PriorityLabel priority={t.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StateLabel state={t.state} />
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-900 dark:text-slate-100">
                    {t.title}
                  </td>
                  <td className="px-4 py-3 w-52">
                    <SlaBar sla={sla} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
