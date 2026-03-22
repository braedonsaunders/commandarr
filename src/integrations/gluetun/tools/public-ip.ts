import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'gluetun_public_ip',
  integration: 'gluetun',
  description:
    'Get detailed public IP information including IP address, country, region, city, ISP, and organization. Use this to verify you are not leaking your real IP.',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'VPN',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('gluetun');
    ctx.log('Fetching public IP information...');

    let publicIp: string | null = null;
    try {
      const ipData = await client.get('/v1/publicip/ip');
      publicIp = ipData?.public_ip ?? ipData?.ip ?? (typeof ipData === 'string' ? ipData.trim() : null);
    } catch {
      // Fall through to info endpoint
    }

    const ipInfo = await client.get('/v1/publicip/info');

    const ip = publicIp ?? ipInfo?.ip ?? 'Unknown';
    const country = ipInfo?.country ?? 'Unknown';
    const region = ipInfo?.region ?? 'Unknown';
    const city = ipInfo?.city ?? 'Unknown';
    const isp = ipInfo?.isp ?? ipInfo?.org ?? 'Unknown';
    const organization = ipInfo?.org ?? ipInfo?.as ?? 'Unknown';
    const timezone = ipInfo?.timezone ?? null;

    const lines = [
      'Public IP Information (via VPN tunnel):',
      '',
      `IP Address: ${ip}`,
      `Country: ${country}`,
      `Region: ${region}`,
      `City: ${city}`,
      `ISP: ${isp}`,
      `Organization: ${organization}`,
    ];

    if (timezone) {
      lines.push(`Timezone: ${timezone}`);
    }

    lines.push('');
    lines.push(
      'If this matches your real location or ISP, your VPN may not be working correctly.',
    );

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        ip,
        country,
        region,
        city,
        isp,
        organization,
        timezone,
      },
    };
  },
};
