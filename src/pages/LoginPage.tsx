import React from 'react';
import { ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function LoginPage() {
  const { store, currentUser, setCurrentUserById, navigate } = useApp();
  if (!store) return null;

  return (
    <div className="mx-auto max-w-4xl py-6 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          <ShieldCheck className="h-4 w-4" />
          Role-Based Workspace Switcher
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Select an Operational Persona
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Test FieldPilot Service Hub across Requester, Field Technician, Dispatcher, Supervisor, and Admin permissions.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {store.profiles.map((p) => {
            const site = store.sites.find((s) => s.id === p.site_id);
            const active = currentUser?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setCurrentUserById(p.id);
                  navigate(p.role === 'requester' ? '/portal' : p.role === 'technician' ? '/my-work' : '/dashboard');
                }}
                className={`flex items-center justify-between gap-4 rounded-xl border p-4 text-left transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/30'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {p.full_name}
                    </span>
                    <span className="font-mono text-xs uppercase text-blue-600 dark:text-blue-400">
                      {p.role}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">{p.email}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {site?.name ?? 'All Sites'} {p.tech_code ? `· ${p.tech_code}` : ''}
                  </p>
                </div>
                {active ? (
                  <UserCheck className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                ) : (
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
