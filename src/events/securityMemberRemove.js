import { Events } from 'discord.js';
import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: Events.GuildMemberRemove,
  async execute(member) {
    await handleAntiNuke(member.guild, 'kick', member.id);
  },
};
