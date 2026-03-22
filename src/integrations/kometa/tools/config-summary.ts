import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'kometa_config_summary',
  integration: 'kometa',
  description: 'Get a human-readable summary of the current Kometa configuration: configured libraries, collection/overlay definitions, scheduling, and connected services',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Configuration',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('kometa');
    ctx.log('Fetching Kometa configuration summary...');

    const config = await client.get('/api/v1/config');

    const lines: string[] = [];

    // Libraries
    const libraries = config.libraries ?? config.library ?? [];
    if (Array.isArray(libraries) && libraries.length > 0) {
      lines.push(`Libraries (${libraries.length}):`);
      for (const lib of libraries) {
        const name = lib.name ?? lib.library_name ?? lib.libraryName ?? 'Unknown';
        const colCount = lib.collections_count ?? lib.collectionsCount ?? lib.collections ?? '?';
        const ovCount = lib.overlays_count ?? lib.overlaysCount ?? lib.overlays ?? '?';
        const opCount = lib.operations_count ?? lib.operationsCount ?? lib.operations ?? '?';
        lines.push(`  - ${name}: ${colCount} collection(s), ${ovCount} overlay(s), ${opCount} operation(s)`);
      }
    } else if (typeof libraries === 'object' && !Array.isArray(libraries)) {
      const libNames = Object.keys(libraries);
      lines.push(`Libraries (${libNames.length}):`);
      for (const name of libNames) {
        const lib = libraries[name];
        const colCount = lib?.collections_count ?? lib?.collections ?? '?';
        const ovCount = lib?.overlays_count ?? lib?.overlays ?? '?';
        lines.push(`  - ${name}: ${colCount} collection(s), ${ovCount} overlay(s)`);
      }
    } else {
      lines.push('Libraries: None configured');
    }

    // Scheduling
    const schedule = config.schedule ?? config.scheduling;
    if (schedule) {
      lines.push('');
      lines.push('Schedule:');
      if (typeof schedule === 'string') {
        lines.push(`  ${schedule}`);
      } else {
        const cron = schedule.cron ?? schedule.time ?? schedule.run_time ?? schedule.runTime;
        if (cron) lines.push(`  Run time: ${cron}`);
        const interval = schedule.interval ?? schedule.run_every ?? schedule.runEvery;
        if (interval) lines.push(`  Interval: ${interval}`);
      }
    }

    // Connected services
    const plex = config.plex;
    if (plex) {
      lines.push('');
      lines.push('Plex:');
      const plexUrl = plex.url ?? plex.server_url ?? plex.serverUrl ?? 'configured';
      lines.push(`  Server: ${plexUrl}`);
    }

    const tmdb = config.tmdb ?? config.TMDb;
    if (tmdb) {
      lines.push(`  TMDb: Connected`);
    }

    const trakt = config.trakt;
    if (trakt) {
      lines.push(`  Trakt: Connected`);
    }

    const mdblist = config.mdblist ?? config.MDBList;
    if (mdblist) {
      lines.push(`  MDBList: Connected`);
    }

    // Settings
    const settings = config.settings;
    if (settings) {
      lines.push('');
      lines.push('Settings:');
      if (settings.cache !== undefined) lines.push(`  Cache: ${settings.cache ? 'Enabled' : 'Disabled'}`);
      if (settings.asset_directory ?? settings.assetDirectory) {
        lines.push(`  Asset directory: ${settings.asset_directory ?? settings.assetDirectory}`);
      }
      if (settings.run_order ?? settings.runOrder) {
        const order = Array.isArray(settings.run_order ?? settings.runOrder)
          ? (settings.run_order ?? settings.runOrder).join(' -> ')
          : settings.run_order ?? settings.runOrder;
        lines.push(`  Run order: ${order}`);
      }
    }

    if (lines.length === 0) {
      lines.push('Configuration data was returned but could not be parsed into a summary. Raw data is attached.');
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: config,
    };
  },
};
