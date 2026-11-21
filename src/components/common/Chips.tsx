import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, PauseCircle, ShieldAlert } from 'lucide-react';
import type { PriorityLevel, SlaInstance, TicketState } from '../../types/domain';
import { formatSlaCountdown, formatStateLabel, getPriorityTone, getStateTone } from '../../lib/stateMachine';

export function StateLabel({ state }: { state: TicketState }) {
  const tone = getStateTone(state);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${tone.bg} ${tone.text} ${tone.border}`}
    >
      {state === 'RESOLVED' || state === 'CLOSED_COMPLETE' ? (
        <CheckCircle2 className="h-3 w-3 shrink-0" />
      ) : state === 'ESCALATED' ? (
        <ShieldAlert className="h-3 w-3 shrink-0" />
      ) : state === 'PENDING' ? (
        <PauseCircle className="h-3 w-3 shrink-0" />
      ) : (
        <Clock className="h-3 w-3 shrink-0" />
      )}
      {formatStateLabel(state)}
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: PriorityLevel }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 ${getPriorityTone(
        priority
      )}`}
    >
      {priority === 'P1' && <AlertTriangle className="h-3 w-3 shrink-0" />}
      {priority}
    </span>
  );
}

export function SlaBar({ sla, compact = false }: { sla?: SlaInstance | null; compact?: boolean }) {
  if (!sla) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
  }

  const pct = Math.min(100, Math.max(4, Math.round(sla.elapsed_pct)));
  const isBreached = sla.status === 'breached';
  const isPaused = sla.status === 'paused';
  const isMet = sla.status === 'met';
  const isAtRisk = sla.status === 'active' && sla.elapsed_pct >= 75;

  const barColor = isBreached
    ? 'bg-rose-600 dark:bg-rose-500'
    : isAtRisk
    ? 'bg-amber-500 dark:bg-amber-400'
    : isPaused
    ? 'bg-slate-400 dark:bg-slate-500'
    : isMet
    ? 'bg-emerald-600 dark:bg-emerald-500'
    : 'bg-blue-600 dark:bg-blue-500';

  const textColor = isBreached
    ? 'text-rose-700 dark:text-rose-300'
    : isAtRisk
    ? 'text-amber-700 dark:text-amber-300'
    : isPaused
    ? 'text-slate-600 dark:text-slate-400'
    : isMet
    ? 'text-emerald-700 dark:text-emerald-300'
    : 'text-slate-700 dark:text-slate-300';

  const label = formatSlaCountdown(sla.resolution_due_at, sla.status);

  return (
    <div className={compact ? 'min-w-[112px]' : 'w-full'}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={`font-mono font-medium tabular-nums whitespace-nowrap ${textColor}`}>{label}</span>
        {!compact && (
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {Math.round(sla.elapsed_pct)}%
          </span>
        )}
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
