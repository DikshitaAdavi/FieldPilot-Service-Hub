import React, { useMemo, useState } from 'react';
import {
  Download,
  Kanban,
  List,
  Plus,
  Search,
  Columns2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PriorityLabel, SlaBar, StateLabel } from '../components/common/Chips';
import { ALL_STATES, formatRelativeTime, formatStateLabel } from '../lib/stateMachine';
import type { ImpactLevel, TicketState, TicketType, UrgencyLevel } from '../types/domain';

interface Props {
  forcedType?: TicketType;
  pageTitle?: string;
}

export function IncidentsListPage({ forcedType, pageTitle = 'Incidents & Tickets' }: Props) {
  const { store, navigate, createTicket } = useApp();
  const urlParams = new URLSearchParams(window.location.search);
  const initialState = urlParams.get('state') || 'ALL';

  const [viewMode, setViewMode] = useState<'table' | 'split' | 'kanban'>('table');
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string>(initialState);
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [selectedTicketNumber, setSelectedTicketNumber] = useState<string>('INC0010001');
  const [createOpen, setCreateOpen] = useState(false);

  // New Ticket Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<TicketType>(forcedType ?? 'INCIDENT');
  const [newCategoryId, setNewCategoryId] = useState('cat-hvac');
  const [newSiteId, setNewSiteId] = useState('site-blr-otp');
  const [newEquipmentId, setNewEquipmentId] = useState('eq-ch07');
  const [newImpact, setNewImpact] = useState<ImpactLevel>('High');
  const [newUrgency, setNewUrgency] = useState<UrgencyLevel>('Medium');
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    if (!store) return [];
    const q = search.trim().toLowerCase();
    return store.tickets.filter((t) => {
      if (forcedType && t.type !== forcedType) return false;
      if (stateFilter !== 'ALL' && t.state !== stateFilter) return false;
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      if (q) {
        const hay = `${t.ticket_number} ${t.title} ${t.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [store, forcedType, stateFilter, priorityFilter, search]);

  if (!store) return null;

  const selectedTicket =
    filtered.find((t) => t.ticket_number === selectedTicketNumber) ?? filtered[0] ?? null;

  function exportCsv() {
    const headers = ['Number', 'Type', 'Priority', 'State', 'Title', 'Created'];
    const rows = filtered.map((t) => [
      t.ticket_number,
      t.type,
      t.priority,
      t.state,
      `"${t.title.replace(/"/g, '""')}"`,
      t.created_at,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fieldpilot-${forcedType?.toLowerCase() ?? 'tickets'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await createTicket({
        title: newTitle,
        description: newDesc,
        type: newType,
        category_id: newCategoryId,
        site_id: newSiteId,
        equipment_id: newEquipmentId || null,
        impact: newImpact,
        urgency: newUrgency,
        source: 'portal',
      });
      setCreateOpen(false);
      setNewTitle('');
      setNewDesc('');
      navigate(`/tickets/${created.ticket_number}`);
    } finally {
      setSubmitting(false);
    }
  }

  const kanbanColumns: TicketState[] = [
    'NEW',
    'ASSIGNED',
    'WORK_IN_PROGRESS',
    'PENDING',
    'ESCALATED',
    'WORKAROUND_PROVIDED',
    'RESOLVED',
  ];

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            {pageTitle}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Showing <span className="font-mono font-semibold tabular-nums">{filtered.length}</span>{' '}
            records with live SLA tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                viewMode === 'table'
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                viewMode === 'split'
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Columns2 className="h-3.5 w-3.5" />
              Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                viewMode === 'kanban'
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              Board
            </button>
          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            New Record
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by ticket number, asset tag, or keyword..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          <option value="ALL">All States</option>
          {ALL_STATES.map((s) => (
            <option key={s} value={s}>
              {formatStateLabel(s)}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          <option value="ALL">All Priorities</option>
          <option value="P1">P1 Critical</option>
          <option value="P2">P2 High</option>
          <option value="P3">P3 Moderate</option>
          <option value="P4">P4 Low</option>
        </select>
      </div>

      {/* Views */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Title &amp; Asset</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3 text-right">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filtered.map((t) => {
                const tech = store.profiles.find((p) => p.id === t.assigned_to);
                const eq = store.equipment.find((e) => e.id === t.equipment_id);
                const sla = store.slaInstances.find((s) => s.ticket_id === t.id);
                return (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/tickets/${t.ticket_number}`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {t.ticket_number}
                    </td>
                    <td className="px-4 py-3">
                      <PriorityLabel priority={t.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StateLabel state={t.state} />
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {t.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {eq ? `${eq.asset_tag} (${eq.name})` : t.type}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {tech ? tech.full_name : 'Unassigned'}
                    </td>
                    <td className="px-4 py-3">
                      <SlaBar sla={sla} compact />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap dark:text-slate-400">
                      {formatRelativeTime(t.updated_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-500">
              No tickets match your active filters.
            </div>
          )}
        </div>
      )}

      {viewMode === 'split' && (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-2 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {filtered.slice(0, 20).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTicketNumber(t.ticket_number)}
                className={`block w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                  selectedTicket?.id === t.id ? 'bg-blue-50/70 dark:bg-blue-950/30' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                    {t.ticket_number}
                  </span>
                  <PriorityLabel priority={t.priority} />
                </div>
                <p className="mt-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {t.title}
                </p>
                <div className="mt-1.5 flex items-center justify-between">
                  <StateLabel state={t.state} />
                  <span className="text-xs text-slate-400">{formatRelativeTime(t.updated_at)}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-3 dark:border-slate-800 dark:bg-slate-900">
            {selectedTicket ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
                  <div>
                    <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {selectedTicket.ticket_number} · {selectedTicket.type}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {selectedTicket.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/tickets/${selectedTicket.ticket_number}`)}
                    className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Open Full Workspace
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <PriorityLabel priority={selectedTicket.priority} />
                  <StateLabel state={selectedTicket.state} />
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {selectedTicket.description}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select a ticket to preview.</p>
            )}
          </div>
        </div>
      )}

      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanColumns.map((colState) => {
            const colTickets = filtered.filter((t) => t.state === colState);
            return (
              <div
                key={colState}
                className="w-72 shrink-0 rounded-xl border border-slate-200 bg-slate-100/70 p-3 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {formatStateLabel(colState)}
                  </span>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {colTickets.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {colTickets.slice(0, 12).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => navigate(`/tickets/${t.ticket_number}`)}
                      className="block w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xs hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {t.ticket_number}
                        </span>
                        <PriorityLabel priority={t.priority} />
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs font-medium text-slate-900 dark:text-slate-100">
                        {t.title}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Ticket Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Create New Service Record
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as TicketType)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="INCIDENT">Incident</option>
                    <option value="SERVICE_REQUEST">Service Request</option>
                    <option value="WORK_ORDER">Work Order</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Site
                  </label>
                  <select
                    value={newSiteId}
                    onChange={(e) => setNewSiteId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    {store.sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Summary Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Chiller CH-08 abnormal compressor vibration"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Description &amp; Telemetry Symptoms
                </label>
                <textarea
                  rows={3}
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Category
                  </label>
                  <select
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  >
                    {store.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Impact
                  </label>
                  <select
                    value={newImpact}
                    onChange={(e) => setNewImpact(e.target.value as ImpactLevel)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Urgency
                  </label>
                  <select
                    value={newUrgency}
                    onChange={(e) => setNewUrgency(e.target.value as UrgencyLevel)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Equipment Asset
                </label>
                <select
                  value={newEquipmentId}
                  onChange={(e) => setNewEquipmentId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">None / General Facility</option>
                  {store.equipment.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.asset_tag} — {eq.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create & Auto-Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
