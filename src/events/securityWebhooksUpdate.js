import { Events } from 'discord.js';
import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: Events.WebhooksUpdate,
  async execute(channel) {
    if (!channel?.guild) return;
    await handleAntiNuke(channel.guild, 'webhookUpdate', channel.id);
  },
};
