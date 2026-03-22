import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

import { ScrollText, Pause, Play } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
  data?: unknown;
}

const LEVEL_COLORS: Record<string, string> = {
  debug: 'text-gray-500',
  info: 'text-blue-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(true);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    shouldReconnectRef.current = true;

    const connect = () => {
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/logs`);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'history') {
          setLogs(data.logs);
        } else if (data.type === 'log') {
          setLogs(prev => [...prev.slice(-500), data]);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!shouldReconnectRef.current) return;
        reconnectTimerRef.current = window.setTimeout(connect, 3000);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(atBottom);
  };

  const filtered = logs.filter(log => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (filterSource !== 'all' && log.source !== filterSource) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Logs</h1>
            <p className="text-sm text-gray-400">Real-time system logs</p>
          </div>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              autoScroll ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-gray-400 border-slate-700'
            }`}
          >
            {autoScroll ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            Auto-scroll {autoScroll ? 'on' : 'off'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-3">
          <select
            value={filterLevel}
            onChange={e => setFilterLevel(e.target.value)}
            className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
          <select
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
            className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Sources</option>
            <option value="agent">Agent</option>
            <option value="integration">Integration</option>
            <option value="scheduler">Scheduler</option>
            <option value="server">Server</option>
            <option value="chat">Chat</option>
            <option value="webhook">Webhook</option>
            <option value="llm">LLM</option>
          </select>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="flex-1 px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Log Stream */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs p-3 space-y-0.5"
        >
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <ScrollText className="w-6 h-6 mr-2" />
              Waiting for logs...
            </div>
          ) : (
            filtered.map((log, i) => (
              <motion.div
                key={`${log.timestamp}-${i}`}
                className="flex gap-2 py-0.5 hover:bg-slate-900/50 px-1 rounded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <span className="text-gray-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`shrink-0 uppercase w-12 ${LEVEL_COLORS[log.level] || 'text-gray-400'}`}>{log.level}</span>
                <span className="text-purple-400 shrink-0 w-20">[{log.source}]</span>
                <span className="text-gray-300">{log.message}</span>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
