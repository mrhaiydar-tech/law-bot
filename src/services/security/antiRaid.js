import { PermissionFlagsBits } from 'discord.js';
import { getSecurityConfig, isWhitelisted, sendSecurityLog } from './securityService.js';

const joins = new Map();
const lockdowns = new Map();

async function restoreLockdown(guild, state) {
  if (!state) return;
  for (const [channelId, previous] of state.channels) {
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.permissionOverwrites?.edit) continue;
    const everyoneId = guild.roles.everyone.id;
    const current = channel.permissionOverwrites.cache.get(everyoneId);
    if (!previous) { if (current) await current.delete('Anti-Raid lockdown ended').catch(() => {}); continue; }
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: previous.sendMessages }, { reason: 'Anti-Raid lockdown ended' }).catch(() => {});
  }
}

async function startLockdown(guild, config) {
  if (lockdowns.has(guild.id)) return;
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) return;
  const state = { expiresAt: Date.now() + config.antiRaid.lockdownMs, channels: new Map() };
  for (const channel of guild.channels.cache.values()) {
    if (!channel.permissionOverwrites?.edit || channel.isThread?.()) continue;
    const overwrite = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
    state.channels.set(channel.id, { sendMessages: overwrite?.deny?.has(PermissionFlagsBits.SendMessages) ? false : overwrite?.allow?.has(PermissionFlagsBits.SendMessages) ? true : null });
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }, { reason: 'Anti-Raid lockdown' }).catch(() => {});
  }
  lockdowns.set(guild.id, state);
  const timer = setTimeout(async () => {
    const current = lockdowns.get(guild.id);
    if (current !== state) return;
    lockdowns.delete(guild.id);
    await restoreLockdown(guild, state);
    await sendSecurityLog(guild.client, guild, { title: 'Anti-Raid Lockdown Ended', description: 'The temporary raid lockdown has ended and previous channel permissions were restored.', color: 0x57F287 });
  }, Math.max(1000, config.antiRaid.lockdownMs));
  timer.unref?.();
}

async function punishMember(member, action, reason, timeoutMs) {
  if (action === 'ban' && member.bannable) await member.ban({ reason: `Anti-Raid: ${reason}` }).catch(() => {});
  else if (action === 'kick' && member.kickable) await member.kick(`Anti-Raid: ${reason}`).catch(() => {});
  else if (action === 'timeout' && member.moderatable) await member.timeout(Math.min(Math.max(timeoutMs || 600000, 1000), 2419200000), `Anti-Raid: ${reason}`).catch(() => {});
}

export async function handleMemberJoin(member) {
  const guild = member.guild;
  const client = guild.client;
  const config = await getSecurityConfig(client, guild.id);
  if (!config.enabled || !config.antiRaid.enabled || isWhitelisted(member, config)) return;

  const now = Date.now();
  const list = (joins.get(guild.id) || []).filter(t => now - t <= config.antiRaid.windowMs);
  list.push(now);
  joins.set(guild.id, list);

  const accountTooNew = now - member.user.createdTimestamp < config.antiRaid.minAccountAgeMs;
  const raidDetected = list.length >= config.antiRaid.joins;
  if (raidDetected || accountTooNew) {
    const reason = raidDetected ? 'raid detected' : 'new account';
    const action = config.antiRaid.punishment || config.antiRaid.action || 'timeout';
    await punishMember(member, action, reason, config.antiRaid.timeoutMs);
    await sendSecurityLog(client, guild, {
      title: raidDetected ? 'Raid Detected' : 'New Account Protection',
      description: `${member} was flagged by Anti-Raid.`,
      fields: [
        { name: 'Account Age', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Joins in Window', value: String(list.length), inline: true },
        { name: 'Punishment', value: action, inline: true },
      ],
    });
  }

  if (raidDetected && config.antiRaid.lockdown) await startLockdown(guild, config);
}

export async function clearRaidLockdown(guild) {
  const state = lockdowns.get(guild.id);
  if (!state) return false;
  lockdowns.delete(guild.id);
  await restoreLockdown(guild, state);
  return true;
}
export function isRaidLockdownActive(guildId) {
  const state = lockdowns.get(guildId);
  return Boolean(state && state.expiresAt > Date.now());
}
