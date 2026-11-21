import React, { useEffect, useState } from 'react';
import { ShieldAlert, Check, X } from 'lucide-react';
import type { ConfirmationRequest } from '../../types/domain';
import { useApp } from '../../context/AppContext';

export function ConfirmationCard({ confirmation }: { confirmation: ConfirmationRequest }) {
  const { resolveConfirmation } = useApp();
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(confirmation.expires_at).getTime() - Date.now()) / 1000))
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft(
        Math.max(0, Math.floor((new Date(confirmation.expires_at).getTime() - Date.now()) / 1000))
      );
    }, 1000);
    return () => clearInterval(t);
  }, [confirmation.expires_at]);

  if (confirmation.status !== 'pending' || secondsLeft <= 0) return null;

  async function handle(decision: 'confirmed' | 'cancelled') {
    setBusy(true);
    try {
      await resolveConfirmation(confirmation.id, decision, 'click');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 dark:border-amber-800 dark:bg-amber-950/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
              Confirmation Required · {confirmation.tool_name.replace(/_/g, ' ')}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
              {confirmation.summary_text}
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Say &ldquo;Yes, confirm&rdquo; or &ldquo;Cancel&rdquo;, or click below. Expires in{' '}
              <span className="font-mono font-semibold tabular-nums">{secondsLeft}s</span>.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => handle('cancelled')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handle('confirmed')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Confirm &amp; Execute
        </button>
      </div>
    </div>
  );
}
