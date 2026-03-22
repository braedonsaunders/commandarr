import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'radarr_delete_movie',
  integration: 'radarr',
  description:
    'Delete a movie from Radarr. Optionally delete files from disk and add to the import exclusion list to prevent re-adding.',
  parameters: {
    type: 'object',
    properties: {
      movieId: {
        type: 'number',
        description: 'Radarr movie ID to delete',
      },
      deleteFiles: {
        type: 'boolean',
        description:
          'Also delete movie files from disk (default: false)',
      },
      addExclusion: {
        type: 'boolean',
        description:
          'Add to import exclusion list to prevent re-adding (default: false)',
      },
    },
    required: ['movieId'],
  },
  ui: {
    category: 'Movies',
    dangerLevel: 'high',
    testable: false,
  },
  async handler(params, ctx) {
    const { movieId, deleteFiles = false, addExclusion = false } = params;
    const client = ctx.getClient('radarr');

    ctx.log(`Fetching movie info for ID ${movieId}...`);

    let movie: any;
    try {
      movie = await client.get(`/api/v3/movie/${movieId}`);
    } catch {
      return {
        success: false,
        message: `No movie found with ID ${movieId}`,
      };
    }

    const title = movie.title ?? 'Unknown';
    const year = movie.year ?? '';
    const hasFile = movie.hasFile ?? false;

    ctx.log(
      `Deleting ${title} (${year})${deleteFiles ? ' and its files' : ''}...`,
    );

    await client.delete(
      `/api/v3/movie/${movieId}?deleteFiles=${deleteFiles}&addImportExclusion=${addExclusion}`,
    );

    const details = [
      `Deleted ${title} (${year}) from Radarr.`,
      `Files deleted: ${deleteFiles ? 'Yes' : 'No'}${hasFile ? '' : ' (no file on disk)'}`,
      `Added to exclusion list: ${addExclusion ? 'Yes' : 'No'}`,
    ];

    return {
      success: true,
      message: details.join('\n'),
      data: {
        movieId,
        title,
        year,
        deleteFiles,
        addExclusion,
        hadFile: hasFile,
      },
    };
  },
};
