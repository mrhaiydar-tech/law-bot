import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getSecurityConfig, updateSecurityConfig } from '../services/security/securityService.js';

const RULES = {
  spam: { label: '💬 Spam', values: ['delete', 'warn', 'timeout', 'kick', 'ban'] },
  duplicate: { label: '🔁 Duplicate', values: ['delete', 'warn', 'timeout', 'kick', 'ban'] },
  mentions: { label: '📢 Mentions', values: ['delete', 'warn', 'timeout', 'kick', 'ban'] },
  invites: { label: '🔗 Invites', values: ['delete', 'warn', 'timeout', 'kick', 'ban'] },
  links: { label: '🌐 Links', values: ['delete', 'warn', 'timeout', 'kick', 'ban'] },
  caps: { label: '🔠 Caps', values: ['delete', 'warn', 'timeout', 'kick', 'ban'] },
  badWords: { label: '🚫 Bad Words', values: ['delete', 'warn', 'timeout', 'kick', 'ban'] },
};

const ok = i => i.customId.split(':').at(-1) === i.user.id;
const deny = i => i.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });
const B = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...buttons) => new ActionRowBuilder().addComponents(buttons);
const cycle = (value, values) => {
  const index = values.indexOf(value);
  return values[(index < 0 ? -1 : index) + 1 >= values.length ? 0 : index + 1];
};

function embed(title, description, guild) {
  return new EmbedBuilder()
    .setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined })
    .setTitle(title)
    .setDescription(description)
    .setColor(0x5865f2)
    .setFooter({ text: 'Infinity System • Changes save automatically' })
    .setTimestamp();
}

async function autoModPage(i, client) {
  const config = await getSecurityConfig(client, i.guildId);
  const rows = [row(B(`security_back2:${i.user.id}`, '← Back'), B(`automod_global_toggle:${i.user.id}`, config.autoMod.enabled ? '🔴 Disable AutoMod' : '🟢 Enable AutoMod', config.autoMod.enabled ? ButtonStyle.Danger : ButtonStyle.Success))];
  const keys = Object.keys(RULES);
  for (let n = 0; n < keys.length; n += 4) {
    rows.push(row(...keys.slice(n, n + 4).map(key => {
      const rule = config.autoMod[key];
      return B(`automod_rule:${key}:${i.user.id}`, `${RULES[key].label}: ${rule.enabled ? 'ON' : 'OFF'}`, rule.enabled ? ButtonStyle.Success : ButtonStyle.Secondary);
    })));
  }
  return i.update({ embeds: [embed('🤖 AutoMod', `**Status:** ${config.autoMod.enabled ? '🟢 ACTIVE' : '🔴 OFF'}\n\nChoose a rule to configure its detection settings and punishment.`, i.guild)], components: rows });
}

async function rulePage(i, client, key) {
  const config = await getSecurityConfig(client, i.guildId);
  const rule = config.autoMod[key];
  const meta = RULES[key];
  if (!rule || !meta) return autoModPage(i, client);

  const settings = [];
  if (key === 'spam') settings.push(`**Limit:** ${rule.maxMessages} messages`, `**Window:** ${Math.round(rule.windowMs / 1000)} seconds`);
  if (key === 'duplicate') settings.push(`**Repeats:** ${rule.maxRepeats}`, `**Window:** ${Math.round(rule.windowMs / 1000)} seconds`);
  if (key === 'mentions') settings.push(`**Max mentions:** ${rule.max}`);
  if (key === 'caps') settings.push(`**Caps ratio:** ${Math.round(rule.ratio * 100)}%`, `**Minimum length:** ${rule.minLength}`);
  if (key === 'badWords') settings.push(`**Blocked words:** ${rule.words?.length || 0}`);
  if (!settings.length) settings.push('This rule has no extra detection values.');

  const rows = [
    row(B(`automod_back:${i.user.id}`, '← AutoMod'), B(`automod_toggle:${key}:${i.user.id}`, rule.enabled ? '🔴 Disable' : '🟢 Enable', rule.enabled ? ButtonStyle.Danger : ButtonStyle.Success), B(`automod_punishment:${key}:${i.user.id}`, `⚖️ ${rule.punishment}`, ButtonStyle.Primary)),
  ];

  if (key === 'spam' || key === 'duplicate') rows.push(row(B(`automod_limit:${key}:${i.user.id}`, key === 'spam' ? `Limit: ${rule.maxMessages}` : `Repeats: ${rule.maxRepeats}`, ButtonStyle.Secondary), B(`automod_window:${key}:${i.user.id}`, `Window: ${Math.round(rule.windowMs / 1000)}s`, ButtonStyle.Secondary)));
  if (key === 'mentions') rows.push(row(B(`automod_limit:${key}:${i.user.id}`, `Max: ${rule.max}`, ButtonStyle.Secondary)));
  if (key === 'caps') rows.push(row(B(`automod_limit:${key}:${i.user.id}`, `Ratio: ${Math.round(rule.ratio * 100)}%`, ButtonStyle.Secondary), B(`automod_min:${key}:${i.user.id}`, `Min: ${rule.minLength}`, ButtonStyle.Secondary)));
  if (key === 'badWords') rows.push(row(B(`automod_words:${i.user.id}`, `Blocked words: ${rule.words?.length || 0}`, ButtonStyle.Secondary)));

  return i.update({ embeds: [embed(`${meta.label} Settings`, `**Status:** ${rule.enabled ? '🟢 ACTIVE' : '🔴 OFF'}\n**Punishment:** **${rule.punishment}**\n\n${settings.join('\n')}`, i.guild)], components: rows });
}

function parseKey(i) { return i.customId.split(':').at(-2); }

export default [
  {
    name: 'security_panel_automod',
    execute: async (i, client) => ok(i) ? autoModPage(i, client) : deny(i),
  },
  {
    name: 'security_panel_automod2',
    execute: async (i, client) => ok(i) ? autoModPage(i, client) : deny(i),
  },
  {
    name: 'automod_global_toggle',
    execute: async (i, client) => {
      if (!ok(i)) return deny(i);
      const x = await getSecurityConfig(client, i.guildId);
      await updateSecurityConfig(client, i.guildId, { autoMod: { enabled: !x.autoMod.enabled } });
      return autoModPage(i, client);
    },
  },
  {
    name: 'automod_rule',
    execute: async (i, client) => ok(i) ? rulePage(i, client, parseKey(i)) : deny(i),
  },
  {
    name: 'automod_back',
    execute: async (i, client) => ok(i) ? autoModPage(i, client) : deny(i),
  },
  {
    name: 'automod_toggle',
    execute: async (i, client) => {
      if (!ok(i)) return deny(i);
      const key = parseKey(i);
      const x = await getSecurityConfig(client, i.guildId);
      await updateSecurityConfig(client, i.guildId, { autoMod: { [key]: { enabled: !x.autoMod[key].enabled } } });
      return rulePage(i, client, key);
    },
  },
  {
    name: 'automod_punishment',
    execute: async (i, client) => {
      if (!ok(i)) return deny(i);
      const key = parseKey(i);
      const x = await getSecurityConfig(client, i.guildId);
      const values = RULES[key].values;
      await updateSecurityConfig(client, i.guildId, { autoMod: { [key]: { punishment: cycle(x.autoMod[key].punishment, values) } } });
      return rulePage(i, client, key);
    },
  },
  {
    name: 'automod_limit',
    execute: async (i, client) => {
      if (!ok(i)) return deny(i);
      const key = parseKey(i);
      const x = await getSecurityConfig(client, i.guildId);
      const rule = x.autoMod[key];
      const patch = key === 'spam' ? { maxMessages: rule.maxMessages >= 12 ? 3 : rule.maxMessages + 1 } : key === 'duplicate' ? { maxRepeats: rule.maxRepeats >= 8 ? 2 : rule.maxRepeats + 1 } : key === 'mentions' ? { max: rule.max >= 15 ? 3 : rule.max + 1 } : key === 'caps' ? { ratio: rule.ratio >= 0.95 ? 0.5 : Number((rule.ratio + 0.05).toFixed(2)) } : {};
      await updateSecurityConfig(client, i.guildId, { autoMod: { [key]: patch } });
      return rulePage(i, client, key);
    },
  },
  {
    name: 'automod_window',
    execute: async (i, client) => {
      if (!ok(i)) return deny(i);
      const key = parseKey(i);
      const x = await getSecurityConfig(client, i.guildId);
      const current = Math.round(x.autoMod[key].windowMs / 1000);
      const values = key === 'spam' ? [3, 5, 10, 15, 30] : [5, 10, 15, 30, 60];
      const next = cycle(current, values);
      await updateSecurityConfig(client, i.guildId, { autoMod: { [key]: { windowMs: next * 1000 } } });
      return rulePage(i, client, key);
    },
  },
  {
    name: 'automod_min',
    execute: async (i, client) => {
      if (!ok(i)) return deny(i);
      const key = parseKey(i);
      const x = await getSecurityConfig(client, i.guildId);
      const next = x.autoMod[key].minLength >= 30 ? 8 : x.autoMod[key].minLength + 2;
      await updateSecurityConfig(client, i.guildId, { autoMod: { [key]: { minLength: next } } });
      return rulePage(i, client, key);
    },
  },
  {
    name: 'automod_words',
    execute: async (i, client) => ok(i) ? rulePage(i, client, 'badWords') : deny(i),
  },
];
