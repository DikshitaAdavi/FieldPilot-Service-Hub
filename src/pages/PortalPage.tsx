import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Mic,
  Plus,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useVoice } from '../context/VoiceContext';
import { PriorityLabel, StateLabel } from '../components/common/Chips';
import type { CatalogItem } from '../types/domain';

export function PortalPage() {
  const { store, currentUser, navigate, submitCatalogRequest, createTicket, transitionTicket } =
    useApp();
  const { launchForTicket } = useVoice();

  const [query, setQuery] = useState('');
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogItem | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [reportOpen, setReportOpen] = useState(false);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const matchingKb = useMemo(() => {
    if (!store || !query.trim()) return [];
    const q = query.toLowerCase();
    return store.kbDocuments
      .filter(
        (d) =>
          d.is_published &&
          (d.title.toLowerCase().includes(q) ||
            d.content.toLowerCase().includes(q) ||
            d.tags.some((t) => t.toLowerCase().includes(q)))
      )
      .slice(0, 4);
  }, [store, query]);

  if (!store || !currentUser) return null;

  const myRequests = store.tickets
    .filter((t) => t.requester_id === currentUser.id)
    .slice(0, 8);

  async function handleCatalogSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCatalog) return;
    setSubmitting(true);
    try {
      const tkt = await submitCatalogRequest(selectedCatalog.id, formData);
      setSelectedCatalog(null);
      setFormData({});
      navigate(`/tickets/${tkt.ticket_number}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIssueSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const tkt = await createTicket({
        title: issueTitle,
        description: issueDesc,
        type: 'INCIDENT',
        site_id: currentUser?.site_id ?? 'site-blr-otp',
        impact: 'Medium',
        urgency: 'Medium',
        source: 'portal',
      });
      setReportOpen(false);
      setIssueTitle('');
      setIssueDesc('');
      navigate(`/tickets/${tkt.ticket_number}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <section className="grid items-stretch gap-6 rounded-2xl border border-slate-200 bg-white p-6 lg:grid-cols-12 lg:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between lg:col-span-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              FieldPilot Self-Service Portal
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Report an equipment fault or request facility support
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Search safety procedures, submit catalog requests with automated routing, or launch hands-free voice intake.
            </p>

            <div className="relative mt-5">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search manuals, cooling issues, power drops, or access..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            {matchingKb.length > 0 && (
              <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
                {matchingKb.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => navigate(`/kb?doc=${doc.id}`)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                      <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                      {doc.title}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Report an Incident
            </button>
            <button
              type="button"
              onClick={() => launchForTicket('INC0010001')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Mic className="h-4 w-4 text-blue-600" />
              Voice Intake Copilot
            </button>
          </div>
        </div>

        <div className="relative hidden overflow-hidden rounded-xl lg:col-span-5 lg:block">
          <img
            src="/src/assets/images/chiller_plant_asset_1795244410515.jpg"
            alt="Campus chiller plant operations"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <p className="text-xs font-medium text-slate-300">24/7 Campus Engineering Coverage</p>
            <p className="mt-0.5 text-sm font-semibold">
              Orion Tech Park · Meridian Data Center · Apex Logistics Hub
            </p>
          </div>
        </div>
      </section>

      {/* Service Catalog Grid */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Service Catalog
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pre-configured facility &amp; engineering workflows with SLA targets
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {store.catalogItems
            .filter((item) =>
              !query.trim()
                ? true
                : item.name.toLowerCase().includes(query.toLowerCase()) ||
                  item.description.toLowerCase().includes(query.toLowerCase())
            )
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedCatalog(item);
                  setFormData({});
                }}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono">{item.code}</span>
                    <span>
                      ETA {item.estimated_hours}h · {item.requires_approval ? 'Approval' : 'Auto-route'}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {item.name}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {item.description}
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                  Request Service <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
        </div>
      </section>

      {/* My Submitted Tickets */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            <Wrench className="h-4 w-4 text-slate-500" />
            My Submitted Tickets ({myRequests.length})
          </h2>
        </div>

        <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {myRequests.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              You have not submitted any tickets under this persona yet.
            </p>
          ) : (
            myRequests.map((t) => (
              <div
                key={t.id}
                className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/tickets/${t.ticket_number}`)}
                      className="font-mono text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {t.ticket_number}
                    </button>
                    <PriorityLabel priority={t.priority} />
                    <StateLabel state={t.state} />
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {t.title}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {t.state === 'RESOLVED' && (
                    <button
                      type="button"
                      onClick={() =>
                        transitionTicket(t.id, {
                          to_state: 'CLOSED_COMPLETE',
                          via: 'ui',
                          reason: 'Requester confirmed resolution',
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirm Fix
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/tickets/${t.ticket_number}`)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Track
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Catalog Request Modal */}
      {selectedCatalog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div>
                <p className="font-mono text-xs text-slate-500">{selectedCatalog.code}</p>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {selectedCatalog.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCatalog(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCatalogSubmit} className="mt-4 space-y-4">
              {selectedCatalog.form_schema.map((field) => (
                <div key={field.name}>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      required={field.required}
                      value={formData[field.name] ?? ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      required={field.required}
                      value={formData[field.name] ?? ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    />
                  )}
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCatalog(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Incident Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Report Facility Incident
              </h3>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleIssueSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Issue Summary
                </label>
                <input
                  type="text"
                  required
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  placeholder="e.g. Block B 3rd floor warm airflow"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Details &amp; Location
                </label>
                <textarea
                  rows={3}
                  required
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  {submitting ? 'Submitting...' : 'Submit Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
