import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import { getSecurityConfig, isWhitelisted, sendSecurityLog } from './securityService.js';
import { logger } from '../../utils/logger.js';

const counters = new Map();
const EVENT_MAP = {
  channelDelete: AuditLogEvent.ChannelDelete,
  channelCreate: AuditLogEvent.ChannelCreate,
  roleDelete: AuditLogEvent.RoleDelete,
  roleCreate: AuditLogEvent.RoleCreate,
  roleUpdate: AuditLogEvent.RoleUpdate,
  webhookUpdate: [AuditLogEvent.WebhookCreate, AuditLogEvent.WebhookUpdate, AuditLogEvent.WebhookDelete],
  webhookDelete: AuditLogEvent.WebhookDelete,
  ban: AuditLogEvent.MemberBanAdd,
  kick: AuditLogEvent.MemberKick,
  botAdd: AuditLogEvent.BotAdd,
};
function key(guildId, executorId, type) { return `${guildId}:${executorId}:${type}`; }
function getRecentCount(store, mapKey, now, windowMs) {
  const existing = store.get(mapKey) || [];
  return existing.filter(timestamp => now - timestamp <= windowMs);
}

async function findExecutor(guild, auditType, targetId = null) {
  const types = Array.isArray(auditType) ? auditType : [auditType];
  const entries = [];
  for (const type of types) {
    const logs = await guild.fetchAuditLogs({ type, limit: 10 }).catch(() => null);
    if (!logs?.entries) continue;
    for (const entry of logs.entries.values()) {
      if (Date.now() - entry.createdTimestamp > 15000) continue;
      if (targetId && entry.target?.id !== targetId && entry.targetId !== targetId) continue;
      entries.push(entry);
    }
  }
  entries.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  return entries[0]?.executor || null;
}

async function stripDangerousRoles(member, reason) {
  if (!member.manageable) return false;
  const removable = member.roles.cache.filter(role => {
    if (role.id === member.guild.id || !role.editable) return false;
    return role.permissions.any([
      PermissionFlagsBits.Administrator,
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ManageWebhooks,
    ]);
  });
  if (!removable.size) return false;
  await member.roles.remove(removable, `Anti-Nuke: ${reason}`).catch(() => {});
  return true;
}

async function punishExecutor(guild, executor, config, type, reason, targetId) {
  const member = await guild.members.fetch(executor.id).catch(() => null);
  if (!member || member.id === guild.ownerId || isWhitelisted(member, config)) return false;

  const action = config.antiNuke.punishments?.[type] || config.antiNuke.action || 'strip';
  let actionTaken = action;
  if (action === 'ban' && member.bannable) await member.ban({ reason: `Anti-Nuke: ${reason}` }).catch(() => {});
  else if (action === 'kick' && member.kickable) await member.kick(`Anti-Nuke: ${reason}`).catch(() => {});
  else if (action === 'timeout' && member.moderatable) await member.timeout(10 * 60 * 1000, `Anti-Nuke: ${reason}`).catch(() => {});
  else if (action === 'strip') {
    const stripped = await stripDangerousRoles(member, reason);
    actionTaken = stripped ? 'strip' : 'none';
  }

  if (type === 'botAdd' && targetId) {
    const bot = await guild.members.fetch(targetId).catch(() => null);
    if (bot?.user?.bot && bot.kickable && bot.id !== guild.client.user?.id) await bot.kick('Anti-Nuke: unauthorized bot addition').catch(() => {});
  }

  await sendSecurityLog(guild.client, guild, {
    title: 'Anti-Nuke Triggered',
    description: `**${executor.tag || executor.username}** triggered Anti-Nuke protection.`,
    fields: [
      { name: 'Operation', value: type, inline: true },
      { name: 'Reason', value: reason.slice(0, 1024), inline: true },
      { name: 'Action', value: actionTaken, inline: true },
      { name: 'Executor', value: executor.id, inline: true },
    ],
  });
  return true;
}

export async function handleAntiNuke(guild, type, targetId = null) {
  const config = await getSecurityConfig(guild.client, guild.id);
  if (!config.enabled || !config.antiNuke.enabled) return;
  const auditType = EVENT_MAP[type];
  const threshold = Number(config.antiNuke.thresholds?.[type] || 0);
  if (!auditType || threshold <= 0) return;

  const auditTargetId = type.startsWith('webhook') ? null : targetId;
  const executor = await findExecutor(guild, auditType, auditTargetId);
  if (!executor || executor.id === guild.client.user?.id) return;
  const member = await guild.members.fetch(executor.id).catch(() => null);
  if (!member || member.id === guild.ownerId || isWhitelisted(member, config)) return;

  const now = Date.now();
  const counterKey = key(guild.id, executor.id, type);
  const recent = getRecentCount(counters, counterKey, now, config.antiNuke.windowMs);
  recent.push(now);
  counters.set(counterKey, recent);
  if (recent.length >= threshold) {
    await punishExecutor(guild, executor, config, type, `${type} threshold exceeded (${recent.length}/${threshold})`, targetId);
    counters.delete(counterKey);
  }
}

export function registerAntiNukeEvent(eventName, type) {
  return {
    name: eventName,
    async execute(eventTarget) {
      const guild = eventTarget?.guild || eventTarget;
      const targetId = eventTarget?.id || null;
      if (!guild?.id) return;
      try { await handleAntiNuke(guild, type, targetId); }
      catch (error) { logger.error(`Anti-Nuke ${type} failed`, { error: error.message, guildId: guild.id }); }
    },
  };
}
