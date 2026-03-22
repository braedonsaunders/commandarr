import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'docker_pin_version',
  integration: 'docker',
  description:
    'Pin a container to its current image version by adding a "commandarr.pinned" label. Pinned containers are skipped during batch update checks.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Container name to pin or unpin',
      },
      action: {
        type: 'string',
        description: '"pin" to lock the current version, "unpin" to allow updates (default: "pin")',
      },
      reason: {
        type: 'string',
        description: 'Optional reason for pinning (e.g., "latest version breaks 4K playback")',
      },
    },
    required: ['name'],
  },
  ui: {
    category: 'Updates',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { name, action = 'pin', reason } = params;

    if (!name || typeof name !== 'string') {
      return { success: false, message: 'Container name is required' };
    }

    const client = ctx.getClient('docker');
    const shouldPin = action !== 'unpin';

    ctx.log(`${shouldPin ? 'Pinning' : 'Unpinning'} container: ${name}`);

    // Inspect current container
    let currentInspect: any;
    try {
      currentInspect = await client.get(`/containers/${name}/json`);
    } catch {
      return { success: false, message: `Container "${name}" not found` };
    }

    const currentImage = currentInspect.Config?.Image ?? '';
    const currentLabels = currentInspect.Config?.Labels ?? {};

    if (shouldPin && currentLabels['commandarr.pinned'] === 'true') {
      return {
        success: true,
        message: `Container "${name}" is already pinned to ${currentImage}. Pinned on: ${currentLabels['commandarr.pinned.date'] ?? 'unknown'}. Reason: ${currentLabels['commandarr.pinned.reason'] ?? 'none'}`,
        data: {
          name,
          image: currentImage,
          pinned: true,
          reason: currentLabels['commandarr.pinned.reason'],
          date: currentLabels['commandarr.pinned.date'],
        },
      };
    }

    if (!shouldPin && !currentLabels['commandarr.pinned']) {
      return {
        success: true,
        message: `Container "${name}" is not pinned.`,
        data: { name, image: currentImage, pinned: false },
      };
    }

    // To update labels, we need to recreate the container
    const newLabels = { ...currentLabels };

    if (shouldPin) {
      newLabels['commandarr.pinned'] = 'true';
      newLabels['commandarr.pinned.image'] = currentImage;
      newLabels['commandarr.pinned.date'] = new Date().toISOString();
      if (reason) {
        newLabels['commandarr.pinned.reason'] = reason;
      }
    } else {
      delete newLabels['commandarr.pinned'];
      delete newLabels['commandarr.pinned.image'];
      delete newLabels['commandarr.pinned.date'];
      delete newLabels['commandarr.pinned.reason'];
    }

    // Stop, remove, recreate with updated labels
    const wasRunning = currentInspect.State?.Running === true;

    try {
      if (wasRunning) {
        await client.post(`/containers/${currentInspect.Id}/stop?t=30`);
      }
    } catch {
      // May already be stopped
    }

    try {
      await client.delete(`/containers/${currentInspect.Id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Failed to remove container for label update: ${msg}`,
      };
    }

    const createConfig: any = {
      ...currentInspect.Config,
      Labels: newLabels,
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

    let newId: string;
    try {
      const created = await client.post(
        `/containers/create?name=${name}`,
        createConfig,
      );
      newId = created.Id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Failed to recreate container with updated labels: ${msg}`,
      };
    }

    if (wasRunning) {
      try {
        await client.post(`/containers/${newId}/start`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          message: `Container recreated but failed to start: ${msg}`,
        };
      }
    }

    if (shouldPin) {
      return {
        success: true,
        message: `Pinned "${name}" to image ${currentImage}.${reason ? ` Reason: ${reason}` : ''} This container will be skipped during update checks.`,
        data: { name, image: currentImage, pinned: true, reason },
      };
    }

    return {
      success: true,
      message: `Unpinned "${name}". This container will now be included in update checks.`,
      data: { name, image: currentImage, pinned: false },
    };
  },
};
