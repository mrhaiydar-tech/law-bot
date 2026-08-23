import { Events } from 'discord.js';
import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: Events.RoleDelete,
  async execute(role) {
    if (role.guild) await handleAntiNuke(role.guild, 'roleDelete', role.id);
  },
};
