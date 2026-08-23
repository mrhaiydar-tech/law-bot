import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } from 'discord.js';
import { getSuggestions, saveSuggestions, suggestionEmbed, suggestionButtons } from '../../utils/suggestions.js';

const submitModal = new ModalBuilder().setCustomId('suggestions_submit_modal').setTitle('Submit Suggestion').addComponents(
  new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('suggestion').setLabel('Your suggestion').setPlaceholder('Describe your idea...').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1500),
  ),
);

async function getSuggestion(interaction, id) {
  const data = await getSuggestions(interaction.client, interaction.guildId);
  const suggestion = data.items?.find(item => String(item.id) === String(id));
  return { data, suggestion };
}

async function refresh(interaction, suggestion) {
  const message = await interaction.channel.messages.fetch(suggestion.messageId).catch(() => null);
  if (message) await message.edit({ embeds: [suggestionEmbed(suggestion)], components: suggestionButtons(suggestion) });
}

async function vote(interaction, client, args, direction) {
  await interaction.deferUpdate();
  const { data, suggestion } = await getSuggestion(interaction, args[0]);
  if (!suggestion) return interaction.followUp({ content: '❌ Suggestion not found.', ephemeral: true });
  if (suggestion.authorId === interaction.user.id) return interaction.followUp({ content: '❌ You cannot vote on your own suggestion.', ephemeral: true });
  suggestion.upvotes = Array.isArray(suggestion.upvotes) ? suggestion.upvotes : [];
  suggestion.downvotes = Array.isArray(suggestion.downvotes) ? suggestion.downvotes : [];
  if (direction === 'up') {
    suggestion.downvotes = suggestion.downvotes.filter(id => id !== interaction.user.id);
    suggestion.upvotes = suggestion.upvotes.includes(interaction.user.id) ? suggestion.upvotes.filter(id => id !== interaction.user.id) : [...suggestion.upvotes, interaction.user.id];
  } else {
    suggestion.upvotes = suggestion.upvotes.filter(id => id !== interaction.user.id);
    suggestion.downvotes = suggestion.downvotes.includes(interaction.user.id) ? suggestion.downvotes.filter(id => id !== interaction.user.id) : [...suggestion.downvotes, interaction.user.id];
  }
  await saveSuggestions(client, interaction.guildId, data);
  await refresh(interaction, suggestion);
}

export default [
  { name: 'suggestions_submit', async execute(interaction) { await interaction.showModal(submitModal); } },
  { name: 'suggestions_up', async execute(interaction, client, args) { await vote(interaction, client, args, 'up'); } },
  { name: 'suggestions_down', async execute(interaction, client, args) { await vote(interaction, client, args, 'down'); } },
  ...['accept', 'reject'].map(action => ({ name: `suggestions_${action}`, async execute(interaction, client, args) {
    await interaction.deferUpdate();
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.followUp({ content: '❌ You need Manage Server permission.', ephemeral: true });
    const { data, suggestion } = await getSuggestion(interaction, args[0]);
    if (!suggestion) return interaction.followUp({ content: '❌ Suggestion not found.', ephemeral: true });
    suggestion.status = action === 'accept' ? 'accepted' : 'rejected';
    suggestion.moderatorId = interaction.user.id;
    await saveSuggestions(client, interaction.guildId, data);
    await refresh(interaction, suggestion);
  } })),
];
