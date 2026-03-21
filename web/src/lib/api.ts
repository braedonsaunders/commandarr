import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Types ───────────────────────────────────────────────────────────

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  version: string;
  status: 'healthy' | 'unhealthy' | 'unconfigured';
  toolCount: number;
  credentials: CredentialField[];
  webhooks?: { path: string; description: string };
}

export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'number' | 'select';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  docsUrl?: string;
  options?: { label: string; value: string }[];
  value?: string;
}

export interface IntegrationTool {
  name: string;
  integration: string;
  description: string;
  parameters: Record<string, unknown>;
  ui: {
    category: string;
    dangerLevel: 'low' | 'medium' | 'high';
    testable: boolean;
    testDefaults?: Record<string, unknown>;
  };
}

export interface WebhookEvent {
  id: string;
  integration: string;
  event: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: string;
}

export interface ToolCall {
  id: string;
  name: string;
  params: Record<string, unknown>;
  result?: Record<string, unknown> | string;
  status: 'pending' | 'success' | 'error';
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string;
  prompt: string;
  conditions?: {
    integration: string;
    status: 'healthy' | 'unhealthy';
  };
  notification?: {
    platform: 'telegram' | 'discord' | 'none';
    chatId?: string;
  };
  lastRun?: string;
  lastResult?: string;
  nextRun?: string;
  createdAt: string;
  runHistory?: AutomationRun[];
}

export interface AutomationRun {
  id: string;
  automationId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'success' | 'error';
  result?: string;
}

export interface Widget {
  id: string;
  name: string;
  description: string;
  html: string;
  createdAt: string;
  updatedAt: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  enabled: boolean;
  config: Record<string, string>;
  configSchema: {
    fields: ConfigField[];
    testPrompt?: string;
  };
  currentModel?: string;
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'url' | 'number';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[];
  default?: string;
}

export interface LLMModel {
  id: string;
  name: string;
  contextLength?: number;
  pricing?: { prompt: number; completion: number };
}

export interface AppSettings {
  appName: string;
  timezone: string;
  telegramBotToken?: string;
  discordBotToken?: string;
  version: string;
}

export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: 'agent' | 'integration' | 'scheduler' | 'system';
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

// ─── Fetch Helpers ───────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw new Error(error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Integration Hooks ───────────────────────────────────────────────

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: () => apiFetch<Integration[]>('/integrations'),
  });
}

export function useIntegration(id: string) {
  return useQuery({
    queryKey: ['integrations', id],
    queryFn: () => apiFetch<Integration & { tools: IntegrationTool[]; webhookEvents: WebhookEvent[] }>(
      `/integrations/${id}`
    ),
    enabled: !!id,
  });
}

export function useUpdateCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, credentials }: { id: string; credentials: Record<string, string> }) =>
      apiFetch(`/integrations/${id}/credentials`, {
        method: 'PUT',
        body: JSON.stringify(credentials),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      qc.invalidateQueries({ queryKey: ['integrations', id] });
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean; message: string; latencyMs: number }>(
        `/integrations/${id}/test`,
        { method: 'POST' }
      ),
  });
}

// ─── Conversation / Chat Hooks ───────────────────────────────────────

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiFetch<Conversation[]>('/conversations'),
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, message }: { conversationId?: string; message: string }) =>
      apiFetch<{ conversationId: string; message: ChatMessage }>(
        '/chat/send',
        { method: 'POST', body: JSON.stringify({ conversationId, message }) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// ─── Automation Hooks ────────────────────────────────────────────────

export function useAutomations() {
  return useQuery({
    queryKey: ['automations'],
    queryFn: () => apiFetch<Automation[]>('/automations'),
  });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Automation, 'id' | 'createdAt' | 'lastRun' | 'lastResult' | 'nextRun' | 'runHistory'>) =>
      apiFetch<Automation>('/automations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

export function useUpdateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Automation>) =>
      apiFetch<Automation>(`/automations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/automations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

export function useTriggerAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<AutomationRun>(`/automations/${id}/trigger`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

// ─── Widget Hooks ────────────────────────────────────────────────────

export function useWidgets() {
  return useQuery({
    queryKey: ['widgets'],
    queryFn: () => apiFetch<Widget[]>('/widgets'),
  });
}

export function useCreateWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { prompt: string }) =>
      apiFetch<Widget>('/widgets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['widgets'] });
    },
  });
}

export function useDeleteWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/widgets/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['widgets'] });
    },
  });
}

// ─── LLM Provider Hooks ─────────────────────────────────────────────

export function useLLMProviders() {
  return useQuery({
    queryKey: ['llm-providers'],
    queryFn: () => apiFetch<LLMProvider[]>('/llm/providers'),
  });
}

export function useUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; config?: Record<string, string>; enabled?: boolean; currentModel?: string }) =>
      apiFetch(`/llm/providers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llm-providers'] });
    },
  });
}

export function useTestProvider() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean; message: string; latencyMs: number; model: string }>(
        `/llm/providers/${id}/test`,
        { method: 'POST' }
      ),
  });
}

export function useProviderModels(providerId: string) {
  return useQuery({
    queryKey: ['llm-models', providerId],
    queryFn: () => apiFetch<LLMModel[]>(`/llm/providers/${providerId}/models`),
    enabled: !!providerId,
  });
}

export function useUpdateFallbackOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: string[]) =>
      apiFetch('/llm/fallback-order', {
        method: 'PUT',
        body: JSON.stringify({ order }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llm-providers'] });
    },
  });
}

// ─── Settings Hooks ──────────────────────────────────────────────────

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<AppSettings>('/settings'),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AppSettings>) =>
      apiFetch<AppSettings>('/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

// ─── Logs Hook ───────────────────────────────────────────────────────

export function useLogs(params?: { level?: string; source?: string; search?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.level && params.level !== 'all') searchParams.set('level', params.level);
  if (params?.source && params.source !== 'all') searchParams.set('source', params.source);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['logs', params],
    queryFn: () => apiFetch<LogEntry[]>(`/logs${qs ? `?${qs}` : ''}`),
    refetchInterval: 5000,
  });
}
