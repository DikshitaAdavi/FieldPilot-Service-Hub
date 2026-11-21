import React, { useMemo, useState } from 'react';
import { Search, Ticket, Cpu, BookOpen, Package, ArrowRight, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export function CommandPalette() {
  const { commandOpen, setCommandOpen, store, navigate } = useApp();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!store) return [];
    const q = query.trim().toLowerCase();
    const items: Array<{ id: string; group: string; title: string; subtitle: string; to: string }> = [];

    const navShortcuts = [
      { id: 'nav-dash', title: 'Operations Dashboard', subtitle: 'KPIs & live SLA queues', to: '/dashboard' },
      { id: 'nav-inc', title: 'Incidents Queue', subtitle: 'All active incidents & filters', to: '/incidents' },
      { id: 'nav-my', title: 'My Field Work', subtitle: 'Technician mobile-first dispatch list', to: '/my-work' },
      { id: 'nav-voice', title: 'Voice Copilot Console', subtitle: 'Hands-free AI diagnostics & camera', to: '/voice' },
      { id: 'nav-inv', title: 'Inventory & Purchase Orders', subtitle: 'Site vs regional spare parts', to: '/inventory' },
      { id: 'nav-kb', title: 'Knowledge Base', subtitle: 'Safety SOPs, manuals & past fixes', to: '/kb' },
      { id: 'nav-apr', title: 'Approvals Inbox', subtitle: 'PO & catalog approvals', to: '/approvals' },
      { id: 'nav-portal', title: 'Service Portal', subtitle: 'Self-service catalog & intake', to: '/portal' },
    ];

    for (const nav of navShortcuts) {
      if (!q || nav.title.toLowerCase().includes(q) || nav.subtitle.toLowerCase().includes(q)) {
        items.push({ ...nav, group: 'Pages' });
      }
    }

    for (const t of store.tickets) {
      if (
        !q ||
        t.ticket_number.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q)
      ) {
        items.push({
          id: t.id,
          group: 'Tickets',
          title: `${t.ticket_number} · ${t.title}`,
          subtitle: `${t.priority} · ${t.state}`,
          to: `/tickets/${t.ticket_number}`,
        });
      }
      if (items.filter((i) => i.group === 'Tickets').length >= 6) break;
    }

    for (const eq of store.equipment) {
      if (
        !q ||
        eq.asset_tag.toLowerCase().includes(q) ||
        eq.name.toLowerCase().includes(q) ||
        (eq.model ?? '').toLowerCase().includes(q)
      ) {
        items.push({
          id: eq.id,
          group: 'Equipment',
          title: `${eq.asset_tag} · ${eq.name}`,
          subtitle: `${eq.manufacturer ?? ''} ${eq.model ?? ''} · ${eq.status}`,
          to: `/assets?tag=${eq.asset_tag}`,
        });
      }
      if (items.filter((i) => i.group === 'Equipment').length >= 4) break;
    }

    for (const p of store.parts) {
      if (!q || p.part_number.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) {
        items.push({
          id: p.id,
          group: 'Parts',
          title: `${p.part_number} · ${p.name}`,
          subtitle: `${p.category} · INR ${p.unit_cost.toLocaleString()}`,
          to: `/inventory?q=${encodeURIComponent(p.part_number)}`,
        });
      }
      if (items.filter((i) => i.group === 'Parts').length >= 3) break;
    }

    for (const doc of store.kbDocuments) {
      if (!q || doc.title.toLowerCase().includes(q)) {
        items.push({
          id: doc.id,
          group: 'Knowledge Base',
          title: doc.title,
          subtitle: `${doc.doc_type.toUpperCase()} · ${doc.equipment_model ?? 'General'}`,
          to: `/kb?doc=${doc.id}`,
        });
      }
      if (items.filter((i) => i.group === 'Knowledge Base').length >= 3) break;
    }

    return items.slice(0, 14);
  }, [store, query]);

  if (!commandOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 pt-20 backdrop-blur-xs"
      onClick={() => setCommandOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to INC0010001, CH-07, CFM-30XA-480V, or any page..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
          />
          <button
            type="button"
            onClick={() => setCommandOpen(false)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No matching tickets, equipment, parts, or articles found.
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  navigate(item.to);
                  setCommandOpen(false);
                  setQuery('');
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.group === 'Tickets' ? (
                    <Ticket className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  ) : item.group === 'Equipment' ? (
                    <Cpu className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : item.group === 'Parts' ? (
                    <Package className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <BookOpen className="h-4 w-4 shrink-0 text-slate-500" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {item.title}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.group} · {item.subtitle}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
