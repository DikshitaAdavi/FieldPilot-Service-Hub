import React from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatRelativeTime } from '../lib/stateMachine';

export function NotificationsPage() {
  const { store, currentUser, markNotificationsRead, navigate } = useApp();
  if (!store || !currentUser) return null;

  const list = store.notifications.filter(
    (n) => n.user_id === currentUser.id || currentUser.role === 'admin'
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Notifications Center
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time assignments, SLA alerts, escalations, and approvals
          </p>
        </div>
        <button
          type="button"
          onClick={() => markNotificationsRead()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark All Read
        </button>
      </div>

      <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {list.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            <Bell className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2">You are all caught up.</p>
          </div>
        ) : (
          list.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-4 p-4 ${
                !n.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
              }`}
            >
              <div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{n.title}</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono text-slate-400">{formatRelativeTime(n.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{n.body}</p>
              </div>
              {n.action_url && (
                <button
                  type="button"
                  onClick={() => {
                    void markNotificationsRead(n.id);
                    navigate(n.action_url!);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  Open
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
