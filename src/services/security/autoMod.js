import { getSecurityConfig, isWhitelisted, addStrike, sendSecurityLog } from './securityService.js';

const userMessages = new Map();
const duplicates = new Map();
const inviteRegex = /(discord\.gg|discord(?:app)?\.com\/invite)\/[^\s]+/i;
const urlRegex = /https?:\/\/[^\s]+/i;
const repeatedCharRegex = /(.)\1{8,}/u;

function getState(map, key) {
  if (!map.has(key)) map.set(key, []);
  return map.get(key);
}

function detect(message, config) {
  const text = message.content || '';
  const reasons = [];
  const now = Date.now();
  const key = `${message.guild.id}:${message.author.id}`;

  if (config.autoMod.spam.enabled) {
    const list = getState(userMessages, key).filter(t => now - t <= config.autoMod.spam.windowMs);
    list.push(now);
    userMessages.set(key, list);
    if (list.length >= config.autoMod.spam.maxMessages) reasons.push({ type: 'spam', reason: `message spam (${config.autoMod.spam.maxMessages}/${Math.round(config.autoMod.spam.windowMs / 1000)}s)` });
  }

  const normalized = text.trim().slice(0, 500).toLowerCase();
  if (config.autoMod.duplicate.enabled && normalized) {
    const list = getState(duplicates, key).filter(x => now - x.time <= config.autoMod.duplicate.windowMs);
    list.push({ text: normalized, time: now });
    duplicates.set(key, list);
    if (list.filter(x => x.text === normalized).length >= config.autoMod.duplicate.maxRepeats) reasons.push({ type: 'duplicate', reason: `duplicate spam (${config.autoMod.duplicate.maxRepeats})` });
  }

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (config.autoMod.mentions.enabled && mentionCount >= config.autoMod.mentions.max) reasons.push({ type: 'mentions', reason: `mention spam (${mentionCount})` });
  if (config.autoMod.mentions.enabled && (message.mentions.everyone || /@(everyone|here)/i.test(text))) reasons.push({ type: 'mentions', reason: 'everyone/here mention' });
  if (config.autoMod.invites.enabled && inviteRegex.test(text)) reasons.push({ type: 'invites', reason: 'Discord invite link' });
  if (config.autoMod.links.enabled && urlRegex.test(text)) reasons.push({ type: 'links', reason: 'external link' });
  if (config.autoMod.badWords.enabled && config.autoMod.badWords.words.some(word => {
    const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|\\s)${escaped}(?=$|\\s|[.!?,])`, 'i').test(text);
  })) reasons.push({ type: 'badWords', reason: 'blocked word' });
  if (repeatedCharRegex.test(text)) reasons.push({ type: 'spam', reason: 'character spam' });

  if (config.autoMod.caps.enabled) {
    const letters = text.match(/[A-Za-z]/g) || [];
    const upper = text.match(/[A-Z]/g) || [];
    if (letters.length >= config.autoMod.caps.minLength && upper.length / letters.length >= config.autoMod.caps.ratio) reasons.push({ type: 'caps', reason: 'excessive caps' });
  }

  const seen = new Set();
  return reasons.filter(item => !seen.has(item.type) && seen.add(item.type));
}

async function executeAction(message, action, duration, reason, strike) {
  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  const config = await getSecurityConfig(message.client, message.guild.id);

  // Whitelist is an absolute bypass: no deletion, timeout, kick, ban, or warning.
  if (!member || isWhitelisted(member, config)) return false;

  const deleted = await message.delete().then(() => true).catch(() => false);

  if (action === 'timeout' && member.moderatable) await member.timeout(Math.min(Math.max(duration || 60000, 1000), 2419200000), `AutoMod: ${reason}`).catch(() => {});
  else if (action === 'kick' && member.kickable) await member.kick(`AutoMod: ${reason}`).catch(() => {});
  else if (action === 'ban' && member.bannable) await member.ban({ reason: `AutoMod: ${reason}` }).catch(() => {});

  await sendSecurityLog(message.client, message.guild, {
    title: 'AutoMod Action',
    description: `${message.author} triggered AutoMod.`,
    fields: [
      { name: 'Rule', value: reason.split(':')[0].slice(0, 100), inline: true },
      { name: 'Reason', value: reason.slice(0, 900), inline: true },
      { name: 'Strike', value: String(strike.count), inline: true },
      { name: 'Action', value: action, inline: true },
      { name: 'Message Deleted', value: deleted ? 'Yes' : 'No', inline: true },
    ],
  });
  return true;
}

export async function handleAutoMod(message) {
  if (!message.guild || message.author.bot) return false;
  const config = await getSecurityConfig(message.client, message.guild.id);
  if (!config.enabled || !config.autoMod.enabled || config.ignoredChannels?.includes(message.channel.id)) return false;

  const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member || member.id === message.guild.ownerId || isWhitelisted(member, config)) return false;

  const violations = detect(message, config);
  if (!violations.length) return false;

  // Re-check immediately before changing strike state in case the whitelist was changed during detection.
  const latestConfig = await getSecurityConfig(message.client, message.guild.id);
  const latestMember = await message.guild.members.fetch(message.author.id).catch(() => member);
  if (!latestMember || latestMember.id === message.guild.ownerId || isWhitelisted(latestMember, latestConfig)) return false;

  const primary = violations[0];
  const reason = violations.map(v => `${v.type}: ${v.reason}`).join(', ');
  const strike = await addStrike(message.client, message.guild.id, message.author.id, reason);
  const rule = latestConfig.autoMod[primary.type] || {};
  const baseAction = rule.punishment || latestConfig.autoMod.action || 'delete';
  const escalation = strike.count > 1 ? latestConfig.escalation?.find(item => item.strike === strike.count) : null;
  const action = escalation?.action || baseAction;
  const duration = escalation?.durationMs || rule.timeoutMs || 60000;

  await executeAction(message, action, duration, reason, strike);
  return true;
}
