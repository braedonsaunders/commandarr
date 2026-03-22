import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'docker_rollback_container',
  integration: 'docker',
  description:
    'Roll back a container to a specific previous image version. Stops the current container, recreates it with the specified image, and starts it.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Container name to roll back',
      },
      image: {
        type: 'string',
        description:
          'Image to roll back to (e.g., "linuxserver/sonarr:3.0.10"). If not specified, uses the previous image if a rollback backup exists.',
      },
      confirm: {
        type: 'boolean',
        description: 'Must be true to proceed with the rollback',
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
    const { name, image, confirm } = params;

    if (!confirm) {
      return {
        success: false,
        message:
          'Rollback not confirmed. Set confirm=true to proceed. This will stop and recreate the container with the specified image.',
      };
    }

    if (!name || typeof name !== 'string') {
      return { success: false, message: 'Container name is required' };
    }

    const client = ctx.getClient('docker');
    ctx.log(`Starting rollback for container: ${name}`);

    // Inspect current container
    let currentInspect: any;
    try {
      currentInspect = await client.get(`/containers/${name}/json`);
    } catch {
      return { success: false, message: `Container "${name}" not found` };
    }

    // Determine target image
    let targetImage = image;

    if (!targetImage) {
      // Look for a rollback backup container
      const allContainers = await client.get('/containers/json', {
        all: 'true',
      });
      const backup = (allContainers ?? []).find((c: any) =>
        (c.Names ?? []).some((n: string) =>
          n.replace(/^\//, '').startsWith(`${name}_rollback_`),
        ),
      );

      if (backup) {
        const backupInspect = await client.get(
          `/containers/${backup.Id}/json`,
        );
        targetImage = backupInspect.Config?.Image;
        ctx.log(`Found rollback backup with image: ${targetImage}`);
      } else {
        return {
          success: false,
          message:
            'No image specified and no rollback backup found. Provide the image parameter (e.g., "linuxserver/sonarr:3.0.10").',
        };
      }
    }

    // Pull the target image if needed
    ctx.log(`Pulling rollback image: ${targetImage}`);
    try {
      await client.post(
        `/images/create?fromImage=${encodeURIComponent(targetImage)}`,
      );
    } catch {
      ctx.log('Pull failed — image may already be available locally');
    }

    const currentImageId = currentInspect.Image;

    // Stop current container
    try {
      await client.post(`/containers/${name}/stop?t=30`);
      ctx.log('Stopped current container');
    } catch {
      // May already be stopped
    }

    // Remove current container
    try {
      await client.delete(`/containers/${currentInspect.Id}`);
      ctx.log('Removed current container');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Failed to remove current container: ${msg}`,
      };
    }

    // Create new container with old image
    const createConfig: any = {
      ...currentInspect.Config,
      Image: targetImage,
      HostConfig: currentInspect.HostConfig,
      NetworkingConfig: {},
    };

    if (currentInspect.NetworkSettings?.Networks) {
      const networks: any = {};
      for (const [netName, netConfig] of Object.entries(
        currentInspect.NetworkSettings.Networks,
      )) {
        networks[netName] = {
          ...(netConfig as any),
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

    delete createConfig.Hostname;

    let newContainerId: string;
    try {
      const created = await client.post(
        `/containers/create?name=${name}`,
        createConfig,
      );
      newContainerId = created.Id;
      ctx.log(`Created rolled-back container: ${newContainerId?.slice(0, 12)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Failed to create rolled-back container: ${msg}. The previous container has been removed — you may need to recreate it manually.`,
      };
    }

    // Start the rolled-back container
    try {
      await client.post(`/containers/${newContainerId}/start`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Rolled-back container created but failed to start: ${msg}`,
      };
    }

    // Wait briefly and verify
    await new Promise((resolve) => setTimeout(resolve, 5000));

    let finalState = 'unknown';
    try {
      const inspect = await client.get(`/containers/${newContainerId}/json`);
      finalState = inspect.State?.Running ? 'running' : 'stopped';
    } catch {
      // Best effort
    }

    return {
      success: true,
      message: `Successfully rolled back "${name}" to image ${targetImage}. Container is ${finalState}.`,
      data: {
        name,
        image: targetImage,
        status: 'rolled_back',
        containerState: finalState,
        previousImageId: currentImageId?.slice(0, 19),
      },
    };
  },
};
