export interface ConfigFileDeclaration {
  /** Unique key used to reference this file (e.g., 'config', 'collections') */
  key: string;
  /** Credential field key that holds the file path (e.g., 'configPath') */
  credentialKey: string;
  /** File format for parse/serialize */
  format: 'yaml' | 'json' | 'toml' | 'text';
  /** Human-readable label */
  label: string;
  /** Max backup count before rotation (default: 10) */
  maxBackups?: number;
}

export interface ConfigFileManager {
  /** Read the raw file content as string */
  readRaw(): Promise<string>;
  /** Read and parse the file into a JS object */
  read(): Promise<unknown>;
  /** Write a parsed object back to file (serializes to the declared format). Auto-backs up first. */
  write(data: unknown): Promise<void>;
  /** Write raw string content. Auto-backs up first. */
  writeRaw(content: string): Promise<void>;
  /** Create a timestamped backup. Returns the backup file path. */
  backup(): Promise<string>;
  /** List all existing backups for this file */
  listBackups(): Promise<Array<{ path: string; timestamp: Date; size: number }>>;
  /** Validate content without writing. Returns null if valid, error string if invalid. */
  validate(data: unknown): Promise<string | null>;
  /** The resolved absolute file path */
  readonly filePath: string;
}

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
  /** Config files this integration manages (enables read/write/backup/validate via ToolContext) */
  configFiles?: ConfigFileDeclaration[];
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
  /** Get a config file manager for a declared config file.
   *  The integration must declare configFiles in its manifest and the user must configure the path. */
  getConfigManager(integrationId: string, fileKey: string): Promise<ConfigFileManager>;
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

export interface PrebuiltWidgetDef {
  id: string;
  slug: string;
  name: string;
  description: string;
  capabilities: string[];
  controls: unknown[];
  html: string;
  css: string;
  js: string;
}

export interface LoadedIntegration {
  id: string;
  manifest: IntegrationManifest;
  tools: ToolDefinition[];
  widgets: PrebuiltWidgetDef[];
  createClient: (creds: Record<string, string>) => IntegrationClient;
  status: 'configured' | 'unconfigured' | 'healthy' | 'unhealthy';
}
