import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'tailscale_dns',
  integration: 'tailscale',
  description:
    'Get the current Tailscale DNS configuration including nameservers, search paths, and MagicDNS status. Critical for verifying that services like Plex are accessible by hostname across your tailnet.',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Network',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('tailscale');
    ctx.log('Fetching DNS configuration...');

    // Fetch nameservers and search paths in parallel-ish style
    const [nameserverData, searchPathData] = await Promise.all([
      client.get('/api/v2/tailnet/{tailnet}/dns/nameservers'),
      client.get('/api/v2/tailnet/{tailnet}/dns/searchpaths'),
    ]);

    const nameservers: string[] = nameserverData.dns ?? nameserverData.nameservers ?? [];
    const searchPaths: string[] = searchPathData.searchPaths ?? searchPathData.paths ?? [];

    // MagicDNS is typically indicated by the presence of 100.100.100.100 as a nameserver
    // or can be inferred from the API response
    const magicDnsActive =
      nameservers.includes('100.100.100.100') ||
      nameserverData.magicDNS === true;

    const lines = [
      `MagicDNS: ${magicDnsActive ? 'Enabled' : 'Disabled'}`,
      '',
      `Nameservers (${nameservers.length}):`,
    ];

    if (nameservers.length > 0) {
      for (const ns of nameservers) {
        lines.push(`  - ${ns}`);
      }
    } else {
      lines.push('  (none configured)');
    }

    lines.push('', `Search Paths (${searchPaths.length}):`);

    if (searchPaths.length > 0) {
      for (const sp of searchPaths) {
        lines.push(`  - ${sp}`);
      }
    } else {
      lines.push('  (none configured)');
    }

    if (magicDnsActive) {
      lines.push(
        '',
        'With MagicDNS enabled, devices are reachable by hostname (e.g., my-server.tail12345.ts.net).',
      );
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        nameservers,
        searchPaths,
        magicDnsActive,
      },
    };
  },
};
