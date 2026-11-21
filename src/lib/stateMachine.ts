import type {
  EscalationTarget,
  PendingReason,
  PriorityLevel,
  ResolutionCode,
  TicketState,
  UserRole,
} from '../types/domain';

export const ALL_STATES: TicketState[] = [
  'NEW',
  'ASSIGNED',
  'WORK_IN_PROGRESS',
  'PENDING',
  'ESCALATED',
  'WORKAROUND_PROVIDED',
  'RESOLVED',
  'CLOSED_COMPLETE',
  'CLOSED_INCOMPLETE',
  'OUT_OF_SCOPE',
  'CANCELLED',
];

export const ACTIVE_RIBBON_STATES: TicketState[] = [
  'NEW',
  'ASSIGNED',
  'WORK_IN_PROGRESS',
  'PENDING',
  'ESCALATED',
  'WORKAROUND_PROVIDED',
  'RESOLVED',
  'CLOSED_COMPLETE',
];

export const TERMINAL_STATES: TicketState[] = [
  'CLOSED_COMPLETE',
  'CLOSED_INCOMPLETE',
  'OUT_OF_SCOPE',
  'CANCELLED',
];

export const PENDING_REASONS: PendingReason[] = [
  'Awaiting Part',
  'Awaiting Customer',
  'Awaiting Vendor',
  'Awaiting Approval',
  'Awaiting Change Window',
];

export const ESCALATION_TARGETS: { value: EscalationTarget; label: string }[] = [
  { value: 'supervisor', label: 'Site Supervisor' },
  { value: 'L2', label: 'L2 Engineering Specialist' },
  { value: 'vendor', label: 'OEM Vendor Support' },
];

export const RESOLUTION_CODES: ResolutionCode[] = [
  'Fixed',
  'Workaround',
  'Part Replaced',
  'No Fault Found',
  'Duplicate',
  'Out of Coverage',
  'Customer Unresponsive',
];

export const STATE_TRANSITIONS: Record<TicketState, TicketState[]> = {
  NEW: ['ASSIGNED', 'ESCALATED', 'OUT_OF_SCOPE', 'CANCELLED'],
  ASSIGNED: ['WORK_IN_PROGRESS', 'PENDING', 'ESCALATED', 'OUT_OF_SCOPE', 'CANCELLED'],
  WORK_IN_PROGRESS: ['PENDING', 'ESCALATED', 'WORKAROUND_PROVIDED', 'RESOLVED', 'OUT_OF_SCOPE'],
  PENDING: ['WORK_IN_PROGRESS', 'ESCALATED', 'CLOSED_INCOMPLETE', 'CANCELLED'],
  ESCALATED: ['ASSIGNED', 'WORK_IN_PROGRESS', 'PENDING', 'WORKAROUND_PROVIDED', 'RESOLVED'],
  WORKAROUND_PROVIDED: ['WORK_IN_PROGRESS', 'RESOLVED', 'CLOSED_INCOMPLETE'],
  RESOLVED: ['CLOSED_COMPLETE', 'CLOSED_INCOMPLETE', 'WORK_IN_PROGRESS'],
  CLOSED_COMPLETE: ['WORK_IN_PROGRESS'],
  CLOSED_INCOMPLETE: ['WORK_IN_PROGRESS'],
  OUT_OF_SCOPE: ['WORK_IN_PROGRESS'],
  CANCELLED: ['WORK_IN_PROGRESS'],
};

export function getAllowedTransitions(
  currentState: TicketState,
  role: UserRole,
  isRequesterOwner = false
): TicketState[] {
  const candidates = STATE_TRANSITIONS[currentState] ?? [];
  if (role === 'requester') {
    if (isRequesterOwner && currentState === 'RESOLVED') {
      return ['CLOSED_COMPLETE', 'WORK_IN_PROGRESS'];
    }
    return [];
  }
  return candidates.filter((target) => {
    if (
      ['CLOSED_COMPLETE', 'CLOSED_INCOMPLETE', 'OUT_OF_SCOPE', 'CANCELLED'].includes(currentState) &&
      target === 'WORK_IN_PROGRESS'
    ) {
      return role === 'supervisor' || role === 'admin';
    }
    return true;
  });
}

export function formatStateLabel(state: TicketState): string {
  return state
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function getStateTone(state: TicketState): {
  text: string;
  bg: string;
  border: string;
} {
  switch (state) {
    case 'NEW':
      return {
        text: 'text-sky-700 dark:text-sky-300',
        bg: 'bg-sky-50 dark:bg-sky-950/60',
        border: 'border-sky-200 dark:border-sky-800',
      };
    case 'ASSIGNED':
      return {
        text: 'text-indigo-700 dark:text-indigo-300',
        bg: 'bg-indigo-50 dark:bg-indigo-950/60',
        border: 'border-indigo-200 dark:border-indigo-800',
      };
    case 'WORK_IN_PROGRESS':
      return {
        text: 'text-blue-700 dark:text-blue-300',
        bg: 'bg-blue-50 dark:bg-blue-950/60',
        border: 'border-blue-200 dark:border-blue-800',
      };
    case 'PENDING':
      return {
        text: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-50 dark:bg-amber-950/60',
        border: 'border-amber-200 dark:border-amber-800',
      };
    case 'ESCALATED':
      return {
        text: 'text-rose-700 dark:text-rose-300',
        bg: 'bg-rose-50 dark:bg-rose-950/60',
        border: 'border-rose-200 dark:border-rose-800',
      };
    case 'WORKAROUND_PROVIDED':
      return {
        text: 'text-teal-700 dark:text-teal-300',
        bg: 'bg-teal-50 dark:bg-teal-950/60',
        border: 'border-teal-200 dark:border-teal-800',
      };
    case 'RESOLVED':
    case 'CLOSED_COMPLETE':
      return {
        text: 'text-emerald-700 dark:text-emerald-300',
        bg: 'bg-emerald-50 dark:bg-emerald-950/60',
        border: 'border-emerald-200 dark:border-emerald-800',
      };
    case 'OUT_OF_SCOPE':
      return {
        text: 'text-orange-700 dark:text-orange-300',
        bg: 'bg-orange-50 dark:bg-orange-950/60',
        border: 'border-orange-200 dark:border-orange-800',
      };
    case 'CLOSED_INCOMPLETE':
    case 'CANCELLED':
    default:
      return {
        text: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-100 dark:bg-slate-800/70',
        border: 'border-slate-200 dark:border-slate-700',
      };
  }
}

export function getPriorityTone(priority: PriorityLevel): string {
  switch (priority) {
    case 'P1':
      return 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800';
    case 'P2':
      return 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800';
    case 'P3':
      return 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800';
    case 'P4':
    default:
      return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700';
  }
}

export function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return '—';
  const ms = Date.now() - new Date(isoString).getTime();
  const mins = Math.round(ms / 60000);
  if (Math.abs(mins) < 1) return 'Just now';
  if (mins > 0) {
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  } else {
    const ahead = Math.abs(mins);
    if (ahead < 60) return `in ${ahead}m`;
    const hrs = Math.round(ahead / 60);
    if (hrs < 24) return `in ${hrs}h`;
    return `in ${Math.round(hrs / 24)}d`;
  }
}

export function formatSlaCountdown(dueIso: string, status: string): string {
  if (status === 'paused') return 'Paused';
  if (status === 'met') return 'SLA Met';
  const diffMs = new Date(dueIso).getTime() - Date.now();
  const absMins = Math.floor(Math.abs(diffMs) / 60000);
  const hrs = Math.floor(absMins / 60);
  const mins = absMins % 60;
  const label = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  return diffMs < 0 ? `Breached (${label})` : `${label} left`;
}
