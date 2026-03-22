/**
 * Generic Config File Manager for Commandarr Integrations
 *
 * Provides read/write/backup/validate operations for config files declared
 * in an integration's manifest. Any integration can use this by adding a
 * `configFiles` array to its manifest and a credential field for the file path.
 *
 * Usage in a tool handler:
 *   const manager = await ctx.getConfigManager('kometa', 'config');
 *   const data = await manager.read();
 *   // ... modify data ...
 *   await manager.write(data); // auto-backs up before writing
 */

import { readFile, writeFile, rename, readdir, stat, mkdir, unlink } from 'node:fs/promises';
import { join, dirname, basename, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import * as YAML from 'yaml';
import type { ConfigFileDeclaration, ConfigFileManager } from './_base';

// ─── Custom Validator Registry ──────────────────────────────────────

type ValidatorFn = (data: unknown) => string | null;

const validatorRegistry = new Map<string, ValidatorFn>();

/**
 * Register a custom schema validator for an integration's config file.
 * Called by integrations during module load to add domain-specific validation
 * beyond basic format checking (YAML syntax, JSON syntax, etc.).
 *
 * @param integrationId - Integration that owns the file (e.g., 'kometa')
 * @param fileKey - Config file key from manifest (e.g., 'config')
 * @param validator - Function returning null if valid, or error string
 */
export function registerConfigValidator(
  integrationId: string,
  fileKey: string,
  validator: ValidatorFn,
): void {
  validatorRegistry.set(`${integrationId}:${fileKey}`, validator);
}

// ─── Parsing & Serialization ────────────────────────────────────────

function parseContent(raw: string, format: ConfigFileDeclaration['format']): unknown {
  switch (format) {
    case 'yaml':
      return YAML.parse(raw);
    case 'json':
      return JSON.parse(raw);
    case 'text':
      return raw;
    case 'toml':
      // TOML support can be added via a toml package when needed
      throw new Error('TOML parsing not yet implemented. Install a TOML package to enable.');
    default:
      throw new Error(`Unsupported config format: ${format}`);
  }
}

function serializeContent(data: unknown, format: ConfigFileDeclaration['format']): string {
  switch (format) {
    case 'yaml':
      return YAML.stringify(data, { lineWidth: 0, nullStr: '' });
    case 'json':
      return JSON.stringify(data, null, 2) + '\n';
    case 'text':
      if (typeof data !== 'string') {
        throw new Error('Text format requires string data');
      }
      return data;
    case 'toml':
      throw new Error('TOML serialization not yet implemented.');
    default:
      throw new Error(`Unsupported config format: ${format}`);
  }
}

// ─── Atomic Write ───────────────────────────────────────────────────

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  const tmpPath = join(dir, `.${basename(filePath)}.tmp.${Date.now()}`);

  await writeFile(tmpPath, content, 'utf-8');
  await rename(tmpPath, filePath);
}

// ─── Backup Management ─────────────────────────────────────────────

const BACKUP_DIR_NAME = '.commandarr-backups';

function getBackupDir(filePath: string): string {
  return join(dirname(filePath), BACKUP_DIR_NAME);
}

function getBackupFileName(filePath: string): string {
  const name = basename(filePath);
  const now = new Date().toISOString().replace(/[:.]/g, '-');
  return `${name}.${now}.bak`;
}

async function ensureBackupDir(filePath: string): Promise<string> {
  const backupDir = getBackupDir(filePath);
  if (!existsSync(backupDir)) {
    await mkdir(backupDir, { recursive: true });
  }
  return backupDir;
}

async function rotateBackups(filePath: string, maxBackups: number): Promise<void> {
  const backupDir = getBackupDir(filePath);
  if (!existsSync(backupDir)) return;

  const baseName = basename(filePath);
  const entries = await readdir(backupDir);
  const backups = entries
    .filter((e) => e.startsWith(baseName + '.') && e.endsWith('.bak'))
    .sort(); // ISO timestamps sort chronologically

  // Delete oldest backups exceeding the limit
  const toDelete = backups.slice(0, Math.max(0, backups.length - maxBackups));
  for (const file of toDelete) {
    await unlink(join(backupDir, file));
  }
}

// ─── Config File Manager Factory ────────────────────────────────────

export function createConfigFileManager(
  filePath: string,
  declaration: ConfigFileDeclaration,
  integrationId: string,
): ConfigFileManager {
  const maxBackups = declaration.maxBackups ?? 10;
  const validatorKey = `${integrationId}:${declaration.key}`;

  return {
    get filePath() {
      return filePath;
    },

    async readRaw(): Promise<string> {
      return readFile(filePath, 'utf-8');
    },

    async read(): Promise<unknown> {
      const raw = await readFile(filePath, 'utf-8');
      return parseContent(raw, declaration.format);
    },

    async write(data: unknown): Promise<void> {
      // Validate before writing
      const error = await this.validate(data);
      if (error) {
        throw new Error(`Config validation failed: ${error}`);
      }

      // Auto-backup before write
      if (existsSync(filePath)) {
        await this.backup();
      }

      const content = serializeContent(data, declaration.format);
      await atomicWrite(filePath, content);
    },

    async writeRaw(content: string): Promise<void> {
      // Auto-backup before write
      if (existsSync(filePath)) {
        await this.backup();
      }

      await atomicWrite(filePath, content);
    },

    async backup(): Promise<string> {
      const backupDir = await ensureBackupDir(filePath);
      const backupName = getBackupFileName(filePath);
      const backupPath = join(backupDir, backupName);

      const content = await readFile(filePath, 'utf-8');
      await writeFile(backupPath, content, 'utf-8');

      // Rotate old backups
      await rotateBackups(filePath, maxBackups);

      return backupPath;
    },

    async listBackups(): Promise<Array<{ path: string; timestamp: Date; size: number }>> {
      const backupDir = getBackupDir(filePath);
      if (!existsSync(backupDir)) return [];

      const baseName = basename(filePath);
      const entries = await readdir(backupDir);
      const backups: Array<{ path: string; timestamp: Date; size: number }> = [];

      for (const entry of entries) {
        if (!entry.startsWith(baseName + '.') || !entry.endsWith('.bak')) continue;

        const fullPath = join(backupDir, entry);
        const info = await stat(fullPath);

        // Extract timestamp from filename: config.yml.2026-03-21T10-30-00-000Z.bak
        const tsMatch = entry.match(/\.(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.bak$/);
        const timestamp = tsMatch
          ? new Date(tsMatch[1].replace(/-/g, (m, offset) => (offset > 9 ? ':' : m)).replace(/T(\d{2}):(\d{2}):(\d{2}):(\d{3})Z/, 'T$1:$2:$3.$4Z'))
          : info.mtime;

        backups.push({
          path: fullPath,
          timestamp,
          size: info.size,
        });
      }

      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    },

    async validate(data: unknown): Promise<string | null> {
      // Format-level validation: try to serialize and re-parse
      try {
        if (declaration.format !== 'text') {
          const serialized = serializeContent(data, declaration.format);
          parseContent(serialized, declaration.format);
        }
      } catch (err) {
        return `Format validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }

      // Custom validator (if registered)
      const customValidator = validatorRegistry.get(validatorKey);
      if (customValidator) {
        const error = customValidator(data);
        if (error) return error;
      }

      return null;
    },
  };
}

// ─── Resolver (main entry point for ToolContext) ────────────────────

/**
 * Resolve a ConfigFileManager for a given integration and file key.
 * Called by ToolContext.getConfigManager(). Looks up the manifest to find
 * the config file declaration, reads the file path from credentials,
 * and returns a scoped manager.
 */
export async function resolveConfigManager(
  integrationId: string,
  fileKey: string,
): Promise<ConfigFileManager> {
  // Lazy import to avoid circular dependency
  const registry = await import('./registry');

  const integration = registry.getIntegration(integrationId);
  if (!integration) {
    throw new Error(`Integration "${integrationId}" not found`);
  }

  const configFiles = integration.manifest.configFiles;
  if (!configFiles || configFiles.length === 0) {
    throw new Error(
      `Integration "${integrationId}" does not declare any config files. ` +
        `Add a configFiles array to the manifest to enable config file management.`,
    );
  }

  const declaration = configFiles.find((cf: ConfigFileDeclaration) => cf.key === fileKey);
  if (!declaration) {
    const available = configFiles.map((cf: ConfigFileDeclaration) => cf.key).join(', ');
    throw new Error(
      `Config file "${fileKey}" not found in integration "${integrationId}". ` +
        `Available config files: ${available}`,
    );
  }

  // Read the file path from credentials
  const creds = await registry.getCredentials(integrationId);
  if (!creds) {
    throw new Error(
      `No credentials configured for integration "${integrationId}". ` +
        `Configure the integration first.`,
    );
  }

  const filePath = creds[declaration.credentialKey];
  if (!filePath) {
    throw new Error(
      `Config file path not set. Configure the "${declaration.credentialKey}" field ` +
        `in ${integration.manifest.name} settings to enable config file management.`,
    );
  }

  const resolvedPath = resolve(filePath);

  // Security: verify the file exists (read operations) or parent dir exists (first-time write)
  const parentDir = dirname(resolvedPath);
  if (!existsSync(parentDir)) {
    throw new Error(
      `Config file directory does not exist: ${parentDir}. ` +
        `Ensure the path is correctly mounted in Docker.`,
    );
  }

  return createConfigFileManager(resolvedPath, declaration, integrationId);
}
