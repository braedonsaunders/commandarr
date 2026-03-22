import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'gluetun',
  name: 'Gluetun',
  description:
    'Monitor and control Gluetun VPN container — connection status, public IP, port forwarding, and DNS leak protection',
  icon: 'shield',
  color: '#3B82F6',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Control Server URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:8000',
      helpText:
        'URL of the Gluetun HTTP control server. Default port is 8000. Typically only accessible from the Docker network.',
      docsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/advanced/control-server.md',
    },
  ],
  healthCheck: {
    endpoint: '/v1/vpn/status',
    interval: 60,
    timeout: 10,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when the Gluetun control server becomes unreachable',
      defaultPrompt:
        'Gluetun control server is not responding. The VPN container may be down — check Docker container status and report findings.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when the Gluetun control server comes back online',
      defaultPrompt:
        'Gluetun control server is back online. Verify VPN is connected and confirm the public IP is not the real IP.',
      enabledByDefault: true,
    },
    {
      event: 'vpn_disconnected',
      description:
        'Triggered when the VPN connection drops — CRITICAL, torrent traffic may leak without VPN protection',
      defaultPrompt:
        'CRITICAL: Gluetun VPN has disconnected! Torrent traffic may be leaking without VPN protection. Immediately check the VPN status, attempt a reconnect, and alert the user urgently.',
      enabledByDefault: true,
    },
    {
      event: 'port_changed',
      description:
        'Triggered when the forwarded port changes — torrent clients may need reconfiguration',
      defaultPrompt:
        'Gluetun port-forwarded port has changed. Check the new port and determine if the torrent client configuration needs updating.',
      enabledByDefault: true,
    },
  ],
};
