import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'docker_check_updates',
  integration: 'docker',
  description:
    'Check which containers have newer images available by comparing local digests with registry digests',
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description: 'Filter containers by name substring (case-insensitive)',
      },
    },
  },
  ui: {
    category: 'Updates',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('docker');
    ctx.log('Checking for container updates...');

    const containers = await client.get('/containers/json', { all: 'true' });

    if (!Array.isArray(containers) || containers.length === 0) {
      return {
        success: true,
        message: 'No containers found',
        data: { updates: [] },
      };
    }

    let filtered = containers;
    if (params.filter && typeof params.filter === 'string') {
      const f = params.filter.toLowerCase();
      filtered = containers.filter((c: any) => {
        const names = (c.Names ?? []).join(' ').toLowerCase();
        const image = (c.Image ?? '').toLowerCase();
        return names.includes(f) || image.includes(f);
      });
    }

    const updates: any[] = [];
    const upToDate: any[] = [];
    const errors: any[] = [];

    for (const container of filtered) {
      const name =
        (container.Names?.[0] ?? '').replace(/^\//, '') ||
        container.Id?.slice(0, 12);
      const image = container.Image ?? '';

      // Skip containers with local image IDs (not from a registry)
      if (image.startsWith('sha256:')) {
        upToDate.push({ name, image, reason: 'local image (no tag)' });
        continue;
      }

      try {
        // Inspect the container to get the full image details
        const inspect = await client.get(
          `/containers/${container.Id}/json`,
        );
        const currentImageId = inspect.Image ?? '';

        // Parse image reference
        const imageRef = image.includes(':') ? image : `${image}:latest`;

        // Try to pull the latest manifest to check for updates
        // We create the image with a pull, then compare IDs
        try {
          await client.post(
            `/images/create?fromImage=${encodeURIComponent(imageRef)}`,
          );
        } catch {
          // Pull may fail for private registries without auth — that's ok
          upToDate.push({ name, image: imageRef, reason: 'unable to check (pull failed)' });
          continue;
        }

        // Get the newly pulled image ID
        const newImageInfo = await client.get(
          `/images/${encodeURIComponent(imageRef)}/json`,
        );
        const newImageId = newImageInfo.Id ?? '';

        if (newImageId && newImageId !== currentImageId) {
          updates.push({
            name,
            image: imageRef,
            currentId: currentImageId.slice(0, 19),
            newId: newImageId.slice(0, 19),
            state: container.State,
          });
        } else {
          upToDate.push({ name, image: imageRef, reason: 'up to date' });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ name, image, error: msg.slice(0, 100) });
      }
    }

    if (updates.length === 0) {
      return {
        success: true,
        message: `All ${filtered.length} container(s) are up to date.${errors.length > 0 ? ` ${errors.length} could not be checked.` : ''}`,
        data: { updates: [], upToDate, errors },
      };
    }

    const summary = updates
      .map(
        (u) =>
          `- ${u.name}: UPDATE AVAILABLE (${u.image}) [current: ${u.currentId}, new: ${u.newId}]`,
      )
      .join('\n');

    return {
      success: true,
      message: `${updates.length} update(s) available:\n${summary}${errors.length > 0 ? `\n\n${errors.length} container(s) could not be checked.` : ''}`,
      data: { updates, upToDate, errors },
    };
  },
};
