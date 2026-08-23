import { buildSecurityDashboard, buildSecurityControls } from '../commands/Security/security.js';
import { getSecurityConfig } from '../services/security/securityService.js';
import securityAutoModDashboard from './securityAutoModDashboard.js';

const ok = interaction => interaction.customId.split(':').at(-1) === interaction.user.id;
const deny = interaction => interaction.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });

async function main(interaction, client) {
  if (!ok(interaction)) return deny(interaction);
  const config = await getSecurityConfig(client, interaction.guildId);
  return interaction.update({
    embeds: [buildSecurityDashboard(config, interaction.guild)],
    components: buildSecurityControls(interaction.user.id),
  });
}

async function automod(interaction, client) {
  if (!ok(interaction)) return deny(interaction);
  const handler = securityAutoModDashboard.find(h => h.name === 'security_panel_automod2');
  if (!handler) return interaction.reply({ content: 'AutoMod handler unavailable.', ephemeral: true });
  const original = interaction.customId;
  interaction.customId = `security_panel_automod2:${interaction.user.id}`;
  try {
    return await handler.execute(interaction, client);
  } finally {
    interaction.customId = original;
  }
}

export default [
  { name: 'security_panel_automod', execute: automod },
  { name: 'security_main2', execute: main },
  { name: 'security_back2', execute: main },
  { name: 'security_back', execute: main },
  { name: 'security_refresh', execute: main },
];
