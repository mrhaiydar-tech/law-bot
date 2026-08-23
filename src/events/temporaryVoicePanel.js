import { getTemporaryChannelInfo } from '../utils/database.js';
import { updatePanel } from '../services/temporaryVoicePanelService.js';
import { logger } from '../utils/logger.js';

export default {
    name: 'voiceStateUpdate',
    once: false,
    async execute(oldState, newState, client) {
        try {
            const guild = newState.guild || oldState.guild;
            if (!guild || !client || newState.member?.user?.bot) return;

            if (newState.channelId && newState.channel) {
                // The main JTC listener registers the temporary channel before moving
                // the member. We intentionally re-check after a short delay so listener
                // ordering/race conditions cannot prevent the public panel from appearing.
                setTimeout(async () => {
                    try {
                        const info = await getTemporaryChannelInfo(client, guild.id, newState.channelId);
                        if (info) await updatePanel(client, newState.channel);
                    } catch (error) {
                        logger.debug(`Temporary voice panel sync failed: ${error.message}`);
                    }
                }, 400);
            }

            if (oldState.channelId && oldState.channelId !== newState.channelId && oldState.channel) {
                setTimeout(async () => {
                    try {
                        const info = await getTemporaryChannelInfo(client, guild.id, oldState.channelId);
                        if (info) await updatePanel(client, oldState.channel);
                    } catch {
                        // The main JTC handler may already have deleted the empty room.
                    }
                }, 600);
            }
        } catch (error) {
            logger.debug(`Temporary voice panel event error: ${error.message}`);
        }
    }
};
