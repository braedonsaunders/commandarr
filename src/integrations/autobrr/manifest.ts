import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'autobrr',
  name: 'Autobrr',
  description:
    'Real-time torrent automation — monitor IRC announce channels, RSS feeds, and filter activity for instant torrent grabbing',
  icon: 'zap',
  color: '#4CAF50',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Autobrr URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:7474',
      helpText: 'The URL of your Autobrr instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Autobrr API key',
      helpText: 'Found in Autobrr under Settings -> API.',
      docsUrl: 'https://autobrr.com/configuration/autobrr',
    },
  ],
  healthCheck: {
    endpoint: '/api/config',
    interval: 60,
    timeout: 10,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Autobrr becomes unreachable',
      defaultPrompt:
        'Autobrr is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Autobrr comes back online',
      defaultPrompt:
        'Autobrr is back online. Check IRC connections and filter status for any issues.',
      enabledByDefault: true,
    },
    {
      event: 'irc_disconnected',
      description:
        'Triggered when an IRC network disconnects — critical because IRC downtime means missing releases',
      defaultPrompt:
        'An Autobrr IRC network has disconnected. Check IRC status immediately — releases may be missed while disconnected.',
      enabledByDefault: true,
    },
  ],
};
