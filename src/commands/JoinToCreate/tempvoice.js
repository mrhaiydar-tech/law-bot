import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { initializeJoinToCreate, getConfiguration, removeTriggerChannel } from '../../services/joinToCreateService.js';
import { getTempVoiceConfig, saveTempVoiceConfig } from '../../services/tempVoiceService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('tempvoice')
    .setDescription('Set up the temporary voice room system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(sub => sub.setName('setup').setDescription('Create Join to Create and the control panel.'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Remove the TempVoice setup.')),

  async execute(interaction, config, client) {
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();
    const current = await getTempVoiceConfig(client, guild.id);

    if (subcommand === 'reset') {
      const jtc = await getConfiguration(client, guild.id).catch(() => null);
      for (const channelId of Object.keys(jtc?.temporaryChannels || {})) await guild.channels.delete(channelId).catch(() => {});
      if (jtc?.triggerChannels?.length) {
        for (const triggerId of jtc.triggerChannels) await removeTriggerChannel(client, guild.id, triggerId).catch(() => {});
      }
      if (current.triggerChannelId) await guild.channels.delete(current.triggerChannelId).catch(() => {});
      if (current.panelChannelId) await guild.channels.delete(current.panelChannelId).catch(() => {});
      if (current.categoryId) await guild.channels.delete(current.categoryId).catch(() => {});
      await saveTempVoiceConfig(client, guild.id, { categoryId: null, triggerChannelId: null, panelChannelId: null, panelMessageId: null, rooms: {} });
      return interaction.reply({ content: '✅ TempVoice setup has been reset.', ephemeral: true });
    }

    if (current.triggerChannelId && guild.channels.cache.has(current.triggerChannelId)) {
      return interaction.reply({ content: `⚠️ TempVoice is already set up: <#${current.triggerChannelId}>`, ephemeral: true });
    }

    const existingJtc = await getConfiguration(client, guild.id);
    if (existingJtc?.triggerChannels?.length) {
      return interaction.reply({ content: `⚠️ This server already has a Join to Create system: <#${existingJtc.triggerChannels[0]}>. Reset it first with \`/tempvoice reset\`.`, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const category = await guild.channels.create({ name: 'Temporary Voice', type: ChannelType.GuildCategory });
    const trigger = await guild.channels.create({ name: '➕・Join to Create', type: ChannelType.GuildVoice, parent: category.id });
    const panel = await guild.channels.create({ name: 'tempvoice-panel', type: ChannelType.GuildText, parent: category.id });

    await initializeJoinToCreate(client, guild.id, trigger.id, {
      nameTemplate: "{username}'s Room",
      userLimit: 0,
      bitrate: 64000,
      categoryId: category.id,
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🎙️ Temporary Voice Rooms')
      .setDescription(`Join <#${trigger.id}> to create your temporary voice room.\n\nUse the panel below while you are inside your room to manage it.`)
      .addFields({ name: 'Controls', value: '🔒 Lock • 👁️ Hide • ✏️ Rename • 👥 Limit\n🚫 Kick • 🔇 Mute • 👑 Transfer • 🗑️ Delete' })
      .setFooter({ text: 'Only the room owner can use these controls.' });

    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tempvoice_lock').setLabel('🔒 Lock').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_hide').setLabel('👁️ Hide').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_rename').setLabel('✏️ Rename').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('tempvoice_limit').setLabel('👥 Limit').setStyle(ButtonStyle.Primary),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tempvoice_kick').setLabel('🚫 Kick').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('tempvoice_mute').setLabel('🔇 Mute').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_transfer').setLabel('👑 Transfer').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('tempvoice_delete').setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger),
      ),
    ];

    const message = await panel.send({ embeds: [embed], components: rows });
    await saveTempVoiceConfig(client, guild.id, {
      categoryId: category.id,
      triggerChannelId: trigger.id,
      panelChannelId: panel.id,
      panelMessageId: message.id,
      rooms: {},
    });

    await interaction.editReply(`✅ TempVoice is ready.\n\n🎙️ Join to Create: ${trigger}\n🎛️ Control Panel: ${panel}`);
  },
};
