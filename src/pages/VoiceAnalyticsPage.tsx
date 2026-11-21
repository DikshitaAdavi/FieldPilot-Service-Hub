import React from 'react';
import { Activity, CheckCircle2, Clock, Mic } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatRelativeTime } from '../lib/stateMachine';

export function VoiceAnalyticsPage() {
  const { store, navigate } = useApp();
  if (!store) return null;

  const totalSessions = store.sessions.length;
  const totalTools = store.toolExecutions.length;
  const successTools = store.toolExecutions.filter((t) => t.status === 'success').length;
  const successRate = totalTools ? Math.round((successTools / totalTools) * 100) : 100;
  const voiceConfs = store.confirmations.filter((c) => c.resolved_via === 'voice').length;
  const clickConfs = store.confirmations.filter((c) => c.resolved_via === 'click').length;
  const timeSaved = Math.round(
    store.impactMetrics.reduce((acc, m) => acc + m.time_saved_minutes, 0)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Voice Copilot Analytics &amp; Tool Telemetry
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Session durations, Gemini function-calling reliability, and confirmation audit trails
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Voice Sessions</span>
            <Mic className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums">{totalSessions}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tool Success Rate</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums">{successRate}%</p>
          <p className="mt-1 text-xs text-slate-400">{totalTools} invocations</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Voice vs Click Confirm</span>
            <Activity className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
            {voiceConfs} / {clickConfs}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Time Saved</span>
            <Clock className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums">{timeSaved}m</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Recent Copilot Sessions
          </h2>
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {store.sessions.map((s) => {
              const t = store.tickets.find((tk) => tk.id === s.ticket_id);
              const u = store.profiles.find((p) => p.id === s.user_id);
              return (
                <div key={s.id} className="py-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {s.channel_name}
                    </span>
                    <span className="font-mono text-slate-400">{s.status}</span>
                  </div>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">
                    {u?.full_name} {t ? `· ${t.ticket_number}` : ''} · {formatRelativeTime(s.started_at)}
                  </p>
                  {s.summary && <p className="mt-0.5 text-slate-500">{s.summary}</p>}
                  {t && (
                    <button
                      type="button"
                      onClick={() => navigate(`/tickets/${t.ticket_number}`)}
                      className="mt-1 text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Open Ticket →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Recent Tool Executions
          </h2>
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {store.toolExecutions.slice(0, 12).map((te) => (
              <div key={te.id} className="flex items-center justify-between py-2.5 text-xs">
                <div>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {te.tool_name}
                  </span>
                  <span className="ml-2 text-slate-400">({te.risk})</span>
                </div>
                <span className="font-mono text-slate-500 tabular-nums">
                  {te.duration_ms}ms · {te.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
