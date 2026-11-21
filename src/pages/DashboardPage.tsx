import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Mic,
  ShieldAlert,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useVoice } from '../context/VoiceContext';
import { PriorityLabel, SlaBar, StateLabel } from '../components/common/Chips';
import { formatRelativeTime, formatStateLabel } from '../lib/stateMachine';
import type { TicketState } from '../types/domain';

export function DashboardPage() {
  const { store, navigate } = useApp();
  const { launchForTicket } = useVoice();

  const metrics = useMemo(() => {
    if (!store) return null;
    const closedStates = ['RESOLVED', 'CLOSED_COMPLETE', 'CLOSED_INCOMPLETE', 'OUT_OF_SCOPE', 'CANCELLED'];
    const openTickets = store.tickets.filter((t) => !closedStates.includes(t.state));
    const p1Open = openTickets.filter((t) => t.priority === 'P1').length;
    const escalated = store.tickets.filter((t) => t.state === 'ESCALATED').length;
    const slaAtRisk = store.slaInstances.filter(
      (s) => s.status === 'active' && s.elapsed_pct >= 75
    ).length;
    const slaBreached = store.slaInstances.filter((s) => s.status === 'breached').length;
    const timeSaved = store.impactMetrics.reduce((acc, m) => acc + m.time_saved_minutes, 0);
    const actionsAuto = store.impactMetrics.reduce((acc, m) => acc + m.actions_automated, 0);

    const byState = store.tickets.reduce<Record<string, number>>((acc, t) => {
      acc[t.state] = (acc[t.state] || 0) + 1;
      return acc;
    }, {});

    const byPriority = (['P1', 'P2', 'P3', 'P4'] as const).map((p) => ({
      priority: p,
      count: openTickets.filter((t) => t.priority === p).length,
    }));

    return {
      openTotal: openTickets.length,
      p1Open,
      escalated,
      slaAtRisk,
      slaBreached,
      timeSaved: Math.round(timeSaved),
      actionsAuto,
      byState,
      byPriority,
    };
  }, [store]);

  if (!store || !metrics) return null;

  const heroTicket = store.tickets.find((t) => t.ticket_number === 'INC0010001') ?? store.tickets[0];
  const heroSla = heroTicket
    ? store.slaInstances.find((s) => s.ticket_id === heroTicket.id)
    : undefined;

  const urgentQueue = store.tickets
    .filter((t) => !['CLOSED_COMPLETE', 'CLOSED_INCOMPLETE', 'OUT_OF_SCOPE', 'CANCELLED'].includes(t.state))
    .sort((a, b) => {
      const pOrder = { P1: 0, P2: 1, P3: 2, P4: 3 };
      return pOrder[a.priority] - pOrder[b.priority];
    })
    .slice(0, 7);

  return (
    <div className="space-y-6">
      {/* Top Hero Operational Dispatch Banner */}
      {heroTicket && (
        <section className="grid items-stretch gap-4 lg:grid-cols-3">
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                  {heroTicket.ticket_number}
                </span>
                <span>·</span>
                <span>Priority {heroTicket.priority}</span>
                <span>·</span>
                <span>Orion Tech Park (BLR-OTP)</span>
                <span>·</span>
                <span>Asset CH-07</span>
              </div>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {heroTicket.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {heroTicket.description}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <StateLabel state={heroTicket.state} />
                <SlaBar sla={heroSla} compact />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/tickets/${heroTicket.ticket_number}`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  Open Ticket
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => launchForTicket(heroTicket.ticket_number)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  <Mic className="h-3.5 w-3.5" />
                  Launch Voice Copilot
                </button>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 dark:border-slate-800">
            <img
              src="/src/assets/images/chiller_plant_asset_1795244410515.jpg"
              alt="Orion Tech Park Chiller Plant"
              referrerPolicy="no-referrer"
              className="h-full min-h-[180px] w-full object-cover opacity-85"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <p className="font-mono text-xs text-slate-300">CH-07 · Carrier 30XA-350</p>
              <p className="mt-0.5 text-sm font-semibold">Block B Roof Plant · 350 Tons R-134a</p>
            </div>
          </div>
        </section>
      )}

      {/* 4-Column KPI Strip */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Open Operational Queue</span>
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
            {metrics.openTotal}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {metrics.p1Open} P1 critical · {metrics.escalated} escalated
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>SLA Risk &amp; Breaches</span>
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
            {metrics.slaAtRisk + metrics.slaBreached}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {metrics.slaAtRisk} at ≥75% · {metrics.slaBreached} breached
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Pending Approvals</span>
            <ShieldAlert className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
            {store.approvals.filter((a) => a.status === 'Pending').length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {store.purchaseOrders.filter((p) => p.status === 'Pending Approval').length} urgent POs awaiting sign-off
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Copilot Time Saved</span>
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
            {metrics.timeSaved}m
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {metrics.actionsAuto} automated tool actions executed
          </p>
        </div>
      </section>

      {/* Main Split: Priority Queue + State Distribution / Live Activity */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Active Priority Queue
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sorted by impact-urgency matrix and SLA countdown
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/incidents')}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap"
            >
              View all tickets →
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {urgentQueue.map((t) => {
              const sla = store.slaInstances.find((s) => s.ticket_id === t.id);
              const tech = store.profiles.find((p) => p.id === t.assigned_to);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => navigate(`/tickets/${t.ticket_number}`)}
                  className="flex w-full flex-col gap-2 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-slate-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {t.ticket_number}
                      </span>
                      <PriorityLabel priority={t.priority} />
                      <StateLabel state={t.state} />
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {t.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {tech ? `Assigned to ${tech.full_name}` : 'Unassigned'} · Created{' '}
                      {formatRelativeTime(t.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <SlaBar sla={sla} compact />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          {/* Open by Priority */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Open Workload by Priority
            </h2>
            <div className="mt-4 space-y-3">
              {metrics.byPriority.map((row) => {
                const pct = metrics.openTotal ? Math.round((row.count / metrics.openTotal) * 100) : 0;
                return (
                  <div key={row.priority}>
                    <div className="flex items-center justify-between text-xs">
                      <PriorityLabel priority={row.priority} />
                      <span className="font-mono font-medium text-slate-700 tabular-nums dark:text-slate-300">
                        {row.count} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full bg-slate-800 dark:bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent Operations Activity
              </h2>
              <Timer className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-3 space-y-3">
              {store.ticketActivities.slice(0, 5).map((act) => {
                const tkt = store.tickets.find((t) => t.id === act.ticket_id);
                return (
                  <div
                    key={act.id}
                    className="border-b border-slate-100 pb-2.5 last:border-0 last:pb-0 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => tkt && navigate(`/tickets/${tkt.ticket_number}`)}
                        className="font-mono font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {tkt?.ticket_number ?? 'Ticket'}
                      </button>
                      <span className="text-slate-400 tabular-nums">
                        {formatRelativeTime(act.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {act.actor_name}:
                      </span>{' '}
                      {act.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Lifecycle Coverage Strip */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Lifecycle State Distribution ({store.tickets.length} total records)
          </h2>
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          {Object.entries(metrics.byState).map(([state, count]) => (
            <button
              key={state}
              type="button"
              onClick={() => navigate(`/incidents?state=${state}`)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-blue-400 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-500"
            >
              <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {formatStateLabel(state as TicketState)}
              </p>
              <p className="mt-0.5 font-mono text-lg font-bold text-slate-900 tabular-nums dark:text-slate-100">
                {count}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
