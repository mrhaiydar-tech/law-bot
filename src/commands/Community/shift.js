import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getStaffData, recordStaffShift } from '../../services/staffService.js';
import {
  formatDuration,
  getShiftData,
  getShiftHistory,
  getShiftLeaderboard,
  getShiftStats,
  startShift,
  stopShift,
  updateShiftConfig,
} from '../../services/staffShiftService.js';
import { withErrorHandling } from '../../utils/errorHandler.js';

function hasManagerAccess(interaction, staffData) {
  return interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
    || Boolean(staffData.config.managerRoleId && interaction.member.roles.cache.has(staffData.config.managerRoleId));
}

function formatHours(hours) {
  return `${Number(hours || 0).toFixed(2)}h`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('shift')
    .setDescription('Manage staff shifts')
    .addSubcommand((sub) => sub.setName('start').setDescription('Start your staff shift'))
    .addSubcommand((sub) => sub.setName('stop').setDescription('Stop your current staff shift'))
    .addSubcommand((sub) => sub.setName('status').setDescription('View a staff shift status').addUserOption((opt) => opt.setName('user').setDescription('Staff member').setRequired(false)))
    .addSubcommand((sub) => sub.setName('history').setDescription('View staff shift history').addUserOption((opt) => opt.setName('user').setDescription('Staff member').setRequired(false)).addIntegerOption((opt) => opt.setName('limit').setDescription('Number of shifts to show').setMinValue(1).setMaxValue(20)))
    .addSubcommand((sub) => sub.setName('leaderboard').setDescription('View the staff shift leaderboard'))
    .addSubcommand((sub) => sub.setName('setup').setDescription('Configure staff shift requirements').addNumberOption((opt) => opt.setName('minimum_hours').setDescription('Minimum required shift hours').setMinValue(0).setMaxValue(1000).setRequired(true))),
  category: 'Community',
  execute: withErrorHandling(async (interaction) => {
    if (!interaction.inGuild()) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const staffData = await getStaffData(interaction.guildId);
    const shiftData = await getShiftData(interaction.guildId);

    if (sub === 'setup') {
      if (!hasManagerAccess(interaction, staffData)) return interaction.reply({ content: 'You do not have permission to configure staff shifts.', ephemeral: true });
      const minimumHours = interaction.options.getNumber('minimum_hours', true);
      const updated = await updateShiftConfig(interaction.guildId, { minimumHours });
      return interaction.reply({ content: `Staff shift settings saved. Minimum hours: **${Number(updated.config.minimumHours).toFixed(2)}h**.`, ephemeral: true });
    }

    const requestedUser = interaction.options.getUser('user');
    const targetUser = requestedUser || interaction.user;
    const isSelf = targetUser.id === interaction.user.id;
    const managerAccess = hasManagerAccess(interaction, staffData);

    if (!isSelf && !managerAccess) return interaction.reply({ content: 'You can only view your own shift information.', ephemeral: true });

    if (sub === 'start') {
      if (!staffData.members[targetUser.id]) return interaction.reply({ content: 'You are not registered in the staff system yet. Open your staff profile first.', ephemeral: true });
      const result = await startShift(interaction.guildId, targetUser.id);
      if (!result.started) return interaction.reply({ content: `You already have an active shift since <t:${Math.floor(new Date(result.shift.startedAt).getTime() / 1000)}:R>.`, ephemeral: true });
      return interaction.reply({ content: `Shift started at <t:${Math.floor(new Date(result.shift.startedAt).getTime() / 1000)}:F>.`, ephemeral: true });
    }

    if (sub === 'stop') {
      const result = await stopShift(interaction.guildId, targetUser.id);
      if (!result.stopped) return interaction.reply({ content: 'You do not have an active shift.', ephemeral: true });
      await recordStaffShift(interaction.guildId, targetUser.id, result.shift.durationHours);
      const minimum = Number(shiftData.config.minimumHours || 0);
      const duration = formatDuration(result.shift.durationMs);
      const requirement = minimum > 0 ? `\nMinimum: **${minimum.toFixed(2)}h** — ${result.shift.durationHours >= minimum ? 'Met' : 'Not met'}` : '';
      return interaction.reply({ content: `Shift stopped. Duration: **${duration}**.${requirement}`, ephemeral: true });
    }

    if (sub === 'status') {
      const stats = getShiftStats(shiftData, targetUser.id);
      const embed = new EmbedBuilder()
        .setTitle(`Shift Status — ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: 'Status', value: stats.active ? `🟢 Active\nStarted <t:${Math.floor(new Date(stats.active.startedAt).getTime() / 1000)}:R>` : '⚪ Offline', inline: true },
          { name: 'Total Hours', value: `**${formatHours(stats.totalHours)}**`, inline: true },
          { name: 'Completed Shifts', value: `**${stats.shiftCount}**`, inline: true },
          { name: 'Minimum Hours', value: `**${Number(shiftData.config.minimumHours || 0).toFixed(2)}h**`, inline: true },
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'history') {
      const limit = interaction.options.getInteger('limit') || 10;
      const history = await getShiftHistory(interaction.guildId, targetUser.id, limit);
      if (!history.length) return interaction.reply({ content: `No completed shifts found for ${targetUser}.`, ephemeral: true });
      const lines = history.map((shift, index) => `${index + 1}. <t:${Math.floor(new Date(shift.startedAt).getTime() / 1000)}:d> — **${formatDuration(shift.durationMs)}** — <t:${Math.floor(new Date(shift.startedAt).getTime() / 1000)}:t> to <t:${Math.floor(new Date(shift.endedAt).getTime() / 1000)}:t>`);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`Shift History — ${targetUser.username}`).setDescription(lines.join('\n')).setFooter({ text: `Showing ${history.length} shift(s)` })] });
    }

    if (sub === 'leaderboard') {
      if (!managerAccess) return interaction.reply({ content: 'You do not have permission to view the staff shift leaderboard.', ephemeral: true });
      const leaderboard = getShiftLeaderboard(shiftData, 10);
      if (!leaderboard.length) return interaction.reply({ content: 'No staff shift data exists yet.', ephemeral: true });
      const lines = leaderboard.map((entry, index) => `${index + 1}. <@${entry.userId}> — **${formatHours(entry.stats.totalHours)}** — ${entry.stats.shiftCount} completed shift(s)${entry.stats.active ? ' 🟢' : ''}`);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Staff Shift Leaderboard').setDescription(lines.join('\n')).addFields({ name: 'Minimum Hours', value: `**${Number(shiftData.config.minimumHours || 0).toFixed(2)}h**` })] });
    }
  }),
};
