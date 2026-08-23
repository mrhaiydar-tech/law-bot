import { Events } from 'discord.js';
import { handleMemberJoin } from '../services/security/antiRaid.js';

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    await handleMemberJoin(member);
  },
};
