import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

const MUTED_ROLE_NAME = 'muted';

export default {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmutes a member by removing the Muted role.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The member to unmute.')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',

  async execute(interaction, config, client) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;

    const user = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id);

    const mutedRole = interaction.guild.roles.cache.find(
      role => role.name.toLowerCase() === MUTED_ROLE_NAME.toLowerCase()
    );

    if (!mutedRole) {
      return await replyUserError(interaction, {
        type: ErrorTypes.UNKNOWN,
        message: 'The `Muted` role could not be found.'
      });
    }

    if (!member.roles.cache.has(mutedRole.id)) {
      return await replyUserError(interaction, {
        type: ErrorTypes.UNKNOWN,
        message: `${member} is not muted.`
      });
    }

    try {
      await member.roles.remove(
        mutedRole,
        `Unmuted by ${interaction.user.tag}`
      );

      await logEvent({
        client,
        guild: interaction.guild,
        event: {
          action: 'Member Unmuted',
          target: `${member.user.tag} (${member.id})`,
          executor: `${interaction.user.tag} (${interaction.user.id})`,
          metadata: {
            userId: member.id,
            roleId: mutedRole.id,
            moderatorId: interaction.user.id
          }
        }
      });

      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          successEmbed(
            '🔊 Member Unmuted',
            `${member} has been unmuted successfully.`
          )
        ]
      });
    } catch (error) {
      logger.error('Unmute command error:', error);

      await replyUserError(interaction, {
        type: ErrorTypes.PERMISSION,
        message: 'I could not remove the Muted role from this member. Check my Manage Roles permission.'
      });
    }
  }
};
