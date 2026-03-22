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

export interface Model {
  id: string;
  name: string;
  contextLength?: number;
  supportsTools?: boolean;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'done' | 'error';
  text?: string;
  toolCall?: ToolCall;
  error?: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  id: string;
  name: string;
  configSchema: {
    fields: ConfigField[];
    testPrompt?: string;
  };
  configure(config: Record<string, string>): void;
  chat(messages: Message[], tools?: ToolDef[], options?: ChatOptions): AsyncGenerator<StreamChunk>;
  listModels(): Promise<Model[]>;
  supportsToolUse(): boolean;
  supportsStreaming(): boolean;
}
