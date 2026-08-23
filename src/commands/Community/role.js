import {
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { withErrorHandling } from '../../utils/errorHandler.js';

function canManageRole(interaction, role) {
  const me = interaction.guild.members.me;
  if (!me) return false;
  return role.editable && role.position < me.roles.highest.position;
}

export default {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Manage member roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) => sub
      .setName('add')
      .setDescription('Give a role to a member')
      .addUserOption((opt) => opt
        .setName('user')
        .setDescription('Member')
        .setRequired(true))
      .addRoleOption((opt) => opt
        .setName('role')
        .setDescription('Role to give')
        .setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('remove')
      .setDescription('Remove a role from a member')
      .addUserOption((opt) => opt
        .setName('user')
        .setDescription('Member')
        .setRequired(true))
      .addRoleOption((opt) => opt
        .setName('role')
        .setDescription('Role to remove')
        .setRequired(true))),
  category: 'Moderation',
  execute: withErrorHandling(async (interaction) => {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const user = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('role', true);
    const sub = interaction.options.getSubcommand();
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: 'Member not found.', ephemeral: true });
    }

    if (role.managed) {
      return interaction.reply({ content: 'This role is managed by Discord and cannot be manually assigned.', ephemeral: true });
    }

    if (!canManageRole(interaction, role)) {
      return interaction.reply({ content: 'I cannot manage this role because it is above or equal to my highest role.', ephemeral: true });
    }

    if (sub === 'add') {
      if (member.roles.cache.has(role.id)) {
        return interaction.reply({ content: `${user} already has **${role.name}**.`, ephemeral: true });
      }

      await member.roles.add(role, `Role added by ${interaction.user.tag}`);
      return interaction.reply({
        content: `Added **${role.name}** to ${user}.\nBy: ${interaction.user}`,
      });
    }

    if (!member.roles.cache.has(role.id)) {
      return interaction.reply({ content: `${user} does not have **${role.name}**.`, ephemeral: true });
    }

    await member.roles.remove(role, `Role removed by ${interaction.user.tag}`);
    return interaction.reply({
      content: `Removed **${role.name}** from ${user}.\nBy: ${interaction.user}`,
    });
  }),
};
