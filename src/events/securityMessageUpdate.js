import { Events } from 'discord.js';
import { handleAutoMod } from '../services/security/autoMod.js';

export default {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (!newMessage?.guild || newMessage.author?.bot) return;
    if (!newMessage.content || newMessage.content === oldMessage?.content) return;
    await handleAutoMod(newMessage);
  },
};
