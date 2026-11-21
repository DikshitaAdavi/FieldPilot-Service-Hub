import React, { useState } from 'react';
import { Package, Plus, Search, ShoppingCart, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatRelativeTime } from '../lib/stateMachine';

export function InventoryOrdersPage() {
  const { store, createPurchaseOrder, updatePoStatus } = useApp();
  const initialQuery = new URLSearchParams(window.location.search).get('q') || '';
  const [search, setSearch] = useState(initialQuery);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('prt-fan-oem');
  const [selectedWhId, setSelectedWhId] = useState('wh-blr-reg');
  const [selectedTicketId, setSelectedTicketId] = useState('tkt-hero-10001');
  const [quantity, setQuantity] = useState(1);
  const [isUrgent, setIsUrgent] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!store) return null;

  const filteredParts = store.parts.filter(
    (p) =>
      !search.trim() ||
      p.part_number.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createPurchaseOrder({
        ticket_id: selectedTicketId || null,
        warehouse_id: selectedWhId,
        part_id: selectedPartId,
        quantity,
        is_urgent: isUrgent,
      });
      setOrderModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Spare Parts Inventory &amp; Purchase Orders
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Local site stores vs regional warehouses with compatible alternate parts
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOrderModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          New Purchase Order
        </button>
      </div>

      {/* Inventory Stock Matrix */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            <Package className="h-4 w-4 text-slate-500" />
            Warehouse Stock Availability
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search part # (e.g. CFM-30XA-480V)..."
              className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Part Number</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Unit Cost (INR)</th>
                {store.warehouses.map((w) => (
                  <th key={w.id} className="px-4 py-3 text-right">
                    {w.name} ({w.lead_time_hours}h)
                  </th>
                ))}
                <th className="px-4 py-3">Alternate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredParts.map((part) => {
                const alt = part.alternate_part_id
                  ? store.parts.find((p) => p.id === part.alternate_part_id)
                  : null;
                return (
                  <tr key={part.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {part.part_number}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-900 dark:text-slate-100">
                      {part.name}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      ₹{part.unit_cost.toLocaleString()}
                    </td>
                    {store.warehouses.map((w) => {
                      const inv = store.inventory.find(
                        (i) => i.warehouse_id === w.id && i.part_id === part.id
                      );
                      const avail = inv ? inv.quantity_on_hand - inv.quantity_reserved : 0;
                      return (
                        <td
                          key={w.id}
                          className={`px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums ${
                            avail === 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {avail} {inv && inv.quantity_reserved > 0 ? `(${inv.quantity_reserved} res)` : ''}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {alt ? alt.part_number : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchase Orders Lifecycle Table */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            <ShoppingCart className="h-4 w-4 text-slate-500" />
            Purchase Orders ({store.purchaseOrders.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">PO #</th>
                <th className="px-4 py-3">Part</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">ETA / Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {store.purchaseOrders.map((po) => {
                const part = store.parts.find((p) => p.id === po.part_id);
                const wh = store.warehouses.find((w) => w.id === po.warehouse_id);
                return (
                  <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {po.po_number}{' '}
                      {po.is_urgent && (
                        <span className="ml-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                          URGENT
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-mono font-medium">{part?.part_number}</span> · {part?.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{wh?.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {po.quantity}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={po.status}
                        onChange={(e) => updatePoStatus(po.id, e.target.value)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
                      >
                        {['Pending Approval', 'Approved', 'Ordered', 'Shipped', 'Delivered', 'Cancelled'].map(
                          (st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          )
                        )}
                      </select>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums">
                      {formatRelativeTime(po.expected_delivery_at ?? po.updated_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create PO Modal */}
      {orderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Create Spare Part Purchase Order
              </h3>
              <button
                type="button"
                onClick={() => setOrderModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleOrderSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Spare Part
                </label>
                <select
                  value={selectedPartId}
                  onChange={(e) => setSelectedPartId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {store.parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.part_number} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Source Warehouse
                </label>
                <select
                  value={selectedWhId}
                  onChange={(e) => setSelectedWhId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {store.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.lead_time_hours}h lead)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Link to Ticket
                </label>
                <select
                  value={selectedTicketId}
                  onChange={(e) => setSelectedTicketId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">General Stock Replenishment</option>
                  {store.tickets.slice(0, 15).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.ticket_number} · {t.title.slice(0, 36)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="mt-1 w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <label className="flex items-center gap-2 pt-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                  />
                  Urgent Field Dispatch
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOrderModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  {submitting ? 'Reserving...' : 'Place Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
