import type { ToolDefinition, IntegrationManifest } from '../integrations/_base';

interface IntegrationStatus {
  manifest: IntegrationManifest;
  healthy: boolean;
  configured: boolean;
}

export function buildSystemPrompt(
  integrations: IntegrationStatus[],
  tools: ToolDefinition[],
): string {
  const now = new Date();
  const timestamp = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const lines: string[] = [
    'You are Commandarr, an AI assistant for managing media servers and automation.',
    `Current date and time: ${timestamp}`,
    '',
  ];

  // Integration status section
  lines.push('## Available Integrations');
  if (integrations.length === 0) {
    lines.push('No integrations are configured yet. Guide the user to set them up in Settings.');
  } else {
    for (const int of integrations) {
      const status = !int.configured
        ? 'NOT CONFIGURED'
        : int.healthy
          ? 'HEALTHY'
          : 'UNHEALTHY';
      lines.push(`- ${int.manifest.name} (${int.manifest.id}): ${status}`);
    }
  }
  lines.push('');

  // Tools section
  lines.push('## Available Tools');
  if (tools.length === 0) {
    lines.push('No tools are available. Integrations must be configured and healthy first.');
  } else {
    const byCategory = new Map<string, ToolDefinition[]>();
    for (const tool of tools) {
      const category = tool.ui.category || tool.integration;
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category)!.push(tool);
    }

    for (const [category, categoryTools] of byCategory) {
      lines.push(`### ${category}`);
      for (const tool of categoryTools) {
        const params = tool.parameters.required?.length
          ? `Required params: ${tool.parameters.required.join(', ')}`
          : 'No required params';
        lines.push(`- **${tool.name}**: ${tool.description} (${params})`);
        if (tool.ui.dangerLevel === 'high') {
          lines.push('  - WARNING: This is a destructive/high-impact action. Always confirm with the user before executing.');
        }
      }
    }
  }
  lines.push('');

  // Instructions
  lines.push('## Instructions');
  lines.push('- Be concise and helpful. Provide direct answers when possible.');
  lines.push('- Use tools to interact with media servers when the user asks you to perform actions or retrieve information.');
  lines.push('- Always confirm before executing destructive or high-impact actions (deleting, removing, restarting services).');
  lines.push('- When displaying results, format them clearly. Use lists for multiple items.');
  lines.push('- If an integration is unhealthy or unconfigured, let the user know and suggest they check Settings.');
  lines.push('- If a tool call fails, explain the error and suggest possible fixes.');
  lines.push('- Do not fabricate data. If you do not have the information, say so and offer to look it up with a tool.');

  return lines.join('\n');
}
