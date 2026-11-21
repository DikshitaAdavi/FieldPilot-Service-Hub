import React, { useState } from 'react';
import {
  LayoutDashboard,
  AlertCircle,
  ClipboardList,
  Wrench,
  Mic,
  Cpu,
  Package,
  BookOpen,
  CheckSquare,
  Timer,
  BarChart3,
  Activity,
  Bell,
  Settings,
  Globe,
  Sun,
  Moon,
  Search,
  Menu,
  X,
  ChevronRight,
  LogIn,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useVoice } from '../../context/VoiceContext';
import { CommandPalette } from './CommandPalette';

interface NavSection {
  title: string;
  items: Array<{ label: string; to: string; icon: React.ComponentType<{ className?: string }>; badge?: number }>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    store,
    currentUser,
    setCurrentUserById,
    route,
    navigate,
    theme,
    toggleTheme,
    setCommandOpen,
    toasts,
    dismissToast,
  } = useApp();
  const { session, isListening, isThinking, lockedTicketNumber } = useVoice();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const unreadNotifs =
    store?.notifications.filter((n) => n.user_id === currentUser?.id && !n.is_read).length ?? 0;
  const pendingApprovals =
    store?.approvals.filter((a) => a.status === 'Pending').length ?? 0;

  const isRequester = currentUser?.role === 'requester';

  const sections: NavSection[] = isRequester
    ? [
        {
          title: 'Self-Service',
          items: [
            { label: 'Service Portal', to: '/portal', icon: Globe },
            { label: 'Voice Copilot', to: '/voice', icon: Mic },
            { label: 'Knowledge Base', to: '/kb', icon: BookOpen },
            { label: 'Notifications', to: '/notifications', icon: Bell, badge: unreadNotifs },
          ],
        },
      ]
    : [
        {
          title: 'Operations',
          items: [
            { label: 'Service Portal', to: '/portal', icon: Globe },
            { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
            { label: 'My Field Work', to: '/my-work', icon: Wrench },
            { label: 'Voice Copilot', to: '/voice', icon: Mic },
          ],
        },
        {
          title: 'Tickets & Tasks',
          items: [
            { label: 'Incidents', to: '/incidents', icon: AlertCircle },
            { label: 'Service Requests', to: '/requests', icon: ClipboardList },
            { label: 'Work Orders', to: '/work-orders', icon: CheckSquare },
          ],
        },
        {
          title: 'Assets & Supply',
          items: [
            { label: 'Equipment', to: '/assets', icon: Cpu },
            { label: 'Inventory & POs', to: '/inventory', icon: Package },
            { label: 'Knowledge Base', to: '/kb', icon: BookOpen },
          ],
        },
        {
          title: 'Governance',
          items: [
            { label: 'Approvals', to: '/approvals', icon: CheckSquare, badge: pendingApprovals },
            { label: 'SLA Overview', to: '/sla', icon: Timer },
            { label: 'Reports', to: '/reports', icon: BarChart3 },
            { label: 'Voice Analytics', to: '/voice-analytics', icon: Activity },
            { label: 'Notifications', to: '/notifications', icon: Bell, badge: unreadNotifs },
            { label: 'Admin', to: '/admin', icon: Settings },
          ],
        },
      ];

  const pageTitle = route.startsWith('/tickets/')
    ? `Ticket ${route.split('/tickets/')[1]}`
    : route.startsWith('/expert/')
    ? `Remote Expert · ${route.split('/expert/')[1]}`
    : sections
        .flatMap((s) => s.items)
        .find((i) => route === i.to || route.startsWith(`${i.to}?`))?.label ?? 'FieldPilot Service Hub';

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      <div className="flex h-15 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            navigate(isRequester ? '/portal' : '/dashboard');
            setMobileNavOpen(false);
          }}
          className="text-left font-display text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap"
        >
          FieldPilot Hub
        </button>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="rounded-lg p-1 text-slate-500 lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {section.title}
            </p>
            <div className="mt-1.5 space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = route === item.to || route.startsWith(`${item.to}?`);
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => {
                      navigate(item.to);
                      setMobileNavOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`font-mono text-xs tabular-nums ${
                          active ? 'text-white/90' : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <label className="block px-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Active Persona
        </label>
        <select
          value={currentUser?.id ?? ''}
          onChange={(e) => setCurrentUserById(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          {store?.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name} ({p.role})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            navigate('/login');
            setMobileNavOpen(false);
          }}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <LogIn className="h-3.5 w-3.5" />
          Account Switcher
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 lg:block dark:border-slate-800">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64 border-r border-slate-200 dark:border-slate-800">{sidebarContent}</div>
          <div className="flex-1 bg-slate-950/50" onClick={() => setMobileNavOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Clean Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-15 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs lg:px-8 dark:border-slate-800 dark:bg-slate-900/95">
          {/* Left: Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="rounded-lg p-1.5 text-slate-600 lg:hidden hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="hidden text-slate-400 sm:inline whitespace-nowrap">FieldPilot</span>
              <ChevronRight className="hidden h-3.5 w-3.5 text-slate-400 sm:inline shrink-0" />
              <span className="truncate font-display font-semibold text-slate-900 dark:text-slate-100">
                {pageTitle}
              </span>
            </div>
          </div>

          {/* Center: Search Trigger */}
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-slate-600 whitespace-nowrap shrink-0"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search tickets, assets, parts...</span>
            <kbd className="rounded border border-slate-300 px-1 font-mono text-[10px] dark:border-slate-700">
              ⌘K
            </kbd>
          </button>

          {/* Right: Theme + Primary Copilot Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => navigate('/voice')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Mic className="h-3.5 w-3.5" />
              <span>{session ? `Copilot (${lockedTicketNumber ?? 'Live'})` : 'Voice Copilot'}</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 lg:p-8">{children}</main>
      </div>

      {/* Floating Voice Dock when active outside /voice */}
      {session && route !== '/voice' && (
        <div className="fixed right-5 bottom-5 z-40 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="text-xs">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              Voice Copilot · {lockedTicketNumber ?? 'General'}
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              {isListening ? 'Listening...' : isThinking ? 'Thinking...' : 'Session active'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/voice')}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
          >
            Open Console
          </button>
        </div>
      )}

      {/* Toast Stack */}
      <div className="fixed right-5 top-18 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.body}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="rounded p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <CommandPalette />
    </div>
  );
}
