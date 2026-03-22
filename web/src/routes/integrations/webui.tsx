import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
import { useRouter } from '@/App';

interface IntegrationInfo {
  id: string;
  name: string;
  color: string;
  webUrl?: string;
}

export default function IntegrationWebUIPage() {
  const { path, navigate } = useRouter();
  // path is /integrations/{id}/webui
  const id = path.split('/integrations/')[1]?.split('/')[0] || '';
  const [integration, setIntegration] = useState<IntegrationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeLoading, setIframeLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetch(`/api/integrations/${id}`)
      .then(r => r.json())
      .then(data => {
        setIntegration({
          id: data.id,
          name: data.name,
          color: data.color,
          webUrl: data.currentCredentials?.url,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!integration || !integration.webUrl) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-gray-400">No WebUI URL configured for this integration.</p>
        <a href={`/integrations/${id}`} className="text-amber-400 hover:text-amber-300 text-sm underline underline-offset-2">
          Go to integration settings
        </a>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0">
        <button
          onClick={() => navigate('/integrations')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="h-4 w-px bg-slate-700" />

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: integration.color }}
          />
          <span className="text-sm font-medium text-gray-200 truncate">
            {integration.name}
          </span>
          <span className="text-xs text-gray-500 truncate hidden sm:inline">
            {integration.webUrl}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setIframeLoading(true);
              const iframe = document.getElementById('webui-iframe') as HTMLIFrameElement;
              if (iframe) iframe.src = integration.webUrl!;
            }}
            className="p-1.5 text-gray-400 hover:text-gray-200 rounded-md hover:bg-slate-800 transition-colors"
            title="Reload"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <a
            href={integration.webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-400 hover:text-gray-200 rounded-md hover:bg-slate-800 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Iframe */}
      <div className="relative flex-1">
        {iframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading {integration.name}...</span>
            </div>
          </div>
        )}
        <iframe
          id="webui-iframe"
          src={integration.webUrl}
          className="w-full h-full border-0"
          onLoad={() => setIframeLoading(false)}
          title={`${integration.name} WebUI`}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </motion.div>
  );
}
