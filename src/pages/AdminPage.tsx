import React from 'react';
import {
  CheckCircle2,
  Database,
  Mic,
  Radio,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  Timer,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatRelativeTime } from '../lib/stateMachine';

export function AdminPage() {
  const {
    store,
    integrationsStatus,
    refreshIntegrations,
    toggleAutomationRule,
    runSlaTick,
    resetDemo,
  } = useApp();
  if (!store) return null;

  const cards = [
    {
      name: 'Gemini AI & Speech',
      icon: Sparkles,
      configured: Boolean(integrationsStatus?.gemini.configured),
      modeLabel: integrationsStatus?.gemini.configured ? 'Connected' : 'Pending Secret',
      detail: integrationsStatus
        ? `${integrationsStatus.gemini.model} · ${integrationsStatus.gemini.sttModel}`
        : 'Loading...',
      secretHint: 'GEMINI_API_KEY',
    },
    {
      name: 'Agora Live RTC',
      icon: Radio,
      configured: Boolean(integrationsStatus?.agora.configured),
      modeLabel: integrationsStatus?.agora.configured ? 'Connected' : 'Pending Secret',
      detail: integrationsStatus?.agora.configured
        ? integrationsStatus.agora.hasCertificate
          ? 'Token-authenticated WebRTC'
          : 'App ID testing mode'
        : 'Local bridge fallback',
      secretHint: 'AGORA_APP_ID + AGORA_APP_CERTIFICATE',
    },
    {
      name: 'Murf Falcon TTS',
      icon: Mic,
      configured: Boolean(integrationsStatus?.murf.configured),
      modeLabel: integrationsStatus?.murf.configured ? 'Connected' : 'Pending Secret',
      detail: integrationsStatus?.murf.configured
        ? `${integrationsStatus.murf.model} · Voice ${integrationsStatus.murf.voiceId}`
        : 'Using Gemini TTS fallback',
      secretHint: 'MURF_API_KEY',
    },
    {
      name: 'Local Persistent Store',
      icon: Database,
      configured: true,
      modeLabel: 'Active',
      detail: 'Persistent atomic JSON store',
      secretHint: '',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Platform Governance &amp; Administration
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Connected AI &amp; voice services, local persistence, automation rules, SLA sweep controls, and audit log
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runSlaTick}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 whitespace-nowrap"
          >
            <Timer className="h-3.5 w-3.5" />
            Trigger SLA Tick
          </button>
          <button
            type="button"
            onClick={resetDemo}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset Demo Dataset
          </button>
        </div>
      </div>

      {/* Connected Services Readiness */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Connected Services &amp; Storage
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gemini, Agora, and Murf credentials are managed securely on the server via Settings &rarr; Secrets
            </p>
          </div>
          <button
            type="button"
            onClick={refreshIntegrations}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Refresh Status
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.name}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {card.name}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                      card.configured
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {card.modeLabel}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{card.detail}</p>
                {!card.configured && card.secretHint && (
                  <p className="mt-1 font-mono text-[10px] text-slate-400">
                    Add {card.secretHint} in Secrets
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Automation Rules */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Settings className="h-4 w-4 text-slate-500" />
          Automation Rules Engine
        </h2>
        <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {store.automationRules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{rule.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Trigger: <span className="font-mono">{rule.trigger_event}</span> ·{' '}
                  {rule.description}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {rule.executions_count} runs
                </span>
                <button
                  type="button"
                  onClick={() => toggleAutomationRule(rule.id)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium ${
                    rule.is_active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {rule.is_active ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Directory & Assignment Groups */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Users className="h-4 w-4 text-slate-500" />
            User Directory ({store.profiles.length})
          </h2>
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {store.profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5 text-xs">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{p.full_name}</p>
                  <p className="font-mono text-slate-500">{p.email}</p>
                </div>
                <span className="font-mono uppercase text-blue-600 dark:text-blue-400">
                  {p.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Shield className="h-4 w-4 text-slate-500" />
            Immutable Audit Log
          </h2>
          <div className="mt-3 divide-y divide-slate-100 max-h-80 overflow-y-auto dark:divide-slate-800">
            {store.auditLog.slice(0, 20).map((entry) => (
              <div key={entry.id} className="py-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {entry.actor_name} · {entry.action}
                  </span>
                  <span className="font-mono text-slate-400">{formatRelativeTime(entry.created_at)}</span>
                </div>
                <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                  {entry.details} (via {entry.via})
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
