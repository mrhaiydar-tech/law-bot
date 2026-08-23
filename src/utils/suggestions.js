import { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

const key = guildId => `suggestions:${guildId}`;

async function load(client, guildId) {
  const data = await client.db.get(key(guildId), {});
  return data && typeof data === 'object' ? data : {};
}

async function save(client, guildId, data) {
  await client.db.set(key(guildId), data);
}

export async function setupSuggestions(interaction) {
  const guild = interaction.guild;
  const existing = await load(interaction.client, guild.id);
  let channel = existing.channelId ? guild.channels.cache.get(existing.channelId) : null;
  if (!channel) {
    channel = await guild.channels.create({
      name: 'suggestions',
      type: ChannelType.GuildText,
      reason: 'Suggestions system setup',
      permissionOverwrites: [
        { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
      ],
    });
  }
  const embed = new EmbedBuilder()
    .setTitle('💡 Suggestions')
    .setDescription('Have an idea for the server? Submit it below and let the community vote.')
    .addFields({ name: 'How it works', value: 'Click **Submit Suggestion**, write your idea, then the community can vote on it.' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('suggestions_submit').setLabel('Submit Suggestion').setEmoji('💡').setStyle(ButtonStyle.Primary),
  );
  if (existing.panelMessageId) {
    const old = await channel.messages.fetch(existing.panelMessageId).catch(() => null);
    if (old) await old.edit({ embeds: [embed], components: [row] });
    else existing.panelMessageId = null;
  }
  if (!existing.panelMessageId) {
    const message = await channel.send({ embeds: [embed], components: [row] });
    existing.panelMessageId = message.id;
  }
  existing.channelId = channel.id;
  existing.counter = Number(existing.counter || 0);
  await save(interaction.client, guild.id, existing);
  return interaction.reply({ content: `✅ Suggestions system is ready in ${channel}.`, ephemeral: true });
}

export async function getSuggestions(client, guildId) { return load(client, guildId); }
export async function saveSuggestions(client, guildId, data) { return save(client, guildId, data); }
export async function nextSuggestionId(client, guildId) {
  const data = await load(client, guildId);
  data.counter = Number(data.counter || 0) + 1;
  await save(client, guildId, data);
  return data.counter;
}

export function suggestionEmbed(s) {
  const status = { pending: '🟡 Pending', accepted: '🟢 Accepted', rejected: '🔴 Rejected', considered: '🔵 Considered', closed: '⚫ Closed' }[s.status] || '🟡 Pending';
  return new EmbedBuilder().setTitle(`💡 Suggestion #${s.id}`).setDescription(s.text).addFields(
    { name: 'Author', value: `<@${s.authorId}>`, inline: true },
    { name: 'Status', value: status, inline: true },
    { name: 'Votes', value: `👍 ${s.upvotes.length}  •  👎 ${s.downvotes.length}`, inline: true },
  ).setTimestamp(new Date(s.createdAt));
}

export function suggestionButtons(s) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`suggestions_up:${s.id}`).setLabel(`👍 ${s.upvotes.length}`).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`suggestions_down:${s.id}`).setLabel(`👎 ${s.downvotes.length}`).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`suggestions_accept:${s.id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`suggestions_reject:${s.id}`).setLabel('Reject').setStyle(ButtonStyle.Danger),
  )];
}
