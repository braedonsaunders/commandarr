import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'tailscale_acl',
  integration: 'tailscale',
  description:
    'Get the current Tailscale ACL (Access Control List) policy. Shows who can access what on your tailnet. Use this to verify that your Plex or media server ACLs allow the right users and devices.',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Security',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('tailscale');
    ctx.log('Fetching ACL policy...');

    const response = await client.get('/api/v2/tailnet/{tailnet}/acl');

    // The ACL response can be either a JSON policy object or an HuJSON string
    const acl = typeof response === 'string' ? response : response;

    // Extract key sections from the ACL
    const aclRules: any[] = acl.acls ?? acl.ACLs ?? [];
    const groups: Record<string, string[]> = acl.groups ?? acl.Groups ?? {};
    const tagOwners: Record<string, string[]> = acl.tagOwners ?? acl.TagOwners ?? {};
    const autoApprovers: any = acl.autoApprovers ?? {};
    const ssh: any[] = acl.ssh ?? [];
    const nodeAttrs: any[] = acl.nodeAttrs ?? [];

    const lines: string[] = [];

    // Groups
    const groupNames = Object.keys(groups);
    lines.push(`Groups (${groupNames.length}):`);
    if (groupNames.length > 0) {
      for (const [name, members] of Object.entries(groups)) {
        const memberList = Array.isArray(members) ? members : [];
        lines.push(`  ${name}: ${memberList.join(', ')}`);
      }
    } else {
      lines.push('  (none defined)');
    }

    // ACL Rules
    lines.push('', `ACL Rules (${aclRules.length}):`);
    if (aclRules.length > 0) {
      for (const rule of aclRules.slice(0, 20)) {
        const action = rule.action ?? 'accept';
        const src = Array.isArray(rule.src) ? rule.src.join(', ') : rule.src ?? '*';
        const dst = Array.isArray(rule.dst) ? rule.dst.join(', ') : rule.dst ?? '*';
        lines.push(`  [${action}] ${src} -> ${dst}`);
      }
      if (aclRules.length > 20) {
        lines.push(`  ... and ${aclRules.length - 20} more rules`);
      }
    } else {
      lines.push('  (no rules defined - default deny)');
    }

    // Tag Owners
    const tagNames = Object.keys(tagOwners);
    lines.push('', `Tag Owners (${tagNames.length}):`);
    if (tagNames.length > 0) {
      for (const [tag, owners] of Object.entries(tagOwners)) {
        const ownerList = Array.isArray(owners) ? owners : [];
        lines.push(`  ${tag}: ${ownerList.join(', ')}`);
      }
    } else {
      lines.push('  (none defined)');
    }

    // SSH rules
    if (ssh.length > 0) {
      lines.push('', `SSH Rules (${ssh.length}):`);
      for (const rule of ssh.slice(0, 10)) {
        const action = rule.action ?? 'accept';
        const src = Array.isArray(rule.src) ? rule.src.join(', ') : rule.src ?? '*';
        const dst = Array.isArray(rule.dst) ? rule.dst.join(', ') : rule.dst ?? '*';
        const users = Array.isArray(rule.users) ? rule.users.join(', ') : rule.users ?? '*';
        lines.push(`  [${action}] ${src} -> ${dst} (users: ${users})`);
      }
    }

    // Auto-approvers
    const autoRoutes = autoApprovers.routes ?? {};
    const autoExitNodes = autoApprovers.exitNode ?? {};
    if (Object.keys(autoRoutes).length > 0 || Object.keys(autoExitNodes).length > 0) {
      lines.push('', 'Auto-Approvers:');
      for (const [route, approvers] of Object.entries(autoRoutes)) {
        const list = Array.isArray(approvers) ? (approvers as string[]).join(', ') : String(approvers);
        lines.push(`  Route ${route}: ${list}`);
      }
      for (const [node, approvers] of Object.entries(autoExitNodes)) {
        const list = Array.isArray(approvers) ? (approvers as string[]).join(', ') : String(approvers);
        lines.push(`  Exit Node ${node}: ${list}`);
      }
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        acls: aclRules,
        groups,
        tagOwners,
        ssh,
        nodeAttrs,
        autoApprovers,
      },
    };
  },
};
