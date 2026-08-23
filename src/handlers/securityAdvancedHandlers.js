import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import {
  getSecurityConfig,
  updateSecurityConfig,
  getStrikes,
  clearStrikes,
  sendSecurityLog,
} from '../services/security/securityService.js';
import { WarningService } from '../services/moderation/warningService.js';

const RULES = {
  spam: { label: '💬 Spam', color: 0xed4245 },
  duplicate: { label: '🔁 Duplicate', color: 0xf47b67 },
  mentions: { label: '📢 Mentions', color: 0xfee75c },
  invites: { label: '🔗 Invites', color: 0x5865f2 },
  links: { label: '🌐 Links', color: 0x5865f2 },
  caps: { label: '🔠 Caps', color: 0x57f287 },
  badWords: { label: '🚫 Bad Words', color: 0xed4245 },
};
const ACTIONS = ['delete', 'warn', 'timeout', 'kick', 'ban'];

function allowed(i) { return i.customId.split(':').at(-1) === i.user.id; }
function reject(i) { return i.reply({ content: 'This security dashboard belongs to another moderator.', flags: MessageFlags.Ephemeral }); }
function btn(id, label, style = ButtonStyle.Secondary) { return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style); }
function next(value, values = ACTIONS) { const index = values.indexOf(value); return values[(index + 1) % values.length]; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || min)); }

function ruleSummary(config, key) {
  const r = config.autoMod[key] || {};
  const common = `**Status:** ${r.enabled ? '🟢 ACTIVE' : '🔴 OFF'}\n**Punishment:** \`${r.punishment || 'delete'}\``;
  if (key === 'spam') return `${common}\n**Limit:** ${r.maxMessages ?? 6} messages\n**Window:** ${Math.round((r.windowMs || 5000) / 1000)} seconds`;
  if (key === 'duplicate') return `${common}\n**Repeats:** ${r.maxRepeats ?? 3}\n**Window:** ${Math.round((r.windowMs || 10000) / 1000)} seconds`;
  if (key === 'mentions') return `${common}\n**Maximum mentions:** ${r.max ?? 6}`;
  if (key === 'caps') return `${common}\n**Uppercase ratio:** ${Math.round((r.ratio ?? 0.8) * 100)}%\n**Minimum length:** ${r.minLength ?? 12}`;
  if (key === 'badWords') return `${common}\n**Blocked words:** ${r.words?.length || 0}`;
  return common;
}

function ruleEmbed(guild, config, key) {
  const meta = RULES[key];
  return new EmbedBuilder()
    .setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined })
    .setTitle(`${meta.label} • AutoMod`)
    .setDescription(`Configure **${meta.label.replace(/^\S+\s/, '')}** without leaving this dashboard.\n\n${ruleSummary(config, key)}\n\n**Escalation:** violations add a Strike, then the configured Strike escalation can override the rule punishment.`)
    .setColor(meta.color)
    .setFooter({ text: 'Infinity System • AutoMod • Changes save automatically' })
    .setTimestamp();
}

function ruleControls(userId, config, key) {
  const r = config.autoMod[key];
  const id = name => `${name}:${key}:${userId}`;
  const rows = [
    new ActionRowBuilder().addComponents(
      btn(id('security_automod_rule_back'), '← AutoMod'),
      btn(id('security_automod_rule_toggle'), r.enabled ? '🟢 Disable' : '🔴 Enable', r.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
      btn(id('security_automod_rule_punishment'), `⚖️ ${r.punishment || 'delete'}`, ButtonStyle.Primary),
    ),
  ];

  if (key === 'spam') rows.push(new ActionRowBuilder().addComponents(
    btn(id('security_automod_rule_down'), '− Messages'), btn(id('security_automod_rule_up'), '+ Messages'),
    btn(id('security_automod_rule_window'), `Window ${Math.round((r.windowMs || 5000) / 1000)}s`),
  ));
  else if (key === 'duplicate') rows.push(new ActionRowBuilder().addComponents(
    btn(id('security_automod_rule_down'), '− Repeats'), btn(id('security_automod_rule_up'), '+ Repeats'),
    btn(id('security_automod_rule_window'), `Window ${Math.round((r.windowMs || 10000) / 1000)}s`),
  ));
  else if (key === 'mentions') rows.push(new ActionRowBuilder().addComponents(
    btn(id('security_automod_rule_down'), '− Mentions'), btn(id('security_automod_rule_up'), '+ Mentions'),
  ));
  else if (key === 'caps') rows.push(new ActionRowBuilder().addComponents(
    btn(id('security_automod_rule_down'), '− Ratio'), btn(id('security_automod_rule_up'), '+ Ratio'), btn(id('security_automod_rule_min'), `Min length ${r.minLength ?? 12}`),
  ));
  else if (key === 'badWords') rows.push(new ActionRowBuilder().addComponents(
    btn(id('security_automod_rule_words'), '✏️ Manage Words', ButtonStyle.Primary),
  ));

  return rows;
}

function autoModEmbed(guild, config) {
  const lines = Object.entries(RULES).map(([key, meta]) => {
    const r = config.autoMod[key] || {};
    return `${meta.label} — ${r.enabled ? '🟢' : '🔴'} • punishment: **${r.punishment || 'delete'}**`;
  });
  return new EmbedBuilder()
    .setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined })
    .setTitle('🤖 AutoMod Rules')
    .setDescription(`**AutoMod:** ${config.autoMod.enabled ? '🟢 ACTIVE' : '🔴 OFF'}\n\nChoose a rule to configure it. Each rule has its own enable switch, thresholds and punishment.\n\n${lines.join('\n')}`)
    .setColor(0x5865f2)
    .setFooter({ text: 'Infinity System • AutoMod • Select a rule to edit it' })
    .setTimestamp();
}

function autoModControls(userId, config) {
  const keys = Object.keys(RULES);
  const rows = [new ActionRowBuilder().addComponents(
    btn(`security_back:${userId}`, '← Back'),
    btn(`security_automod_toggle:${userId}`, config.autoMod.enabled ? '🟢 Disable AutoMod' : '🔴 Enable AutoMod', config.autoMod.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
  )];
  for (let i = 0; i < keys.length; i += 3) {
    rows.push(new ActionRowBuilder().addComponents(...keys.slice(i, i + 3).map(key => btn(`security_automod_rule:${key}:${userId}`, RULES[key].label, config.autoMod[key]?.enabled ? ButtonStyle.Primary : ButtonStyle.Secondary))));
  }
  return rows.slice(0, 5);
}

async function renderAutoMod(i, client) {
  const config = await getSecurityConfig(client, i.guildId);
  return i.update({ embeds: [autoModEmbed(i.guild, config)], components: autoModControls(i.user.id, config) });
}

async function renderRule(i, client, key) {
  const config = await getSecurityConfig(client, i.guildId);
  return i.update({ embeds: [ruleEmbed(i.guild, config, key)], components: ruleControls(i.user.id, config, key) });
}

async function getCombinedEntries(client, guild) {
  const config = await getSecurityConfig(client, guild.id);
  const warnings = await WarningService.getGuildWarnings(client, guild.id, { limit: 1000 }).catch(() => []);
  const warningMap = new Map();
  for (const warning of warnings) warningMap.set(warning.userId, (warningMap.get(warning.userId) || 0) + 1);
  const members = await guild.members.fetch().catch(() => guild.members.cache);
  const entries = [];
  for (const member of members.values()) {
    if (member.user?.bot) continue;
    const strike = await getStrikes(client, guild.id, member.id).catch(() => ({ count: 0, updatedAt: 0 }));
    const expired = config.strikeDecayMs && strike.updatedAt && Date.now() - strike.updatedAt > Number(config.strikeDecayMs);
    const strikes = expired ? 0 : Number(strike.count || 0);
    const warningCount = warningMap.get(member.id) || 0;
    if (!strikes && !warningCount) continue;
    entries.push({ userId: member.id, strikes, warnings: warningCount, updatedAt: strike.updatedAt || 0 });
  }
  return entries.sort((a, b) => (b.strikes + b.warnings) - (a.strikes + a.warnings) || b.strikes - a.strikes).slice(0, 5);
}

function combinedEmbed(guild, entries) {
  const text = entries.length ? entries.map((e, i) => `${i + 1}. <@${e.userId}> — **${e.strikes}** Strikes • **${e.warnings}** Warnings`).join('\n') : '✅ No active Strikes or Warnings.';
  return new EmbedBuilder().setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined }).setTitle('🏆 Strikes & Warnings').setDescription(`Top members by active security history.\n\n${text}\n\nSelect a member below to view their history and manage it.`).setColor(0xfee75c).setFooter({ text: 'Resetting/clearing records does not delete Security Logs.' }).setTimestamp();
}

function combinedControls(userId, entries) {
  const rows = [];
  if (entries.length) rows.push(new ActionRowBuilder().addComponents(...entries.map((e, i) => btn(`security_member_manage:${e.userId}:${userId}`, `Manage #${i + 1}`, ButtonStyle.Primary))));
  rows.push(new ActionRowBuilder().addComponents(btn(`security_back:${userId}`, '← Back'), btn(`security_strikes_refresh:${userId}`, '🔄 Refresh', ButtonStyle.Success)));
  return rows;
}

async function combinedBoard(i, client) {
  const entries = await getCombinedEntries(client, i.guild);
  return i.update({ embeds: [combinedEmbed(i.guild, entries)], components: combinedControls(i.user.id, entries) });
}

async function memberPage(i, client, userId) {
  const member = await i.guild.members.fetch(userId).catch(() => null);
  const strike = await getStrikes(client, i.guildId, userId).catch(() => ({ count: 0, updatedAt: 0, lastReason: '' }));
  const warnings = await WarningService.getWarnings(i.guildId, userId).catch(() => []);
  const warningText = warnings.length ? warnings.slice(-5).reverse().map(w => `• ${new Date(w.timestamp || Date.now()).toLocaleString()} — ${String(w.reason || 'No reason').slice(0, 120)}`).join('\n') : 'No active warnings.';
  const embed = new EmbedBuilder().setTitle(`👤 Security History • ${member?.user?.tag || userId}`).setDescription(`**Strikes:** ${strike.count || 0}\n**Warnings:** ${warnings.length}\n**Last Strike Reason:** ${strike.lastReason || '—'}\n\n**Recent Warnings**\n${warningText}`).setColor(0xfee75c).setFooter({ text: 'All changes happen inside this message.' }).setTimestamp();
  return i.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(
    btn(`security_member_reset:${userId}:${i.user.id}`, '🧹 Reset Strikes', ButtonStyle.Danger),
    btn(`security_member_clearwarnings:${userId}:${i.user.id}`, '🗑️ Clear Warnings', ButtonStyle.Danger),
    btn(`security_member_back:${i.user.id}`, '← Back'),
  )] });
}

const handlers = [];
handlers.push({ name: 'security_panel_automod', execute: async (i, c) => allowed(i) ? renderAutoMod(i, c) : reject(i) });
handlers.push({ name: 'security_automod_toggle', execute: async (i, c) => { if (!allowed(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { enabled: !x.autoMod.enabled } }); return renderAutoMod(i, c); } });
handlers.push({ name: 'security_automod_rule', execute: async (i, c) => { if (!allowed(i)) return reject(i); const parts = i.customId.split(':'); return renderRule(i, c, parts.at(-2)); } });
handlers.push({ name: 'security_automod_rule_back', execute: async (i, c) => { if (!allowed(i)) return reject(i); return renderAutoMod(i, c); } });
handlers.push({ name: 'security_automod_rule_toggle', execute: async (i, c) => { if (!allowed(i)) return reject(i); const parts = i.customId.split(':'); const key = parts.at(-2); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { [key]: { enabled: !x.autoMod[key].enabled } } }); return renderRule(i, c, key); } });
handlers.push({ name: 'security_automod_rule_punishment', execute: async (i, c) => { if (!allowed(i)) return reject(i); const parts = i.customId.split(':'); const key = parts.at(-2); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { [key]: { punishment: next(x.autoMod[key].punishment || 'delete') } } }); return renderRule(i, c, key); } });
handlers.push({ name: 'security_automod_rule_down', execute: async (i, c) => { if (!allowed(i)) return reject(i); const parts = i.customId.split(':'); const key = parts.at(-2); const x = await getSecurityConfig(c, i.guildId); const r = x.autoMod[key]; const field = key === 'spam' ? 'maxMessages' : key === 'duplicate' ? 'maxRepeats' : key === 'mentions' ? 'max' : 'ratio'; const delta = field === 'ratio' ? -0.05 : -1; const min = field === 'ratio' ? 0.5 : key === 'mentions' ? 1 : 2; await updateSecurityConfig(c, i.guildId, { autoMod: { [key]: { [field]: clamp((r[field] ?? min) + delta, min, field === 'ratio' ? 1 : 30) } } }); return renderRule(i, c, key); } });
handlers.push({ name: 'security_automod_rule_up', execute: async (i, c) => { if (!allowed(i)) return reject(i); const parts = i.customId.split(':'); const key = parts.at(-2); const x = await getSecurityConfig(c, i.guildId); const r = x.autoMod[key]; const field = key === 'spam' ? 'maxMessages' : key === 'duplicate' ? 'maxRepeats' : key === 'mentions' ? 'max' : 'ratio'; const delta = field === 'ratio' ? 0.05 : 1; const max = field === 'ratio' ? 1 : 30; await updateSecurityConfig(c, i.guildId, { autoMod: { [key]: { [field]: clamp((r[field] ?? 2) + delta, field === 'ratio' ? 0.5 : 1, max) } } }); return renderRule(i, c, key); } });
handlers.push({ name: 'security_automod_rule_min', execute: async (i, c) => { if (!allowed(i)) return reject(i); const parts = i.customId.split(':'); const key = parts.at(-2); const x = await getSecurityConfig(c, i.guildId); const value = ((x.autoMod[key].minLength ?? 12) + 2); await updateSecurityConfig(c, i.guildId, { autoMod: { [key]: { minLength: value > 40 ? 8 : value } } }); return renderRule(i, c, key); } });
handlers.push({ name: 'security_automod_rule_window', execute: async (i, c) => { if (!allowed(i)) return reject(i); const parts = i.customId.split(':'); const key = parts.at(-2); const x = await getSecurityConfig(c, i.guildId); const current = x.autoMod[key].windowMs || 5000; const values = [3000, 5000, 10000, 15000, 30000, 60000]; await updateSecurityConfig(c, i.guildId, { autoMod: { [key]: { windowMs: next(current, values) } } }); return renderRule(i, c, key); } });
handlers.push({ name: 'security_automod_rule_words', execute: async (i, c) => { if (!allowed(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); const input = new TextInputBuilder().setCustomId('words').setLabel('Blocked words separated by spaces').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue((x.autoMod.badWords.words || []).join(' ').slice(0, 4000)); return i.showModal(new ModalBuilder().setCustomId(`security_automod_rule_words_modal:${i.user.id}`).setTitle('AutoMod • Bad Words').addComponents(new ActionRowBuilder().addComponents(input))); } });
handlers.push({ name: 'security_panel_strikes', execute: async (i, c) => allowed(i) ? combinedBoard(i, c) : reject(i) });
handlers.push({ name: 'security_strikes_refresh', execute: async (i, c) => allowed(i) ? combinedBoard(i, c) : reject(i) });
handlers.push({ name: 'security_member_manage', execute: async (i, c) => { if (!allowed(i)) return reject(i); return memberPage(i, c, i.customId.split(':').at(-2)); } });
handlers.push({ name: 'security_member_back', execute: async (i, c) => allowed(i) ? combinedBoard(i, c) : reject(i) });
handlers.push({ name: 'security_member_reset', execute: async (i, c) => { if (!allowed(i)) return reject(i); const userId = i.customId.split(':').at(-2); await clearStrikes(c, i.guildId, userId); await sendSecurityLog(c, i.guild, { title: 'Security Strikes Reset', description: `Strikes reset for <@${userId}> by <@${i.user.id}>.`, color: 0x57f287 }); return memberPage(i, c, userId); } });
handlers.push({ name: 'security_member_clearwarnings', execute: async (i, c) => { if (!allowed(i)) return reject(i); const userId = i.customId.split(':').at(-2); const result = await WarningService.clearWarnings(i.guildId, userId); await sendSecurityLog(c, i.guild, { title: 'Security Warnings Cleared', description: `Cleared ${result.count} warning(s) for <@${userId}> by <@${i.user.id}>.`, color: 0x57f287 }); return memberPage(i, c, userId); } });

export const securityAdvancedButtonHandlers = handlers;

export const securityAdvancedModalHandlers = [
  { name: 'security_automod_rule_words_modal', execute: async (i, c) => { if (!allowed(i)) return reject(i); const words = String(i.fields.getTextInputValue('words') || '').split(/\s+/).map(x => x.trim()).filter(Boolean).slice(0, 100); await updateSecurityConfig(c, i.guildId, { autoMod: { badWords: { enabled: words.length > 0, words } } }); return renderRule(i, c, 'badWords'); } },
];
