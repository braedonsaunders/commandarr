import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'tailscale_key_expiry',
  integration: 'tailscale',
  description:
    'Check for Tailscale devices with expiring keys. Alerts if any media-critical devices have keys expiring within a configurable threshold. Devices with key expiry disabled are reported separately.',
  parameters: {
    type: 'object',
    properties: {
      thresholdDays: {
        type: 'number',
        description:
          'Number of days to consider as "expiring soon". Defaults to 14.',
      },
    },
  },
  ui: {
    category: 'Security',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { thresholdDays: 14 },
  },
  async handler(params, ctx) {
    const thresholdDays =
      typeof params.thresholdDays === 'number' && params.thresholdDays > 0
        ? params.thresholdDays
        : 14;

    const client = ctx.getClient('tailscale');
    ctx.log(`Checking key expiry (threshold: ${thresholdDays} days)...`);

    const response = await client.get('/api/v2/tailnet/{tailnet}/devices');
    const devices: any[] = response.devices ?? [];

    if (devices.length === 0) {
      return {
        success: true,
        message: 'No devices found in your tailnet.',
        data: { expiring: [], noExpiry: [], healthy: [] },
      };
    }

    const now = Date.now();
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

    const expiring: {
      name: string;
      id: string;
      expires: string;
      daysLeft: number;
      os: string;
    }[] = [];
    const noExpiry: { name: string; id: string; os: string }[] = [];
    const healthy: { name: string; id: string; expires: string; daysLeft: number }[] = [];

    for (const device of devices) {
      const name = device.name ?? device.hostname ?? 'unknown';
      const id = device.id ?? device.nodeId ?? 'unknown';
      const os = device.os ?? 'unknown';

      if (device.keyExpiryDisabled) {
        noExpiry.push({ name, id, os });
        continue;
      }

      const expires = device.expires ?? '';
      if (!expires) {
        noExpiry.push({ name, id, os });
        continue;
      }

      const expiresMs = new Date(expires).getTime();
      const daysLeft = Math.floor((expiresMs - now) / (24 * 60 * 60 * 1000));

      if (expiresMs - now <= thresholdMs) {
        expiring.push({ name, id, expires, daysLeft, os });
      } else {
        healthy.push({ name, id, expires, daysLeft });
      }
    }

    // Sort expiring by soonest first
    expiring.sort((a, b) => a.daysLeft - b.daysLeft);

    const lines: string[] = [];

    if (expiring.length > 0) {
      lines.push(
        `WARNING: ${expiring.length} device(s) with keys expiring within ${thresholdDays} days:`,
        '',
      );
      for (const d of expiring) {
        const urgency =
          d.daysLeft <= 0
            ? 'EXPIRED'
            : d.daysLeft <= 1
              ? 'EXPIRES TODAY'
              : `${d.daysLeft} days left`;
        lines.push(`  - ${d.name} (${d.os}) -- ${urgency} -- expires ${d.expires}`);
      }
    } else {
      lines.push(
        `All device keys are healthy (no keys expiring within ${thresholdDays} days).`,
      );
    }

    if (noExpiry.length > 0) {
      lines.push('', `${noExpiry.length} device(s) with key expiry disabled:`);
      for (const d of noExpiry) {
        lines.push(`  - ${d.name} (${d.os})`);
      }
    }

    if (healthy.length > 0) {
      lines.push('', `${healthy.length} device(s) with healthy keys:`);
      for (const d of healthy) {
        lines.push(`  - ${d.name} -- ${d.daysLeft} days remaining`);
      }
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        expiring,
        noExpiry,
        healthy,
        thresholdDays,
      },
    };
  },
};
