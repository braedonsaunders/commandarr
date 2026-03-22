import { useState } from 'react';

interface QuickAction {
  label: string;
  icon: string;
  action: () => Promise<void>;
  color?: string;
  danger?: boolean;
}

export function QuickActions() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const executeAction = async (label: string, action: () => Promise<void>) => {
    setLoading(label);
    setResult(null);
    try {
      await action();
      setResult(`${label}: Done`);
    } catch (e) {
      setResult(`${label}: Failed`);
    } finally {
      setLoading(null);
    }
  };

  const callTool = async (toolName: string, params: Record<string, unknown> = {}) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Use the ${toolName} tool${Object.keys(params).length ? ` with ${JSON.stringify(params)}` : ''}` }),
    });
    if (!response.ok) throw new Error('Failed');
  };

  const actions: QuickAction[] = [
    {
      label: 'Pause All Downloads',
      icon: '\u23F8',
      action: () => callTool('sabnzbd_pause_resume', { action: 'pause' }),
      color: 'bg-yellow-600 hover:bg-yellow-700',
    },
    {
      label: 'Resume All Downloads',
      icon: '\u25B6',
      action: () => callTool('sabnzbd_pause_resume', { action: 'resume' }),
      color: 'bg-green-600 hover:bg-green-700',
    },
    {
      label: 'Restart Plex',
      icon: '\uD83D\uDD04',
      action: () => callTool('plex_restart'),
      color: 'bg-orange-600 hover:bg-orange-700',
      danger: true,
    },
    {
      label: 'Pending Requests',
      icon: '\uD83D\uDCCB',
      action: () => callTool('seerr_requests', { filter: 'pending' }),
      color: 'bg-indigo-600 hover:bg-indigo-700',
    },
    {
      label: 'Stack Health',
      icon: '\uD83C\uDFE5',
      action: () => callTool('commandarr_diagnose'),
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      label: "What's Playing",
      icon: '\uD83D\uDCFA',
      action: () => callTool('plex_now_playing'),
      color: 'bg-purple-600 hover:bg-purple-700',
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => executeAction(action.label, action.action)}
            disabled={loading !== null}
            className={`${action.color || 'bg-gray-700 hover:bg-gray-600'} text-white rounded-xl p-4 text-center transition-all active:scale-95 disabled:opacity-50 min-h-[72px] flex flex-col items-center justify-center gap-1`}
          >
            <span className="text-2xl">{action.icon}</span>
            <span className="text-xs font-medium leading-tight">
              {loading === action.label ? 'Running...' : action.label}
            </span>
          </button>
        ))}
      </div>
      {result && (
        <div className="text-sm text-gray-400 text-center py-1">{result}</div>
      )}
    </div>
  );
}
