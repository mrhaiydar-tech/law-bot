import { ChannelType, PermissionFlagsBits } from 'discord.js';

const key = guildId => `guild:${guildId}:tempvoice:config`;

async function read(client, guildId) {
  const value = await client.db.get(key(guildId), null);
  return value && typeof value === 'object' ? value : null;
}

async function write(client, guildId, config) {
  await client.db.set(key(guildId), config);
  return config;
}

export async function getTempVoiceConfig(client, guildId) {
  return await read(client, guildId) || {
    categoryId: null,
    triggerChannelId: null,
    panelChannelId: null,
    panelMessageId: null,
    rooms: {},
  };
}

export async function saveTempVoiceConfig(client, guildId, config) {
  return write(client, guildId, config);
}

export async function createTempRoom(guild, member, settings) {
  const name = `${settings.prefix || '🔊・'}${member.displayName}'s Room`.slice(0, 100);
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: settings.categoryId || undefined,
    userLimit: settings.userLimit || 0,
    bitrate: Math.min(settings.bitrate || 64000, guild.maximumBitrate || 64000),
    permissionOverwrites: [
      { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ManageChannels] },
    ],
  });
  return channel;
}

export async function removeRoomRecord(client, guildId, channelId) {
  const config = await getTempVoiceConfig(client, guildId);
  if (config.rooms?.[channelId]) {
    delete config.rooms[channelId];
    await saveTempVoiceConfig(client, guildId, config);
  }
}

export async function findOwnedRoom(client, guildId, ownerId) {
  const config = await getTempVoiceConfig(client, guildId);
  const entry = Object.entries(config.rooms || {}).find(([, room]) => room.ownerId === ownerId);
  return entry ? { channelId: entry[0], ...entry[1] } : null;
}
