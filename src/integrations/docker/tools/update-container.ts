import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'docker_update_container',
  integration: 'docker',
  description:
    'Update a container to the latest image with automatic rollback on health check failure. Creates a backup of the current state before updating.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Container name to update',
      },
      healthCheckTimeout: {
        type: 'number',
        description:
          'Seconds to wait for the new container to become healthy (default: 120)',
      },
      confirm: {
        type: 'boolean',
        description: 'Must be true to proceed with the update',
      },
    },
    required: ['name', 'confirm'],
  },
  ui: {
    category: 'Updates',
    dangerLevel: 'high',
    testable: false,
  },
  async handler(params, ctx) {
    const { name, confirm, healthCheckTimeout = 120 } = params;

    if (!confirm) {
      return {
        success: false,
        message:
          'Update not confirmed. Set confirm=true to proceed. This will stop the container, pull the latest image, and recreate it.',
      };
    }

    if (!name || typeof name !== 'string') {
      return { success: false, message: 'Container name is required' };
    }

    const client = ctx.getClient('docker');
    ctx.log(`Starting update for container: ${name}`);

    // Step 1: Inspect the current container to save its config
    let currentInspect: any;
    try {
      currentInspect = await client.get(`/containers/${name}/json`);
    } catch {
      return {
        success: false,
        message: `Container "${name}" not found`,
      };
    }

    const currentImageId = currentInspect.Image;
    const currentImage = currentInspect.Config?.Image ?? '';
    const backupName = `${name}_rollback_${Date.now()}`;

    ctx.log(`Current image: ${currentImage} (${currentImageId?.slice(0, 19)})`);

    // Step 2: Pull the latest image
    const imageRef = currentImage.includes(':')
      ? currentImage
      : `${currentImage}:latest`;

    ctx.log(`Pulling latest image: ${imageRef}`);
    try {
      await client.post(
        `/images/create?fromImage=${encodeURIComponent(imageRef)}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Failed to pull image ${imageRef}: ${msg}`,
      };
    }

    // Check if image actually changed
    let newImageInfo: any;
    try {
      newImageInfo = await client.get(
        `/images/${encodeURIComponent(imageRef)}/json`,
      );
    } catch {
      return {
        success: false,
        message: `Failed to inspect pulled image ${imageRef}`,
      };
    }

    if (newImageInfo.Id === currentImageId) {
      return {
        success: true,
        message: `Container "${name}" is already running the latest image. No update needed.`,
        data: { name, image: imageRef, status: 'already_up_to_date' },
      };
    }

    ctx.log(`New image available: ${newImageInfo.Id?.slice(0, 19)}`);

    // Step 3: Rename current container as backup
    try {
      await client.post(`/containers/${currentInspect.Id}/rename?name=${backupName}`);
      ctx.log(`Renamed current container to ${backupName} for rollback`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Failed to rename container for backup: ${msg}`,
      };
    }

    // Step 4: Stop the old container
    try {
      await client.post(`/containers/${backupName}/stop?t=30`);
      ctx.log('Stopped old container');
    } catch {
      // May already be stopped
    }

    // Step 5: Create new container with same config
    const createConfig: any = {
      ...currentInspect.Config,
      Image: imageRef,
      HostConfig: currentInspect.HostConfig,
      NetworkingConfig: {},
    };

    // Preserve network connections
    if (currentInspect.NetworkSettings?.Networks) {
      const networks: any = {};
      for (const [netName, netConfig] of Object.entries(
        currentInspect.NetworkSettings.Networks,
      )) {
        networks[netName] = {
          ...(netConfig as any),
          // Clear dynamic fields
          IPAddress: undefined,
          Gateway: undefined,
          IPPrefixLen: undefined,
          MacAddress: undefined,
          NetworkID: undefined,
          EndpointID: undefined,
        };
      }
      createConfig.NetworkingConfig.EndpointsConfig = networks;
    }

    // Remove fields that shouldn't be in create config
    delete createConfig.Hostname;

    let newContainerId: string;
    try {
      const created = await client.post(
        `/containers/create?name=${name}`,
        createConfig,
      );
      newContainerId = created.Id;
      ctx.log(`Created new container: ${newContainerId?.slice(0, 12)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Rollback: rename backup back
      ctx.log(`Create failed, rolling back: ${msg}`);
      try {
        await client.post(`/containers/${backupName}/rename?name=${name}`);
        await client.post(`/containers/${name}/start`);
      } catch {
        // Best effort rollback
      }
      return {
        success: false,
        message: `Failed to create updated container. Rolled back to previous version. Error: ${msg}`,
      };
    }

    // Step 6: Start new container
    try {
      await client.post(`/containers/${newContainerId}/start`);
      ctx.log('Started new container');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Rollback: remove new container, restore backup
      ctx.log(`Start failed, rolling back: ${msg}`);
      try {
        await client.delete(`/containers/${newContainerId}?force=true`);
        await client.post(`/containers/${backupName}/rename?name=${name}`);
        await client.post(`/containers/${name}/start`);
      } catch {
        // Best effort rollback
      }
      return {
        success: false,
        message: `Failed to start updated container. Rolled back to previous version. Error: ${msg}`,
      };
    }

    // Step 7: Health check the new container
    ctx.log(
      `Waiting up to ${healthCheckTimeout}s for container to become healthy...`,
    );
    const startTime = Date.now();
    let healthy = false;
    let lastStatus = '';

    while (Date.now() - startTime < healthCheckTimeout * 1000) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      try {
        const inspect = await client.get(`/containers/${newContainerId}/json`);
        const state = inspect.State ?? {};

        if (!state.Running) {
          lastStatus = `Container exited with code ${state.ExitCode}`;
          break;
        }

        // If container has a healthcheck defined, wait for it
        if (state.Health) {
          if (state.Health.Status === 'healthy') {
            healthy = true;
            break;
          }
          if (state.Health.Status === 'unhealthy') {
            lastStatus = `Container is unhealthy: ${state.Health.Log?.[state.Health.Log.length - 1]?.Output ?? 'unknown reason'}`;
            break;
          }
          lastStatus = `Health: ${state.Health.Status}`;
        } else {
          // No healthcheck — consider running as healthy after 10s
          if (Date.now() - startTime > 10000) {
            healthy = true;
            break;
          }
        }
      } catch {
        lastStatus = 'Failed to inspect container';
      }
    }

    if (!healthy) {
      // Auto-rollback
      ctx.log(`Container unhealthy after update: ${lastStatus}. Rolling back...`);
      try {
        await client.post(`/containers/${newContainerId}/stop?t=10`);
        await client.delete(`/containers/${newContainerId}`);
        await client.post(`/containers/${backupName}/rename?name=${name}`);
        await client.post(`/containers/${name}/start`);
      } catch {
        // Best effort
      }
      return {
        success: false,
        message: `Update failed health check: ${lastStatus}. Automatically rolled back to previous version.`,
        data: {
          name,
          image: imageRef,
          status: 'rolled_back',
          reason: lastStatus,
          previousImageId: currentImageId?.slice(0, 19),
        },
      };
    }

    // Step 8: Success — clean up backup container
    ctx.log('Update successful! Cleaning up backup container...');
    try {
      await client.delete(`/containers/${backupName}?v=false`);
    } catch {
      // Leave backup if cleanup fails
    }

    return {
      success: true,
      message: `Successfully updated "${name}" from ${currentImageId?.slice(0, 19)} to ${newImageInfo.Id?.slice(0, 19)}. Container is healthy.`,
      data: {
        name,
        image: imageRef,
        status: 'updated',
        previousImageId: currentImageId?.slice(0, 19),
        newImageId: newImageInfo.Id?.slice(0, 19),
      },
    };
  },
};
