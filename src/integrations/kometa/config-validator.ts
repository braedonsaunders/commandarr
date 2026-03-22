/**
 * Kometa-specific config file validator.
 * Checks YAML structure beyond syntax — validates required sections,
 * library structure, and warns on likely typos.
 */

const KNOWN_TOP_LEVEL_KEYS = new Set([
  'libraries',
  'playlist_files',
  'settings',
  'webhooks',
  'plex',
  'tmdb',
  'tautulli',
  'omdb',
  'mdblist',
  'notifiarr',
  'gotify',
  'trakt',
  'mal',
  'anidb',
  'radarr',
  'sonarr',
]);

const KNOWN_LIBRARY_KEYS = new Set([
  'collection_files',
  'overlay_files',
  'metadata_files',
  'collections',
  'overlays',
  'metadata',
  'operations',
  'settings',
  'plex',
  'radarr',
  'sonarr',
  'tautulli',
  'template_variables',
]);

/**
 * Validate a parsed Kometa config object.
 * Returns null if valid, or an error/warning string if issues found.
 */
export function kometaConfigValidator(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return 'Config must be a YAML mapping (object), not a scalar or array.';
  }

  const config = data as Record<string, unknown>;
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required 'libraries' key
  if (!config.libraries) {
    errors.push('Missing required "libraries" section. Kometa needs at least one library configured.');
  } else if (typeof config.libraries !== 'object' || Array.isArray(config.libraries)) {
    errors.push('"libraries" must be a mapping of library names to their configuration.');
  } else {
    // Validate each library
    const libraries = config.libraries as Record<string, unknown>;
    for (const [libName, libConfig] of Object.entries(libraries)) {
      if (!libConfig || typeof libConfig !== 'object' || Array.isArray(libConfig)) {
        errors.push(`Library "${libName}" must be a mapping, not a ${typeof libConfig}.`);
        continue;
      }

      const lib = libConfig as Record<string, unknown>;
      const libKeys = Object.keys(lib);

      // Check for at least one actionable key
      const hasAction = libKeys.some(
        (k) =>
          k === 'collection_files' ||
          k === 'overlay_files' ||
          k === 'metadata_files' ||
          k === 'collections' ||
          k === 'overlays' ||
          k === 'metadata' ||
          k === 'operations',
      );

      if (!hasAction) {
        warnings.push(
          `Library "${libName}" has no collection_files, overlay_files, collections, overlays, or operations. ` +
            `It won't do anything without at least one of these.`,
        );
      }

      // Warn on unknown library keys
      for (const key of libKeys) {
        if (!KNOWN_LIBRARY_KEYS.has(key)) {
          warnings.push(`Library "${libName}" has unknown key "${key}" — possible typo?`);
        }
      }
    }
  }

  // Warn on unknown top-level keys
  for (const key of Object.keys(config)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
      warnings.push(`Unknown top-level key "${key}" — possible typo?`);
    }
  }

  // Check plex config if present
  if (config.plex && typeof config.plex === 'object') {
    const plex = config.plex as Record<string, unknown>;
    if (!plex.url) {
      warnings.push('"plex" section is missing "url". Kometa needs the Plex server URL.');
    }
    if (!plex.token) {
      warnings.push('"plex" section is missing "token". Kometa needs a Plex auth token.');
    }
  }

  if (errors.length > 0) {
    return errors.join('\n');
  }

  if (warnings.length > 0) {
    return `Validation passed with warnings:\n${warnings.join('\n')}`;
  }

  return null;
}
