import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  EscalationTarget,
  PendingReason,
  Profile,
  ResolutionCode,
  ServiceReport,
  StoreSnapshot,
  Ticket,
  TicketState,
  TicketType,
} from '../types/domain';
import { fetchJson } from '../lib/apiClient';

export interface IntegrationsStatus {
  gemini: { configured: boolean; model: string; sttModel: string; ttsModel: string };
  agora: { configured: boolean; appId: string | null; hasCertificate: boolean };
  murf: { configured: boolean; model: string; voiceId: string; supportedVoices: string[] };
  storage: { mode: 'local'; file: string };
}

interface ToastItem {
  id: string;
  title: string;
  body?: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

interface AppContextValue {
  store: StoreSnapshot | null;
  loading: boolean;
  error: string | null;
  currentUser: Profile | null;
  setCurrentUserById: (id: string) => void;
  route: string;
  navigate: (to: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
  refreshStore: () => Promise<void>;
  integrationsStatus: IntegrationsStatus | null;
  refreshIntegrations: () => Promise<void>;
  createTicket: (payload: {
    title: string;
    description: string;
    type?: TicketType;
    category_id?: string | null;
    site_id?: string | null;
    equipment_id?: string | null;
    impact?: Ticket['impact'];
    urgency?: Ticket['urgency'];
    source?: Ticket['source'];
  }) => Promise<Ticket>;
  transitionTicket: (
    idOrNumber: string,
    payload: {
      to_state: TicketState;
      via?: 'ui' | 'voice' | 'automation';
      reason?: string;
      pending_reason?: PendingReason;
      escalation_target?: EscalationTarget;
      workaround_description?: string;
      resolution_code?: ResolutionCode;
      resolution_notes?: string;
      out_of_scope_justification?: string;
      out_of_scope_redirect?: string;
      closed_incomplete_reason?: string;
      assigned_to?: string;
    }
  ) => Promise<Ticket>;
  assignTicket: (idOrNumber: string, assigned_to: string | null, assignment_group_id?: string | null) => Promise<void>;
  addActivity: (idOrNumber: string, body: string, is_internal: boolean) => Promise<void>;
  logWork: (idOrNumber: string, minutes_spent: number, work_type: string, notes: string) => Promise<void>;
  toggleWoTask: (taskId: string) => Promise<void>;
  submitCatalogRequest: (catalog_item_id: string, form_data: Record<string, string>, site_id?: string) => Promise<Ticket>;
  decideApproval: (approvalId: string, status: 'Approved' | 'Rejected', comments?: string) => Promise<void>;
  createPurchaseOrder: (payload: {
    ticket_id?: string | null;
    warehouse_id: string;
    part_id: string;
    quantity: number;
    is_urgent: boolean;
    notes?: string;
  }) => Promise<unknown>;
  updatePoStatus: (poId: string, status: string) => Promise<void>;
  addKbDoc: (payload: {
    title: string;
    doc_type: string;
    equipment_model?: string;
    hazard_level: string;
    safety_sop?: string;
    content: string;
    tags: string[];
  }) => Promise<void>;
  markNotificationsRead: (notificationId?: string) => Promise<void>;
  resolveConfirmation: (confirmationId: string, decision: 'confirmed' | 'cancelled', via?: 'voice' | 'click') => Promise<unknown>;
  generateReport: (ticketNumber: string, sessionId?: string | null) => Promise<ServiceReport>;
  toggleAutomationRule: (ruleId: string) => Promise<void>;
  runSlaTick: () => Promise<void>;
  resetDemo: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<StoreSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string>(() => {
    return localStorage.getItem('fp_user_id') || 'usr-tech-arjun';
  });
  const [route, setRoute] = useState<string>(() => {
    const path = window.location.pathname;
    return path === '/' ? '/dashboard' : path;
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('fp_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [commandOpen, setCommandOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [integrationsStatus, setIntegrationsStatus] = useState<IntegrationsStatus | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('fp_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const pushToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [{ ...toast, id }, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshIntegrations = useCallback(async () => {
    try {
      const status = await fetchJson<IntegrationsStatus>('/api/integrations/status');
      setIntegrationsStatus(status);
    } catch {
      // ignore background status refresh failure
    }
  }, []);

  const refreshStore = useCallback(async () => {
    try {
      const data = await fetchJson<StoreSnapshot>('/api/store');
      setStore(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load FieldPilot data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStore();
    refreshIntegrations();
    const es = new EventSource('/api/events');
    es.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data);
        if (parsed.type && parsed.type !== 'connected') {
          refreshStore();
        }
      } catch {
        // ignore ping
      }
    };
    return () => es.close();
  }, [refreshStore, refreshIntegrations]);

  useEffect(() => {
    const onPopState = () => {
      const p = window.location.pathname;
      setRoute(p === '/' ? '/dashboard' : p);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const navigate = useCallback((to: string) => {
    if (window.location.pathname !== to) {
      window.history.pushState({}, '', to);
    }
    setRoute(to);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const currentUser = useMemo(() => {
    if (!store) return null;
    return store.profiles.find((p) => p.id === activeUserId) ?? store.profiles[0] ?? null;
  }, [store, activeUserId]);

  const setCurrentUserById = useCallback(
    (id: string) => {
      setActiveUserId(id);
      localStorage.setItem('fp_user_id', id);
      const user = store?.profiles.find((p) => p.id === id);
      if (user) {
        pushToast({
          title: `Switched role to ${user.full_name}`,
          body: `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} workspace active`,
          tone: 'info',
        });
        if (user.role === 'requester' && !route.startsWith('/portal') && !route.startsWith('/tickets')) {
          navigate('/portal');
        } else if (user.role !== 'requester' && route === '/portal') {
          navigate('/dashboard');
        }
      }
    },
    [store, pushToast, route, navigate]
  );

  async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
    const data = await fetchJson<T>(url, options);
    await refreshStore();
    return data;
  }

  const createTicket: AppContextValue['createTicket'] = async (payload) => {
    const res = await apiJson<{ ticket: Ticket }>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ ...payload, requester_id: currentUser?.id ?? 'usr-req-ananya' }),
    });
    pushToast({ title: `Created ${res.ticket.ticket_number}`, body: res.ticket.title, tone: 'success' });
    return res.ticket;
  };

  const transitionTicket: AppContextValue['transitionTicket'] = async (idOrNumber, payload) => {
    const res = await apiJson<{ ticket: Ticket; message: string }>(`/api/tickets/${idOrNumber}/transition`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, actor_id: currentUser?.id }),
    });
    pushToast({ title: `${res.ticket.ticket_number} updated`, body: res.message, tone: 'success' });
    return res.ticket;
  };

  const assignTicket: AppContextValue['assignTicket'] = async (idOrNumber, assigned_to, assignment_group_id) => {
    await apiJson(`/api/tickets/${idOrNumber}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assigned_to, assignment_group_id, actor_id: currentUser?.id }),
    });
    pushToast({ title: 'Assignment updated', tone: 'success' });
  };

  const addActivity: AppContextValue['addActivity'] = async (idOrNumber, body, is_internal) => {
    await apiJson(`/api/tickets/${idOrNumber}/activity`, {
      method: 'POST',
      body: JSON.stringify({ body, is_internal, actor_id: currentUser?.id }),
    });
  };

  const logWork: AppContextValue['logWork'] = async (idOrNumber, minutes_spent, work_type, notes) => {
    await apiJson(`/api/tickets/${idOrNumber}/work-log`, {
      method: 'POST',
      body: JSON.stringify({ minutes_spent, work_type, notes, user_id: currentUser?.id }),
    });
    pushToast({ title: `Logged ${minutes_spent}m work`, tone: 'success' });
  };

  const toggleWoTask: AppContextValue['toggleWoTask'] = async (taskId) => {
    await apiJson(`/api/work-order-tasks/${taskId}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ actor_id: currentUser?.id }),
    });
  };

  const submitCatalogRequest: AppContextValue['submitCatalogRequest'] = async (catalog_item_id, form_data, site_id) => {
    const res = await apiJson<{ ticket: Ticket }>('/api/catalog-requests', {
      method: 'POST',
      body: JSON.stringify({
        catalog_item_id,
        form_data,
        site_id: site_id ?? currentUser?.site_id,
        requester_id: currentUser?.id ?? 'usr-req-ananya',
      }),
    });
    pushToast({ title: `Request ${res.ticket.ticket_number} submitted`, tone: 'success' });
    return res.ticket;
  };

  const decideApproval: AppContextValue['decideApproval'] = async (approvalId, status, comments) => {
    await apiJson(`/api/approvals/${approvalId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ status, comments, actor_id: currentUser?.id }),
    });
    pushToast({ title: `Approval ${status}`, tone: status === 'Approved' ? 'success' : 'warning' });
  };

  const createPurchaseOrder: AppContextValue['createPurchaseOrder'] = async (payload) => {
    const res = await apiJson('/api/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({ ...payload, requested_by: currentUser?.id ?? 'usr-tech-arjun' }),
    });
    pushToast({ title: 'Purchase Order created', tone: 'success' });
    return res;
  };

  const updatePoStatus: AppContextValue['updatePoStatus'] = async (poId, status) => {
    await apiJson(`/api/purchase-orders/${poId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    pushToast({ title: `Order marked ${status}`, tone: 'info' });
  };

  const addKbDoc: AppContextValue['addKbDoc'] = async (payload) => {
    await apiJson('/api/kb', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    pushToast({ title: 'Knowledge article published', tone: 'success' });
  };

  const markNotificationsRead: AppContextValue['markNotificationsRead'] = async (notification_id) => {
    await apiJson('/api/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ user_id: currentUser?.id, notification_id }),
    });
  };

  const resolveConfirmation: AppContextValue['resolveConfirmation'] = async (confirmationId, decision, via = 'click') => {
    const res = await apiJson(`/api/confirmations/${confirmationId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ decision, via, actor_id: currentUser?.id }),
    });
    pushToast({
      title: decision === 'confirmed' ? 'Action confirmed & executed' : 'Action cancelled',
      tone: decision === 'confirmed' ? 'success' : 'info',
    });
    return res;
  };

  const generateReport: AppContextValue['generateReport'] = async (ticketNumber, sessionId) => {
    const rpt = await apiJson<ServiceReport>('/api/reports/generate', {
      method: 'POST',
      body: JSON.stringify({
        ticket_number: ticketNumber,
        actor_id: currentUser?.id ?? 'usr-tech-arjun',
        session_id: sessionId ?? null,
      }),
    });
    pushToast({ title: `Generated ${rpt.report_number}`, tone: 'success' });
    return rpt;
  };

  const toggleAutomationRule: AppContextValue['toggleAutomationRule'] = async (ruleId) => {
    await apiJson(`/api/admin/rules/${ruleId}/toggle`, { method: 'POST' });
  };

  const runSlaTick: AppContextValue['runSlaTick'] = async () => {
    const res = await apiJson<{ alerts_sent: number; auto_escalated: number; breached: number }>('/api/admin/sla-tick', {
      method: 'POST',
    });
    pushToast({
      title: 'SLA Monitor Sweep Completed',
      body: `${res.auto_escalated} escalated · ${res.breached} breached · ${res.alerts_sent} alerts`,
      tone: 'info',
    });
  };

  const resetDemo: AppContextValue['resetDemo'] = async () => {
    await apiJson('/api/admin/reset-demo', { method: 'POST' });
    pushToast({ title: 'Demo dataset restored', tone: 'success' });
  };

  return (
    <AppContext.Provider
      value={{
        store,
        loading,
        error,
        currentUser,
        setCurrentUserById,
        route,
        navigate,
        theme,
        toggleTheme,
        commandOpen,
        setCommandOpen,
        toasts,
        pushToast,
        dismissToast,
        refreshStore,
        integrationsStatus,
        refreshIntegrations,
        createTicket,
        transitionTicket,
        assignTicket,
        addActivity,
        logWork,
        toggleWoTask,
        submitCatalogRequest,
        decideApproval,
        createPurchaseOrder,
        updatePoStatus,
        addKbDoc,
        markNotificationsRead,
        resolveConfirmation,
        generateReport,
        toggleAutomationRule,
        runSlaTick,
        resetDemo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
