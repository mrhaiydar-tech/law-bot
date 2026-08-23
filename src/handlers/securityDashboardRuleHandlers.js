import { getSecurityConfig, updateSecurityConfig } from '../services/security/securityService.js';
import { ButtonStyle, ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';

const NUKE = ['strip', 'kick', 'ban'];
const AUTO = ['delete', 'timeout', 'kick', 'ban'];
const AUTO_LABELS = { spam: 'Spam', duplicate: 'Duplicate', mentions: 'Mentions', invites: 'Invites', links: 'Links', caps: 'Caps', badWords: 'Bad Words' };
const ok = i => i.customId.split(':').at(-1) === i.user.id;
const deny = i => i.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });
const B = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...b) => new ActionRowBuilder().addComponents(b);
const cycle = (v, list) => list[(list.indexOf(v) + 1) % list.length];
const autoKeys = Object.keys(AUTO_LABELS);

async function autoPage(i, c) {
  const x = await getSecurityConfig(c, i.guildId);
  const rows = [row(B(`punishments_back2:${i.user.id}`, '← Punishments'))];
  for (let n = 0; n < autoKeys.length; n += 4) rows.push(row(...autoKeys.slice(n, n + 4).map(k => B(`auto_pun2:${k}:${i.user.id}`, `${AUTO_LABELS[k]}: ${x.autoMod[k].punishment}`, ButtonStyle.Primary))));
  return i.update({ embeds: [new EmbedBuilder().setTitle('🤖 AutoMod Punishments').setDescription('Every AutoMod rule has an independent punishment. Click a rule to cycle: Delete → Timeout → Kick → Ban.').setColor(0x5865f2)], components: rows });
}

export default [
  { name: 'nuke_rule', execute: async (i, c) => { if (!ok(i)) return deny(i); const key = i.customId.split(':').at(-2); const x = await getSecurityConfig(c, i.guildId); const current = x.antiNuke.punishments[key] || 'strip'; const next = cycle(current, NUKE); await updateSecurityConfig(c, i.guildId, { antiNuke: { punishments: { [key]: next } } }); return i.update({ content: null, embeds: [new EmbedBuilder().setTitle('⚖️ Anti-Nuke Punishment Updated').setDescription(`**${key}** punishment is now **${next}**.`).setColor(0xed4245)], components: [row(B(`security_back2:${i.user.id}`, '← Back'))] }); } },
  { name: 'pun_auto2', execute: async (i, c) => ok(i) ? autoPage(i, c) : deny(i) },
  { name: 'auto_pun2', execute: async (i, c) => { if (!ok(i)) return deny(i); const key = i.customId.split(':').at(-2); const x = await getSecurityConfig(c, i.guildId); const next = cycle(x.autoMod[key].punishment, AUTO); await updateSecurityConfig(c, i.guildId, { autoMod: { [key]: { punishment: next } } }); return autoPage(i, c); } },
];
