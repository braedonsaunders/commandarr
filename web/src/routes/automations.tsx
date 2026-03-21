import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { Zap, Plus, Trash2, Play, ChevronDown, ChevronRight } from 'lucide-react';

interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string;
  prompt: string;
  conditions: { integration: string; status: string } | null;
  notification: { platform: string; chatId?: string } | null;
  lastRun: string | null;
  lastResult: string | null;
  nextRun: string | null;
  createdAt: string;
}

const CRON_PRESETS = [
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at 9am', value: '0 9 * * *' },
  { label: 'Weekly on Monday', value: '0 9 * * 1' },
  { label: 'Custom', value: 'custom' },
];

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', schedule: '0 * * * *', customCron: '', prompt: '' });

  const loadAutomations = () => {
    fetch('/api/automations')
      .then(r => r.json())
      .then(data => { setAutomations(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadAutomations(); }, []);

  const handleCreate = async () => {
    const schedule = form.schedule === 'custom' ? form.customCron : form.schedule;
    if (!form.name || !schedule || !form.prompt) return;

    await fetch('/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, schedule, prompt: form.prompt }),
    });
    setShowCreate(false);
    setForm({ name: '', schedule: '0 * * * *', customCron: '', prompt: '' });
    loadAutomations();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this automation?')) return;
    await fetch(`/api/automations/${id}`, { method: 'DELETE' });
    loadAutomations();
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch(`/api/automations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    loadAutomations();
  };

  const handleTrigger = async (id: string) => {
    await fetch(`/api/automations/${id}/run`, { method: 'POST' });
    loadAutomations();
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleString() : 'Never';

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Automations</h1>
            <p className="text-sm text-gray-400 mt-1">Schedule automated tasks for your media stack</p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Automation
          </button>
        </div>

        <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
          <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
            <h2 className="text-lg font-semibold text-gray-100">Create Automation</h2>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Name</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Plex Watchdog"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Schedule</label>
              <select
                value={form.schedule}
                onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500"
              >
                {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {form.schedule === 'custom' && (
                <input
                  value={form.customCron}
                  onChange={e => setForm(f => ({ ...f, customCron: e.target.value }))}
                  placeholder="Cron expression (e.g., */5 * * * *)"
                  className="w-full mt-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Prompt</label>
              <textarea
                value={form.prompt}
                onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                placeholder="What should the agent do? e.g., Check if Plex is responding. If not, restart it."
                rows={3}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-400 hover:text-gray-200">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors">Create</button>
            </div>
          </div>
          </motion.div>
        )}
        </AnimatePresence>

        {loading ? (
          <div className="text-gray-400 text-center py-20">Loading...</div>
        ) : automations.length === 0 ? (
          <div className="text-center py-20">
            <Zap className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No automations configured</p>
            <p className="text-gray-500 text-sm">Create your first automation to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {automations.map((auto, index) => (
              <motion.div
                key={auto.id}
                className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03, duration: 0.25 }}
              >
                <div className="flex items-center px-5 py-4">
                  <button onClick={() => setExpanded(expanded === auto.id ? null : auto.id)} className="mr-3 text-gray-400">
                    {expanded === auto.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-100">{auto.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${auto.enabled ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                        {auto.enabled ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      <code className="text-amber-400/70">{auto.schedule}</code>
                      {auto.nextRun && <> · Next: {formatDate(auto.nextRun)}</>}
                      {auto.lastRun && <> · Last: {formatDate(auto.lastRun)}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button onClick={() => handleTrigger(auto.id)} title="Run now" className="p-2 text-gray-400 hover:text-green-400 hover:bg-slate-800 rounded-lg transition-colors"><Play className="w-4 h-4" /></button>
                    <button onClick={() => handleToggle(auto.id, auto.enabled)} className={`relative w-10 h-5 rounded-full transition-colors ${auto.enabled ? 'bg-amber-500' : 'bg-slate-700'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${auto.enabled ? 'left-5' : 'left-0.5'}`} />
                    </button>
                    <button onClick={() => handleDelete(auto.id)} title="Delete" className="p-2 text-gray-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <AnimatePresence>
                {expanded === auto.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 border-t border-slate-800 pt-3">
                      <p className="text-sm text-gray-300 bg-slate-800 rounded-lg p-3">{auto.prompt}</p>
                      {auto.lastResult && (
                        <div className="mt-3">
                          <h4 className="text-xs font-medium text-gray-400 mb-1">Last Result</h4>
                          <p className="text-sm text-gray-300 bg-slate-800 rounded-lg p-3 whitespace-pre-wrap">{auto.lastResult}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
