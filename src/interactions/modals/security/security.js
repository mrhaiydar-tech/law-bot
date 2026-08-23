import { securityModalHandlers } from '../../../handlers/securityHandlers.js';
import { securityAdvancedModalHandlers } from '../../../handlers/securityAdvancedHandlers.js';
import { securityDashboardModalHandlers } from '../../../handlers/securityDashboardHandlers.js';
import securityDashboardFixes from '../../../handlers/securityDashboardFixes.js';
import { getSecurityConfig, updateSecurityConfig } from '../../../services/security/securityService.js';

const ok = i => i.customId.split(':').at(-1) === i.user.id;
const deny = i => i.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });

function parseIds(value) {
  return [...new Set(String(value || '').split(/[\s,\n]+/).map(part => part.match(/\d{15,25}/)?.[0]).filter(Boolean))].slice(0, 100);
}

async function saveWhitelist(interaction, client, type) {
  if (!ok(interaction)) return deny(interaction);
  const ids = parseIds(interaction.fields.getTextInputValue('value'));
  const config = await getSecurityConfig(client, interaction.guildId);
  const whitelist = {
    users: Array.isArray(config.whitelist?.users) ? config.whitelist.users.map(String) : [],
    roles: Array.isArray(config.whitelist?.roles) ? config.whitelist.roles.map(String) : [],
    bots: Array.isArray(config.whitelist?.bots) ? config.whitelist.bots.map(String) : [],
  };
  whitelist[type] = ids;
  await updateSecurityConfig(client, interaction.guildId, { whitelist });
  return interaction.reply({ content: `Whitelist updated successfully. **${ids.length}** ${type} entr${ids.length === 1 ? 'y' : 'ies'} saved.`, ephemeral: true });
}

export default [
  ...securityModalHandlers,
  ...securityAdvancedModalHandlers,
  ...securityDashboardModalHandlers,
  ...securityDashboardFixes.filter(h => h.name.endsWith('_modal')),
  { name: 'security_final_wl_users', execute: (i, c) => saveWhitelist(i, c, 'users') },
  { name: 'security_final_wl_roles', execute: (i, c) => saveWhitelist(i, c, 'roles') },
  { name: 'security_final_wl_bots', execute: (i, c) => saveWhitelist(i, c, 'bots') },
  { name: 'security_whitelist_users_modal', execute: (i, c) => saveWhitelist(i, c, 'users') },
  { name: 'security_whitelist_roles_modal', execute: (i, c) => saveWhitelist(i, c, 'roles') },
  { name: 'security_whitelist_bots_modal', execute: (i, c) => saveWhitelist(i, c, 'bots') },
  { name: 'security_whitelist_user_modal', execute: (i, c) => saveWhitelist(i, c, 'users') },
  { name: 'security_whitelist_role_modal', execute: (i, c) => saveWhitelist(i, c, 'roles') },
  { name: 'security_whitelist_bot_modal', execute: (i, c) => saveWhitelist(i, c, 'bots') },
];