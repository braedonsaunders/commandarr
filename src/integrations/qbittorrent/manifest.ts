import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'qbittorrent',
  name: 'qBittorrent',
  description: 'Free open-source torrent download client',
  icon: 'hard-drive',
  color: '#2F67BA',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'qBittorrent URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:8080',
      helpText: 'The URL of your qBittorrent Web UI.',
    },
    {
      key: 'username',
      label: 'Username',
      type: 'text',
      required: true,
      placeholder: 'admin',
      helpText: 'Your qBittorrent Web UI username.',
    },
    {
      key: 'password',
      label: 'Password',
      type: 'password',
      required: true,
      placeholder: 'Your qBittorrent password',
      helpText: 'Your qBittorrent Web UI password.',
    },
  ],
  healthCheck: {
    endpoint: '/api/v2/app/version',
    interval: 30,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when qBittorrent becomes unreachable',
      defaultPrompt: 'qBittorrent is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when qBittorrent comes back online',
      defaultPrompt: 'qBittorrent is back online. Check for any stalled or errored torrents.',
      enabledByDefault: true,
    },
  ],
};
