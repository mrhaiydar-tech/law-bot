import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MUTED_ROLE_NAME = 'Muted';
const MUTE_FILE = path.join(__dirname, '../../data/mutes.json');

function ensureMuteFile() {
  const dir = path.dirname(MUTE_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(MUTE_FILE)) {
    fs.writeFileSync(MUTE_FILE, '{}', 'utf8');
  }
}

function loadMutes() {
  ensureMuteFile();

  try {
    return JSON.parse(fs.readFileSync(MUTE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveMutes(mutes) {
  ensureMuteFile();
  fs.writeFileSync(
    MUTE_FILE,
    JSON.stringify(mutes, null, 2),
    'utf8'
  );
}

function parseDuration(duration) {
  if (!duration) return null;

  const match = duration.toLowerCase().match(
    /^(\d+)\s*(s|m|h|d|w)$/
  );

  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];

  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
  };

  return amount * units[unit];
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}

async function scheduleUnmute(client, guildId, userId, expiresAt) {
  const delay = expiresAt - Date.now();

  if (delay <= 0) {
    try {
      const guild = await client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId).catch(() => null);

      const mutedRole = guild.roles.cache.find(
        role => role.name.toLowerCase() === MUTED_ROLE_NAME.toLowerCase()
      );

      if (member && mutedRole && member.roles.cache.has(mutedRole.id)) {
        await member.roles.remove(
          mutedRole,
          'Temporary mute expired'
        );
      }
    } catch (error) {
      logger.error('Automatic unmute error:', error);
    }

    const mutes = loadMutes();
    delete mutes[`${guildId}:${userId}`];
    saveMutes(mutes);

    return;
  }

  setTimeout(async () => {
    try {
      const guild = await client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId).catch(() => null);

      const mutedRole = guild.roles.cache.find(
        role => role.name.toLowerCase() === MUTED_ROLE_NAME.toLowerCase()
      );

      if (member && mutedRole && member.roles.cache.has(mutedRole.id)) {
        await member.roles.remove(
          mutedRole,
          'Temporary mute expired'
        );
      }

      const mutes = loadMutes();
      delete mutes[`${guildId}:${userId}`];
      saveMutes(mutes);

      logger.info(
        `Temporary mute expired for ${userId} in ${guildId}`
      );
    } catch (error) {
      logger.error('Automatic unmute error:', error);
    }
  }, delay);
}

async function restoreMutes(client) {
  const mutes = loadMutes();

  for (const [key, data] of Object.entries(mutes)) {
    const [guildId, userId] = key.split(':');

    if (!data?.expiresAt) continue;

    await scheduleUnmute(
      client,
      guildId,
      userId,
      data.expiresAt
    );
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mutes a member using the Muted role.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The member to mute.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('Mute duration: 10s, 10m, 2h, 1d, 1w. Leave empty for permanent.')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',

  async execute(interaction, config, client) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;

    const user = interaction.options.getUser('user');
    const duration = interaction.options.getString('duration');

    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!member) {
      return await replyUserError(interaction, {
        type: ErrorTypes.UNKNOWN,
        message: 'This user is not in the server.'
      });
    }

    const mutedRole = interaction.guild.roles.cache.find(
      role => role.name.toLowerCase() === MUTED_ROLE_NAME.toLowerCase()
    );

    if (!mutedRole) {
      return await replyUserError(interaction, {
        type: ErrorTypes.UNKNOWN,
        message: 'The `Muted` role could not be found.'
      });
    }

    if (member.roles.cache.has(mutedRole.id)) {
      return await replyUserError(interaction, {
        type: ErrorTypes.UNKNOWN,
        message: `${member} is already muted.`
      });
    }

    if (
      member.id === interaction.guild.ownerId ||
      member.roles.highest.position >= interaction.member.roles.highest.position
    ) {
      return await replyUserError(interaction, {
        type: ErrorTypes.PERMISSION,
        message: 'You cannot mute this member because their highest role is equal to or higher than yours.'
      });
    }

    if (
      mutedRole.position >=
      interaction.guild.members.me.roles.highest.position
    ) {
      return await replyUserError(interaction, {
        type: ErrorTypes.PERMISSION,
        message: 'My role must be above the `Muted` role.'
      });
    }

    let durationMs = null;

    if (duration) {
      durationMs = parseDuration(duration);

      if (!durationMs) {
        return await replyUserError(interaction, {
          type: ErrorTypes.UNKNOWN,
          message: 'Invalid duration. Use formats like `10s`, `10m`, `2h`, `1d`, or `1w`.'
        });
      }
    }

    try {
      await member.roles.add(
        mutedRole,
        `Muted by ${interaction.user.tag}`
      );

      const mutes = loadMutes();
      const muteKey = `${interaction.guild.id}:${member.id}`;

      let expiresAt = null;

      if (durationMs) {
        expiresAt = Date.now() + durationMs;

        mutes[muteKey] = {
          guildId: interaction.guild.id,
          userId: member.id,
          expiresAt
        };

        saveMutes(mutes);

        await scheduleUnmute(
          client,
          interaction.guild.id,
          member.id,
          expiresAt
        );
      }

      await logEvent({
        client,
        guild: interaction.guild,
        event: {
          action: 'Member Muted',
          target: `${member.user.tag} (${member.id})`,
          executor: `${interaction.user.tag} (${interaction.user.id})`,
          metadata: {
            userId: member.id,
            roleId: mutedRole.id,
            roleName: mutedRole.name,
            duration: duration || 'Permanent',
            expiresAt,
            moderatorId: interaction.user.id
          }
        }
      });

      const durationText = durationMs
        ? `\nDuration: **${formatDuration(durationMs)}**`
        : '\nDuration: **Permanent**';

      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          successEmbed(
            '🔇 Member Muted',
            `${member} has been muted successfully.${durationText}`
          )
        ]
      });

    } catch (error) {
      logger.error('Mute command error:', error);

      await replyUserError(interaction, {
        type: ErrorTypes.PERMISSION,
        message: 'I could not give the Muted role to this member. Check my Manage Roles permission and role position.'
      });
    }
  },

  async restoreMutes(client) {
    await restoreMutes(client);
  }
};
