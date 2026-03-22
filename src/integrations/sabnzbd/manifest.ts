import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'sabnzbd',
  name: 'SABnzbd',
  description: 'Usenet download client and newsreader',
  icon: 'download',
  color: '#EAB308',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'SABnzbd URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:8080',
      helpText: 'The URL of your SABnzbd instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your SABnzbd API key',
      helpText: 'Found in SABnzbd under Config -> General -> API Key.',
      docsUrl: 'https://sabnzbd.org/wiki/configuration/4.3/general#security',
    },
  ],
  healthCheck: {
    endpoint: '/api?mode=version&output=json',
    interval: 30,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when SABnzbd becomes unreachable',
      defaultPrompt: 'SABnzbd is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when SABnzbd comes back online',
      defaultPrompt: 'SABnzbd is back online. Check the download queue for any stalled items.',
      enabledByDefault: true,
    },
  ],
};
