import { useState, useEffect, useMemo, createContext, useContext, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Router context ──────────────────────────────────────────────────

interface RouterCtx {
  path: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterCtx>({ path: '/', navigate: () => {} });

export function useRouter() {
  return useContext(RouterContext);
}

// ─── Page imports ───────────────────────────────────────────────────

import DashboardPage from './routes/index';
import ChatPage from './routes/chat';
import IntegrationsPage from './routes/integrations/index';
import IntegrationDetailPage from './routes/integrations/detail';
import AutomationsPage from './routes/automations';
import WidgetsPage from './routes/widgets';
import LLMSettingsPage from './routes/settings/llm';
import GeneralSettingsPage from './routes/settings/general';
import LogsPage from './routes/logs';

// ─── Router component ───────────────────────────────────────────────

function PageRouter({ path }: { path: string }) {
  if (path === '/' || path === '') return <DashboardPage />;
  if (path === '/chat') return <ChatPage />;
  if (path === '/integrations') return <IntegrationsPage />;
  if (path.startsWith('/integrations/')) return <IntegrationDetailPage />;
  if (path === '/automations') return <AutomationsPage />;
  if (path === '/widgets') return <WidgetsPage />;
  if (path === '/settings/llm') return <LLMSettingsPage />;
  if (path === '/settings/general' || path === '/settings') return <GeneralSettingsPage />;
  if (path === '/logs') return <LogsPage />;
  return <DashboardPage />;
}

// ─── App ─────────────────────────────────────────────────────────────

export function App() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
    [],
  );

  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const navigate = useCallback((to: string) => {
    window.history.pushState(null, '', to);
    setPath(to);
  }, []);

  // Intercept anchor clicks for SPA navigation
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (
        anchor &&
        anchor.href &&
        anchor.origin === window.location.origin &&
        !anchor.hasAttribute('target') &&
        !anchor.hasAttribute('download') &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        navigate(anchor.pathname);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterContext.Provider value={{ path, navigate }}>
        <PageRouter path={path} />
      </RouterContext.Provider>
    </QueryClientProvider>
  );
}
