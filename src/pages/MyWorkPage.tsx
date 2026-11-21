import React from 'react';
import { Mic, Play, ArrowRight, Wrench } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useVoice } from '../context/VoiceContext';
import { PriorityLabel, SlaBar, StateLabel } from '../components/common/Chips';

export function MyWorkPage() {
  const { store, currentUser, navigate, transitionTicket } = useApp();
  const { launchForTicket } = useVoice();

  if (!store || !currentUser) return null;

  const myTickets = store.tickets
    .filter(
      (t) =>
        (t.assigned_to === currentUser.id || currentUser.role === 'admin' || currentUser.role === 'supervisor') &&
        !['CLOSED_COMPLETE', 'CLOSED_INCOMPLETE', 'OUT_OF_SCOPE', 'CANCELLED'].includes(t.state)
    )
    .sort((a, b) => {
      if (a.ticket_number === 'INC0010001') return -1;
      if (b.ticket_number === 'INC0010001') return 1;
      const pOrder = { P1: 0, P2: 1, P3: 2, P4: 3 };
      return pOrder[a.priority] - pOrder[b.priority];
    });

  async function handleStartJob(ticketId: string, ticketNumber: string, currentState: string) {
    if (currentState === 'ASSIGNED') {
      await transitionTicket(ticketId, {
        to_state: 'WORK_IN_PROGRESS',
        via: 'ui',
        reason: 'Technician arrived on-site and started job',
      });
    }
    await launchForTicket(ticketNumber);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            My Field Dispatch Queue
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {currentUser.full_name} ({currentUser.tech_code || currentUser.role}) ·{' '}
            <span className="font-mono font-semibold tabular-nums">{myTickets.length}</span> active jobs
          </p>
        </div>
      </div>

      {myTickets.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <Wrench className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            No active tickets assigned to your queue right now.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {myTickets.map((t) => {
            const eq = store.equipment.find((e) => e.id === t.equipment_id);
            const site = store.sites.find((s) => s.id === t.site_id);
            const sla = store.slaInstances.find((s) => s.ticket_id === t.id);

            return (
              <div
                key={t.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        {t.ticket_number}
                      </span>
                      <PriorityLabel priority={t.priority} />
                    </div>
                    <StateLabel state={t.state} />
                  </div>

                  <h2 className="mt-2.5 text-base font-semibold text-slate-900 dark:text-slate-100">
                    {t.title}
                  </h2>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {site?.name ?? 'Campus'} {eq ? `· ${eq.asset_tag} (${eq.location_detail})` : ''}
                  </p>

                  <div className="mt-3">
                    <SlaBar sla={sla} />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => navigate(`/tickets/${t.ticket_number}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Details
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>

                  {t.state === 'ASSIGNED' ? (
                    <button
                      type="button"
                      onClick={() => handleStartJob(t.id, t.ticket_number, t.state)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Start Job &amp; Voice Copilot
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => launchForTicket(t.ticket_number)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                    >
                      <Mic className="h-3.5 w-3.5" />
                      Resume Copilot
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
