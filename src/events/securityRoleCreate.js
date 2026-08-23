import { Events } from 'discord.js';
import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: Events.RoleCreate,
  async execute(role) {
    if (role.guild) await handleAntiNuke(role.guild, 'roleCreate', role.id);
  },
};
