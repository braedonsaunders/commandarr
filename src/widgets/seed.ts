import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { widgets, widgetState } from '../db/schema';
import { getIntegrationWidgets } from '../integrations/registry';
import { logger } from '../utils/logger';

interface PrebuiltWidgetShape {
  id: string;
  slug: string;
  name: string;
  description: string;
  capabilities: string[];
  controls: unknown[];
  html: string;
  css: string;
  js: string;
}

async function loadCorePrebuiltWidgets(): Promise<PrebuiltWidgetShape[]> {
  const prebuiltDir = join(import.meta.dir, 'prebuilt');
  const result: PrebuiltWidgetShape[] = [];

  try {
    const files = await readdir(prebuiltDir);
    for (const file of files) {
      if (!file.endsWith('.ts')) continue;
      const mod = await import(join(prebuiltDir, file));
      // Support both `export const widget = ...` and any other named export that looks like a widget
      const widget = mod.widget ?? Object.values(mod).find(
        (v: any) => v && typeof v === 'object' && 'id' in v && 'html' in v && 'slug' in v,
      );
      if (widget) result.push(widget as PrebuiltWidgetShape);
    }
  } catch {
    // No prebuilt directory
  }

  return result;
}

export async function seedPrebuiltWidgets(): Promise<void> {
  const coreWidgets = await loadCorePrebuiltWidgets();
  const integrationWidgets = getIntegrationWidgets();
  const allPrebuilt = [...coreWidgets, ...integrationWidgets];

  if (allPrebuilt.length === 0) return;

  const db = await getDb();
  let seeded = 0;
  let updated = 0;

  for (const w of allPrebuilt) {
    const [existing] = await db.select().from(widgets).where(eq(widgets.id, w.id));

    if (existing) {
      // Update html/css/js/controls on every startup so prebuilt widgets stay current
      await db.update(widgets).set({
        html: w.html,
        css: w.css,
        js: w.js,
        controls: JSON.stringify(w.controls),
        capabilities: JSON.stringify(w.capabilities),
        name: w.name,
        description: w.description,
        updatedAt: new Date(),
      }).where(eq(widgets.id, w.id));
      updated++;
    } else {
      await db.insert(widgets).values({
        id: w.id,
        slug: w.slug,
        name: w.name,
        description: w.description,
        status: 'active',
        html: w.html,
        css: w.css,
        js: w.js,
        capabilities: JSON.stringify(w.capabilities),
        controls: JSON.stringify(w.controls),
        revision: 1,
        createdBy: 'commandarr',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Initialize empty runtime state
      await db.insert(widgetState).values({
        widgetId: w.id,
        stateJson: '{}',
        updatedAt: new Date(),
      });

      seeded++;
    }
  }

  logger.info(
    'widget',
    `Prebuilt widgets: ${seeded} seeded, ${updated} updated (${allPrebuilt.length} total)`,
  );
}
