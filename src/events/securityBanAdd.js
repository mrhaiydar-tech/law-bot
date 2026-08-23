import { Events } from 'discord.js';
import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: Events.GuildBanAdd,
  async execute(ban) {
    await handleAntiNuke(ban.guild, 'ban', ban.user.id);
  },
};
