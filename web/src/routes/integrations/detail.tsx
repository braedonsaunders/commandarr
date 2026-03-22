import React, { useState, useEffect } from 'react';

import { CredentialForm, type CredentialField } from '../../components/integrations/CredentialForm';
import { StatusBadge } from '../../components/integrations/StatusBadge';
import { ArrowLeft, Play, AlertTriangle } from 'lucide-react';
import { useRouter } from '@/App';

interface Tool {
  name: string;
  description: string;
  parameters: { type: string; properties: Record<string, unknown>; required?: string[] };
  ui: { category: string; dangerLevel: string; testable: boolean; testDefaults?: Record<string, unknown> };
}

interface IntegrationDetail {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  configured: boolean;
  healthy: boolean;
  credentials: CredentialField[];
  currentCredentials?: Record<string, string>;
  tools: Tool[];
  webhookPath?: string;
}

export default function IntegrationDetailPage() {
  const { path } = useRouter();
  const id = path.split('/integrations/')[1] || '';
  const [integration, setIntegration] = useState<IntegrationDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'credentials' | 'tools' | 'webhooks'>('credentials');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connTesting, setConnTesting] = useState(false);
  const [connResult, setConnResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetch(`/api/integrations/${id}`)
      .then(r => r.json())
      .then(data => { setIntegration(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const handleSaveCredentials = async (values: Record<string, string>) => {
    setSaving(true);
    try {
      await fetch(`/api/integrations/${id}/creds`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      // Refresh integration data
      const res = await fetch(`/api/integrations/${id}`);
      const data = await res.json();
      setIntegration(data);
    } catch {
      // Error handling
    }
    setSaving(false);
  };

  const handleTestConnection = async () => {
    setConnTesting(true);
    setConnResult(null);
    try {
      const res = await fetch(`/api/integrations/${id}/test`, { method: 'POST' });
      const result = await res.json();
      setConnResult(result);
      // Refresh integration data to update health status
      if (result.success && integration) {
        setIntegration({ ...integration, healthy: true, configured: true });
      }
    } catch {
      setConnResult({ success: false, message: 'Connection test failed' });
    }
    setConnTesting(false);
  };

  const handleTestTool = async (toolName: string, defaults?: Record<string, unknown>) => {
    setTesting(prev => ({ ...prev, [toolName]: true }));
    try {
      const res = await fetch(`/api/integrations/${id}/tools/${toolName}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaults || {}),
      });
      const result = await res.json();
      setTestResults(prev => ({ ...prev, [toolName]: result }));
    } catch (e) {
      setTestResults(prev => ({ ...prev, [toolName]: { success: false, message: 'Test failed' } }));
    }
    setTesting(prev => ({ ...prev, [toolName]: false }));
  };

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading...</div>;
  if (!integration) return <div className="text-gray-400 py-20 text-center">Integration not found</div>;

  const tabs = ['credentials', 'tools', 'webhooks'] as const;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <a href="/integrations" className="text-gray-400 hover:text-gray-200"><ArrowLeft className="w-5 h-5" /></a>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-100">{integration.name}</h1>
              <StatusBadge status={integration.configured ? (integration.healthy ? 'healthy' : 'unhealthy') : 'unconfigured'} />
            </div>
            <p className="text-sm text-gray-400 mt-1">{integration.description}</p>
          </div>
        </div>

        <div className="flex gap-1 border-b border-slate-800">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'credentials' && (
          <CredentialForm
            fields={integration.credentials}
            values={integration.currentCredentials}
            onSave={handleSaveCredentials}
            onTest={handleTestConnection}
            saving={saving}
            testing={connTesting}
            testResult={connResult}
          />
        )}

        {activeTab === 'tools' && (
          <div className="space-y-3">
            {integration.tools.length === 0 ? (
              <div className="text-gray-400 text-center py-10">No tools available</div>
            ) : (
              integration.tools.map(tool => (
                <div key={tool.name} className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-100">{tool.name}</h3>
                        {tool.ui.dangerLevel === 'high' && (
                          <span className="flex items-center gap-1 text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3" />
                            High Risk
                          </span>
                        )}
                        {tool.ui.dangerLevel === 'medium' && (
                          <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">Medium</span>
                        )}
                        <span className="text-xs text-gray-500 bg-slate-800 px-2 py-0.5 rounded">{tool.ui.category}</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{tool.description}</p>
                      {testResults[tool.name] && (
                        <div className={`mt-2 text-sm p-2 rounded ${testResults[tool.name]!.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {testResults[tool.name]!.message}
                        </div>
                      )}
                    </div>
                    {tool.ui.testable && (
                      <button
                        onClick={() => handleTestTool(tool.name, tool.ui.testDefaults)}
                        disabled={testing[tool.name]}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5" />
                        {testing[tool.name] ? 'Testing...' : 'Test'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'webhooks' && (
          <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
            {integration.webhookPath ? (
              <div>
                <h3 className="font-medium text-gray-200 mb-2">Webhook URL</h3>
                <p className="text-sm text-gray-400 mb-3">Configure this URL in your {integration.name} settings to receive events.</p>
                <code className="block p-3 bg-slate-800 rounded-lg text-amber-400 text-sm break-all">
                  {window.location.origin}{integration.webhookPath}
                </code>
              </div>
            ) : (
              <p className="text-gray-400 text-center">No webhooks configured for this integration</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
