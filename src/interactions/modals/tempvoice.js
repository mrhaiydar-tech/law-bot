import { getJoinToCreateConfig, saveJoinToCreateConfig, getTemporaryChannelInfo } from '../../utils/database.js';

async function roomFor(interaction, client) {
  const channel = interaction.member?.voice?.channel;
  if (!channel) return { error: '❌ Join your temporary voice room first.' };
  const info = await getTemporaryChannelInfo(client, interaction.guildId, channel.id);
  if (!info || info.ownerId !== interaction.user.id) return { error: '❌ Only the owner of a temporary room can use this panel.' };
  return { channel, info };
}

export default [
  {
    name: 'tempvoice_rename_modal',
    async execute(i, client) {
      const room = await roomFor(i, client); if (room.error) return i.reply({ content: room.error, ephemeral: true });
      const name = i.fields.getTextInputValue('value').trim().replace(/[\r\n\t]/g, ' ').slice(0, 100);
      if (!name) return i.reply({ content: '❌ Enter a valid room name.', ephemeral: true });
      await room.channel.setName(name);
      return i.reply({ content: `✏️ Room renamed to **${name}**.`, ephemeral: true });
    },
  },
  {
    name: 'tempvoice_limit_modal',
    async execute(i, client) {
      const room = await roomFor(i, client); if (room.error) return i.reply({ content: room.error, ephemeral: true });
      const limit = Number(i.fields.getTextInputValue('value'));
      if (!Number.isInteger(limit) || limit < 0 || limit > 99) return i.reply({ content: '❌ Limit must be between 0 and 99.', ephemeral: true });
      await room.channel.setUserLimit(limit);
      return i.reply({ content: `👥 User limit set to **${limit === 0 ? 'Unlimited' : limit}**.`, ephemeral: true });
    },
  },
  {
    name: 'tempvoice_kick_modal',
    async execute(i, client) {
      const room = await roomFor(i, client); if (room.error) return i.reply({ content: room.error, ephemeral: true });
      const id = i.fields.getTextInputValue('value').trim();
      const member = await i.guild.members.fetch(id).catch(() => null);
      if (!member || member.voice.channelId !== room.channel.id) return i.reply({ content: '❌ That user is not in your room.', ephemeral: true });
      await member.voice.disconnect('TempVoice owner kicked user');
      return i.reply({ content: `🚫 Kicked <@${member.id}> from the room.`, ephemeral: true });
    },
  },
  {
    name: 'tempvoice_mute_modal',
    async execute(i, client) {
      const room = await roomFor(i, client); if (room.error) return i.reply({ content: room.error, ephemeral: true });
      const id = i.fields.getTextInputValue('value').trim();
      const member = await i.guild.members.fetch(id).catch(() => null);
      if (!member || member.voice.channelId !== room.channel.id) return i.reply({ content: '❌ That user is not in your room.', ephemeral: true });
      const nextMuted = !member.voice.serverMute;
      await member.voice.setMute(nextMuted, 'TempVoice owner toggled mute');
      return i.reply({ content: nextMuted ? `🔇 Muted <@${member.id}>.` : `🔊 Unmuted <@${member.id}>.`, ephemeral: true });
    },
  },
  {
    name: 'tempvoice_transfer_modal',
    async execute(i, client) {
      const room = await roomFor(i, client); if (room.error) return i.reply({ content: room.error, ephemeral: true });
      const id = i.fields.getTextInputValue('value').trim();
      const member = await i.guild.members.fetch(id).catch(() => null);
      if (!member || member.voice.channelId !== room.channel.id) return i.reply({ content: '❌ The new owner must be inside your room.', ephemeral: true });
      const config = await getJoinToCreateConfig(client, i.guildId);
      const info = config.temporaryChannels[room.channel.id];
      const oldOwnerId = info.ownerId;
      info.ownerId = member.id;
      await saveJoinToCreateConfig(client, i.guildId, config);
      await room.channel.permissionOverwrites.edit(member.id, { Connect: true, Speak: true, MoveMembers: true, ManageChannels: true }).catch(() => {});
      if (oldOwnerId !== member.id) {
        await room.channel.permissionOverwrites.edit(oldOwnerId, { Connect: true, Speak: true, MoveMembers: false, ManageChannels: false }).catch(() => {});
      }
      return i.reply({ content: `👑 Ownership transferred to <@${member.id}>.`, ephemeral: true });
    },
  },
];
