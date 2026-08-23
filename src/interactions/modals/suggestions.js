import { getSuggestions, saveSuggestions, nextSuggestionId, suggestionEmbed, suggestionButtons } from '../../utils/suggestions.js';

export default {
  name: 'suggestions_submit_modal',
  async execute(interaction, client) {
    const text = interaction.fields.getTextInputValue('suggestion').trim();
    if (!text) return interaction.reply({ content: '❌ Suggestion cannot be empty.', ephemeral: true });

    const data = await getSuggestions(client, interaction.guildId);
    const id = await nextSuggestionId(client, interaction.guildId);
    data.counter = Math.max(Number(data.counter || 0), id);
    const channel = interaction.guild.channels.cache.get(data.channelId);
    if (!channel) return interaction.reply({ content: '❌ Suggestions channel is missing. Run `/suggestions setup` again.', ephemeral: true });

    const suggestion = {
      id,
      authorId: interaction.user.id,
      text,
      status: 'pending',
      upvotes: [],
      downvotes: [],
      createdAt: new Date().toISOString(),
      messageId: null,
    };

    const message = await channel.send({ embeds: [suggestionEmbed(suggestion)], components: suggestionButtons(suggestion) });
    suggestion.messageId = message.id;
    data.items = Array.isArray(data.items) ? data.items : [];
    data.items.push(suggestion);
    await saveSuggestions(client, interaction.guildId, data);

    return interaction.reply({ content: `✅ Suggestion #${id} submitted.`, ephemeral: true });
  },
};
