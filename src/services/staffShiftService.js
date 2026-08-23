import { getFromDb, setInDb } from '../utils/database.js';

const key = (guildId) => `guild:${guildId}:staff-shifts`;

const DEFAULTS = {
  config: { minimumHours: 0 },
  active: {},
  history: {},
};

function normalize(data) {
  const value = data && typeof data === 'object' ? data : {};
  return {
    config: { ...DEFAULTS.config, ...(value.config || {}) },
    active: value.active && typeof value.active === 'object' ? value.active : {},
    history: value.history && typeof value.history === 'object' ? value.history : {},
  };
}

async function getData(guildId) {
  return normalize(await getFromDb(key(guildId), DEFAULTS));
}

async function saveData(guildId, data) {
  const normalized = normalize(data);
  await setInDb(key(guildId), normalized);
  return normalized;
}

export async function getShiftData(guildId) {
  return getData(guildId);
}

export async function updateShiftConfig(guildId, patch) {
  const data = await getData(guildId);
  data.config = { ...data.config, ...patch };
  return saveData(guildId, data);
}

export async function getActiveShift(guildId, userId) {
  const data = await getData(guildId);
  return data.active[userId] || null;
}

export async function startShift(guildId, userId) {
  const data = await getData(guildId);
  if (data.active[userId]) return { started: false, reason: 'already_active', shift: data.active[userId] };

  const shift = {
    id: `shift_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: String(userId),
    startedAt: new Date().toISOString(),
  };
  data.active[userId] = shift;
  await saveData(guildId, data);
  return { started: true, shift };
}

export async function stopShift(guildId, userId) {
  const data = await getData(guildId);
  const active = data.active[userId];
  if (!active) return { stopped: false, reason: 'not_active' };

  const endedAt = new Date();
  const startedAt = new Date(active.startedAt);
  const durationMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
  const durationHours = durationMs / 3600000;
  const record = {
    ...active,
    endedAt: endedAt.toISOString(),
    durationMs,
    durationHours: Number(durationHours.toFixed(4)),
  };

  delete data.active[userId];
  data.history[userId] = Array.isArray(data.history[userId]) ? data.history[userId] : [];
  data.history[userId].push(record);
  if (data.history[userId].length > 500) data.history[userId] = data.history[userId].slice(-500);
  await saveData(guildId, data);
  return { stopped: true, shift: record };
}

export async function getShiftHistory(guildId, userId, limit = 10) {
  const data = await getData(guildId);
  const history = Array.isArray(data.history[userId]) ? data.history[userId] : [];
  return history.slice(-Math.max(1, Math.min(50, Number(limit) || 10))).reverse();
}

export function getShiftStats(data, userId) {
  const history = Array.isArray(data?.history?.[userId]) ? data.history[userId] : [];
  const active = data?.active?.[userId] || null;
  const completedMs = history.reduce((sum, shift) => sum + Number(shift.durationMs || 0), 0);
  const activeMs = active ? Math.max(0, Date.now() - new Date(active.startedAt).getTime()) : 0;
  const totalMs = completedMs + activeMs;
  return {
    shiftCount: history.length,
    completedHours: completedMs / 3600000,
    activeHours: activeMs / 3600000,
    totalHours: totalMs / 3600000,
    active,
    lastShift: history.at(-1) || null,
  };
}

export function getShiftLeaderboard(data, limit = 10) {
  const userIds = new Set([
    ...Object.keys(data?.history || {}),
    ...Object.keys(data?.active || {}),
  ]);
  return [...userIds]
    .map((userId) => ({ userId, stats: getShiftStats(data, userId) }))
    .sort((a, b) => b.stats.totalHours - a.stats.totalHours)
    .slice(0, Math.max(1, Math.min(25, Number(limit) || 10)));
}

export function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(Number(ms || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}
