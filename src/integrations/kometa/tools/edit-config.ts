import type { ToolDefinition } from '../../_base';
import * as YAML from 'yaml';

export const tool: ToolDefinition = {
  name: 'kometa_edit_config',
  integration: 'kometa',
  description:
    'Make targeted edits to the Kometa config using dot-notation paths. Supports set, delete, and append operations. Auto-backs up before changes.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description:
          'Dot-notation path to the config value (e.g., "libraries.Movies.collections.My Collection.sync_mode", "settings.cache", "plex.url")',
      },
      value: {
        description:
          'The new value to set. Can be a string, number, boolean, array, or object. Ignored for "delete" action.',
      },
      action: {
        type: 'string',
        description: '"set" (default) to set/replace a value, "delete" to remove a key, "append" to add to an array',
      },
    },
    required: ['path'],
  },
  ui: {
    category: 'Config',
    dangerLevel: 'high',
    testable: false,
  },
  async handler(params, ctx) {
    const manager = await ctx.getConfigManager('kometa', 'config');
    const action = params.action || 'set';
    ctx.log(`Editing Kometa config: ${action} at "${params.path}"...`);

    const data = (await manager.read()) as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'Config file is empty or invalid.' };
    }

    const config = data as Record<string, any>;
    const pathParts = splitPath(params.path);

    if (pathParts.length === 0) {
      return { success: false, message: 'Path cannot be empty.' };
    }

    switch (action) {
      case 'set': {
        if (params.value === undefined) {
          return { success: false, message: 'Value is required for "set" action.' };
        }
        setNestedValue(config, pathParts, params.value);
        break;
      }
      case 'delete': {
        const deleted = deleteNestedValue(config, pathParts);
        if (!deleted) {
          return { success: false, message: `Path "${params.path}" not found in config.` };
        }
        break;
      }
      case 'append': {
        if (params.value === undefined) {
          return { success: false, message: 'Value is required for "append" action.' };
        }
        const appendResult = appendNestedValue(config, pathParts, params.value);
        if (!appendResult.success) {
          return { success: false, message: appendResult.error! };
        }
        break;
      }
      default:
        return { success: false, message: `Unknown action: "${action}". Use "set", "delete", or "append".` };
    }

    await manager.write(config);

    // Show what was changed
    const currentValue = getNestedValue(config, pathParts);
    const snippet = action === 'delete'
      ? `Deleted: ${params.path}`
      : YAML.stringify({ [pathParts[pathParts.length - 1]]: currentValue }, { lineWidth: 0 });

    return {
      success: true,
      message:
        `Config updated (${action} at "${params.path}"). Backed up and written.\n\n` +
        `\`\`\`yaml\n${snippet}\`\`\`\n\n` +
        `Run kometa_run to apply changes.`,
      data: { action, path: params.path, value: currentValue },
    };
  },
};

/**
 * Split a dot-notation path, preserving quoted segments for keys with dots/spaces.
 * Examples:
 *   "libraries.Movies.collections" → ["libraries", "Movies", "collections"]
 *   'libraries."TV Shows".overlays' → ["libraries", "TV Shows", "overlays"]
 */
function splitPath(path: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of path) {
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === '.' && !inQuotes) {
      if (current) parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function getNestedValue(obj: Record<string, any>, parts: string[]): unknown {
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function setNestedValue(obj: Record<string, any>, parts: string[], value: unknown): void {
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function deleteNestedValue(obj: Record<string, any>, parts: string[]): boolean {
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null || typeof current[parts[i]] !== 'object') {
      return false;
    }
    current = current[parts[i]];
  }
  const lastKey = parts[parts.length - 1];
  if (!(lastKey in current)) return false;
  delete current[lastKey];
  return true;
}

function appendNestedValue(
  obj: Record<string, any>,
  parts: string[],
  value: unknown,
): { success: boolean; error?: string } {
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }

  const lastKey = parts[parts.length - 1];
  const existing = current[lastKey];

  if (existing === undefined) {
    current[lastKey] = [value];
  } else if (Array.isArray(existing)) {
    existing.push(value);
  } else {
    return { success: false, error: `Value at "${parts.join('.')}" is not an array (it's a ${typeof existing}). Cannot append.` };
  }
  return { success: true };
}
