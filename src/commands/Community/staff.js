import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import {
  calculateActivityScore,
  countWarnings,
  getStaffData,
  getStaffLeaderboard,
  getStaffProfile,
  updateStaffConfig,
  addStaffWarning,
  addPromotion,
  addDemotion,
  addStaffNote,
  resetStaffProfile,
} from '../../services/staffService.js';
import { withErrorHandling } from '../../utils/errorHandler.js';

const dashboardButtons = () => [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('staff_my_profile').setLabel('My Profile').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('staff_activity').setLabel('Activity').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('staff_list').setLabel('Staff List').setStyle(ButtonStyle.Secondary),
  ),
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('staff_warnings').setLabel('Warnings').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('staff_promotions').setLabel('Promotions').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('staff_demotions').setLabel('Demotions').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('staff_notes').setLabel('Notes').setStyle(ButtonStyle.Secondary),
  ),
];

function dashboardEmbed(guild, data) {
  const count = Object.keys(data.members).length;
  const warned = Object.values(data.members).filter((member) => countWarnings(member) > 0).length;
  return new EmbedBuilder()
    .setTitle('Staff Management')
    .setDescription(`**${guild.name}**\nCentralized staff management, activity and history.`)
    .addFields(
      { name: 'Staff', value: `**${count}**`, inline: true },
      { name: 'With Warnings', value: `**${warned}**`, inline: true },
      { name: 'Review Threshold', value: `**${data.config.warningsBeforeReview}** warnings`, inline: true },
    )
    .setFooter({ text: 'Use /staff profile, /staff warn, /staff promote or /staff demote to manage staff.' });
}

export default {
  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('Manage server staff')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('dashboard').setDescription('Open the staff dashboard'))
    .addSubcommand((sub) => sub.setName('leaderboard').setDescription('View staff performance leaderboard'))
    .addSubcommand((sub) => sub
      .setName('profile')
      .setDescription('View a staff profile')
      .addUserOption((opt) => opt.setName('user').setDescription('Staff member').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('warn')
      .setDescription('Issue a staff warning')
      .addUserOption((opt) => opt.setName('user').setDescription('Staff member').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500)))
    .addSubcommand((sub) => sub
      .setName('promote')
      .setDescription('Promote a staff member')
      .addUserOption((opt) => opt.setName('user').setDescription('Staff member').setRequired(true))
      .addRoleOption((opt) => opt.setName('new_role').setDescription('Role to give').setRequired(true))
      .addRoleOption((opt) => opt.setName('remove_role').setDescription('Role to remove').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500))
      .addBooleanOption((opt) => opt.setName('reset_profile').setDescription('Reset current profile data after the promotion').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('demote')
      .setDescription('Demote a staff member')
      .addUserOption((opt) => opt.setName('user').setDescription('Staff member').setRequired(true))
      .addRoleOption((opt) => opt.setName('new_role').setDescription('Role to give').setRequired(true))
      .addRoleOption((opt) => opt.setName('remove_role').setDescription('Role to remove').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500))
      .addBooleanOption((opt) => opt.setName('reset_profile').setDescription('Reset current profile data after the demotion').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('note')
      .setDescription('Add a private staff note')
      .addUserOption((opt) => opt.setName('user').setDescription('Staff member').setRequired(true))
      .addStringOption((opt) => opt.setName('note').setDescription('Internal note').setRequired(true).setMaxLength(1000)))
    .addSubcommand((sub) => sub
      .setName('setup')
      .setDescription('Configure staff channels and permissions')
      .addChannelOption((opt) => opt.setName('promotion_channel').setDescription('Promotion announcement channel').addChannelTypes(ChannelType.GuildText))
      .addChannelOption((opt) => opt.setName('demotion_channel').setDescription('Demotion announcement channel').addChannelTypes(ChannelType.GuildText))
      .addChannelOption((opt) => opt.setName('warning_channel').setDescription('Staff warning channel').addChannelTypes(ChannelType.GuildText))
      .addRoleOption((opt) => opt.setName('manager_role').setDescription('Role allowed to manage staff'))
      .addIntegerOption((opt) => opt.setName('warnings_before_review').setDescription('Warnings before review').setMinValue(1).setMaxValue(20))),
  category: 'Community',
  execute: withErrorHandling(async (interaction) => {
    if (!interaction.inGuild()) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const data = await getStaffData(interaction.guildId);

    if (sub === 'dashboard') return interaction.reply({ embeds: [dashboardEmbed(interaction.guild, data)], components: dashboardButtons() });

    if (sub === 'leaderboard') {
      const leaderboard = getStaffLeaderboard(data, 10);
      if (!leaderboard.length) return interaction.reply({ content: 'No staff performance data exists yet.', ephemeral: true });
      const lines = leaderboard.map((entry, index) => {
        const activity = entry.profile?.activity || {};
        return `${index + 1}. <@${entry.userId}> — **${entry.score}/100**\n   💬 ${Number(activity.messages || 0).toLocaleString()} messages • 🎫 ${Number(activity.ticketsHandled || 0)} tickets • ⏱️ ${Number(activity.shiftHours || 0).toFixed(2)}h shifts • ⚠️ ${countWarnings(entry.profile)} warnings`;
      });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Staff Performance Leaderboard').setDescription(lines.join('\n\n')).setFooter({ text: 'Performance score combines staff activity and completed shift hours.' })] });
    }

    if (sub === 'setup') {
      const patch = {};
      const promotionChannel = interaction.options.getChannel('promotion_channel');
      const demotionChannel = interaction.options.getChannel('demotion_channel');
      const warningChannel = interaction.options.getChannel('warning_channel');
      const managerRole = interaction.options.getRole('manager_role');
      const threshold = interaction.options.getInteger('warnings_before_review');
      if (promotionChannel) patch.promotionChannelId = promotionChannel.id;
      if (demotionChannel) patch.demotionChannelId = demotionChannel.id;
      if (warningChannel) patch.warningChannelId = warningChannel.id;
      if (managerRole) patch.managerRoleId = managerRole.id;
      if (threshold) patch.warningsBeforeReview = threshold;
      if (!Object.keys(patch).length) return interaction.reply({ content: 'No settings were supplied.', ephemeral: true });
      const updated = await updateStaffConfig(interaction.guildId, patch);
      return interaction.reply({ content: `Staff settings saved.\nPromotion: ${updated.config.promotionChannelId ? `<#${updated.config.promotionChannelId}>` : 'Not set'}\nDemotion: ${updated.config.demotionChannelId ? `<#${updated.config.demotionChannelId}>` : 'Not set'}\nWarnings: ${updated.config.warningChannelId ? `<#${updated.config.warningChannelId}>` : 'Not set'}\nManager role: ${updated.config.managerRoleId ? `<@&${updated.config.managerRoleId}>` : 'Not set'}`, ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    if (!user) return interaction.reply({ content: 'A staff member is required.', ephemeral: true });

    if (sub === 'profile') {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      const profile = await getStaffProfile(interaction.guildId, user.id, { joinedAt: member?.joinedAt?.toISOString() });
      return interaction.reply({ embeds: [new EmbedBuilder()
        .setTitle('Staff Profile')
        .setDescription(`**${user}**\n${member?.roles?.highest ? `Current Role: **${member.roles.highest.name}**` : ''}`)
        .addFields(
          { name: 'Performance', value: `**${calculateActivityScore(profile)}/100**`, inline: true },
          { name: 'Activity', value: `**${Number(profile.activity?.messages || 0).toLocaleString()} messages**`, inline: true },
          { name: 'Warnings', value: `**${countWarnings(profile)}**`, inline: true },
          { name: 'Moderation Actions', value: `**${profile.activity?.moderationActions || 0}**`, inline: true },
          { name: 'Tickets Handled', value: `**${profile.activity?.ticketsHandled || 0}**`, inline: true },
          { name: 'Shift Hours', value: `**${Number(profile.activity?.shiftHours || 0).toFixed(2)}h**`, inline: true },
          { name: 'Shifts', value: `**${profile.activity?.shiftCount || 0}**`, inline: true },
          { name: 'Promotions', value: `**${profile.promotions.length}**`, inline: true },
          { name: 'Demotions', value: `**${profile.demotions.length}**`, inline: true },
        )
        .setThumbnail(user.displayAvatarURL())] });
    }

    if (sub === 'warn') {
      const reason = interaction.options.getString('reason', true);
      await addStaffWarning(interaction.guildId, user.id, interaction.user.id, reason);
      const profile = await getStaffProfile(interaction.guildId, user.id);
      const channelId = data.config.warningChannelId;
      if (channelId) {
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (channel?.isTextBased()) await channel.send(`⚠️ **Staff Warning**\n${user}\nReason: ${reason}\nIssued by: ${interaction.user}\nWarnings: **${profile.warnings.length}/${data.config.warningsBeforeReview}**`);
      }
      return interaction.reply({ content: `Staff warning issued to ${user}. Total warnings: **${profile.warnings.length}**.`, ephemeral: true });
    }

    const newRole = interaction.options.getRole('new_role');
    const removeRole = interaction.options.getRole('remove_role');
    const reason = interaction.options.getString('reason', true);
    if (!newRole || !removeRole) return interaction.reply({ content: 'Both roles are required.', ephemeral: true });
    const target = await interaction.guild.members.fetch(user.id);
    if (newRole.position >= interaction.guild.members.me.roles.highest.position || removeRole.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: 'I cannot manage one of these roles because it is above my highest role.', ephemeral: true });

    if (sub === 'promote' || sub === 'demote') {
      const resetProfile = interaction.options.getBoolean('reset_profile', true);
      await target.roles.remove(removeRole).catch(() => null);
      await target.roles.add(newRole);
      const record = { fromRoleId: removeRole.id, fromRoleName: removeRole.name, toRoleId: newRole.id, toRoleName: newRole.name, reason, issuerId: interaction.user.id };
      if (sub === 'promote') await addPromotion(interaction.guildId, user.id, record);
      else await addDemotion(interaction.guildId, user.id, record);
      if (resetProfile) await resetStaffProfile(interaction.guildId, user.id);
      const channelId = sub === 'promote' ? data.config.promotionChannelId : data.config.demotionChannelId;
      if (channelId) {
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (channel?.isTextBased()) await channel.send(`${sub === 'promote' ? '📈' : '📉'} **Staff ${sub === 'promote' ? 'Promotion' : 'Demotion'}**\n${user}\n**${removeRole.name}** → **${newRole.name}**\nReason: ${reason}\nBy: ${interaction.user}`);
      }
      return interaction.reply({ content: `${user} has been ${sub === 'promote' ? 'promoted' : 'demoted'}: **${removeRole.name}** → **${newRole.name}**.${resetProfile ? ' Profile data has been reset; promotion/demotion history was preserved.' : ''}`, ephemeral: true });
    }

    if (sub === 'note') {
      const note = interaction.options.getString('note', true);
      await addStaffNote(interaction.guildId, user.id, interaction.user.id, note);
      return interaction.reply({ content: `Private staff note added for ${user}.`, ephemeral: true });
    }
  }),
};
