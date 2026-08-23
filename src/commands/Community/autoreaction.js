import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig, updateGuildConfig } from '../../services/config/guildConfig.js';
import { withErrorHandling } from '../../utils/errorHandler.js';

function normalizeEmoji(value) {
  return String(value ?? '').trim();
}

export default {
  data: new SlashCommandBuilder()
    .setName('autoreaction')
    .setDescription('Manage automatic reactions for a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('setup')
      .setDescription('Set the channel and reaction')
      .addChannelOption((opt) => opt
        .setName('channel')
        .setDescription('Channel where every new message gets the reaction')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addStringOption((opt) => opt
        .setName('reaction')
        .setDescription('Emoji or custom Discord emoji')
        .setRequired(true)
        .setMaxLength(100)))
    .addSubcommand((sub) => sub
      .setName('disable')
      .setDescription('Disable automatic reactions'))
    .addSubcommand((sub) => sub
      .setName('status')
      .setDescription('Show the current automatic reaction settings')),
  category: 'Community',
  execute: withErrorHandling(async (interaction, guildConfig) => {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const config = guildConfig || await getGuildConfig(interaction.client, interaction.guildId);
    const current = config.autoReaction || { enabled: false, channelId: null, reaction: null };
    const sub = interaction.options.getSubcommand();

    if (sub === 'disable') {
      await updateGuildConfig(interaction.client, interaction.guildId, {
        autoReaction: { ...current, enabled: false },
      });
      return interaction.reply({ content: 'Automatic reactions have been disabled.', ephemeral: true });
    }

    if (sub === 'status') {
      if (!current.enabled || !current.channelId || !current.reaction) {
        return interaction.reply({ content: 'Automatic reactions are currently disabled.', ephemeral: true });
      }
      return interaction.reply({
        content: `**Auto Reaction**\nChannel: <#${current.channelId}>\nReaction: ${current.reaction}\nStatus: **Enabled**`,
        ephemeral: true,
      });
    }

    const channel = interaction.options.getChannel('channel', true);
    const reaction = normalizeEmoji(interaction.options.getString('reaction', true));
    if (!reaction) return interaction.reply({ content: 'The reaction cannot be empty.', ephemeral: true });

    const me = interaction.guild.members.me;
    if (!me?.permissionsIn(channel).has('AddReactions')) {
      return interaction.reply({ content: 'I need the Add Reactions permission in that channel.', ephemeral: true });
    }

    await updateGuildConfig(interaction.client, interaction.guildId, {
      autoReaction: {
        enabled: true,
        channelId: channel.id,
        reaction,
      },
    });

    return interaction.reply({
      content: `Auto Reaction enabled.\nChannel: <#${channel.id}>\nReaction: ${reaction}`,
      ephemeral: true,
    });
  }),
};
