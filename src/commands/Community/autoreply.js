import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig, updateGuildConfig } from '../../services/config/guildConfig.js';
import { withErrorHandling } from '../../utils/errorHandler.js';

const MAX_RULES = 100;
const MAX_TRIGGER_LENGTH = 500;
const MAX_RESPONSE_LENGTH = 2000;

function normalizeText(value) {
  return String(value ?? '').trim();
}

export default {
  data: new SlashCommandBuilder()
    .setName('autoreply')
    .setDescription('Manage exact-match automatic replies')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('add')
      .setDescription('Add an automatic reply')
      .addStringOption((opt) => opt
        .setName('message')
        .setDescription('The exact message that should trigger the reply')
        .setRequired(true)
        .setMaxLength(MAX_TRIGGER_LENGTH))
      .addStringOption((opt) => opt
        .setName('reply')
        .setDescription('What the bot should reply with')
        .setRequired(true)
        .setMaxLength(MAX_RESPONSE_LENGTH)))
    .addSubcommand((sub) => sub
      .setName('remove')
      .setDescription('Remove an automatic reply')
      .addStringOption((opt) => opt
        .setName('message')
        .setDescription('The exact message to remove')
        .setRequired(true)
        .setMaxLength(MAX_TRIGGER_LENGTH)))
    .addSubcommand((sub) => sub
      .setName('list')
      .setDescription('List automatic replies')),
  category: 'Community',
  execute: withErrorHandling(async (interaction, guildConfig) => {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const config = guildConfig || await getGuildConfig(interaction.client, interaction.guildId);
    const rules = Array.isArray(config.autoReplies) ? config.autoReplies : [];
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      if (!rules.length) {
        return interaction.reply({ content: 'No automatic replies are configured.', ephemeral: true });
      }

      const lines = rules.map((rule, index) =>
        `**${index + 1}.** \`${rule.trigger.replace(/`/g, '\\`')}\` → ${rule.response}`
      );
      return interaction.reply({ content: `**Automatic Replies (${rules.length})**\n${lines.join('\n')}`, ephemeral: true });
    }

    const trigger = normalizeText(interaction.options.getString('message', true));
    if (!trigger) return interaction.reply({ content: 'The trigger message cannot be empty.', ephemeral: true });

    if (sub === 'remove') {
      const index = rules.findIndex((rule) => rule.trigger === trigger);
      if (index === -1) {
        return interaction.reply({ content: 'No automatic reply was found for that exact message.', ephemeral: true });
      }

      const updatedRules = rules.filter((_, ruleIndex) => ruleIndex !== index);
      await updateGuildConfig(interaction.client, interaction.guildId, { autoReplies: updatedRules });
      return interaction.reply({ content: `Removed the automatic reply for: \`${trigger}\``, ephemeral: true });
    }

    const response = normalizeText(interaction.options.getString('reply', true));
    if (!response) return interaction.reply({ content: 'The reply cannot be empty.', ephemeral: true });

    const existingIndex = rules.findIndex((rule) => rule.trigger === trigger);
    const nextRule = { trigger, response };
    let updatedRules;

    if (existingIndex >= 0) {
      updatedRules = [...rules];
      updatedRules[existingIndex] = nextRule;
    } else {
      if (rules.length >= MAX_RULES) {
        return interaction.reply({ content: `You can have a maximum of ${MAX_RULES} automatic replies.`, ephemeral: true });
      }
      updatedRules = [...rules, nextRule];
    }

    await updateGuildConfig(interaction.client, interaction.guildId, { autoReplies: updatedRules });
    return interaction.reply({
      content: existingIndex >= 0
        ? `Updated the automatic reply for: \`${trigger}\``
        : `Added an automatic reply for: \`${trigger}\``,
      ephemeral: true,
    });
  }),
};
