import { Events } from 'discord.js';
import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    if (!member?.user?.bot) return;
    await handleAntiNuke(member.guild, 'botAdd', member.id);
  },
};
