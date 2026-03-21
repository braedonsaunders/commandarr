type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogSource = 'agent' | 'integration' | 'scheduler' | 'server' | 'chat' | 'webhook' | 'llm' | 'widget';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  data?: unknown;
}

type LogListener = (entry: LogEntry) => void;

class Logger {
  private listeners: LogListener[] = [];
  private buffer: LogEntry[] = [];
  private maxBuffer = 1000;

  private log(level: LogLevel, source: LogSource, message: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      data,
    };

    this.buffer.push(entry);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.shift();
    }

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${source}]`;
    if (level === 'error') {
      console.error(prefix, message, data ?? '');
    } else if (level === 'warn') {
      console.warn(prefix, message, data ?? '');
    } else {
      console.log(prefix, message, data ?? '');
    }

    for (const listener of this.listeners) {
      listener(entry);
    }
  }

  debug(source: LogSource, message: string, data?: unknown) {
    this.log('debug', source, message, data);
  }

  info(source: LogSource, message: string, data?: unknown) {
    this.log('info', source, message, data);
  }

  warn(source: LogSource, message: string, data?: unknown) {
    this.log('warn', source, message, data);
  }

  error(source: LogSource, message: string, data?: unknown) {
    this.log('error', source, message, data);
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getRecentLogs(count = 100): LogEntry[] {
    return this.buffer.slice(-count);
  }
}

export const logger = new Logger();
export type { LogEntry, LogLevel, LogSource };
