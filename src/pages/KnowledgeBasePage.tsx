import React, { useMemo, useState } from 'react';
import { BookOpen, Plus, Search, ShieldAlert, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function KnowledgeBasePage() {
  const { store, currentUser, addKbDoc } = useApp();
  const initialDocId = new URLSearchParams(window.location.search).get('doc');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState<string>(initialDocId || 'kb-1');
  const [addOpen, setAddOpen] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('troubleshooting');
  const [newModel, setNewModel] = useState('30XA-350');
  const [newHazard, setNewHazard] = useState('caution');
  const [newSop, setNewSop] = useState('');
  const [newContent, setNewContent] = useState('');

  const docs = useMemo(() => {
    if (!store) return [];
    const q = query.trim().toLowerCase();
    return store.kbDocuments.filter((d) => {
      if (typeFilter !== 'ALL' && d.doc_type !== typeFilter) return false;
      if (!q) return true;
      return `${d.title} ${d.content} ${d.safety_sop ?? ''} ${d.tags.join(' ')}`.toLowerCase().includes(q);
    });
  }, [store, query, typeFilter]);

  if (!store) return null;
  const selected = docs.find((d) => d.id === selectedId) ?? docs[0] ?? null;

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    await addKbDoc({
      title: newTitle,
      doc_type: newType,
      equipment_model: newModel,
      hazard_level: newHazard,
      safety_sop: newSop || undefined,
      content: newContent,
      tags: [newType, newModel].filter(Boolean),
    });
    setAddOpen(false);
    setNewTitle('');
    setNewSop('');
    setNewContent('');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Engineering Knowledge Base &amp; Safety SOPs
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Grounded manuals, LOTO procedures, troubleshooting trees, and past fix reports
          </p>
        </div>
        {currentUser?.role !== 'requester' && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add KB Article
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search high pressure, 30XA, LOTO, fan motor, refrigerant..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {['ALL', 'sop', 'manual', 'troubleshooting', 'past_fix'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium uppercase ${
                typeFilter === t
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-5 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {docs.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setSelectedId(doc.id)}
              className={`block w-full px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                selected?.id === doc.id ? 'bg-blue-50/70 dark:bg-blue-950/30' : ''
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span className="uppercase">{doc.doc_type.replace('_', ' ')}</span>
                <span>{doc.equipment_model ?? 'General'}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {doc.title}
              </p>
              {doc.hazard_level !== 'none' && (
                <p className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="h-3.5 w-3.5" /> Hazard: {doc.hazard_level.replace('_', ' ')}
                </p>
              )}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          {selected ? (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                  <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                  <span className="uppercase">{selected.doc_type.replace('_', ' ')}</span>
                  <span>·</span>
                  <span>{selected.equipment_model ?? 'Campus-wide'}</span>
                </div>
                <h2 className="mt-1.5 text-xl font-bold text-slate-900 dark:text-slate-100">
                  {selected.title}
                </h2>
              </div>

              {selected.safety_sop && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                    <ShieldAlert className="h-4 w-4" /> Mandatory Safety SOP
                  </p>
                  <p className="mt-1 leading-relaxed">{selected.safety_sop}</p>
                </div>
              )}

              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {selected.content}
              </div>

              <div className="border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800">
                Keywords: {selected.tags.join(' · ')}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No articles match your filter.</p>
          )}
        </div>
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-semibold">Publish Knowledge Article</h3>
              <button type="button" onClick={() => setAddOpen(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3">
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Article Title"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="sop">SOP</option>
                  <option value="manual">Manual</option>
                  <option value="troubleshooting">Troubleshooting</option>
                  <option value="past_fix">Past Fix</option>
                </select>
                <input
                  type="text"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  placeholder="Model (e.g. 30XA-350)"
                  className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
                <select
                  value={newHazard}
                  onChange={(e) => setNewHazard(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="none">No Hazard</option>
                  <option value="caution">Caution</option>
                  <option value="high_pressure">High Pressure</option>
                  <option value="electrical">Electrical</option>
                  <option value="refrigerant">Refrigerant</option>
                </select>
              </div>
              <input
                type="text"
                value={newSop}
                onChange={(e) => setNewSop(e.target.value)}
                placeholder="Optional Mandatory Safety SOP warning..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <textarea
                rows={4}
                required
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Technical diagnostic steps..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white"
                >
                  Publish Article
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
