import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'caddy_tls',
  integration: 'caddy',
  description:
    'Get Caddy TLS configuration — managed domains, certificate automation policies, and ACME settings',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Reverse Proxy',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('caddy');
    ctx.log('Fetching Caddy TLS configuration...');

    let tlsConfig: any;
    try {
      tlsConfig = await client.get('/config/apps/tls/');
    } catch {
      return {
        success: true,
        message:
          'No TLS configuration found (Caddy may be using default automatic HTTPS or TLS is not configured)',
        data: { tls: null },
      };
    }

    if (!tlsConfig) {
      return {
        success: true,
        message: 'No TLS configuration found',
        data: { tls: null },
      };
    }

    const lines: string[] = [];

    // Automation policies
    const policies = tlsConfig.automation?.policies ?? [];
    if (policies.length > 0) {
      lines.push(`Automation Policies: ${policies.length}`);
      for (const policy of policies) {
        const subjects = policy.subjects ?? [];
        const issuerModule = policy.issuers?.[0]?.module ?? 'default';
        if (subjects.length > 0) {
          lines.push(
            `  - ${subjects.join(', ')} (issuer: ${issuerModule})`,
          );
        } else {
          lines.push(`  - Catch-all policy (issuer: ${issuerModule})`);
        }
      }
    }

    // Managed certificates / subjects
    const allSubjects = policies.flatMap((p: any) => p.subjects ?? []);
    if (allSubjects.length > 0) {
      lines.push(`Managed Domains: ${allSubjects.length} — ${allSubjects.join(', ')}`);
    }

    // ACME settings
    if (tlsConfig.automation?.on_demand) {
      lines.push('On-Demand TLS: enabled');
    }

    // Certificate loaders
    if (tlsConfig.certificates?.load_files) {
      const loaded = tlsConfig.certificates.load_files;
      lines.push(`Loaded Certificate Files: ${loaded.length}`);
    }

    if (lines.length === 0) {
      lines.push('TLS is configured with default settings (automatic HTTPS)');
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: { tls: tlsConfig },
    };
  },
};
