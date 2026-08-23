import { Events } from 'discord.js';
import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: Events.ChannelCreate,
  async execute(channel) {
    if (channel.guild) await handleAntiNuke(channel.guild, 'channelCreate', channel.id);
  },
};
