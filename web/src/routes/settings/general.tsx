import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { Settings, Download, Upload, Save, Check } from 'lucide-react';

export default function GeneralSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => { setSettings(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { alert('Failed to save settings'); }
    setSaving(false);
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading...</div>;

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
          <p className="text-sm text-gray-400 mt-1">General configuration</p>
        </div>

        {/* General */}
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
          <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-400" />
            General
          </h2>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Application Name</label>
            <input
              value={settings.appName || 'Commandarr'}
              onChange={e => updateSetting('appName', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Timezone</label>
            <input
              value={settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
              onChange={e => updateSetting('timezone', e.target.value)}
              placeholder="America/New_York"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Backup */}
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
          <h2 className="text-lg font-semibold text-gray-100">Backup & Restore</h2>
          <div className="flex gap-3">
            <a
              href="/api/settings?export=true"
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg border border-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Settings
            </a>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg border border-slate-700 transition-colors">
              <Upload className="w-4 h-4" />
              Import Settings
            </button>
          </div>
        </div>

        {/* About */}
        <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
          <h2 className="text-lg font-semibold text-gray-100 mb-3">About</h2>
          <div className="space-y-1 text-sm text-gray-400">
            <p>Commandarr v1.0.1</p>
            <p>The AI brain for your media stack</p>
            <a href="https://github.com/braedonsaunders/commandarr" target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-300">
              GitHub Repository
            </a>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3">
          <AnimatePresence>
            {saved && (
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-1.5 text-sm text-green-400"
              >
                <Check className="w-4 h-4" />
                Settings saved
              </motion.span>
            )}
          </AnimatePresence>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </>
  );
}
