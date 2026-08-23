import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { getJoinToCreateConfig, saveJoinToCreateConfig, getTemporaryChannelInfo, unregisterTemporaryChannel } from '../../utils/database.js';

async function getOwnedRoom(interaction, client) {
  const channel = interaction.member?.voice?.channel;
  if (!channel) return { error: '❌ Join your temporary voice room first.' };
  const info = await getTemporaryChannelInfo(client, interaction.guildId, channel.id);
  if (!info) return { error: '❌ You are not inside a temporary voice room.' };
  if (info.ownerId !== interaction.user.id) return { error: '❌ Only the room owner can use this panel.' };
  return { channel, info };
}

function modal(id, title, label, placeholder) {
  return new ModalBuilder().setCustomId(id).setTitle(title).addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('value').setLabel(label).setPlaceholder(placeholder).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100),
    ),
  );
}

const handlers = {
  tempvoice_lock: async (i, c) => {
    const room = await getOwnedRoom(i, c); if (room.error) return i.reply({ content: room.error, ephemeral: true });
    const config = await getJoinToCreateConfig(c, i.guildId); const info = config.temporaryChannels[room.channel.id];
    const locked = !info.locked;
    info.locked = locked;
    await room.channel.permissionOverwrites.edit(i.guildId, { Connect: !locked });
    await saveJoinToCreateConfig(c, i.guildId, config);
    return i.reply({ content: locked ? '🔒 Room locked.' : '🔓 Room unlocked.', ephemeral: true });
  },
  tempvoice_hide: async (i, c) => {
    const room = await getOwnedRoom(i, c); if (room.error) return i.reply({ content: room.error, ephemeral: true });
    const config = await getJoinToCreateConfig(c, i.guildId); const info = config.temporaryChannels[room.channel.id];
    const hidden = !info.hidden;
    info.hidden = hidden;
    await room.channel.permissionOverwrites.edit(i.guildId, { ViewChannel: !hidden });
    await room.channel.permissionOverwrites.edit(i.user.id, { ViewChannel: true, Connect: true, Speak: true, MoveMembers: true, ManageChannels: true });
    await saveJoinToCreateConfig(c, i.guildId, config);
    return i.reply({ content: hidden ? '👁️ Room hidden.' : '👁️ Room visible.', ephemeral: true });
  },
  tempvoice_rename: async i => i.showModal(modal('tempvoice_rename_modal', 'Rename Room', 'New room name', "Abdallah's Room")),
  tempvoice_limit: async i => i.showModal(modal('tempvoice_limit_modal', 'User Limit', 'Maximum users (0 = unlimited)', '0')),
  tempvoice_kick: async i => i.showModal(modal('tempvoice_kick_modal', 'Kick User', 'User ID', '123456789012345678')),
  tempvoice_mute: async i => i.showModal(modal('tempvoice_mute_modal', 'Mute User', 'User ID', '123456789012345678')),
  tempvoice_transfer: async i => i.showModal(modal('tempvoice_transfer_modal', 'Transfer Ownership', 'New owner User ID', '123456789012345678')),
  tempvoice_delete: async (i, c) => {
    const room = await getOwnedRoom(i, c); if (room.error) return i.reply({ content: room.error, ephemeral: true });
    await unregisterTemporaryChannel(c, i.guildId, room.channel.id);
    await room.channel.delete('TempVoice owner deleted room').catch(() => {});
    return i.reply({ content: '🗑️ Room deleted.', ephemeral: true });
  },
};

export default Object.entries(handlers).map(([name, execute]) => ({ name, execute }));
