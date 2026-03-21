export interface WakeHook {
  /** Unique event name, e.g. 'health_down', 'webhook_received', 'queue_stalled' */
  event: string;
  /** Human-readable description shown in the UI */
  description: string;
  /** Default prompt sent to the agent when this hook fires */
  defaultPrompt: string;
  /** Whether this hook is enabled by default */
  enabledByDefault?: boolean;
}

export interface IntegrationManifest {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  version: string;
  credentials: CredentialField[];
  healthCheck: {
    endpoint: string;
    /** Polling interval in seconds */
    interval: number;
    /** Timeout in seconds */
    timeout: number;
  };
  webhooks?: {
    path: string;
    description: string;
  };
  /** Wake hooks - events that can trigger the LLM agent */
  wakeHooks?: WakeHook[];
}

export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'number';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  docsUrl?: string;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface ToolContext {
  getClient(integrationId: string): IntegrationClient;
  log(message: string): void;
}

export interface IntegrationClient {
  get(path: string, params?: Record<string, string>): Promise<any>;
  post(path: string, body?: unknown): Promise<any>;
  put(path: string, body?: unknown): Promise<any>;
  delete(path: string): Promise<any>;
}

export interface ToolDefinition {
  name: string;
  integration: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  ui: {
    category: string;
    dangerLevel: 'low' | 'medium' | 'high';
    testable: boolean;
    testDefaults?: Record<string, unknown>;
  };
  handler: (params: Record<string, any>, ctx: ToolContext) => Promise<ToolResult>;
}

export interface LoadedIntegration {
  id: string;
  manifest: IntegrationManifest;
  tools: ToolDefinition[];
  createClient: (creds: Record<string, string>) => IntegrationClient;
  status: 'configured' | 'unconfigured' | 'healthy' | 'unhealthy';
}
