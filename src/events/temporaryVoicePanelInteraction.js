import { Events, MessageFlags } from 'discord.js';
import { getTemporaryChannelInfo } from '../utils/database.js';
import {
    buildUserSelect,
    buildNameModal,
    buildLimitModal,
    isTemporaryOwner,
    updatePanel,
    togglePrivacy,
    trustUser,
    blockUser,
    clearUserOverride,
    transferOwnership,
    kickUser,
    deleteTemporaryRoom,
    createRoomInvite,
} from '../services/temporaryVoicePanelService.js';
import { logger } from '../utils/logger.js';

const PREFIX = 'tvp:';

export default {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction, client) {
        try {
            const id = interaction.customId;
            if (!id || !id.startsWith(PREFIX)) return;

            const parts = id.split(':');
            const action = parts[1];
            const channelId = action === 'select' || action === 'modal' ? parts[3] : parts[2];
            if (!channelId || !interaction.guild) return;

            const channel = interaction.guild.channels.cache.get(channelId)
                || await interaction.guild.channels.fetch(channelId).catch(() => null);
            if (!channel || !channel.isVoiceBased?.()) {
                await safeReply(interaction, '❌ This temporary room no longer exists.');
                return;
            }

            const info = await getTemporaryChannelInfo(client, interaction.guild.id, channelId);
            if (!info) {
                await safeReply(interaction, '❌ This is no longer an active temporary room.');
                return;
            }

            if (!await isTemporaryOwner(interaction, client, channelId)) {
                await safeReply(interaction, '❌ Only the current owner of this room can use the control panel.');
                return;
            }

            if (interaction.isButton()) {
                if (action === 'name') {
                    await interaction.showModal(buildNameModal(channelId, channel.name));
                    return;
                }

                if (action === 'limit') {
                    await interaction.showModal(buildLimitModal(channelId, channel.userLimit || 0));
                    return;
                }

                if (action === 'privacy') {
                    const isPublic = await togglePrivacy(client, channel);
                    await updatePanel(client, channel);
                    await safeReply(interaction, isPublic ? '🔓 Room is now public.' : '🔒 Room is now private.');
                    return;
                }

                if (action === 'invite') {
                    const invite = await createRoomInvite(channel);
                    await safeReply(interaction, `🔗 **Room invite:** ${invite.url}`);
                    return;
                }

                const selectActions = {
                    trust: 'Select a member to trust.',
                    untrust: 'Select a member to untrust.',
                    kick: 'Select a member to kick from the room.',
                    block: 'Select a member to block.',
                    unblock: 'Select a member to unblock.',
                    transfer: 'Select the new room owner.',
                };

                if (selectActions[action]) {
                    await interaction.reply({
                        content: `🎛️ ${selectActions[action]}`,
                        components: [buildUserSelect(action, channelId, selectActions[action])],
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                if (action === 'delete') {
                    await interaction.reply({ content: '🗑️ Deleting the temporary room...', flags: MessageFlags.Ephemeral });
                    await deleteTemporaryRoom(client, channel);
                    return;
                }
            }

            if (interaction.isUserSelectMenu() && action === 'select') {
                const selectedAction = parts[2];
                const selectedId = interaction.values[0];
                const selectedMember = await interaction.guild.members.fetch(selectedId).catch(() => null);
                if (!selectedMember) {
                    await safeReply(interaction, '❌ Member not found.');
                    return;
                }

                if (selectedAction === 'trust') {
                    await trustUser(channel, selectedId);
                    await safeReply(interaction, `✅ ${selectedMember} is now trusted in this room.`);
                } else if (selectedAction === 'untrust') {
                    await clearUserOverride(channel, selectedId);
                    await safeReply(interaction, `✅ ${selectedMember} is no longer trusted.`);
                } else if (selectedAction === 'block') {
                    await blockUser(channel, selectedId);
                    if (selectedMember.voice.channelId === channelId) {
                        await selectedMember.voice.disconnect('Blocked by temporary room owner').catch(() => null);
                    }
                    await safeReply(interaction, `🚫 ${selectedMember} is blocked from this room.`);
                } else if (selectedAction === 'unblock') {
                    await clearUserOverride(channel, selectedId);
                    await safeReply(interaction, `✅ ${selectedMember} is unblocked.`);
                } else if (selectedAction === 'kick') {
                    const removed = await kickUser(channel, selectedId);
                    await safeReply(interaction, removed ? `👢 ${selectedMember} was removed from the room.` : '❌ That member is not currently in this room.');
                } else if (selectedAction === 'transfer') {
                    if (selectedId === interaction.user.id) {
                        await safeReply(interaction, '❌ You already own this room.');
                        return;
                    }
                    await transferOwnership(client, channel, selectedId);
                    await updatePanel(client, channel);
                    await safeReply(interaction, `👑 Ownership transferred to ${selectedMember}.`);
                }
                return;
            }

            if (interaction.isModalSubmit() && action === 'modal') {
                const modalType = parts[2];

                if (modalType === 'name') {
                    const value = interaction.fields.getTextInputValue('name').trim();
                    if (!value || value.length > 100) {
                        await safeReply(interaction, '❌ The room name must be between 1 and 100 characters.');
                        return;
                    }
                    await channel.setName(value);
                    await updatePanel(client, channel);
                    await safeReply(interaction, '✅ Room name updated.');
                    return;
                }

                if (modalType === 'limit') {
                    const raw = interaction.fields.getTextInputValue('limit').trim();
                    const limit = Number(raw);
                    if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
                        await safeReply(interaction, '❌ Enter a number from **0** to **99**. 0 means unlimited.');
                        return;
                    }
                    await channel.setUserLimit(limit);
                    await updatePanel(client, channel);
                    await safeReply(interaction, `✅ User limit set to **${limit === 0 ? 'Unlimited' : limit}**.`);
                }
            }
        } catch (error) {
            logger.error(`Temporary voice panel interaction error: ${error.message}`);
            await safeReply(interaction, '❌ Something went wrong while updating the room.');
        }
    }
};

async function safeReply(interaction, content) {
    if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
    }
    return interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
}
