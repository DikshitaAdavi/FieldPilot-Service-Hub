import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { VoiceProvider } from './context/VoiceContext';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { IncidentsListPage } from './pages/IncidentsListPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { MyWorkPage } from './pages/MyWorkPage';
import { VoiceConsolePage } from './pages/VoiceConsolePage';
import { ExpertViewPage } from './pages/ExpertViewPage';
import { PortalPage } from './pages/PortalPage';
import { LoginPage } from './pages/LoginPage';
import { AssetsPage } from './pages/AssetsPage';
import { InventoryOrdersPage } from './pages/InventoryOrdersPage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { SlaOverviewPage } from './pages/SlaOverviewPage';
import { ReportsPage } from './pages/ReportsPage';
import { VoiceAnalyticsPage } from './pages/VoiceAnalyticsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AdminPage } from './pages/AdminPage';

function RouteView() {
  const { loading, error, store, route, navigate, refreshStore } = useApp();

  if (loading && !store) {
    return (
      <div className="space-y-4 py-6">
        <div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      </div>
    );
  }

  if (error && !store) {
    return (
      <div className="mx-auto my-12 max-w-md rounded-xl border border-rose-200 bg-white p-6 text-center dark:border-rose-900/60 dark:bg-slate-900">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-600 dark:text-rose-400" />
        <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
          Unable to Connect to Operations Store
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{error}</p>
        <button
          type="button"
          onClick={() => refreshStore()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Connection
        </button>
      </div>
    );
  }

  const path = route.split('?')[0].replace(/\/+$/, '') || '/dashboard';

  if (path === '/' || path === '/dashboard') {
    return <DashboardPage />;
  }
  if (path === '/portal') {
    return <PortalPage />;
  }
  if (path === '/incidents') {
    return <IncidentsListPage forcedType="INCIDENT" pageTitle="Incidents" />;
  }
  if (path === '/requests') {
    return <IncidentsListPage forcedType="SERVICE_REQUEST" pageTitle="Service Requests" />;
  }
  if (path === '/work-orders') {
    return <IncidentsListPage forcedType="WORK_ORDER" pageTitle="Work Orders" />;
  }
  if (path.startsWith('/tickets/')) {
    const ticketNumber = decodeURIComponent(path.slice('/tickets/'.length));
    return <TicketDetailPage ticketNumber={ticketNumber} />;
  }
  if (path === '/my-work') {
    return <MyWorkPage />;
  }
  if (path === '/voice') {
    return <VoiceConsolePage />;
  }
  if (path.startsWith('/expert/')) {
    const channel = decodeURIComponent(path.slice('/expert/'.length));
    return <ExpertViewPage channel={channel} />;
  }
  if (path === '/assets') {
    return <AssetsPage />;
  }
  if (path === '/inventory') {
    return <InventoryOrdersPage />;
  }
  if (path === '/kb') {
    return <KnowledgeBasePage />;
  }
  if (path === '/approvals') {
    return <ApprovalsPage />;
  }
  if (path === '/sla') {
    return <SlaOverviewPage />;
  }
  if (path === '/reports') {
    return <ReportsPage />;
  }
  if (path === '/voice-analytics') {
    return <VoiceAnalyticsPage />;
  }
  if (path === '/notifications') {
    return <NotificationsPage />;
  }
  if (path === '/admin') {
    return <AdminPage />;
  }
  if (path === '/login') {
    return <LoginPage />;
  }

  return (
    <div className="mx-auto my-12 max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
      <p className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500">
        404 · Route Not Found
      </p>
      <h2 className="mt-2 font-display text-xl font-bold text-slate-900 dark:text-slate-100">
        Workspace View Unavailable
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        The requested route <span className="font-mono">{path}</span> does not match an active FieldPilot workspace.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
        >
          Go to Dashboard
        </button>
        <button
          type="button"
          onClick={() => navigate('/portal')}
          className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Service Portal
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <VoiceProvider>
        <AppShell>
          <RouteView />
        </AppShell>
      </VoiceProvider>
    </AppProvider>
  );
}
