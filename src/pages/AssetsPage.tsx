import React, { useState } from 'react';
import { Cpu, MapPin, Wrench } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatRelativeTime } from '../lib/stateMachine';

export function AssetsPage() {
  const { store, navigate } = useApp();
  const initialTag = new URLSearchParams(window.location.search).get('tag');
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (initialTag && store) {
      const match = store.equipment.find((e) => e.asset_tag === initialTag);
      if (match) return match.id;
    }
    return 'eq-ch07';
  });

  if (!store) return null;

  const selected = store.equipment.find((e) => e.id === selectedId) ?? store.equipment[0];
  const site = store.sites.find((s) => s.id === selected.site_id);
  const history = store.equipmentHistory.filter((h) => h.equipment_id === selected.id);
  const relatedTickets = store.tickets.filter((t) => t.equipment_id === selected.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Equipment &amp; Asset Registry
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {store.equipment.length} critical facility assets monitored across {store.sites.length} campuses
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-5 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {store.equipment.map((eq) => {
            const eqSite = store.sites.find((s) => s.id === eq.site_id);
            const active = eq.id === selected.id;
            return (
              <button
                key={eq.id}
                type="button"
                onClick={() => setSelectedId(eq.id)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                  active
                    ? 'bg-blue-50/80 dark:bg-blue-950/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {eq.asset_tag}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500">{eq.category}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {eq.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {eqSite?.code} · {eq.location_detail}
                  </p>
                </div>
                <span
                  className={`font-mono text-xs font-medium capitalize ${
                    eq.status === 'degraded' || eq.status === 'down'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {eq.status}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-5 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div>
                <p className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {selected.asset_tag} · {selected.manufacturer} {selected.model}
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                  {selected.name}
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin className="h-3.5 w-3.5" />
                  {site?.name} — {selected.location_detail}
                </p>
              </div>
              <span className="rounded-lg border border-slate-200 px-3 py-1 font-mono text-xs font-semibold capitalize dark:border-slate-700">
                {selected.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Serial Number</p>
                <p className="mt-0.5 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                  {selected.serial_number ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Last Serviced</p>
                <p className="mt-0.5 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                  {formatRelativeTime(selected.last_service_at)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Next Preventive Check</p>
                <p className="mt-0.5 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                  {formatRelativeTime(selected.next_pm_at)}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Technical Nameplate Specs
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(selected.specs).map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <p className="text-[11px] text-slate-500">{k.replace(/_/g, ' ')}</p>
                    <p className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {String(v)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Wrench className="h-4 w-4 text-slate-500" />
              Linked Service Tickets &amp; History ({relatedTickets.length})
            </h3>
            <div className="mt-3 space-y-2">
              {relatedTickets.slice(0, 6).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => navigate(`/tickets/${t.ticket_number}`)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-left text-xs hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                >
                  <div>
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {t.ticket_number}
                    </span>{' '}
                    · <span className="font-medium text-slate-900 dark:text-slate-100">{t.title}</span>
                  </div>
                  <span className="font-mono text-slate-500">{t.state}</span>
                </button>
              ))}
              {history.map((h) => (
                <div
                  key={h.id}
                  className="rounded-lg bg-slate-50 px-3.5 py-2 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {h.event_type.replace('_', ' ')}:
                  </span>{' '}
                  {h.summary} ({formatRelativeTime(h.performed_at)})
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
