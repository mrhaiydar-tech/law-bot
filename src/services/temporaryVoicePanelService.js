import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    PermissionFlagsBits,
    ChannelType,
} from 'discord.js';
import { getJoinToCreateConfig, getTemporaryChannelInfo } from '../utils/database.js';
import { logger } from '../utils/logger.js';

const PANEL_PREFIX = 'tvp';

export function panelCustomId(action, channelId) {
    return `${PANEL_PREFIX}:${action}:${channelId}`;
}

export function buildTemporaryVoicePanel(channel, ownerId) {
    const isPublic = channel.permissionsFor(channel.guild.roles.everyone)?.has(PermissionFlagsBits.Connect);

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎛️ Temporary Voice Panel')
        .setDescription(
            `Manage **${channel.name}** from this panel.\n\n` +
            `👑 **Owner:** <@${ownerId}>\n` +
            `👥 **Users:** ${channel.members.size}${channel.userLimit ? `/${channel.userLimit}` : ''}\n` +
            `🔐 **Privacy:** ${isPublic ? 'Public' : 'Private'}\n\n` +
            'Only the current room owner can use these controls.'
        )
        .setFooter({ text: 'The panel is public • Controls affect this voice room only' })
        .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(panelCustomId('name', channel.id)).setLabel('Name').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(panelCustomId('limit', channel.id)).setLabel('Limit').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(panelCustomId('privacy', channel.id)).setLabel('Privacy').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(panelCustomId('trust', channel.id)).setLabel('Trust').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(panelCustomId('untrust', channel.id)).setLabel('Untrust').setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(panelCustomId('invite', channel.id)).setLabel('Invite').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(panelCustomId('kick', channel.id)).setLabel('Kick').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(panelCustomId('block', channel.id)).setLabel('Block').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(panelCustomId('unblock', channel.id)).setLabel('Unblock').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(panelCustomId('transfer', channel.id)).setLabel('Transfer').setStyle(ButtonStyle.Secondary),
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(panelCustomId('delete', channel.id)).setLabel('Delete').setStyle(ButtonStyle.Danger),
    );

    return { embeds: [embed], components: [row1, row2, row3] };
}

export function buildUserSelect(action, channelId, placeholder) {
    const select = new UserSelectMenuBuilder()
        .setCustomId(panelCustomId(`select:${action}`, channelId))
        .setPlaceholder(placeholder)
        .setMinValues(1)
        .setMaxValues(1);
    return new ActionRowBuilder().addComponents(select);
}

export function buildNameModal(channelId, currentName) {
    const input = new TextInputBuilder()
        .setCustomId('name')
        .setLabel('Room name')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(100)
        .setRequired(true)
        .setValue(currentName);
    return new ModalBuilder()
        .setCustomId(panelCustomId('modal:name', channelId))
        .setTitle('Change Room Name')
        .addComponents(new ActionRowBuilder().addComponents(input));
}

export function buildLimitModal(channelId, currentLimit) {
    const input = new TextInputBuilder()
        .setCustomId('limit')
        .setLabel('User limit (0 = unlimited)')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(2)
        .setRequired(true)
        .setValue(String(currentLimit || 0));
    return new ModalBuilder()
        .setCustomId(panelCustomId('modal:limit', channelId))
        .setTitle('Change User Limit')
        .addComponents(new ActionRowBuilder().addComponents(input));
}

export async function getTemporaryOwner(client, guildId, channelId) {
    const info = await getTemporaryChannelInfo(client, guildId, channelId);
    return info?.ownerId || null;
}

export async function isTemporaryOwner(interaction, client, channelId) {
    if (!interaction.guild || !interaction.member) return false;
    const ownerId = await getTemporaryOwner(client, interaction.guild.id, channelId);
    return ownerId === interaction.user.id;
}

async function getConfig(client, guildId) {
    return getJoinToCreateConfig(client, guildId);
}

async function saveConfig(client, guildId, config) {
    await client.db.set(`guild:${guildId}:jointocreate`, config);
}

export async function updatePanel(client, channel) {
    try {
        const info = await getTemporaryChannelInfo(client, channel.guild.id, channel.id);
        if (!info) return null;

        const config = await getConfig(client, channel.guild.id);
        const stored = config?.temporaryChannels?.[channel.id];
        let message = null;

        if (stored?.panelMessageId) {
            message = await channel.messages.fetch(stored.panelMessageId).catch(() => null);
        }

        if (message) {
            await message.edit(buildTemporaryVoicePanel(channel, info.ownerId));
            return message;
        }

        if (!channel.isSendable?.()) return null;
        message = await channel.send(buildTemporaryVoicePanel(channel, info.ownerId));

        if (config?.temporaryChannels?.[channel.id]) {
            config.temporaryChannels[channel.id].panelMessageId = message.id;
            await saveConfig(client, channel.guild.id, config);
        }

        return message;
    } catch (error) {
        logger.warn(`Failed to sync temporary voice panel for ${channel?.id}: ${error.message}`);
        return null;
    }
}

export async function togglePrivacy(client, channel) {
    const everyone = channel.guild.roles.everyone;
    const currentlyPublic = channel.permissionsFor(everyone)?.has(PermissionFlagsBits.Connect);
    await channel.permissionOverwrites.edit(everyone, { Connect: !currentlyPublic });
    return !currentlyPublic;
}

export async function trustUser(channel, userId) {
    await channel.permissionOverwrites.edit(userId, {
        Connect: true,
        Speak: true,
    });
}

export async function blockUser(channel, userId) {
    await channel.permissionOverwrites.edit(userId, {
        Connect: false,
        Speak: false,
    });
}

export async function clearUserOverride(channel, userId) {
    await channel.permissionOverwrites.delete(userId).catch(() => null);
}

export async function transferOwnership(client, channel, newOwnerId) {
    const guildId = channel.guild.id;
    const config = await getConfig(client, guildId);
    const info = config?.temporaryChannels?.[channel.id];
    if (!info) throw new Error('Temporary channel information was not found.');

    info.ownerId = newOwnerId;
    info.panelMessageId = info.panelMessageId || null;
    await saveConfig(client, guildId, config);

    const newOwner = await channel.guild.members.fetch(newOwnerId);
    const safeName = `${newOwner.displayName || newOwner.user.username}'s Room`.slice(0, 100);
    await channel.setName(safeName || 'Voice Room');

    return newOwner;
}

export async function kickUser(channel, userId) {
    const member = await channel.guild.members.fetch(userId).catch(() => null);
    if (!member || member.voice.channelId !== channel.id) return false;
    await member.voice.disconnect('Removed by temporary room owner');
    return true;
}

export async function deleteTemporaryRoom(client, channel) {
    const guildId = channel.guild.id;
    const config = await getConfig(client, guildId);
    if (config?.temporaryChannels?.[channel.id]) {
        delete config.temporaryChannels[channel.id];
        await saveConfig(client, guildId, config);
    }
    await channel.delete('Temporary voice room deleted by owner');
}

export async function createRoomInvite(channel) {
    return channel.createInvite({ maxAge: 0, maxUses: 0, unique: true });
}

export { ChannelType };
