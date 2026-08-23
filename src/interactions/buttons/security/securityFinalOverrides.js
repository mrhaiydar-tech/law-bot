import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getSecurityConfig, updateSecurityConfig, getStrikes, clearStrikes } from '../../../services/security/securityService.js';

const ok = interaction => interaction.customId.split(':').at(-1) === interaction.user.id;
const deny = interaction => interaction.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });
const button = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...buttons) => new ActionRowBuilder().addComponents(buttons);
const AUTOMOD_ACTIONS = ['delete', 'timeout', 'kick', 'ban'];

function embed(title, description, guild, color = 0xfee75c) {
  return new EmbedBuilder().setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined }).setTitle(title).setDescription(description).setColor(color).setFooter({ text: 'Infinity System • Changes save automatically' }).setTimestamp();
}

async function renderStrikes(interaction, client) {
  const members = await interaction.guild.members.fetch().catch(() => interaction.guild.members.cache);
  const entries = [];
  for (const member of members.values()) {
    if (member.user.bot) continue;
    const strike = await getStrikes(client, interaction.guildId, member.id).catch(() => ({ count: 0 }));
    const count = Number(strike?.count || 0);
    if (count > 0) entries.push({ id: member.id, name: member.displayName || member.user.username, count });
  }
  entries.sort((a, b) => b.count - a.count);
  const text = entries.slice(0, 10).map((entry, index) => `${index + 1}. <@${entry.id}> — **${entry.count}** strikes`).join('\n') || 'No active strikes.';
  const components = [row(button(`security_back2:${interaction.user.id}`, '← Back'), button(`strikes_refresh2:${interaction.user.id}`, '🔄 Refresh', ButtonStyle.Success))];
  for (let i = 0; i < Math.min(entries.length, 8); i += 4) {
    components.push(row(...entries.slice(i, i + 4).map(entry => button(`strike_manage2:${entry.id}:${interaction.user.id}`, entry.name.slice(0, 80), ButtonStyle.Primary))));
  }
  return interaction.update({ embeds: [embed('🏆 Strikes', `**${interaction.guild.name}**\n\n${text}\n\nSelect a member to manage their strikes.`, interaction.guild)], components });
}

async function manageStrike(interaction, client, userId) {
  const strike = await getStrikes(client, interaction.guildId, userId).catch(() => ({ count: 0, lastReason: '' }));
  return interaction.update({ embeds: [embed('🏆 Strike Management', `<@${userId}>\n\n**Strikes:** ${Number(strike?.count || 0)}\n**Last Reason:** ${strike?.lastReason || '—'}`, interaction.guild)], components: [row(button(`strike_reset2:${userId}:${interaction.user.id}`, '🧹 Remove Strikes', ButtonStyle.Danger), button(`strikes_back2:${interaction.user.id}`, '← Back'))] });
}

async function resetStrike(interaction, client, userId) {
  await clearStrikes(client, interaction.guildId, userId);
  return renderStrikes(interaction, client);
}

function parseIds(value) {
  return [...new Set(String(value || '').split(/[\s,\n]+/).map(value => value.match(/\d{15,25}/)?.[0]).filter(Boolean))].slice(0, 100);
}

async function whitelistPage(interaction, client) {
  const config = await getSecurityConfig(client, interaction.guildId);
  return interaction.update({ embeds: [embed('👤 Whitelist', `Accounts listed here bypass security actions.\n\n**Users:** ${config.whitelist.users.length}\n**Roles:** ${config.whitelist.roles.length}\n**Bots:** ${config.whitelist.bots.length}`, interaction.guild, 0x57f287)], components: [row(button(`security_back2:${interaction.user.id}`, '← Back'), button(`wl_users2:${interaction.user.id}`, '👤 Users', ButtonStyle.Primary), button(`wl_roles2:${interaction.user.id}`, '🎭 Roles', ButtonStyle.Primary), button(`wl_bots2:${interaction.user.id}`, '🤖 Bots', ButtonStyle.Primary))] });
}

function whitelistModal(interaction, type, title, label, current) {
  return interaction.showModal(new ModalBuilder().setCustomId(`security_final_wl_${type}:${interaction.user.id}`).setTitle(title).addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('value').setLabel(label).setPlaceholder('ID or mention, multiple values supported').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(current.join('\n').slice(0, 4000)))));
}

async function saveWhitelist(interaction, client, type) {
  const ids = parseIds(interaction.fields.getTextInputValue('value'));
  await updateSecurityConfig(client, interaction.guildId, { whitelist: { [type]: ids } });
  return whitelistPage(interaction, client);
}

function parseAutoModKey(interaction) { return interaction.customId.split(':').at(-2); }

async function autoModPunishment(interaction, client) {
  if (!ok(interaction)) return deny(interaction);
  const key = parseAutoModKey(interaction);
  const config = await getSecurityConfig(client, interaction.guildId);
  if (!config.autoMod[key]) return interaction.reply({ content: 'AutoMod rule unavailable.', ephemeral: true });
  const current = config.autoMod[key].punishment;
  const index = AUTOMOD_ACTIONS.indexOf(current);
  const next = AUTOMOD_ACTIONS[(index < 0 ? 0 : index + 1) % AUTOMOD_ACTIONS.length];
  await updateSecurityConfig(client, interaction.guildId, { autoMod: { [key]: { punishment: next } } });
  return interaction.update({ embeds: [embed(`🤖 ${key} Settings`, `**Status:** ${config.autoMod[key].enabled ? '🟢 ACTIVE' : '🔴 OFF'}\n**Punishment:** **${next}**`, interaction.guild)], components: [row(button(`automod_back:${interaction.user.id}`, '← AutoMod'), button(`automod_toggle:${key}:${interaction.user.id}`, config.autoMod[key].enabled ? '🔴 Disable' : '🟢 Enable', config.autoMod[key].enabled ? ButtonStyle.Danger : ButtonStyle.Success), button(`automod_punishment:${key}:${interaction.user.id}`, `⚖️ ${next}`, ButtonStyle.Primary))] });
}

export default [
  { name: 'security_panel_strikes2', execute: async (i, c) => ok(i) ? renderStrikes(i, c) : deny(i) },
  { name: 'security_panel_strikes', execute: async (i, c) => ok(i) ? renderStrikes(i, c) : deny(i) },
  { name: 'strikes_refresh2', execute: async (i, c) => ok(i) ? renderStrikes(i, c) : deny(i) },
  { name: 'strike_manage2', execute: async (i, c, args) => ok(i) ? manageStrike(i, c, args[0]) : deny(i) },
  { name: 'strike_reset2', execute: async (i, c, args) => ok(i) ? resetStrike(i, c, args[0]) : deny(i) },
  { name: 'strikes_back2', execute: async (i, c) => ok(i) ? renderStrikes(i, c) : deny(i) },
  { name: 'security_panel_whitelist2', execute: async (i, c) => ok(i) ? whitelistPage(i, c) : deny(i) },
  { name: 'security_panel_whitelist', execute: async (i, c) => ok(i) ? whitelistPage(i, c) : deny(i) },
  { name: 'wl_users2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); return whitelistModal(i, 'users', 'Whitelist Users', 'User IDs', x.whitelist.users); } },
  { name: 'wl_roles2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); return whitelistModal(i, 'roles', 'Whitelist Roles', 'Role IDs', x.whitelist.roles); } },
  { name: 'wl_bots2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); return whitelistModal(i, 'bots', 'Whitelist Bots', 'Bot IDs', x.whitelist.bots); } },
  { name: 'security_final_wl_users', execute: async (i, c) => ok(i) ? saveWhitelist(i, c, 'users') : deny(i) },
  { name: 'security_final_wl_roles', execute: async (i, c) => ok(i) ? saveWhitelist(i, c, 'roles') : deny(i) },
  { name: 'security_final_wl_bots', execute: async (i, c) => ok(i) ? saveWhitelist(i, c, 'bots') : deny(i) },
  { name: 'automod_punishment', execute: autoModPunishment },
];
