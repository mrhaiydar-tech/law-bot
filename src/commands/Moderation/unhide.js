import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

const TARGET_ROLE_ID = '1534935138440314960';

export default {
  data: new SlashCommandBuilder()
    .setName('unhide')
    .setDescription('Unhides the current channel for the configured role.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  category: 'moderation',

  async execute(interaction, config, client) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;

    const channel = interaction.channel;
    const role = interaction.guild.roles.cache.get(TARGET_ROLE_ID);

    if (!role) {
      return await replyUserError(interaction, {
        type: ErrorTypes.UNKNOWN,
        message: 'The configured role could not be found in this server.'
      });
    }

    try {
      await channel.permissionOverwrites.edit(
        role,
        {
          ViewChannel: null
        },
        {
          type: 0,
          reason: `Channel unhidden for ${role.name} by ${interaction.user.tag}`
        }
      );

      await logEvent({
        client,
        guild: interaction.guild,
        event: {
          action: 'Channel Unhidden',
          target: channel.toString(),
          executor: `${interaction.user.tag} (${interaction.user.id})`,
          metadata: {
            channelId: channel.id,
            roleId: role.id,
            roleName: role.name,
            moderatorId: interaction.user.id
          }
        }
      });

      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          successEmbed(
            '🔓 Channel Unhidden',
            `${channel} is now visible to ${role}.`
          )
        ]
      });
    } catch (error) {
      logger.error('Unhide command error:', error);

      await replyUserError(interaction, {
        type: ErrorTypes.PERMISSION,
        message: 'I could not modify the channel permissions. Make sure I have Manage Channels.'
      });
    }
  }
};
