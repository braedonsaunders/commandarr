import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Download, Upload, Save, Check, Brain, Play, Search,
  ChevronDown, X, GripVertical, Plus, Shield, Eye, EyeOff,
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
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-lg font-semibold text-gray-100">Chat Platforms</h2>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Telegram Bot Token</label>
          <input type="password" value={settings.telegramBotToken || ''} onChange={e => updateSetting('telegramBotToken', e.target.value)}
            placeholder="123456:ABC-DEF1234..." className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
          <p className="text-xs text-gray-500 mt-1">Get this from @BotFather on Telegram</p>
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Discord Bot Token</label>
          <input type="password" value={settings.discordBotToken || ''} onChange={e => updateSetting('discordBotToken', e.target.value)}
            placeholder="Discord bot token" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
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
          {authEnabled ? 'Authentication is enabled. Restart the container for changes to take effect.' : 'Authentication is disabled. Set a username and password below to enable it.'}
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
            Authentication is configured via environment variables (AUTH_USERNAME, AUTH_PASSWORD).
            Setting values here saves them for reference but you must also set the env vars on the container.
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

// ─── Settings Page ──────────────────────────────────────────────────

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'llm', label: 'LLM Providers', icon: Brain },
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
            {activeTab !== 'llm' && (
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
            {activeTab === 'llm' && <LLMTab />}
            {activeTab === 'auth' && <AuthTab settings={settings} updateSetting={updateSetting} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
