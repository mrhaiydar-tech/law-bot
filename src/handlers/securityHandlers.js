import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import {
  getSecurityConfig,
  updateSecurityConfig,
  getStrikes,
  clearStrikes,
  sendSecurityLog,
} from '../services/security/securityService.js';
import {
  buildSecurityDashboard,
  buildSecurityControls,
  buildSecurityPanel,
  buildSecurityPanelControls,
  buildStrikeBoardEmbed,
} from '../commands/Security/security.js';

const PANELS = {
  security_panel_nuke: 'nuke',
  security_panel_raid: 'raid',
  security_panel_automod: 'automod',
  security_panel_punishments: 'punishments',
  security_panel_strikes: 'strikes',
  security_panel_whitelist: 'whitelist',
  security_panel_logs: 'logs',
  security_panel_settings: 'settings',
};
const NUKE_ACTIONS = ['strip', 'kick', 'ban'];
const RAID_ACTIONS = ['timeout', 'kick', 'ban'];
const AUTO_ACTIONS = ['delete', 'warn', 'timeout', 'kick', 'ban'];
const NUKE_KEYS = ['channelDelete', 'channelCreate', 'roleDelete', 'roleCreate', 'roleUpdate', 'webhookUpdate', 'webhookDelete', 'ban', 'kick', 'botAdd'];
const AUTO_KEYS = ['spam', 'duplicate', 'mentions', 'invites', 'links', 'caps', 'badWords'];

function authorized(i) { return i.customId.split(':').at(-1) === i.user.id; }
function reject(i) { return i.reply({ content: 'This security dashboard belongs to another moderator.', flags: MessageFlags.Ephemeral }); }
function num(v, fallback, min = 0) { const n = Number(v); return Number.isFinite(n) ? Math.max(min, n) : fallback; }
function lines(v) { return String(v || '').split(/[\s,]+/).map(x => x.trim()).filter(Boolean); }
function field(id, label, value = '', style = TextInputStyle.Short) {
  const input = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(false);
  if (value !== undefined && value !== null && String(value)) input.setValue(String(value).slice(0, 4000));
  return new ActionRowBuilder().addComponents(input);
}
function modal(i, id, title, fields) { return i.showModal(new ModalBuilder().setCustomId(`${id}:${i.user.id}`).setTitle(title).addComponents(...fields)); }
function cycle(current, values) { const index = values.indexOf(current); return values[(index + 1) % values.length]; }

async function panel(i, client, panelName) {
  const config = await getSecurityConfig(client, i.guildId);
  if (panelName === 'strikes') return strikeBoard(i, client);
  return i.update({ embeds: [buildSecurityPanel(config, i.guild, panelName)], components: buildSecurityPanelControls(i.user.id, panelName, config) });
}

async function dashboard(i, client) {
  const config = await getSecurityConfig(client, i.guildId);
  return i.update({ embeds: [buildSecurityDashboard(config, i.guild)], components: buildSecurityControls(i.user.id) });
}

async function getStrikeEntries(client, guild) {
  const config = await getSecurityConfig(client, guild.id);
  const members = await guild.members.fetch().catch(() => guild.members.cache);
  const now = Date.now();
  const entries = [];
  for (const member of members.values()) {
    if (member.user?.bot) continue;
    const strike = await getStrikes(client, guild.id, member.id).catch(() => ({ count: 0, updatedAt: 0 }));
    if (!strike?.count) continue;
    if (config.strikeDecayMs && strike.updatedAt && now - strike.updatedAt > Number(config.strikeDecayMs)) continue;
    entries.push({ userId: member.id, count: Number(strike.count || 0), updatedAt: strike.updatedAt || 0, lastReason: strike.lastReason || '' });
  }
  return entries.sort((a, b) => b.count - a.count || b.updatedAt - a.updatedAt).slice(0, 10);
}

async function strikeBoard(i, client) {
  const entries = await getStrikeEntries(client, i.guild);
  const embed = buildStrikeBoardEmbed(i.guild, entries);
  const rows = [];
  if (entries.length) {
    for (let offset = 0; offset < entries.length; offset += 4) {
      rows.push(new ActionRowBuilder().addComponents(...entries.slice(offset, offset + 4).map(entry => {
        return new (requireButton())().setCustomId(`security_strike_reset:${entry.userId}:${i.user.id}`).setLabel(`Reset ${entry.userId.slice(-4)}`).setStyle(4);
      })));
    }
  }
  rows.push(new ActionRowBuilder().addComponents(
    new (requireButton())().setCustomId(`security_back:${i.user.id}`).setLabel('← Back').setStyle(2),
    new (requireButton())().setCustomId(`security_strikes_refresh:${i.user.id}`).setLabel('🔄 Refresh').setStyle(3),
  ));
  return i.update({ embeds: [embed], components: rows.slice(0, 5) });
}

function requireButton() {
  return class {
    constructor() { this.data = {}; }
    setCustomId(value) { this.data.custom_id = value; return this; }
    setLabel(value) { this.data.label = value; return this; }
    setStyle(value) { this.data.style = value; return this; }
    toJSON() { return { type: 2, ...this.data }; }
  };
}

const handlers = [];
for (const [name, p] of Object.entries(PANELS)) handlers.push({ name, execute: async (i, c) => authorized(i) ? panel(i, c, p) : reject(i) });
handlers.push({ name: 'security_refresh', execute: async (i, c) => authorized(i) ? dashboard(i, c) : reject(i) });
handlers.push({ name: 'security_back', execute: async (i, c) => authorized(i) ? dashboard(i, c) : reject(i) });
handlers.push({ name: 'security_strikes_refresh', execute: async (i, c) => authorized(i) ? strikeBoard(i, c) : reject(i) });
handlers.push({
  name: 'security_strike_reset',
  execute: async (i, c) => {
    if (!authorized(i)) return reject(i);
    const parts = i.customId.split(':');
    const userId = parts.at(-2);
    const member = await i.guild.members.fetch(userId).catch(() => null);
    await clearStrikes(c, i.guildId, userId);
    await sendSecurityLog(c, i.guild, {
      title: 'Security Strikes Reset',
      description: `Security strikes were reset for <@${userId}>.`,
      color: 0x57f287,
      fields: [
        { name: 'Member', value: member ? `${member.user.tag} (${userId})` : userId, inline: true },
        { name: 'Moderator', value: `${i.user.tag} (${i.user.id})`, inline: true },
        { name: 'Action', value: 'Reset all strikes', inline: true },
      ],
    });
    return strikeBoard(i, c);
  },
});

handlers.push({ name: 'security_settings_refresh', execute: async (i, c) => authorized(i) ? panel(i, c, 'settings') : reject(i) });
handlers.push({ name: 'security_settings_toggle', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { enabled: !x.enabled }); return panel(i, c, 'settings'); } });

handlers.push({ name: 'security_nuke_toggle', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiNuke: { enabled: !x.antiNuke.enabled } }); return panel(i, c, 'nuke'); } });
handlers.push({ name: 'security_nuke_window', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiNuke: { windowMs: cycle(x.antiNuke.windowMs, [5000, 10000, 15000, 30000, 60000]) } }); return panel(i, c, 'nuke'); } });
handlers.push({ name: 'security_nuke_lockdown', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiNuke: { lockdown: !x.antiNuke.lockdown } }); return panel(i, c, 'nuke'); } });
handlers.push({ name: 'security_nuke_threshold', execute: async i => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(i.client, i.guildId); const t = x.antiNuke.thresholds || {}; return modal(i, 'security_nuke_threshold_modal', 'Anti-Nuke Thresholds', [field('channelDelete', 'Channel deletes', t.channelDelete), field('channelCreate', 'Channel creates', t.channelCreate), field('roleDelete', 'Role deletes', t.roleDelete), field('roleCreate', 'Role creates', t.roleCreate), field('botAdd', 'Bot additions', t.botAdd)]); } });

handlers.push({ name: 'security_raid_toggle', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiRaid: { enabled: !x.antiRaid.enabled } }); return panel(i, c, 'raid'); } });
handlers.push({ name: 'security_raid_joins_down', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiRaid: { joins: Math.max(2, x.antiRaid.joins - 1) } }); return panel(i, c, 'raid'); } });
handlers.push({ name: 'security_raid_joins_up', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiRaid: { joins: Math.min(100, x.antiRaid.joins + 1) } }); return panel(i, c, 'raid'); } });
handlers.push({ name: 'security_raid_window', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiRaid: { windowMs: cycle(x.antiRaid.windowMs, [5000, 10000, 15000, 30000, 60000]) } }); return panel(i, c, 'raid'); } });
handlers.push({ name: 'security_raid_age', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiRaid: { minAccountAgeMs: cycle(x.antiRaid.minAccountAgeMs, [0, 3600000, 21600000, 86400000, 604800000, 2592000000]) } }); return panel(i, c, 'raid'); } });
handlers.push({ name: 'security_raid_lockdown', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiRaid: { lockdown: !x.antiRaid.lockdown } }); return panel(i, c, 'raid'); } });
handlers.push({ name: 'security_raid_punishment', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiRaid: { punishment: cycle(x.antiRaid.punishment || 'timeout', RAID_ACTIONS) } }); return panel(i, c, 'raid'); } });

const toggleRule = async (i, c, key) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { [key]: { enabled: !x.autoMod[key].enabled } } }); return panel(i, c, 'automod'); };
const adjust = async (i, c, key, fieldName, delta, min, max) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { [key]: { [fieldName]: Math.min(max, Math.max(min, x.autoMod[key][fieldName] + delta)) } } }); return panel(i, c, 'automod'); };
handlers.push({ name: 'security_automod_toggle', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { enabled: !x.autoMod.enabled } }); return panel(i, c, 'automod'); } });
handlers.push({ name: 'security_automod_spam_toggle', execute: (i, c) => toggleRule(i, c, 'spam') });
handlers.push({ name: 'security_automod_dup_toggle', execute: (i, c) => toggleRule(i, c, 'duplicate') });
handlers.push({ name: 'security_automod_invites', execute: (i, c) => toggleRule(i, c, 'invites') });
handlers.push({ name: 'security_automod_links', execute: (i, c) => toggleRule(i, c, 'links') });
handlers.push({ name: 'security_automod_caps', execute: (i, c) => toggleRule(i, c, 'caps') });
handlers.push({ name: 'security_automod_spam_down', execute: (i, c) => adjust(i, c, 'spam', 'maxMessages', -1, 2, 30) });
handlers.push({ name: 'security_automod_spam_up', execute: (i, c) => adjust(i, c, 'spam', 'maxMessages', 1, 2, 30) });
handlers.push({ name: 'security_automod_dup_down', execute: (i, c) => adjust(i, c, 'duplicate', 'maxRepeats', -1, 2, 15) });
handlers.push({ name: 'security_automod_dup_up', execute: (i, c) => adjust(i, c, 'duplicate', 'maxRepeats', 1, 2, 15) });
handlers.push({ name: 'security_automod_mentions_down', execute: (i, c) => adjust(i, c, 'mentions', 'max', -1, 1, 30) });
handlers.push({ name: 'security_automod_mentions_up', execute: (i, c) => adjust(i, c, 'mentions', 'max', 1, 1, 30) });
handlers.push({ name: 'security_automod_action', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { action: cycle(x.autoMod.action || 'delete', AUTO_ACTIONS) } }); return panel(i, c, 'automod'); } });
handlers.push({ name: 'security_automod_badwords', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); return modal(i, 'security_automod_badwords_modal', 'AutoMod Blocked Words', [field('words', 'Words, separated by spaces', (x.autoMod.badWords.words || []).join(' '), TextInputStyle.Paragraph)]); } });
for (const key of AUTO_KEYS) handlers.push({ name: `security_automod_${key}_punishment`, execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { [key]: { punishment: cycle(x.autoMod[key].punishment || 'delete', AUTO_ACTIONS) } } }); return panel(i, c, 'automod'); } });

handlers.push({ name: 'security_pun_decay_down', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { strikeDecayMs: Math.max(3600000, x.strikeDecayMs - 3600000) }); return panel(i, c, 'punishments'); } });
handlers.push({ name: 'security_pun_decay_up', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { strikeDecayMs: Math.min(30 * 86400000, x.strikeDecayMs + 3600000) }); return panel(i, c, 'punishments'); } });
handlers.push({ name: 'security_pun_raid', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiRaid: { punishment: cycle(x.antiRaid.punishment || 'timeout', RAID_ACTIONS) } }); return panel(i, c, 'punishments'); } });
for (const key of NUKE_KEYS) handlers.push({ name: `security_pun_nuke_${key}`, execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiNuke: { punishments: { [key]: cycle(x.antiNuke.punishments[key] || 'strip', NUKE_ACTIONS) } } }); return panel(i, c, 'punishments'); } });
for (const key of AUTO_KEYS) handlers.push({ name: `security_pun_auto_${key}`, execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { [key]: { punishment: cycle(x.autoMod[key].punishment || 'delete', AUTO_ACTIONS) } } }); return panel(i, c, 'punishments'); } });
for (let strike = 1; strike <= 10; strike++) handlers.push({ name: `security_pun_level_${strike}`, execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); const escalation = x.escalation.map(e => e.strike === strike ? { ...e, action: cycle(e.action, ['warn', 'timeout', 'kick', 'ban']) } : e); await updateSecurityConfig(c, i.guildId, { escalation }); return panel(i, c, 'punishments'); } });

handlers.push({ name: 'security_whitelist_users', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); return modal(i, 'security_whitelist_users_modal', 'Whitelist Users', [field('users', 'User IDs, one per line', (x.whitelist.users || []).join('\n'), TextInputStyle.Paragraph)]); } });
handlers.push({ name: 'security_whitelist_roles', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); return modal(i, 'security_whitelist_roles_modal', 'Whitelist Roles', [field('roles', 'Role IDs, one per line', (x.whitelist.roles || []).join('\n'), TextInputStyle.Paragraph)]); } });
handlers.push({ name: 'security_whitelist_bots', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); return modal(i, 'security_whitelist_bots_modal', 'Whitelist Bots', [field('bots', 'Bot IDs, one per line', (x.whitelist.bots || []).join('\n'), TextInputStyle.Paragraph)]); } });
handlers.push({ name: 'security_logs_channel', execute: async i => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(i.client, i.guildId); return modal(i, 'security_logs_channel_modal', 'Security Log Channel', [field('channel', 'Channel ID', x.logChannelId || '')]); } });
handlers.push({ name: 'security_logs_ignored', execute: async i => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(i.client, i.guildId); return modal(i, 'security_logs_ignored_modal', 'Ignored Channels', [field('channels', 'Channel IDs, one per line', (x.ignoredChannels || []).join('\n'), TextInputStyle.Paragraph)]); } });

export const securityButtonHandlers = handlers;

export const securityModalHandlers = [
  { name: 'security_nuke_threshold_modal', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); const t = { ...x.antiNuke.thresholds }; for (const key of ['channelDelete', 'channelCreate', 'roleDelete', 'roleCreate', 'botAdd']) t[key] = num(i.fields.getTextInputValue(key), t[key], 1); await updateSecurityConfig(c, i.guildId, { antiNuke: { thresholds: t } }); return panel(i, c, 'nuke'); } },
  { name: 'security_automod_badwords_modal', execute: async (i, c) => { if (!authorized(i)) return reject(i); const words = lines(i.fields.getTextInputValue('words')).slice(0, 100); await updateSecurityConfig(c, i.guildId, { autoMod: { badWords: { enabled: words.length > 0, words } } }); return panel(i, c, 'automod'); } },
  { name: 'security_whitelist_users_modal', execute: async (i, c) => { if (!authorized(i)) return reject(i); await updateSecurityConfig(c, i.guildId, { whitelist: { users: lines(i.fields.getTextInputValue('users')).slice(0, 100) } }); return panel(i, c, 'whitelist'); } },
  { name: 'security_whitelist_roles_modal', execute: async (i, c) => { if (!authorized(i)) return reject(i); await updateSecurityConfig(c, i.guildId, { whitelist: { roles: lines(i.fields.getTextInputValue('roles')).slice(0, 100) } }); return panel(i, c, 'whitelist'); } },
  { name: 'security_whitelist_bots_modal', execute: async (i, c) => { if (!authorized(i)) return reject(i); await updateSecurityConfig(c, i.guildId, { whitelist: { bots: lines(i.fields.getTextInputValue('bots')).slice(0, 100) } }); return panel(i, c, 'whitelist'); } },
  { name: 'security_logs_channel_modal', execute: async (i, c) => { if (!authorized(i)) return reject(i); await updateSecurityConfig(c, i.guildId, { logChannelId: i.fields.getTextInputValue('channel').trim() || null }); return panel(i, c, 'logs'); } },
  { name: 'security_logs_ignored_modal', execute: async (i, c) => { if (!authorized(i)) return reject(i); await updateSecurityConfig(c, i.guildId, { ignoredChannels: lines(i.fields.getTextInputValue('channels')).slice(0, 100) }); return panel(i, c, 'logs'); } },
];