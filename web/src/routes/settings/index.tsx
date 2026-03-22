import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Download, Upload, Save, Check, Brain, Play, Search,
  ChevronDown, X, GripVertical, Plus, Shield, Eye, EyeOff, Bell, Zap,
  MessageCircle, Send, Hash, Info,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface ConfigField {
  key: string; label: string; type: string; required: boolean;
  placeholder?: string; helpText?: string; default?: string;
}
interface ProviderInfo {
  id: string; name: string;
  configSchema: { fields: ConfigField[] };
  supportsToolUse: boolean; supportsStreaming: boolean;
}
interface ConfiguredProvider {
  id: string; providerId: string; config: Record<string, string>;
  model: string | null; priority: number; enabled: boolean;
}
interface ModelInfo { id: string; name: string; contextLength?: number; }

// ─── Model Selector ─────────────────────────────────────────────────

function ModelSelector({ providerId, currentModel, onSelect }: {
  providerId: string; currentModel: string; onSelect: (m: string) => void;
}) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchModels = async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/llm/providers/${providerId}/models`);
      const data = await res.json();
      if (Array.isArray(data)) setModels(data);
    } catch {}
    setLoading(false);
    setFetched(true);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return models;
    const q = search.toLowerCase();
    return models.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
  }, [models, search]);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs text-gray-400 mb-1">Model</label>
      <button type="button" onClick={() => { setOpen(true); fetchModels(); }}
        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-gray-100 hover:border-slate-600 focus:outline-none focus:border-amber-500 text-left">
        <span className={currentModel ? 'text-gray-100' : 'text-gray-500'}>{currentModel || 'Select a model...'}</span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-72 flex flex-col">
          <div className="p-2 border-b border-slate-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search models..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? <div className="px-3 py-4 text-sm text-gray-500 text-center">Loading models...</div>
            : filtered.length === 0 ? <div className="px-3 py-4 text-sm text-gray-500 text-center">{models.length === 0 ? 'Save credentials first, then fetch models' : 'No matches'}</div>
            : filtered.map(model => (
              <button key={model.id} type="button" onClick={() => { onSelect(model.id); setOpen(false); setSearch(''); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 flex items-center justify-between ${currentModel === model.id ? 'bg-amber-500/10 text-amber-400' : 'text-gray-300'}`}>
                <div>
                  <div className="font-medium">{model.name || model.id}</div>
                  {model.contextLength && <div className="text-xs text-gray-500">{(model.contextLength / 1000).toFixed(0)}k context</div>}
                </div>
                {currentModel === model.id && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: General ───────────────────────────────────────────────────

function GeneralTab({ settings, updateSetting }: { settings: Record<string, string>; updateSetting: (k: string, v: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" /> General
        </h2>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Application Name</label>
          <input value={settings.appName || 'Commandarr'} onChange={e => updateSetting('appName', e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Timezone</label>
          <input value={settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} onChange={e => updateSetting('timezone', e.target.value)}
            placeholder="America/New_York" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
        </div>
      </div>
      {/* ── Commandarr Helper ── */}
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" /> Commandarr Helper
        </h2>
        <p className="text-xs text-gray-500">
          The helper runs on the host machine for OS-level actions like restarting Plex. Only needed if Plex runs bare-metal (not Docker).
        </p>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Helper URL</label>
          <input value={settings.helperUrl || ''} onChange={e => updateSetting('helperUrl', e.target.value)}
            placeholder="http://host.docker.internal:9484"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Helper Token</label>
          <input type="password" value={settings.helperToken || ''} onChange={e => updateSetting('helperToken', e.target.value)}
            placeholder="Token generated during helper install"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Plex Restart Command</label>
          <input value={settings.plexRestartCommand || ''} onChange={e => updateSetting('plexRestartCommand', e.target.value)}
            placeholder="docker restart plex"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
          <p className="text-xs text-gray-500 mt-1">
            Alternative to the helper — a shell command to restart Plex. Only works if Plex is accessible from inside the container.
          </p>
        </div>
      </div>

      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-lg font-semibold text-gray-100">Backup & Restore</h2>
        <div className="flex gap-3">
          <a href="/api/settings?export=true" className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg border border-slate-700 transition-colors">
            <Download className="w-4 h-4" /> Export Settings
          </a>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg border border-slate-700 transition-colors">
            <Upload className="w-4 h-4" /> Import Settings
          </button>
        </div>
      </div>
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
        <h2 className="text-lg font-semibold text-gray-100 mb-3">About</h2>
        <div className="space-y-1 text-sm text-gray-400">
          <p>Commandarr v1.0.0</p>
          <p>The AI brain for your media stack</p>
          <a href="https://github.com/braedonsaunders/commandarr" target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300">GitHub Repository</a>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Authentication ────────────────────────────────────────────

function AuthTab({ settings, updateSetting }: { settings: Record<string, string>; updateSetting: (k: string, v: string) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const authEnabled = !!(settings.authUsername && settings.authPassword);

  return (
    <div className="space-y-6">
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
          <Shield className="w-5 h-5 text-gray-400" /> Authentication
        </h2>
        <p className="text-sm text-gray-400">
          Protect your Commandarr dashboard with basic authentication. When enabled, all pages require a username and password.
          Webhooks and the health check endpoint are excluded.
        </p>
        <div className={`p-3 rounded-lg text-sm ${authEnabled ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
          {authEnabled ? 'Authentication is enabled. Changes take effect immediately.' : 'Authentication is disabled. Set a username and password below to enable it.'}
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Username</label>
          <input value={settings.authUsername || ''} onChange={e => updateSetting('authUsername', e.target.value)}
            placeholder="admin" autoComplete="off"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Password</label>
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} value={settings.authPassword || ''} onChange={e => updateSetting('authPassword', e.target.value)}
              placeholder="Enter a strong password" autoComplete="new-password"
              className="w-full px-3 py-2 pr-10 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Both username and password must be set to enable authentication.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: LLM Providers ─────────────────────────────────────────────

function LLMTab() {
  const [available, setAvailable] = useState<ProviderInfo[]>([]);
  const [configured, setConfigured] = useState<ConfiguredProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [selectedModel, setSelectedModel] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; response?: string; latency?: number } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProviders = () => {
    fetch('/api/llm/providers').then(r => r.json()).then(data => {
      setAvailable(data.available || []); setConfigured(data.configured || []); setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { loadProviders(); }, []);

  const selectedProvider = available.find(p => p.id === selectedProviderId);

  const handleSelectProvider = (id: string) => {
    const existing = configured.find(c => c.providerId === id);
    setSelectedProviderId(id); setFormValues(existing?.config || {}); setSelectedModel(existing?.model || ''); setTestResult(null);
  };
  const handleSave = async () => {
    if (!selectedProviderId) return;
    setSaving(true);
    try {
      await fetch(`/api/llm/providers/${selectedProviderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: selectedProviderId, config: formValues, model: selectedModel || null, enabled: true }) });
      const res = await fetch('/api/llm/providers'); const data = await res.json();
      setAvailable(data.available || []); setConfigured(data.configured || []); setTestResult(null);
    } catch { alert('Failed to save'); }
    setSaving(false);
  };
  const handleTest = async () => {
    if (!selectedProviderId) return;
    setTesting(true); setTestResult(null);
    try { const res = await fetch(`/api/llm/providers/${selectedProviderId}/test`, { method: 'POST' }); setTestResult(await res.json()); }
    catch { setTestResult({ success: false }); }
    setTesting(false);
  };
  const handleToggle = async (id: string, enabled: boolean) => {
    const conf = configured.find(c => c.id === id); if (!conf) return;
    await fetch(`/api/llm/providers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: conf.providerId, config: conf.config, model: conf.model, enabled: !enabled }) });
    loadProviders();
  };

  if (loading) return <div className="text-gray-400 py-10 text-center">Loading providers...</div>;

  return (
    <div className="space-y-6">
      {configured.filter(p => p.enabled).length > 0 && (
        <div className="p-5 bg-slate-900 rounded-xl border border-slate-800">
          <h2 className="text-sm font-medium text-gray-300 mb-3">Active Providers (Fallback Order)</h2>
          <div className="space-y-1.5">
            {configured.filter(p => p.enabled).sort((a, b) => a.priority - b.priority).map((p, i) => {
              const info = available.find(a => a.id === p.providerId);
              return (
                <motion.div key={p.id}
                  className="flex items-center gap-3 px-3 py-2.5 bg-slate-800 rounded-lg group cursor-pointer hover:bg-slate-700/50"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, duration: 0.25 }}
                  onClick={() => handleSelectProvider(p.providerId)}>
                  <GripVertical className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-amber-400 w-5">{i + 1}.</span>
                  <Brain className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-200 flex-1">{info?.name || p.providerId}</span>
                  {p.model && <span className="text-xs text-gray-500 font-mono">{p.model}</span>}
                  <span className="text-xs text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Active</span>
                  <button onClick={(e) => { e.stopPropagation(); handleToggle(p.id, p.enabled); }}
                    className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" title="Disable">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-5 bg-slate-900 rounded-xl border border-slate-800 space-y-4 overflow-visible">
        <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {configured.some(c => c.providerId === selectedProviderId) ? 'Edit Provider' : 'Add Provider'}
        </h2>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Provider</label>
          <select value={selectedProviderId || ''} onChange={e => handleSelectProvider(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer">
            <option value="" disabled>Select a provider...</option>
            {available.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <AnimatePresence>
        {selectedProvider && (
          <motion.div initial={{ height: 0, opacity: 0, overflow: 'hidden' }} animate={{ height: 'auto', opacity: 1, overflow: 'visible' }}
            exit={{ height: 0, opacity: 0, overflow: 'hidden' }} transition={{ duration: 0.25, ease: 'easeInOut' }} className="space-y-4">
            {selectedProvider.configSchema.fields.filter(f => f.key !== 'model').map(field => (
              <div key={field.key}>
                <label className="block text-xs text-gray-400 mb-1">{field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}</label>
                <input type={field.type === 'password' ? 'password' : 'text'} value={formValues[field.key] || ''} onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.value }))}
                  placeholder={field.placeholder || ''} className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
                {field.helpText && <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>}
              </div>
            ))}
            <ModelSelector providerId={selectedProviderId!} currentModel={selectedModel} onSelect={setSelectedModel} />
            {testResult && (
              <div className={`text-sm p-3 rounded-lg ${testResult.success ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {testResult.success ? `Connection successful (${testResult.latency}ms)` : 'Connection failed'}
                {testResult.response && <p className="text-xs mt-1 opacity-70 truncate">{testResult.response}</p>}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Provider'}
              </button>
              <button onClick={handleTest} disabled={testing} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50">
                <Play className="w-3.5 h-3.5" /> {testing ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Tab: Agent Behavior ────────────────────────────────────────────

interface WakeHook {
  integrationId: string;
  event: string;
  prompt: string;
  enabled: boolean;
}

function AgentTab({ settings, updateSetting }: { settings: Record<string, string>; updateSetting: (k: string, v: string) => void }) {
  const [hooks, setHooks] = useState<WakeHook[]>([]);
  const [loadingHooks, setLoadingHooks] = useState(true);
  const [savingHook, setSavingHook] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [promptValue, setPromptValue] = useState('');

  useEffect(() => {
    fetch('/api/wake-hooks').then(r => r.json()).then(data => { setHooks(data); setLoadingHooks(false); }).catch(() => setLoadingHooks(false));
  }, []);

  const toggleHook = async (integrationId: string, event: string, enabled: boolean) => {
    const key = `${integrationId}:${event}`;
    setSavingHook(key);
    await fetch(`/api/wake-hooks/${integrationId}/${event}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    setHooks(prev => prev.map(h => h.integrationId === integrationId && h.event === event ? { ...h, enabled } : h));
    setSavingHook(null);
  };

  const savePrompt = async (integrationId: string, event: string) => {
    const key = `${integrationId}:${event}`;
    setSavingHook(key);
    await fetch(`/api/wake-hooks/${integrationId}/${event}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptValue }),
    });
    setHooks(prev => prev.map(h => h.integrationId === integrationId && h.event === event ? { ...h, prompt: promptValue } : h));
    setEditingPrompt(null);
    setSavingHook(null);
  };

  const agentMode = settings.agentMode || 'all';
  const healthInterval = settings.healthCheckInterval || '60';

  return (
    <div className="space-y-6">
      {/* Agent Mode */}
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" /> Agent Activation
        </h2>
        <p className="text-sm text-gray-400">Control when the agent can be triggered automatically.</p>

        <div className="space-y-2">
          {[
            { value: 'all', label: 'Chat + Automations + Wake Hooks', desc: 'Agent responds to chat, runs scheduled automations, and reacts to events (recommended)' },
            { value: 'chat_and_automations', label: 'Chat + Automations Only', desc: 'Agent responds to chat and runs automations, but does not react to integration events' },
            { value: 'chat_only', label: 'Chat Only', desc: 'Agent only responds when you talk to it — no background activity' },
            { value: 'disabled', label: 'Disabled', desc: 'Agent does not respond to anything (integrations still work for widgets/dashboard)' },
          ].map(opt => (
            <label key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${agentMode === opt.value ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800 border border-transparent hover:bg-slate-800/80'}`}>
              <input type="radio" name="agentMode" value={opt.value} checked={agentMode === opt.value}
                onChange={() => updateSetting('agentMode', opt.value)}
                className="mt-1 accent-amber-500" />
              <div>
                <div className="text-sm font-medium text-gray-200">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Health Check Interval */}
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-lg font-semibold text-gray-100">Health Check Polling</h2>
        <p className="text-sm text-gray-400">How often Commandarr checks if your integrations are online. Used for wake hooks and dashboard status.</p>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Interval (seconds)</label>
          <select value={healthInterval} onChange={e => updateSetting('healthCheckInterval', e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500">
            <option value="30">Every 30 seconds</option>
            <option value="60">Every 60 seconds (default)</option>
            <option value="120">Every 2 minutes</option>
            <option value="300">Every 5 minutes</option>
            <option value="600">Every 10 minutes</option>
          </select>
        </div>
      </div>

      {/* Wake Hooks */}
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-400" /> Wake Hooks
        </h2>
        <p className="text-sm text-gray-400">
          Events that automatically wake the agent and trigger an action. Each hook has a prompt that tells the agent what to do.
        </p>

        {loadingHooks ? (
          <div className="text-gray-500 text-sm text-center py-4">Loading wake hooks...</div>
        ) : hooks.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-4">No wake hooks available. Configure integrations first.</div>
        ) : (
          <div className="space-y-2">
            {hooks.map(hook => {
              const key = `${hook.integrationId}:${hook.event}`;
              const isEditing = editingPrompt === key;
              return (
                <div key={key} className="bg-slate-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-200">{hook.integrationId}</span>
                        <span className="text-xs text-gray-500">→</span>
                        <span className="text-xs font-mono text-amber-400/80">{hook.event}</span>
                      </div>
                    </div>
                    <button onClick={() => toggleHook(hook.integrationId, hook.event, !hook.enabled)}
                      disabled={savingHook === key}
                      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${hook.enabled ? 'bg-amber-500' : 'bg-slate-600'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${hook.enabled ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {/* Prompt */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea value={promptValue} onChange={e => setPromptValue(e.target.value)} rows={3}
                        className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => savePrompt(hook.integrationId, hook.event)}
                          className="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-black font-medium rounded transition-colors">Save</button>
                        <button onClick={() => setEditingPrompt(null)}
                          className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingPrompt(key); setPromptValue(hook.prompt); }}
                      className="w-full text-left text-xs text-gray-400 bg-slate-900/50 rounded p-2 hover:bg-slate-900 transition-colors">
                      {hook.prompt}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Toggle Component ───────────────────────────────────────────────

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!enabled)} disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${enabled ? 'bg-amber-500' : 'bg-slate-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}

function ToggleRow({ label, description, enabled, onChange }: { label: string; description: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 min-w-0 mr-4">
        <div className="text-sm text-gray-200">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <Toggle enabled={enabled} onChange={onChange} />
    </div>
  );
}

// ─── Tab: Chat Platforms ────────────────────────────────────────────

function ChatPlatformsTab({ settings, updateSetting }: { settings: Record<string, string>; updateSetting: (k: string, v: string) => void }) {
  const telegramEnabled = settings.telegramEnabled !== 'false';
  const discordEnabled = settings.discordEnabled !== 'false';

  // Notification toggles - default to true
  const getBool = (key: string, def = true) => settings[key] === undefined ? def : settings[key] === 'true';

  return (
    <div className="space-y-6">
      {/* ── Telegram ── */}
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-400" /> Telegram
          </h2>
          <Toggle enabled={telegramEnabled} onChange={v => updateSetting('telegramEnabled', String(v))} />
        </div>

        <div className={telegramEnabled ? '' : 'opacity-40 pointer-events-none'}>
          {/* Bot Token */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Bot Token</label>
              <input type="password" value={settings.telegramBotToken || ''} onChange={e => updateSetting('telegramBotToken', e.target.value)}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
              <p className="text-xs text-gray-500 mt-1">
                Create a bot via <span className="text-amber-400">@BotFather</span> on Telegram. Send <span className="font-mono text-gray-400">/newbot</span>, follow the prompts, and paste the token here.
              </p>
            </div>

            {/* Allowed User IDs */}
            <div>
              <label className="block text-sm text-gray-300 mb-1">Allowed User IDs</label>
              <input value={settings.telegramAllowedUsers || ''} onChange={e => updateSetting('telegramAllowedUsers', e.target.value)}
                placeholder="123456789, 987654321"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated Telegram user IDs that can interact with the bot. Leave blank to allow anyone.
                Send <span className="font-mono text-gray-400">/start</span> to <span className="text-amber-400">@userinfobot</span> to find your ID.
              </p>
            </div>

            {/* Notification Chat ID */}
            <div>
              <label className="block text-sm text-gray-300 mb-1">Notification Chat ID</label>
              <input value={settings.telegramNotifyChatId || ''} onChange={e => updateSetting('telegramNotifyChatId', e.target.value)}
                placeholder="123456789 or -1001234567890"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
              <p className="text-xs text-gray-500 mt-1">
                Chat or group ID where the bot sends alerts and notifications. Can be a user ID (for DMs) or a group ID (starts with <span className="font-mono text-gray-400">-100</span>).
              </p>
            </div>
          </div>

          {/* Telegram Notification Preferences */}
          <div className="mt-5 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-400" /> Notification Preferences
            </h3>
            <div className="space-y-1">
              <ToggleRow label="Integration Status Changes" description="Alert when integrations go online/offline"
                enabled={getBool('telegramNotifyIntegrationStatus')} onChange={v => updateSetting('telegramNotifyIntegrationStatus', String(v))} />
              <ToggleRow label="Automation Results" description="Send results when scheduled automations complete"
                enabled={getBool('telegramNotifyAutomationResults')} onChange={v => updateSetting('telegramNotifyAutomationResults', String(v))} />
              <ToggleRow label="New Media Added" description="Notify when new movies, shows, or music are added"
                enabled={getBool('telegramNotifyNewMedia')} onChange={v => updateSetting('telegramNotifyNewMedia', String(v))} />
              <ToggleRow label="Request Fulfillment" description="Notify when media requests are completed"
                enabled={getBool('telegramNotifyRequests')} onChange={v => updateSetting('telegramNotifyRequests', String(v))} />
              <ToggleRow label="System Warnings" description="Disk space, high CPU, failed health checks, etc."
                enabled={getBool('telegramNotifySystemWarnings')} onChange={v => updateSetting('telegramNotifySystemWarnings', String(v))} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Discord ── */}
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-indigo-400" /> Discord
          </h2>
          <Toggle enabled={discordEnabled} onChange={v => updateSetting('discordEnabled', String(v))} />
        </div>

        <div className={discordEnabled ? '' : 'opacity-40 pointer-events-none'}>
          <div className="space-y-4">
            {/* Bot Token */}
            <div>
              <label className="block text-sm text-gray-300 mb-1">Bot Token</label>
              <input type="password" value={settings.discordBotToken || ''} onChange={e => updateSetting('discordBotToken', e.target.value)}
                placeholder="MTIz...your-bot-token"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
              <p className="text-xs text-gray-500 mt-1">
                Create a bot at the <span className="text-amber-400">Discord Developer Portal</span>. Enable the Message Content intent under Bot settings, then copy the token.
              </p>
            </div>

            {/* Allowed User IDs */}
            <div>
              <label className="block text-sm text-gray-300 mb-1">Allowed User IDs</label>
              <input value={settings.discordAllowedUsers || ''} onChange={e => updateSetting('discordAllowedUsers', e.target.value)}
                placeholder="123456789012345678, 987654321098765432"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated Discord user IDs. Leave blank to allow anyone who can @mention the bot. Enable Developer Mode in Discord settings, then right-click your profile to copy your ID.
              </p>
            </div>

            {/* Notification Channel ID */}
            <div>
              <label className="block text-sm text-gray-300 mb-1">Notification Channel ID</label>
              <input value={settings.discordNotifyChannelId || ''} onChange={e => updateSetting('discordNotifyChannelId', e.target.value)}
                placeholder="1234567890123456789"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
              <p className="text-xs text-gray-500 mt-1">
                Channel ID where the bot sends alerts. Right-click a channel with Developer Mode enabled to copy its ID.
              </p>
            </div>
          </div>

          {/* Discord Notification Preferences */}
          <div className="mt-5 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-400" /> Notification Preferences
            </h3>
            <div className="space-y-1">
              <ToggleRow label="Integration Status Changes" description="Alert when integrations go online/offline"
                enabled={getBool('discordNotifyIntegrationStatus')} onChange={v => updateSetting('discordNotifyIntegrationStatus', String(v))} />
              <ToggleRow label="Automation Results" description="Send results when scheduled automations complete"
                enabled={getBool('discordNotifyAutomationResults')} onChange={v => updateSetting('discordNotifyAutomationResults', String(v))} />
              <ToggleRow label="New Media Added" description="Notify when new movies, shows, or music are added"
                enabled={getBool('discordNotifyNewMedia')} onChange={v => updateSetting('discordNotifyNewMedia', String(v))} />
              <ToggleRow label="Request Fulfillment" description="Notify when media requests are completed"
                enabled={getBool('discordNotifyRequests')} onChange={v => updateSetting('discordNotifyRequests', String(v))} />
              <ToggleRow label="System Warnings" description="Disk space, high CPU, failed health checks, etc."
                enabled={getBool('discordNotifySystemWarnings')} onChange={v => updateSetting('discordNotifySystemWarnings', String(v))} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Setup Tips ── */}
      <div className="p-5 bg-slate-800/50 rounded-xl border border-slate-700/50">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-gray-400" /> Setup Tips
        </h3>
        <ul className="space-y-2 text-xs text-gray-400">
          <li><span className="text-amber-400 font-medium">Telegram:</span> Message your bot after saving to verify it responds. Use a group for shared notifications, or your personal chat for private alerts.</li>
          <li><span className="text-indigo-400 font-medium">Discord:</span> Make sure the bot has been invited to your server with the <span className="font-mono text-gray-400">Send Messages</span> and <span className="font-mono text-gray-400">Read Message History</span> permissions. Mention the bot or DM it to chat.</li>
          <li><span className="text-gray-300 font-medium">Restart required:</span> Changes to bot tokens require a container restart to take effect.</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Settings Page ──────────────────────────────────────────────────

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'chat', label: 'Chat Platforms', icon: MessageCircle },
  { id: 'llm', label: 'LLM Providers', icon: Brain },
  { id: 'agent', label: 'Agent', icon: Zap },
  { id: 'auth', label: 'Authentication', icon: Shield },
] as const;

type TabId = typeof TABS[number]['id'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => { setSettings(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const updateSetting = (key: string, value: string) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch { alert('Failed to save settings'); }
    setSaving(false);
  };

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading...</div>;

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
            <p className="text-sm text-gray-400 mt-1">Configure Commandarr</p>
          </div>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {saved && (
                <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}
                  className="flex items-center gap-1.5 text-sm text-green-400">
                  <Check className="w-4 h-4" /> Saved
                </motion.span>
              )}
            </AnimatePresence>
            {(activeTab === 'general' || activeTab === 'chat' || activeTab === 'auth' || activeTab === 'agent') && (
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 border-b border-slate-800">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}>
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {activeTab === 'general' && <GeneralTab settings={settings} updateSetting={updateSetting} />}
            {activeTab === 'chat' && <ChatPlatformsTab settings={settings} updateSetting={updateSetting} />}
            {activeTab === 'llm' && <LLMTab />}
            {activeTab === 'agent' && <AgentTab settings={settings} updateSetting={updateSetting} />}
            {activeTab === 'auth' && <AuthTab settings={settings} updateSetting={updateSetting} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
