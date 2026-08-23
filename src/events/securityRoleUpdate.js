import { Events, PermissionFlagsBits } from 'discord.js';
import { handleAntiNuke } from '../services/security/antiNuke.js';

const DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageWebhooks,
];

function hasDangerousPermission(role) {
  return DANGEROUS_PERMISSIONS.some(permission => role.permissions.has(permission));
}

export default {
  name: Events.RoleUpdate,
  async execute(oldRole, newRole) {
    if (!newRole?.guild) return;
    if (!hasDangerousPermission(oldRole) && hasDangerousPermission(newRole)) {
      await handleAntiNuke(newRole.guild, 'roleUpdate', newRole.id);
    }
  },
};
