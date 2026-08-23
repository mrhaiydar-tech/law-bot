import { Events } from 'discord.js';
import { handleAutoMod } from '../services/security/autoMod.js';

export default {
  name: Events.MessageCreate,
  async execute(message) {
    await handleAutoMod(message);
  },
};
