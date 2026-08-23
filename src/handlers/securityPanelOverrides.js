import { securityDashboardButtonHandlers } from './securityDashboardHandlers.js';
import securityAutoModDashboard from './securityAutoModDashboard.js';

// Keep old /security panel button IDs compatible with the new dashboard.
const names = new Set([
  'security_panel_nuke',
  'security_panel_raid',
  'security_panel_automod',
  'security_panel_punishments',
  'security_panel_strikes',
  'security_panel_whitelist',
  'security_panel_logs',
  'security_panel_settings',
]);

const target = {
  security_panel_nuke: 'security_panel_nuke2',
  security_panel_raid: 'security_panel_raid2',
  security_panel_automod: 'security_panel_automod2',
  security_panel_punishments: 'security_panel_punishments2',
  security_panel_strikes: 'security_panel_strikes2',
  security_panel_whitelist: 'security_panel_whitelist2',
  security_panel_logs: 'security_panel_logs2',
  security_panel_settings: 'security_panel_settings2',
};

export default [...names].map(name => ({
  name,
  execute: async (interaction, client) => {
    const targetName = target[name];
    const handlers = [...securityDashboardButtonHandlers, ...securityAutoModDashboard];
    const handler = handlers.find(h => h.name === targetName);

    if (!handler) {
      return interaction.reply({
        content: 'Security panel handler unavailable.',
        ephemeral: true,
      });
    }

    const original = interaction.customId;
    interaction.customId = `${targetName}:${interaction.user.id}`;

    try {
      return await handler.execute(interaction, client);
    } finally {
      interaction.customId = original;
    }
  },
}));
