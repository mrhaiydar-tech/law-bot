import { Events, PermissionFlagsBits } from 'discord.js';
import express from 'express';
import { registerSecurityDashboard } from '../services/security/securityDashboard.js';
import { logger, startupLog } from '../utils/logger.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    try {
      const server = client.webServer;
      const app = server?.listeners('request')?.[0];
      if (typeof app !== 'function') {
        logger.warn('Security dashboard could not attach: Express app was not found.');
      } else {
        app.use(express.json({ limit: '128kb' }));
        registerSecurityDashboard(app, client);
      }

      for (const guild of client.guilds.cache.values()) {
        const me = guild.members.me;
        const permissions = me?.permissions;
        if (!permissions) continue;

        const required = [
          [PermissionFlagsBits.ViewAuditLog, 'View Audit Log'],
          [PermissionFlagsBits.ManageChannels, 'Manage Channels'],
          [PermissionFlagsBits.ManageRoles, 'Manage Roles'],
          [PermissionFlagsBits.ManageWebhooks, 'Manage Webhooks'],
          [PermissionFlagsBits.KickMembers, 'Kick Members'],
          [PermissionFlagsBits.BanMembers, 'Ban Members'],
          [PermissionFlagsBits.ModerateMembers, 'Moderate Members'],
        ];
        const missing = required.filter(([bit]) => !permissions.has(bit)).map(([, name]) => name);
        if (missing.length) {
          logger.warn(`Security permissions missing in ${guild.name}: ${missing.join(', ')}`);
        } else {
          startupLog(`Security permissions OK in ${guild.name}`);
        }
      }

      if (!process.env.SECURITY_DASHBOARD_TOKEN) {
        logger.warn('SECURITY_DASHBOARD_TOKEN is not configured; /security will be inaccessible.');
      } else {
        startupLog('Security dashboard enabled at /security');
      }
    } catch (error) {
      logger.error('Failed to initialize security dashboard:', error);
    }
  },
};
