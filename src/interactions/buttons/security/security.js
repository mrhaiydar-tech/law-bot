import securityDashboardOverrides from '../../../handlers/securityDashboardOverrides.js';
import { securityDashboardButtonHandlers } from '../../../handlers/securityDashboardCore.js';
import securityDashboardRuleHandlers from '../../../handlers/securityDashboardRuleHandlers.js';
import securityAutoModDashboard from '../../../handlers/securityAutoModDashboard.js';
import securityDashboardFixes from '../../../handlers/securityDashboardFixes.js';
import securityFinalOverrides from './securityFinalOverrides.js';
import securityStrikeCompatibility from './securityStrikeCompatibility.js';

// Keep the Security handlers in one deterministic registration point.
// The final override/compatibility handlers intentionally come last so legacy
// dashboard buttons cannot replace the current handlers.
export default [
  ...securityDashboardOverrides,
  ...securityDashboardButtonHandlers,
  ...securityDashboardRuleHandlers,
  ...securityAutoModDashboard,
  ...securityDashboardFixes,
  ...securityFinalOverrides,
  ...securityStrikeCompatibility,
];
