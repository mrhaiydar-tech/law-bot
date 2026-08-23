import { Events, PermissionFlagsBits } from 'discord.js';
import { getStaffData, incrementStaffActivity } from '../services/staffService.js';

export default {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const member = message.member;
    if (!member) return;

    const data = await getStaffData(message.guild.id);
    const isManager = data.config.managerRoleId && member.roles.cache.has(data.config.managerRoleId);
    const isGuildManager = member.permissions.has(PermissionFlagsBits.ManageGuild);

    if (!isManager && !isGuildManager) return;

    await incrementStaffActivity(message.guild.id, message.author.id, 'messages', 1);
  },
};
