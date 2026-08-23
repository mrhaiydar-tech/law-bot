import { logger } from '../utils/logger.js';

const CLAN_KEY_PREFIX = 'clans:';

function key(guildId) {
  return `${CLAN_KEY_PREFIX}${guildId}`;
}

function normalizeClan(clan) {
  return {
    id: String(clan.id),
    name: String(clan.name),
    ownerId: String(clan.ownerId),
    roleId: String(clan.roleId),
    categoryId: String(clan.categoryId),
    textChannelId: String(clan.textChannelId),
    voiceChannelId: String(clan.voiceChannelId),
    memberIds: Array.from(new Set((clan.memberIds || []).map(String))),
    createdAt: clan.createdAt || new Date().toISOString(),
  };
}

export async function getClans(client, guildId) {
  const data = await client.db.get(key(guildId), { clans: [] });
  return Array.isArray(data?.clans) ? data.clans.map(normalizeClan) : [];
}

async function saveClans(client, guildId, clans) {
  await client.db.set(key(guildId), { clans });
  return clans;
}

export async function getClan(client, guildId, clanId) {
  const clans = await getClans(client, guildId);
  return clans.find((clan) => clan.id === clanId) || null;
}

export async function getClanForUser(client, guildId, userId) {
  const clans = await getClans(client, guildId);
  return clans.find((clan) => clan.ownerId === userId || clan.memberIds.includes(userId)) || null;
}

export async function createClan(client, guildId, clan) {
  const clans = await getClans(client, guildId);
  if (clans.some((item) => item.name.toLowerCase() === clan.name.toLowerCase())) {
    throw new Error('A clan with this name already exists.');
  }
  if (clans.some((item) => item.ownerId === clan.ownerId)) {
    throw new Error('This user already owns a clan.');
  }

  const normalized = normalizeClan(clan);
  clans.push(normalized);
  await saveClans(client, guildId, clans);
  return normalized;
}

export async function updateClan(client, guildId, clanId, updates) {
  const clans = await getClans(client, guildId);
  const index = clans.findIndex((clan) => clan.id === clanId);
  if (index === -1) throw new Error('Clan not found.');

  const updated = normalizeClan({ ...clans[index], ...updates });
  clans[index] = updated;
  await saveClans(client, guildId, clans);
  return updated;
}

export async function deleteClan(client, guildId, clanId) {
  const clans = await getClans(client, guildId);
  const filtered = clans.filter((clan) => clan.id !== clanId);
  if (filtered.length === clans.length) throw new Error('Clan not found.');
  await saveClans(client, guildId, filtered);
  return true;
}

export async function addClanMember(client, guildId, clanId, userId) {
  const clan = await getClan(client, guildId, clanId);
  if (!clan) throw new Error('Clan not found.');
  if (!clan.memberIds.includes(userId)) clan.memberIds.push(userId);
  return updateClan(client, guildId, clanId, { memberIds: clan.memberIds });
}

export async function removeClanMember(client, guildId, clanId, userId) {
  const clan = await getClan(client, guildId, clanId);
  if (!clan) throw new Error('Clan not found.');
  return updateClan(client, guildId, clanId, {
    memberIds: clan.memberIds.filter((id) => id !== userId),
  });
}

export function makeClanId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sanitizeClanName(name) {
  return String(name || '')
    .normalize('NFKC')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[@#:`]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 50);
}

export function clanLoggerError(context, error) {
  logger.error(`Clan system error (${context}):`, error);
}
