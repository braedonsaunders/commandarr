import type { ToolDefinition } from '../../_base';

interface MediaRequest {
  id: number;
  type: string;
  status: number;
  createdAt: string;
  media: {
    tmdbId: number;
    tvdbId?: number;
    mediaType: string;
    status: number;
  };
  requestedBy: {
    displayName: string;
    email?: string;
  };
}

function statusLabel(status: number): string {
  switch (status) {
    case 1:
      return 'Pending';
    case 2:
      return 'Approved';
    case 3:
      return 'Declined';
    default:
      return `Unknown (${status})`;
  }
}

function mediaStatusLabel(status: number): string {
  switch (status) {
    case 1:
      return 'Unknown';
    case 2:
      return 'Pending';
    case 3:
      return 'Processing';
    case 4:
      return 'Partially Available';
    case 5:
      return 'Available';
    default:
      return `Unknown (${status})`;
  }
}

export const tool: ToolDefinition = {
  name: 'seerr_requests',
  integration: 'seerr',
  description: 'List media requests in Seerr (Overseerr/Jellyseerr)',
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description:
          'Filter requests by status (all, pending, approved, available, unavailable)',
        enum: ['all', 'pending', 'approved', 'available', 'unavailable'],
      },
      count: {
        type: 'number',
        description: 'Number of requests to return (default 20)',
      },
    },
  },
  ui: {
    category: 'Requests',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const filter = params.filter ?? 'all';
    const count = params.count ?? 20;
    const client = ctx.getClient('seerr');
    ctx.log(`Fetching Seerr requests (filter: ${filter}, count: ${count})...`);

    const response = await client.get('/api/v1/request', {
      take: String(count),
      skip: '0',
      filter,
      sort: 'added',
    });

    const results = response.results ?? response ?? [];

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: 'No media requests found.',
        data: { requests: [] },
      };
    }

    const requests = results.map((r: MediaRequest) => ({
      id: r.id,
      type: r.media?.mediaType ?? r.type ?? 'unknown',
      status: statusLabel(r.status),
      mediaStatus: mediaStatusLabel(r.media?.status ?? 1),
      requestedBy: r.requestedBy?.displayName ?? 'Unknown',
      requestedDate: r.createdAt
        ? new Date(r.createdAt).toLocaleString()
        : 'Unknown',
      tmdbId: r.media?.tmdbId,
    }));

    const summary = requests
      .map(
        (r: (typeof requests)[0]) =>
          `- #${r.id}: [${r.type}] ${r.status} (media: ${r.mediaStatus}) - requested by ${r.requestedBy} on ${r.requestedDate}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${requests.length} request(s) found:\n${summary}`,
      data: { requests },
    };
  },
};
