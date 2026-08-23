import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getSecurityConfig, updateSecurityConfig, getStrikes, clearStrikes } from '../services/security/securityService.js';
import { buildSecurityDashboard as buildOriginalSecurityDashboard, buildSecurityControls } from '../commands/Security/security.js';

const NUKE_ACTIONS = ['strip', 'kick', 'ban'];
const RAID_ACTIONS = ['timeout', 'kick', 'ban'];

const ok = interaction => interaction.customId.split(':').at(-1) === interaction.user.id;
const deny = interaction => interaction.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });
const button = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...buttons) => new ActionRowBuilder().addComponents(buttons);
const cycle = (value, values) => values[(values.indexOf(value) + 1) % values.length];

function embed(title, description, guild, color = 0x5865f2) {
  return new EmbedBuilder()
    .setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined })
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: 'Infinity System • Changes save automatically' })
    .setTimestamp();
}

// IMPORTANT: this must be the exact same dashboard used by /security.
// Do not maintain a second dashboard layout here.
export async function buildSecurityDashboard(client, guild, userId) {
  const config = await getSecurityConfig(client, guild.id);
  return {
    embeds: [buildOriginalSecurityDashboard(config, guild)],
    components: buildSecurityControls(userId),
  };
}

async function dashboard(interaction, client) {
  return interaction.update(await buildSecurityDashboard(client, interaction.guild, interaction.user.id));
}

async function panel(interaction, client, type) {
  const config = await getSecurityConfig(client, interaction.guildId);
  let title = '🛡️ Security';
  let description = '';
  let color = 0x5865f2;
  let components = [row(button(`security_back2:${interaction.user.id}`, '← Back'))];

  if (type === 'nuke') {
    title = '🛡️ Anti-Nuke'; color = 0xed4245;
    description = `**Status:** ${config.antiNuke.enabled ? '🟢 ACTIVE' : '🔴 OFF'}\n**Window:** ${config.antiNuke.windowMs / 1000}s\n**Lockdown:** ${config.antiNuke.lockdown ? '🟢 ON' : '🔴 OFF'}\n**Default action:** ${config.antiNuke.action || 'strip'}`;
    components = [row(button(`security_back2:${interaction.user.id}`, '← Back'), button(`nuke_toggle2:${interaction.user.id}`, config.antiNuke.enabled ? 'Disable' : 'Enable', config.antiNuke.enabled ? ButtonStyle.Success : ButtonStyle.Danger), button(`nuke_lock2:${interaction.user.id}`, `Lockdown: ${config.antiNuke.lockdown ? 'ON' : 'OFF'}`), button(`nuke_window2:${interaction.user.id}`, `Window: ${config.antiNuke.windowMs / 1000}s`)), row(button(`nuke_rules2:${interaction.user.id}`, '⚖️ Rule Punishments', ButtonStyle.Primary))];
  } else if (type === 'raid') {
    title = '🚨 Anti-Raid'; color = 0xf47b67;
    description = `**Status:** ${config.antiRaid.enabled ? '🟢 ACTIVE' : '🔴 OFF'}\n**Joins:** ${config.antiRaid.joins}\n**Window:** ${config.antiRaid.windowMs / 1000}s\n**Account age:** ${Math.round(config.antiRaid.minAccountAgeMs / 3600000)}h\n**Punishment:** ${config.antiRaid.punishment}\n**Lockdown:** ${config.antiRaid.lockdown ? 'ON' : 'OFF'}`;
    components = [row(button(`security_back2:${interaction.user.id}`, '← Back'), button(`raid_toggle2:${interaction.user.id}`, config.antiRaid.enabled ? 'Disable' : 'Enable', config.antiRaid.enabled ? ButtonStyle.Success : ButtonStyle.Danger), button(`raid_punishment2:${interaction.user.id}`, `Punishment: ${config.antiRaid.punishment}`, ButtonStyle.Primary)), row(button(`raid_joins2:${interaction.user.id}`, `Joins: ${config.antiRaid.joins}`), button(`raid_window2:${interaction.user.id}`, `Window: ${config.antiRaid.windowMs / 1000}s`), button(`raid_age2:${interaction.user.id}`, `Age: ${Math.round(config.antiRaid.minAccountAgeMs / 3600000)}h`), button(`raid_lock2:${interaction.user.id}`, `Lockdown: ${config.antiRaid.lockdown ? 'ON' : 'OFF'}`))];
  } else if (type === 'punishments') {
    title = '⚖️ Punishments'; color = 0xfee75c;
    const escalation = (config.escalation || []).map(e => `Strike ${e.strike} → **${e.action}**`).join('\n') || 'No escalation rules configured.';
    description = `**Anti-Raid:** ${config.antiRaid.punishment}\n**Strike decay:** ${Math.round(config.strikeDecayMs / 3600000)}h\n\n**Escalation**\n${escalation}`;
    components = [row(button(`security_back2:${interaction.user.id}`, '← Back'), button(`punishment_decay2:${interaction.user.id}`, '⏱️ Decay', ButtonStyle.Primary), button(`punishment_rules2:${interaction.user.id}`, '⚖️ Rule Punishments', ButtonStyle.Primary))];
  } else if (type === 'whitelist') {
    title = '👤 Whitelist'; color = 0x57f287;
    description = `**Users:** ${config.whitelist?.users?.length || 0}\n**Roles:** ${config.whitelist?.roles?.length || 0}\n**Bots:** ${config.whitelist?.bots?.length || 0}`;
    components = [row(button(`security_back2:${interaction.user.id}`, '← Back'), button(`wl_users2:${interaction.user.id}`, '👤 Users', ButtonStyle.Primary), button(`wl_roles2:${interaction.user.id}`, '🎭 Roles', ButtonStyle.Primary), button(`wl_bots2:${interaction.user.id}`, '🤖 Bots', ButtonStyle.Primary))];
  } else if (type === 'logs') {
    title = '📋 Security Logs';
    description = `**Log channel:** ${config.logChannelId ? `<#${config.logChannelId}>` : 'Not configured'}\n**Ignored channels:** ${config.ignoredChannels?.length || 0}`;
    components = [row(button(`security_back2:${interaction.user.id}`, '← Back'), button(`logs_channel2:${interaction.user.id}`, '📋 Set Log Channel', ButtonStyle.Primary), button(`logs_ignored2:${interaction.user.id}`, '🚫 Ignored Channels'))];
  } else if (type === 'settings') {
    title = '⚙️ Security Settings'; color = 0x57f287;
    description = `**Global protection:** ${config.enabled ? '🟢 ON' : '🔴 OFF'}\n**Strike decay:** ${Math.round(config.strikeDecayMs / 3600000)}h\n**Ignored channels:** ${config.ignoredChannels?.length || 0}`;
    components = [row(button(`security_back2:${interaction.user.id}`, '← Back'), button(`settings_toggle2:${interaction.user.id}`, config.enabled ? 'Disable Protection' : 'Enable Protection'), button(`settings_decay2:${interaction.user.id}`, '⏱️ Strike Decay', ButtonStyle.Primary))];
  }

  return interaction.update({ embeds: [embed(title, description, interaction.guild, color)], components });
}

async function strikes(interaction, client) {
  const members = await interaction.guild.members.fetch().catch(() => interaction.guild.members.cache);
  const entries = [];
  for (const member of members.values()) {
    if (member.user.bot) continue;
    const strike = await getStrikes(client, interaction.guildId, member.id).catch(() => ({ count: 0 }));
    if (strike.count) entries.push({ id: member.id, count: strike.count });
  }
  entries.sort((a, b) => b.count - a.count);
  const text = entries.slice(0, 10).map((entry, index) => `${index + 1}. <@${entry.id}> — **${entry.count}** strikes`).join('\n') || 'No active strikes.';
  return interaction.update({ embeds: [embed('🏆 Strikes & Warnings', text, interaction.guild, 0xfee75c)], components: [row(button(`security_back2:${interaction.user.id}`, '← Back'), button(`strikes_refresh2:${interaction.user.id}`, '🔄 Refresh', ButtonStyle.Success))] });
}

const panelHandlers = {
  security_panel_nuke2: 'nuke', security_panel_raid2: 'raid', security_panel_punishments2: 'punishments', security_panel_whitelist2: 'whitelist', security_panel_logs2: 'logs', security_panel_settings2: 'settings',
  security_panel_nuke: 'nuke', security_panel_raid: 'raid', security_panel_punishments: 'punishments', security_panel_whitelist: 'whitelist', security_panel_logs: 'logs', security_panel_settings: 'settings',
};

export const securityDashboardButtonHandlers = [
  ...Object.entries(panelHandlers).map(([name, type]) => ({ name, execute: async (interaction, client) => ok(interaction) ? panel(interaction, client, type) : deny(interaction) })),
  { name: 'security_panel_strikes2', execute: async (interaction, client) => ok(interaction) ? strikes(interaction, client) : deny(interaction) },
  { name: 'security_panel_strikes', execute: async (interaction, client) => ok(interaction) ? strikes(interaction, client) : deny(interaction) },
  { name: 'security_back2', execute: async (interaction, client) => ok(interaction) ? dashboard(interaction, client) : deny(interaction) },
  { name: 'security_back', execute: async (interaction, client) => ok(interaction) ? dashboard(interaction, client) : deny(interaction) },
  { name: 'security_refresh', execute: async (interaction, client) => ok(interaction) ? dashboard(interaction, client) : deny(interaction) },
  { name: 'nuke_toggle2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiNuke: { enabled: !x.antiNuke.enabled } }); return panel(i, c, 'nuke'); } },
  { name: 'nuke_lock2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiNuke: { lockdown: !x.antiNuke.lockdown } }); return panel(i, c, 'nuke'); } },
  { name: 'nuke_window2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiNuke: { windowMs: cycle(x.antiNuke.windowMs, [5000, 10000, 15000, 30000, 60000]) } }); return panel(i, c, 'nuke'); } },
  { name: 'nuke_rules2', execute: async (i, c) => ok(i) ? i.update({ embeds: [embed('⚖️ Anti-Nuke Rule Punishments', 'Use the rule buttons from the security punishment dashboard.', i.guild, 0xed4245)], components: [row(button(`punishment_rules2:${i.user.id}`, '← Punishments'))] }) : deny(i) },
  { name: 'raid_toggle2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiRaid: { enabled: !x.antiRaid.enabled } }); return panel(i, c, 'raid'); } },
  { name: 'raid_punishment2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiRaid: { punishment: cycle(x.antiRaid.punishment, RAID_ACTIONS) } }); return panel(i, c, 'raid'); } },
  { name: 'raid_joins2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiRaid: { joins: x.antiRaid.joins >= 50 ? 2 : x.antiRaid.joins + 2 } }); return panel(i, c, 'raid'); } },
  { name: 'raid_window2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiRaid: { windowMs: cycle(x.antiRaid.windowMs, [5000, 10000, 15000, 30000, 60000]) } }); return panel(i, c, 'raid'); } },
  { name: 'raid_age2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiRaid: { minAccountAgeMs: cycle(x.antiRaid.minAccountAgeMs, [0, 3600000, 21600000, 86400000, 604800000, 2592000000]) } }); return panel(i, c, 'raid'); } },
  { name: 'raid_lock2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { antiRaid: { lockdown: !x.antiRaid.lockdown } }); return panel(i, c, 'raid'); } },
  { name: 'punishment_rules2', execute: async (i, c) => ok(i) ? panel(i, c, 'punishments') : deny(i) },
  { name: 'punishments_back2', execute: async (i, c) => ok(i) ? panel(i, c, 'punishments') : deny(i) },
  { name: 'punishment_decay2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { strikeDecayMs: x.strikeDecayMs >= 30 * 86400000 ? 3600000 : x.strikeDecayMs + 3600000 }); return panel(i, c, 'punishments'); } },
  { name: 'settings_toggle2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { enabled: !x.enabled }); return panel(i, c, 'settings'); } },
  { name: 'settings_decay2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { strikeDecayMs: x.strikeDecayMs >= 30 * 86400000 ? 3600000 : x.strikeDecayMs + 3600000 }); return panel(i, c, 'settings'); } },
];
