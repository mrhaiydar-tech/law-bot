import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { setupSuggestions } from '../../utils/suggestions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('suggestions')
    .setDescription('Manage the server suggestions system')
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Create the suggestions channel and panel'))
    .addSubcommand(sub => sub
      .setName('dashboard')
      .setDescription('Open the suggestions management dashboard'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'setup') {
      return setupSuggestions(interaction);
    }
    return interaction.reply({
      content: 'The suggestions dashboard will be available after setup.',
      ephemeral: true,
    });
  },
};
