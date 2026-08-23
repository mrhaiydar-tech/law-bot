import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { getSecurityConfig } from '../../services/security/securityService.js';

const PANEL_META = {
  nuke: ['🛡️ Anti-Nuke', 'Protects channels, roles, webhooks, bans and dangerous server changes.'],
  raid: ['🚨 Anti-Raid', 'Detects rapid joins and suspicious new accounts.'],
  automod: ['🤖 AutoMod', 'Stops spam, duplicates, mentions, invites, links and other abuse.'],
  punishments: ['⚖️ Punishments', 'Every protection rule can have its own punishment.'],
  strikes: ['🏆 Strike Board', 'See members with the most active security strikes and manage them.'],
  whitelist: ['👤 Whitelist', 'Trusted users, roles and bots bypass security actions.'],
  logs: ['📋 Logs', 'Choose where security incidents are reported.'],
  settings: ['⚙️ Settings', 'Global protection and security behavior.'],
};

const MAIN_BUTTONS = [
  ['security_panel_nuke', '🛡️ Anti-Nuke', ButtonStyle.Danger],
  ['security_panel_raid', '🚨 Anti-Raid', ButtonStyle.Primary],
  ['security_panel_automod', '🤖 AutoMod', ButtonStyle.Primary],
  ['security_panel_punishments', '⚖️ Punishments', ButtonStyle.Primary],
  ['security_panel_strikes', '🏆 Strikes', ButtonStyle.Danger],
  ['security_panel_whitelist', '👤 Whitelist', ButtonStyle.Secondary],
  ['security_panel_logs', '📋 Logs', ButtonStyle.Secondary],
  ['security_panel_settings', '⚙️ Settings', ButtonStyle.Secondary],
];

const NUKE_LABELS = { channelDelete: 'Channel Del', channelCreate: 'Channel Add', roleDelete: 'Role Del', roleCreate: 'Role Add', roleUpdate: 'Role Edit', webhookUpdate: 'Webhook Edit', webhookDelete: 'Webhook Del', ban: 'Ban', kick: 'Kick', botAdd: 'Bot Add' };
const AUTOMOD_LABELS = { spam: 'Spam', duplicate: 'Duplicate', mentions: 'Mentions', invites: 'Invites', links: 'Links', caps: 'Caps', badWords: 'Bad Words' };

function status(enabled) { return enabled ? '🟢 **ACTIVE**' : '🔴 **OFF**'; }
function boolLabel(value) { return value ? '🟢 ON' : '🔴 OFF'; }
function hours(ms) { return Math.max(0, Math.round(Number(ms || 0) / 3600000)); }
function button(id, label, style = ButtonStyle.Secondary, disabled = false) { return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled); }

export function buildSecurityDashboard(config, guild) {
  const systems = [config.enabled, config.antiNuke?.enabled, config.antiRaid?.enabled, config.autoMod?.enabled];
  const active = systems.filter(Boolean).length;
  const score = Math.round((active / systems.length) * 100);
  const scoreLabel = score >= 100 ? 'Maximum' : score >= 75 ? 'Strong' : score >= 50 ? 'Partial' : 'Weak';
  const whitelistCount = (config.whitelist?.users?.length || 0) + (config.whitelist?.roles?.length || 0) + (config.whitelist?.bots?.length || 0);
  const logValue = config.logChannelId ? `<#${config.logChannelId}>` : '`Not configured`';
  return new EmbedBuilder()
    .setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined })
    .setTitle('🛡️ Server Protection')
    .setDescription(`**${guild.name}**\n\nCentralized security controls for your server.\n\n**Security Health:** ${score}% • **${scoreLabel}**`)
    .setColor(score >= 100 ? 0x57f287 : score >= 75 ? 0xfee75c : score >= 50 ? 0xf47b67 : 0xed4245)
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .addFields(
      { name: '━━ Protection ━━', value: [`🛡️ Anti-Nuke  ${status(config.antiNuke?.enabled)}`, `🚨 Anti-Raid  ${status(config.antiRaid?.enabled)}`, `🤖 AutoMod    ${status(config.autoMod?.enabled)}`, `🔒 Global     ${status(config.enabled)}`].join('\n'), inline: true },
      { name: '━━ Statistics ━━', value: [`⚡ **${config.escalation?.length || 0}** escalation levels`, `🏆 **Strike management** enabled`, `👤 **${whitelistCount}** whitelist entries`, `📋 Logs: ${logValue}`].join('\n'), inline: true },
      { name: '━━ Current Mode ━━', value: config.enabled ? '🟢 **PROTECTED** — security systems are actively monitoring this server.' : '🔴 **DISABLED** — global security protection is currently off.' },
    )
    .setFooter({ text: 'Infinity System • Security Center • Changes save automatically' })
    .setTimestamp();
}

export function buildSecurityControls(userId) {
  return [
    new ActionRowBuilder().addComponents(...MAIN_BUTTONS.slice(0, 4).map(([id, label, style]) => button(`${id}:${userId}`, label, style))),
    new ActionRowBuilder().addComponents(...MAIN_BUTTONS.slice(4).map(([id, label, style]) => button(`${id}:${userId}`, label, style)), button(`security_refresh:${userId}`, '🔄 Refresh', ButtonStyle.Success)),
  ];
}

export function buildSecurityPanel(config, guild, panel) {
  const [title, description] = PANEL_META[panel] || PANEL_META.settings;
  let data = [];
  if (panel === 'nuke') data = [
    `**Status:** ${status(config.antiNuke?.enabled)}`,
    `**Default action:** \`${config.antiNuke?.action || 'strip'}\``,
    `**Detection window:** \`${Math.round((config.antiNuke?.windowMs || 10000) / 1000)}s\``,
    `**Lockdown:** ${boolLabel(config.antiNuke?.lockdown)}`,
    '', '**Thresholds**',
    `Channels: delete \`${config.antiNuke?.thresholds?.channelDelete ?? 3}\` • create \`${config.antiNuke?.thresholds?.channelCreate ?? 5}\``,
    `Roles: delete \`${config.antiNuke?.thresholds?.roleDelete ?? 3}\` • create \`${config.antiNuke?.thresholds?.roleCreate ?? 5}\` • edit \`${config.antiNuke?.thresholds?.roleUpdate ?? 1}\``,
    `Webhooks: edit \`${config.antiNuke?.thresholds?.webhookUpdate ?? 3}\` • delete \`${config.antiNuke?.thresholds?.webhookDelete ?? 2}\``,
    `Ban \`${config.antiNuke?.thresholds?.ban ?? 5}\` • Kick \`${config.antiNuke?.thresholds?.kick ?? 5}\` • Bot add \`${config.antiNuke?.thresholds?.botAdd ?? 1}\``,
  ];
  else if (panel === 'raid') data = [
    `**Status:** ${status(config.antiRaid?.enabled)}`,
    `**Punishment:** \`${config.antiRaid?.punishment || config.antiRaid?.action || 'timeout'}\``,
    `**Join threshold:** \`${config.antiRaid?.joins ?? 8}\` members`,
    `**Window:** \`${Math.round((config.antiRaid?.windowMs || 10000) / 1000)}s\``,
    `**Minimum account age:** \`${hours(config.antiRaid?.minAccountAgeMs)}h\``,
    `**Lockdown:** ${boolLabel(config.antiRaid?.lockdown)} • **Duration:** \`${Math.round((config.antiRaid?.lockdownMs || 600000) / 60000)}m\``,
  ];
  else if (panel === 'automod') data = [
    `**Status:** ${status(config.autoMod?.enabled)}`,
    `**Spam:** ${boolLabel(config.autoMod?.spam?.enabled)} • ${config.autoMod?.spam?.maxMessages ?? 6}/${Math.round((config.autoMod?.spam?.windowMs || 5000) / 1000)}s • **${config.autoMod?.spam?.punishment || 'timeout'}**`,
    `**Duplicate:** ${boolLabel(config.autoMod?.duplicate?.enabled)} • ${config.autoMod?.duplicate?.maxRepeats ?? 3} repeats • **${config.autoMod?.duplicate?.punishment || 'timeout'}**`,
    `**Mentions:** ${boolLabel(config.autoMod?.mentions?.enabled)} • max ${config.autoMod?.mentions?.max ?? 6} • **${config.autoMod?.mentions?.punishment || 'timeout'}**`,
    `**Invites:** ${boolLabel(config.autoMod?.invites?.enabled)} • **${config.autoMod?.invites?.punishment || 'delete'}**`,
    `**Links:** ${boolLabel(config.autoMod?.links?.enabled)} • **${config.autoMod?.links?.punishment || 'delete'}** • **Caps:** ${boolLabel(config.autoMod?.caps?.enabled)} • **${config.autoMod?.caps?.punishment || 'warn'}**`,
    `**Bad words:** ${config.autoMod?.badWords?.words?.length || 0} words • **${config.autoMod?.badWords?.punishment || 'timeout'}**`,
  ];
  else if (panel === 'punishments') {
    const nuke = Object.entries(NUKE_LABELS).map(([key, label]) => `${label}: **${config.antiNuke?.punishments?.[key] || config.antiNuke?.action || 'strip'}**`);
    const automod = Object.entries(AUTOMOD_LABELS).map(([key, label]) => `${label}: **${config.autoMod?.[key]?.punishment || 'delete'}**`);
    data = ['**Per-rule punishments**', '', '**Anti-Nuke**', ...nuke, '', `**Anti-Raid:** **${config.antiRaid?.punishment || 'timeout'}**`, '', '**AutoMod**', ...automod, '', '**Escalation**', ...(config.escalation || []).slice(0, 10).map(e => `Strike ${e.strike}: **${e.action}**${e.durationMs ? ` • ${Math.round(e.durationMs / 60000)}m` : ''}`), '', `Strike decay: **${hours(config.strikeDecayMs)}h**`];
  } else if (panel === 'strikes') data = [
    '🏆 **Top active security strikes**',
    '',
    'This board shows members with the highest active Strike count. Expired strikes are ignored automatically.',
    '',
    'Use the buttons below to reset a member completely or refresh the board.',
  ];
  else if (panel === 'whitelist') data = [`**Users:** \`${config.whitelist?.users?.length || 0}\``, `**Roles:** \`${config.whitelist?.roles?.length || 0}\``, `**Bots:** \`${config.whitelist?.bots?.length || 0}\``, '', 'Whitelisted accounts bypass Anti-Nuke and AutoMod enforcement where applicable.'];
  else if (panel === 'logs') data = [`**Log channel:** ${config.logChannelId ? `<#${config.logChannelId}>` : '`Not configured`'}`, `**Ignored channels:** \`${config.ignoredChannels?.length || 0}\``, '', 'Security incidents include the executor/member, reason and action taken.'];
  else data = [`**Global protection:** ${status(config.enabled)}`, `**Anti-Nuke:** ${status(config.antiNuke?.enabled)}`, `**Anti-Raid:** ${status(config.antiRaid?.enabled)}`, `**AutoMod:** ${status(config.autoMod?.enabled)}`, '', 'Use the controls below to change protection without leaving this message.'];

  return new EmbedBuilder()
    .setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined })
    .setTitle(title)
    .setDescription(`${description}\n\n${data.join('\n')}`)
    .setColor(panel === 'nuke' ? 0xed4245 : panel === 'raid' ? 0xf47b67 : panel === 'automod' ? 0x5865f2 : panel === 'strikes' ? 0xfee75c : 0x57f287)
    .setFooter({ text: 'Infinity System • Click a control below • Changes save automatically' })
    .setTimestamp();
}

export function buildStrikeBoardEmbed(guild, entries) {
  const lines = entries.length
    ? entries.map((entry, index) => `${index + 1}. <@${entry.userId}> — **${entry.count} strike${entry.count === 1 ? '' : 's'}**${entry.lastReason ? ` • ${String(entry.lastReason).slice(0, 80)}` : ''}`).join('\n')
    : '✅ No active strikes found.';
  return new EmbedBuilder()
    .setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined })
    .setTitle('🏆 Strike Leaderboard')
    .setDescription(`**${guild.name}**\n\n${lines}`)
    .setColor(0xfee75c)
    .setFooter({ text: 'Resetting a strike only changes the security strike counter; security logs remain intact.' })
    .setTimestamp();
}

export function buildSecurityPanelControls(userId, panel, config) {
  const id = name => `${name}:${userId}`;
  const rows = [];
  if (panel === 'nuke') {
    rows.push(new ActionRowBuilder().addComponents(button(id('security_back'), '← Back'), button(id('security_nuke_toggle'), config.antiNuke.enabled ? '🟢 Disable' : '🔴 Enable', config.antiNuke.enabled ? ButtonStyle.Success : ButtonStyle.Danger), button(id('security_nuke_window'), `Window: ${Math.round(config.antiNuke.windowMs / 1000)}s`), button(id('security_nuke_lockdown'), `Lockdown: ${config.antiNuke.lockdown ? 'ON' : 'OFF'}`)));
    rows.push(new ActionRowBuilder().addComponents(button(id('security_nuke_threshold'), 'Threshold Editor', ButtonStyle.Primary), button(id('security_panel_punishments'), '⚖️ Punishments', ButtonStyle.Primary)));
  } else if (panel === 'raid') {
    rows.push(new ActionRowBuilder().addComponents(button(id('security_back'), '← Back'), button(id('security_raid_toggle'), config.antiRaid.enabled ? '🟢 Disable' : '🔴 Enable', config.antiRaid.enabled ? ButtonStyle.Success : ButtonStyle.Danger), button(id('security_raid_joins_down'), '− Joins'), button(id('security_raid_joins_up'), '+ Joins'), button(id('security_raid_punishment'), `Punishment: ${config.antiRaid.punishment || 'timeout'}`, ButtonStyle.Primary)));
    rows.push(new ActionRowBuilder().addComponents(button(id('security_raid_window'), `Window: ${Math.round(config.antiRaid.windowMs / 1000)}s`), button(id('security_raid_age'), `Age: ${hours(config.antiRaid.minAccountAgeMs)}h`), button(id('security_raid_lockdown'), `Lockdown: ${config.antiRaid.lockdown ? 'ON' : 'OFF'}`)));
  } else if (panel === 'automod') {
    rows.push(new ActionRowBuilder().addComponents(button(id('security_back'), '← Back'), button(id('security_automod_toggle'), config.autoMod.enabled ? '🟢 Disable' : '🔴 Enable', config.autoMod.enabled ? ButtonStyle.Success : ButtonStyle.Danger), button(id('security_automod_spam_toggle'), `Spam ${boolLabel(config.autoMod.spam.enabled)}`), button(id('security_automod_spam_punishment'), `Spam: ${config.autoMod.spam.punishment}`)));
    rows.push(new ActionRowBuilder().addComponents(button(id('security_automod_dup_toggle'), `Duplicate ${boolLabel(config.autoMod.duplicate.enabled)}`), button(id('security_automod_dup_punishment'), `Duplicate: ${config.autoMod.duplicate.punishment}`), button(id('security_automod_mentions_punishment'), `Mentions: ${config.autoMod.mentions.punishment}`), button(id('security_automod_invites'), `Invites ${boolLabel(config.autoMod.invites.enabled)}`), button(id('security_automod_invites_punishment'), `Invites: ${config.autoMod.invites.punishment}`)));
    rows.push(new ActionRowBuilder().addComponents(button(id('security_automod_links'), `Links ${boolLabel(config.autoMod.links.enabled)}`), button(id('security_automod_links_punishment'), `Links: ${config.autoMod.links.punishment}`), button(id('security_automod_caps'), `Caps ${boolLabel(config.autoMod.caps.enabled)}`), button(id('security_automod_caps_punishment'), `Caps: ${config.autoMod.caps.punishment}`)));
    rows.push(new ActionRowBuilder().addComponents(button(id('security_automod_badwords'), '🚫 Manage Words', ButtonStyle.Primary), button(id('security_automod_badwords_punishment'), `Bad Words: ${config.autoMod.badWords.punishment}`, ButtonStyle.Primary), button(id('security_automod_spam_down'), 'Spam −'), button(id('security_automod_spam_up'), 'Spam +'), button(id('security_automod_action'), `Default: ${config.autoMod.action}`)));
  } else if (panel === 'punishments') {
    rows.push(new ActionRowBuilder().addComponents(button(id('security_back'), '← Back'), button(id('security_pun_decay_down'), 'Decay −'), button(id('security_pun_decay_up'), 'Decay +'), button(id('security_pun_raid'), `Raid: ${config.antiRaid.punishment}`, ButtonStyle.Primary)));
    const nukeKeys = Object.keys(NUKE_LABELS);
    for (let i = 0; i < nukeKeys.length; i += 5) rows.push(new ActionRowBuilder().addComponents(...nukeKeys.slice(i, i + 5).map(k => button(id(`security_pun_nuke_${k}`), `${NUKE_LABELS[k]}: ${config.antiNuke.punishments[k]}`, ButtonStyle.Primary))));
    const autoKeys = Object.keys(AUTOMOD_LABELS);
    for (let i = 0; i < autoKeys.length; i += 5) rows.push(new ActionRowBuilder().addComponents(...autoKeys.slice(i, i + 5).map(k => button(id(`security_pun_auto_${k}`), `${AUTOMOD_LABELS[k]}: ${config.autoMod[k].punishment}`, ButtonStyle.Primary))));
    for (let i = 0; i < Math.min(10, (config.escalation || []).length); i += 5) rows.push(new ActionRowBuilder().addComponents(...config.escalation.slice(i, i + 5).map(level => button(id(`security_pun_level_${level.strike}`), `#${level.strike}: ${level.action}`, ButtonStyle.Secondary))));
  } else if (panel === 'strikes') {
    rows.push(new ActionRowBuilder().addComponents(button(id('security_back'), '← Back'), button(id('security_strikes_refresh'), '🔄 Refresh', ButtonStyle.Success)));
  } else if (panel === 'whitelist') rows.push(new ActionRowBuilder().addComponents(button(id('security_back'), '← Back'), button(id('security_whitelist_users'), '👤 Manage Users', ButtonStyle.Primary), button(id('security_whitelist_roles'), '🎭 Manage Roles', ButtonStyle.Primary), button(id('security_whitelist_bots'), '🤖 Manage Bots', ButtonStyle.Primary)));
  else if (panel === 'logs') rows.push(new ActionRowBuilder().addComponents(button(id('security_back'), '← Back'), button(id('security_logs_channel'), '📋 Set Log Channel', ButtonStyle.Primary), button(id('security_logs_ignored'), '🚫 Ignored Channels')));
  else rows.push(new ActionRowBuilder().addComponents(button(id('security_back'), '← Back'), button(id('security_settings_toggle'), config.enabled ? '🟢 Disable Protection' : '🔴 Enable Protection', config.enabled ? ButtonStyle.Danger : ButtonStyle.Success), button(id('security_settings_refresh'), '🔄 Refresh')));
  return rows.slice(0, 5);
}

export default {
  category: 'Security',
  slashOnly: true,
  data: new SlashCommandBuilder().setName('security').setDescription('Open the server security dashboard').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString()),
  async execute(interaction, config, client) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'You need Manage Server permission.', flags: MessageFlags.Ephemeral });
    const security = await getSecurityConfig(client, interaction.guildId);
    await interaction.reply({ embeds: [buildSecurityDashboard(security, interaction.guild)], components: buildSecurityControls(interaction.user.id), flags: MessageFlags.Ephemeral });
  },
};