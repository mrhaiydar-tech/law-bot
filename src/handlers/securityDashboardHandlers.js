import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { getSecurityConfig, updateSecurityConfig, getStrikes, clearStrikes, sendSecurityLog } from '../services/security/securityService.js';

const NUKE_ACTIONS = ['strip', 'kick', 'ban'];
const RAID_ACTIONS = ['timeout', 'kick', 'ban'];
const AUTO_ACTIONS = ['delete', 'timeout', 'kick', 'ban'];
const NUKE_RULES = {
  channelDelete: 'Channel Delete', channelCreate: 'Channel Create', roleDelete: 'Role Delete', roleCreate: 'Role Create',
  roleUpdate: 'Role Update', webhookUpdate: 'Webhook Update', webhookDelete: 'Webhook Delete', ban: 'Ban', kick: 'Kick', botAdd: 'Bot Add',
};
const AUTO_RULES = { spam: 'Spam', duplicate: 'Duplicate', mentions: 'Mentions', invites: 'Invites', links: 'Links', caps: 'Caps', badWords: 'Bad Words' };

const ok = i => i.customId.split(':').at(-1) === i.user.id;
const deny = i => i.reply({ content: 'This security dashboard belongs to another moderator.', flags: MessageFlags.Ephemeral });
const B = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const cycle = (v, list) => list[(list.indexOf(v) + 1 + list.length) % list.length];
const row = (...buttons) => new ActionRowBuilder().addComponents(buttons);
const modalField = (id, label, value = '', style = TextInputStyle.Short) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(false).setValue(String(value).slice(0, 4000)));

function embed(title, description, color = 0x5865f2, guild) {
  return new EmbedBuilder().setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined }).setTitle(title).setDescription(description).setColor(color).setFooter({ text: 'Infinity System • Changes save automatically' }).setTimestamp();
}

export async function buildSecurityDashboard(client, guild, userId) {
  const config = await getSecurityConfig(client, guild.id);
  return {
    embeds: [embed('🛡️ Server Protection', `**${guild.name}**\n\nChoose a security system to configure.\n\n🛡️ Anti-Nuke — ${config.antiNuke.enabled ? '🟢' : '🔴'}\n🚨 Anti-Raid — ${config.antiRaid.enabled ? '🟢' : '🔴'}\n🤖 AutoMod — ${config.autoMod.enabled ? '🟢' : '🔴'}\n⚖️ Punishments — ${(config.escalation || []).length} escalation levels\n🏆 Strikes — management enabled\n👤 Whitelist — ${(config.whitelist.users.length + config.whitelist.roles.length + config.whitelist.bots.length)} entries\n📋 Logs — ${config.logChannelId ? `<#${config.logChannelId}>` : 'not configured'}`, 0x57f287, guild)],
    components: [
      row(
        B(`security_panel_nuke2:${userId}`, '🛡️ Anti-Nuke', ButtonStyle.Danger),
        B(`security_panel_raid2:${userId}`, '🚨 Anti-Raid', ButtonStyle.Primary),
        B(`security_panel_automod2:${userId}`, '🤖 AutoMod', ButtonStyle.Primary),
        B(`security_panel_punishments2:${userId}`, '⚖️ Punishments', ButtonStyle.Primary),
      ),
      row(
        B(`security_panel_strikes2:${userId}`, '🏆 Strikes', ButtonStyle.Danger),
        B(`security_panel_whitelist2:${userId}`, '👤 Whitelist'),
        B(`security_panel_logs2:${userId}`, '📋 Logs'),
        B(`security_panel_settings2:${userId}`, '⚙️ Settings'),
        B(`security_refresh:${userId}`, '🔄 Refresh', ButtonStyle.Success),
      ),
    ],
  };
}

async function dashboard(i, c) { return i.update(await buildSecurityDashboard(c, i.guild, i.user.id)); }

async function nuke(i, c) {
  const x = await getSecurityConfig(c, i.guildId), t = x.antiNuke.thresholds;
  const lines = Object.entries(NUKE_RULES).map(([k, n]) => `**${n}** — threshold \`${t[k] ?? 1}\` • punishment **${x.antiNuke.punishments[k] || x.antiNuke.action}**`).join('\n');
  return i.update({ embeds: [embed('🛡️ Anti-Nuke', `**Status:** ${x.antiNuke.enabled ? '🟢 ACTIVE' : '🔴 OFF'}\n**Window:** ${x.antiNuke.windowMs / 1000}s\n**Lockdown:** ${x.antiNuke.lockdown ? '🟢 ON' : '🔴 OFF'}\n\n${lines}`, 0xed4245, i.guild)], components: [row(B(`security_back2:${i.user.id}`, '← Back'), B(`nuke_toggle2:${i.user.id}`, x.antiNuke.enabled ? 'Disable' : 'Enable', x.antiNuke.enabled ? ButtonStyle.Success : ButtonStyle.Danger), B(`nuke_lock2:${i.user.id}`, `Lockdown: ${x.antiNuke.lockdown ? 'ON' : 'OFF'}`), B(`nuke_window2:${i.user.id}`, `Window: ${x.antiNuke.windowMs / 1000}s`)), row(B(`nuke_thresholds2:${i.user.id}`, '✏️ Thresholds', ButtonStyle.Primary), B(`nuke_rules2:${i.user.id}`, '⚖️ Rule Punishments', ButtonStyle.Primary))] });
}
async function nukeRules(i, c) {
  const x = await getSecurityConfig(c, i.guildId), keys = Object.keys(NUKE_RULES);
  const rows = [row(B(`nuke_rules_back2:${i.user.id}`, '← Anti-Nuke'))];
  for (let n = 0; n < keys.length; n += 4) rows.push(row(...keys.slice(n, n + 4).map(k => B(`nuke_rule:${k}:${i.user.id}`, `${NUKE_RULES[k]}: ${x.antiNuke.punishments[k] || 'strip'}`, ButtonStyle.Primary))));
  return i.update({ embeds: [embed('⚖️ Anti-Nuke Punishments', 'Each Anti-Nuke event has its own punishment.', 0xed4245, i.guild)], components: rows.slice(0, 5) });
}
async function raid(i, c) {
  const x = await getSecurityConfig(c, i.guildId);
  return i.update({ embeds: [embed('🚨 Anti-Raid', `**Status:** ${x.antiRaid.enabled ? '🟢 ACTIVE' : '🔴 OFF'}\n**Join burst:** ${x.antiRaid.joins} joins / ${x.antiRaid.windowMs / 1000}s\n**Minimum account age:** ${Math.round(x.antiRaid.minAccountAgeMs / 3600000)}h\n**Punishment:** **${x.antiRaid.punishment}**\n**Lockdown:** ${x.antiRaid.lockdown ? '🟢 ON' : '🔴 OFF'}`, 0xf47b67, i.guild)], components: [row(B(`security_back2:${i.user.id}`, '← Back'), B(`raid_toggle2:${i.user.id}`, x.antiRaid.enabled ? 'Disable' : 'Enable', x.antiRaid.enabled ? ButtonStyle.Success : ButtonStyle.Danger), B(`raid_punishment2:${i.user.id}`, `Punishment: ${x.antiRaid.punishment}`, ButtonStyle.Primary)), row(B(`raid_joins2:${i.user.id}`, `Joins: ${x.antiRaid.joins}`), B(`raid_window2:${i.user.id}`, `Window: ${x.antiRaid.windowMs / 1000}s`), B(`raid_age2:${i.user.id}`, `Age: ${Math.round(x.antiRaid.minAccountAgeMs / 3600000)}h`), B(`raid_lock2:${i.user.id}`, `Lockdown: ${x.antiRaid.lockdown ? 'ON' : 'OFF'}`))] });
}
async function automod(i, c) {
  const x = await getSecurityConfig(c, i.guildId);
  const text = Object.entries(AUTO_RULES).map(([k, n]) => `${n}: **${x.autoMod[k]?.punishment || 'delete'}**`).join('\n');
  const keys = Object.keys(AUTO_RULES);
  const rows = [row(B(`security_back2:${i.user.id}`, '← Back'), B(`automod_toggle2:${i.user.id}`, x.autoMod.enabled ? 'Disable' : 'Enable', x.autoMod.enabled ? ButtonStyle.Success : ButtonStyle.Danger))];
  for (let n = 0; n < keys.length; n += 4) rows.push(row(...keys.slice(n, n + 4).map(k => B(`auto_pun2:${k}:${i.user.id}`, `${AUTO_RULES[k]}: ${x.autoMod[k]?.punishment || 'delete'}`, ButtonStyle.Primary))));
  return i.update({ embeds: [embed('🤖 AutoMod', text, 0x5865f2, i.guild)], components: rows.slice(0, 3) });
}
async function punishments(i, c) {
  const x = await getSecurityConfig(c, i.guildId);
  const escalation = (x.escalation || []).map(e => `Strike **${e.strike}** → **${e.action}**${e.durationMs ? ` (${Math.round(e.durationMs / 60000)}m)` : ''}`).join('\n') || 'No escalation rules.';
  return i.update({ embeds: [embed('⚖️ Punishments & Escalation', `Every security rule has an independent punishment.\n\n**Anti-Raid:** ${x.antiRaid.punishment}\n**Strike decay:** ${Math.round(x.strikeDecayMs / 3600000)}h\n\n**Escalation**\n${escalation}`, 0xfee75c, i.guild)], components: [row(B(`security_back2:${i.user.id}`, '← Back'), B(`punishment_decay2:${i.user.id}`, '⏱️ Decay', ButtonStyle.Primary))] });
}
async function punishmentRules(i, c) { return punishments(i, c); }
async function whitelist(i, c) {
  const x = await getSecurityConfig(c, i.guildId);
  return i.update({ embeds: [embed('👤 Whitelist', `Trusted entries bypass applicable security enforcement.\n\n**Users:** ${x.whitelist.users.length}\n**Roles:** ${x.whitelist.roles.length}\n**Bots:** ${x.whitelist.bots.length}`, 0x57f287, i.guild)], components: [row(B(`security_back2:${i.user.id}`, '← Back'), B(`wl_users2:${i.user.id}`, '👤 Users', ButtonStyle.Primary), B(`wl_roles2:${i.user.id}`, '🎭 Roles', ButtonStyle.Primary), B(`wl_bots2:${i.user.id}`, '🤖 Bots', ButtonStyle.Primary))] });
}
async function logs(i, c) { const x = await getSecurityConfig(c, i.guildId); return i.update({ embeds: [embed('📋 Security Logs', `**Log channel:** ${x.logChannelId ? `<#${x.logChannelId}>` : 'Not configured'}\n**Ignored channels:** ${x.ignoredChannels.length}`, 0x5865f2, i.guild)], components: [row(B(`security_back2:${i.user.id}`, '← Back'), B(`logs_channel2:${i.user.id}`, '📋 Set Log Channel', ButtonStyle.Primary), B(`logs_ignored2:${i.user.id}`, '🚫 Ignored Channels'))] }); }
async function settings(i, c) { const x = await getSecurityConfig(c, i.guildId); return i.update({ embeds: [embed('⚙️ Security Settings', `**Global protection:** ${x.enabled ? '🟢 ON' : '🔴 OFF'}\n**Strike decay:** ${Math.round(x.strikeDecayMs / 3600000)}h\n**Ignored channels:** ${x.ignoredChannels.length}`, 0x57f287, i.guild)], components: [row(B(`security_back2:${i.user.id}`, '← Back'), B(`settings_toggle2:${i.user.id}`, x.enabled ? '🔴 Disable Protection' : '🟢 Enable Protection'), B(`settings_decay2:${i.user.id}`, '⏱️ Strike Decay', ButtonStyle.Primary), B(`settings_ignored2:${i.user.id}`, '🚫 Ignored Channels', ButtonStyle.Primary))] }); }
async function strikes(i, c) {
  const members = await i.guild.members.fetch().catch(() => i.guild.members.cache), entries = [];
  for (const m of members.values()) { if (m.user.bot) continue; const s = await getStrikes(c, i.guildId, m.id).catch(() => ({ count: 0 })); if (Number(s.count) > 0) entries.push({ id: m.id, count: Number(s.count) }); }
  entries.sort((a, b) => b.count - a.count);
  const text = entries.slice(0, 10).map((e, n) => `${n + 1}. <@${e.id}> — **${e.count}** strikes`).join('\n') || 'No active strikes.';
  const rows = [row(B(`security_back2:${i.user.id}`, '← Back'), B(`strikes_refresh2:${i.user.id}`, '🔄 Refresh', ButtonStyle.Success))];
  if (entries.length) rows.push(row(...entries.slice(0, 4).map(e => B(`strike_manage2:${e.id}:${i.user.id}`, `Manage ${e.count}`, ButtonStyle.Primary))));
  return i.update({ embeds: [embed('🏆 Strikes', `Members with active security strikes.\n\n${text}`, 0xfee75c, i.guild)], components: rows });
}
async function member(i, c, userId) {
  const s = await getStrikes(c, i.guildId, userId).catch(() => ({ count: 0, lastReason: '' }));
  return i.update({ embeds: [embed('👤 Security Strikes', `<@${userId}>\n\n**Strikes:** ${Number(s.count) || 0}\n**Last strike:** ${s.lastReason || '—'}`, 0xfee75c, i.guild)], components: [row(B(`strike_reset2:${userId}:${i.user.id}`, '🧹 Reset Strikes', ButtonStyle.Danger), B(`strikes_back2:${i.user.id}`, '← Back'))] });
}

const panelMap = { security_panel_nuke2: nuke, security_panel_raid2: raid, security_panel_automod2: automod, security_panel_punishments2: punishments, security_panel_whitelist2: whitelist, security_panel_logs2: logs, security_panel_settings2: settings, security_panel_strikes2: strikes };

export const securityDashboardButtonHandlers = [
  ...Object.entries(panelMap).map(([name, fn]) => ({ name, execute: async (i, c) => ok(i) ? fn(i, c) : deny(i) })),
  { name: 'security_back2', execute: async (i, c) => ok(i) ? dashboard(i, c) : deny(i) },
  { name: 'security_refresh', execute: async (i, c) => ok(i) ? dashboard(i, c) : deny(i) },
  { name: 'nuke_toggle2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiNuke: { enabled: !x.antiNuke.enabled } }); return nuke(i, c); } },
  { name: 'nuke_lock2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiNuke: { lockdown: !x.antiNuke.lockdown } }); return nuke(i, c); } },
  { name: 'nuke_window2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiNuke: { windowMs: cycle(x.antiNuke.windowMs, [5000,10000,15000,30000,60000]) } }); return nuke(i, c); } },
  { name: 'nuke_thresholds2', execute: async i => ok(i) ? i.showModal(new ModalBuilder().setCustomId(`nuke_thresholds_modal2:${i.user.id}`).setTitle('Anti-Nuke Thresholds').addComponents(modalField('channelDelete','Channel deletes','3'),modalField('channelCreate','Channel creates','5'),modalField('roleDelete','Role deletes','3'),modalField('roleCreate','Role creates','5'),modalField('botAdd','Bot additions','1'))) : deny(i) },
  { name: 'nuke_rules2', execute: async (i,c) => ok(i) ? nukeRules(i,c) : deny(i) },
  { name: 'nuke_rules_back2', execute: async (i,c) => ok(i) ? nuke(i,c) : deny(i) },
  ...Object.keys(NUKE_RULES).map(k => ({ name: 'nuke_rule', match: k, execute: async (i,c) => { if (!ok(i)) return deny(i); const x=await getSecurityConfig(c,i.guildId); await updateSecurityConfig(c,i.guildId,{antiNuke:{punishments:{[k]:cycle(x.antiNuke.punishments[k]||'strip',NUKE_ACTIONS)}}}); return nukeRules(i,c); } })),
  { name: 'raid_toggle2', execute: async(i,c)=>{if(!ok(i))return deny(i);const x=await getSecurityConfig(c,i.guildId);await updateSecurityConfig(c,i.guildId,{antiRaid:{enabled:!x.antiRaid.enabled}});return raid(i,c);} },
  { name: 'raid_punishment2', execute: async(i,c)=>{if(!ok(i))return deny(i);const x=await getSecurityConfig(c,i.guildId);await updateSecurityConfig(c,i.guildId,{antiRaid:{punishment:cycle(x.antiRaid.punishment,RAID_ACTIONS)}});return raid(i,c);} },
  { name: 'raid_joins2', execute: async(i,c)=>{if(!ok(i))return deny(i);const x=await getSecurityConfig(c,i.guildId);await updateSecurityConfig(c,i.guildId,{antiRaid:{joins:x.antiRaid.joins>=50?2:x.antiRaid.joins+2}});return raid(i,c);} },
  { name: 'raid_window2', execute: async(i,c)=>{if(!ok(i))return deny(i);const x=await getSecurityConfig(c,i.guildId);await updateSecurityConfig(c,i.guildId,{antiRaid:{windowMs:cycle(x.antiRaid.windowMs,[5000,10000,15000,30000,60000])}});return raid(i,c);} },
  { name: 'raid_age2', execute: async(i,c)=>{if(!ok(i))return deny(i);const x=await getSecurityConfig(c,i.guildId);await updateSecurityConfig(c,i.guildId,{antiRaid:{minAccountAgeMs:cycle(x.antiRaid.minAccountAgeMs,[0,3600000,21600000,86400000,604800000,2592000000])}});return raid(i,c);} },
  { name: 'raid_lock2', execute: async(i,c)=>{if(!ok(i))return deny(i);const x=await getSecurityConfig(c,i.guildId);await updateSecurityConfig(c,i.guildId,{antiRaid:{lockdown:!x.antiRaid.lockdown}});return raid(i,c);} },
  { name: 'punishment_rules2', execute: async(i,c)=>ok(i)?punishmentRules(i,c):deny(i) },
  { name: 'punishments_back2', execute: async(i,c)=>ok(i)?punishments(i,c):deny(i) },
  { name: 'pun_raid2', execute: async(i,c)=>{if(!ok(i))return deny(i);const x=await getSecurityConfig(c,i.guildId);await updateSecurityConfig(c,i.guildId,{antiRaid:{punishment:cycle(x.antiRaid.punishment,RAID_ACTIONS)}});return punishmentRules(i,c);} },
  { name: 'pun_auto2', execute: async(i,c)=>ok(i)?automod(i,c):deny(i) },
  { name: 'automod_toggle2', execute: async(i,c)=>{if(!ok(i))return deny(i);const x=await getSecurityConfig(c,i.guildId);await updateSecurityConfig(c,i.guildId,{autoMod:{enabled:!x.autoMod.enabled}});return automod(i,c);} },
  ...Object.keys(AUTO_RULES).map(k => ({ name: 'auto_pun2', match: k, execute: async(i,c)=>{if(!ok(i))return deny(i);const x=await getSecurityConfig(c,i.guildId);await updateSecurityConfig(c,i.guildId,{autoMod:{[k]:{punishment:cycle(x.autoMod[k]?.punishment||'delete',AUTO_ACTIONS)}}});return automod(i,c);} })),
  { name: 'punishment_decay2', execute: async(i,c)=>{if(!ok(i))return deny(i);const x=await getSecurityConfig(c,i.guildId);await updateSecurityConfig(c,i.guildId,{strikeDecayMs:x.strikeDecayMs>=30*86400000?3600000:x.strikeDecayMs+3600000});return punishments(i,c);} },
  { name: 'strikes_refresh2', execute: async(i,c)=>ok(i)?strikes(i,c):deny(i) },
  { name: 'strike_manage2', execute: async(i,c)=>ok(i)?member(i,c,i.customId.split(':').at(-2)):deny(i) },
  { name: 'strike_reset2', execute: async(i,c)=>{if(!ok(i))return deny(i);const u=i.customId.split(':').at(-2);await clearStrikes(c,i.guildId,u);await sendSecurityLog(c,i.guild,{title:'Strikes Reset',description:`<@${u}> strikes reset by <@${i.user.id}>`,color:0x57f287});return strikes(i,c);} },
  { name: 'strikes_back2', execute: async(i,c)=>ok(i)?strikes(i,c):deny(i) },
  { name: 'wl_users2', execute: async i=>ok(i)?i.showModal(new ModalBuilder().setCustomId(`wl_users_modal2:${i.user.id}`).setTitle('Whitelist Users').addComponents(modalField('value','User IDs, one per line','',TextInputStyle.Paragraph))):deny(i) },
  { name: 'wl_roles2', execute: async i=>ok(i)?i.showModal(new ModalBuilder().setCustomId(`wl_roles_modal2:${i.user.id}`).setTitle('Whitelist Roles').addComponents(modalField('value','Role IDs, one per line','',TextInputStyle.Paragraph))):deny(i) },
  { name: 'wl_bots2', execute: async i=>ok(i)?i.showModal(new ModalBuilder().setCustomId(`wl_bots_modal2:${i.user.id}`).setTitle('Whitelist Bots').addComponents(modalField('value','Bot IDs, one per line','',TextInputStyle.Paragraph))):deny(i) },
  { name: 'logs_channel2', execute: async i=>ok(i)?i.showModal(new ModalBuilder().setCustomId(`logs_channel_modal2:${i.user.id}`).setTitle('Security Log Channel').addComponents(modalField('value','Channel ID'))):deny(i) },
  { name: 'logs_ignored2', execute: async i=>ok(i)?i.showModal(new ModalBuilder().setCustomId(`logs_ignored_modal2:${i.user.id}`).setTitle('Ignored Channels').addComponents(modalField('value','Channel IDs, one per line','',TextInputStyle.Paragraph))):deny(i) },
  { name: 'settings_toggle2', execute: async(i,c)=>{if(!ok(i))return deny(i);const x=await getSecurityConfig(c,i.guildId);await updateSecurityConfig(c,i.guildId,{enabled:!x.enabled});return settings(i,c);} },
  { name: 'settings_decay2', execute: async(i,c)=>{if(!ok(i))return deny(i);const x=await getSecurityConfig(c,i.guildId);await updateSecurityConfig(c,i.guildId,{strikeDecayMs:x.strikeDecayMs>=30*86400000?3600000:x.strikeDecayMs+3600000});return settings(i,c);} },
  { name: 'settings_ignored2', execute: async i=>ok(i)?i.showModal(new ModalBuilder().setCustomId(`settings_ignored_modal2:${i.user.id}`).setTitle('Ignored Channels').addComponents(modalField('value','Channel IDs, one per line','',TextInputStyle.Paragraph))):deny(i) },
  { name: 'logs_ignored2', execute: async i=>ok(i)?i.showModal(new ModalBuilder().setCustomId(`logs_ignored_modal2:${i.user.id}`).setTitle('Ignored Channels').addComponents(modalField('value','Channel IDs, one per line','',TextInputStyle.Paragraph))):deny(i) },
  { name: 'logs_channel2', execute: async i=>ok(i)?i.showModal(new ModalBuilder().setCustomId(`logs_channel_modal2:${i.user.id}`).setTitle('Security Log Channel').addComponents(modalField('value','Channel ID'))):deny(i) },
];

export const securityDashboardModalHandlers = [
  { name:'nuke_thresholds_modal2', execute:async(i,c)=>{if(!ok(i))return deny(i);const x=await getSecurityConfig(c,i.guildId);const t={...x.antiNuke.thresholds};for(const k of ['channelDelete','channelCreate','roleDelete','roleCreate','botAdd'])t[k]=Math.max(1,Number(i.fields.getTextInputValue(k))||t[k]);await updateSecurityConfig(c,i.guildId,{antiNuke:{thresholds:t}});return nuke(i,c);} },
  { name:'wl_users_modal2', execute:async(i,c)=>{if(!ok(i))return deny(i);const users=String(i.fields.getTextInputValue('value')||'').split(/\s+/).filter(Boolean).slice(0,100);await updateSecurityConfig(c,i.guildId,{whitelist:{users}});return whitelist(i,c);} },
  { name:'wl_roles_modal2', execute:async(i,c)=>{if(!ok(i))return deny(i);const roles=String(i.fields.getTextInputValue('value')||'').split(/\s+/).filter(Boolean).slice(0,100);await updateSecurityConfig(c,i.guildId,{whitelist:{roles}});return whitelist(i,c);} },
  { name:'wl_bots_modal2', execute:async(i,c)=>{if(!ok(i))return deny(i);const bots=String(i.fields.getTextInputValue('value')||'').split(/\s+/).filter(Boolean).slice(0,100);await updateSecurityConfig(c,i.guildId,{whitelist:{bots}});return whitelist(i,c);} },
  { name:'logs_channel_modal2', execute:async(i,c)=>{if(!ok(i))return deny(i);const value=String(i.fields.getTextInputValue('value')||'').trim()||null;await updateSecurityConfig(c,i.guildId,{logChannelId:value});return logs(i,c);} },
  { name:'logs_ignored_modal2', execute:async(i,c)=>{if(!ok(i))return deny(i);const value=String(i.fields.getTextInputValue('value')||'').split(/\s+/).filter(Boolean).slice(0,100);await updateSecurityConfig(c,i.guildId,{ignoredChannels:value});return logs(i,c);} },
  { name:'settings_ignored_modal2', execute:async(i,c)=>{if(!ok(i))return deny(i);const value=String(i.fields.getTextInputValue('value')||'').split(/\s+/).filter(Boolean).slice(0,100);await updateSecurityConfig(c,i.guildId,{ignoredChannels:value});return settings(i,c);} },
];