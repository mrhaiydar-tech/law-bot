import { ChannelType, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addClanMember, createClan, deleteClan, getClan, getClanForUser, getClans, makeClanId, removeClanMember, sanitizeClanName, updateClan } from '../../services/clanService.js';

const clanCommand = new SlashCommandBuilder()
  .setName('clan').setDescription('Manage clans and your clan').setDMPermission(false)
  .addSubcommandGroup((group) => group.setName('admin').setDescription('Administrator clan controls')
    .addSubcommand((sub) => sub.setName('create').setDescription('Create a clan for a user')
      .addUserOption((opt) => opt.setName('owner').setDescription('Clan owner').setRequired(true))
      .addStringOption((opt) => opt.setName('name').setDescription('Clan name').setRequired(true).setMaxLength(50)))
    .addSubcommand((sub) => sub.setName('delete').setDescription('Delete a clan and its channels')
      .addStringOption((opt) => opt.setName('clan_id').setDescription('Clan ID').setRequired(true)))
    .addSubcommand((sub) => sub.setName('list').setDescription('List all clans'))
    .addSubcommand((sub) => sub.setName('info').setDescription('View a clan')
      .addStringOption((opt) => opt.setName('clan_id').setDescription('Clan ID').setRequired(true))))
  .addSubcommand((sub) => sub.setName('info').setDescription('View your clan'))
  .addSubcommand((sub) => sub.setName('members').setDescription('View your clan members'))
  .addSubcommand((sub) => sub.setName('add').setDescription('Add a member to your clan')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to add').setRequired(true)))
  .addSubcommand((sub) => sub.setName('remove').setDescription('Remove a member from your clan')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to remove').setRequired(true)))
  .addSubcommand((sub) => sub.setName('rename').setDescription('Rename your clan')
    .addStringOption((opt) => opt.setName('name').setDescription('New clan name').setRequired(true).setMaxLength(50)));

const adminAllowed = (interaction) => interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

function clanEmbed(clan) {
  return new EmbedBuilder().setTitle(`Clan • ${clan.name}`)
    .addFields(
      { name: 'Clan ID', value: `\`${clan.id}\``, inline: true },
      { name: 'Owner', value: `<@${clan.ownerId}>`, inline: true },
      { name: 'Members', value: `**${clan.memberIds.length + 1}**`, inline: true },
      { name: 'Role', value: `<@&${clan.roleId}>`, inline: true },
      { name: 'Text', value: `<#${clan.textChannelId}>`, inline: true },
      { name: 'Voice', value: `<#${clan.voiceChannelId}>`, inline: true },
    ).setTimestamp();
}

async function createClanResources(interaction, owner, name) {
  const guild = interaction.guild;
  const role = await guild.roles.create({ name: name.slice(0, 100), reason: `Clan created by ${interaction.user.tag}` });
  let category;
  let textChannel;
  let voiceChannel;
  try {
    const overwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
      { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    ];
    category = await guild.channels.create({ name: `Clan • ${name}`.slice(0, 100), type: ChannelType.GuildCategory, permissionOverwrites: overwrites, reason: `Clan category for ${name}` });
    textChannel = await guild.channels.create({ name: 'chat', type: ChannelType.GuildText, parent: category.id, permissionOverwrites: overwrites, reason: `Clan text channel for ${name}` });
    voiceChannel = await guild.channels.create({ name: 'Voice', type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: overwrites, reason: `Clan voice channel for ${name}` });
    await owner.roles.add(role, `Clan owner: ${name}`);
    return { role, category, textChannel, voiceChannel };
  } catch (error) {
    await voiceChannel?.delete().catch(() => {});
    await textChannel?.delete().catch(() => {});
    await category?.delete().catch(() => {});
    await role.delete().catch(() => {});
    throw error;
  }
}

export default {
  data: clanCommand,
  category: 'Community',
  async execute(interaction, config, client) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    try {
      const group = interaction.options.getSubcommandGroup(false);
      const sub = interaction.options.getSubcommand();

      if (group === 'admin') {
        if (!adminAllowed(interaction)) return interaction.reply({ content: 'You need **Manage Server** permission to use clan administration.', ephemeral: true });

        if (sub === 'list') {
          const clans = await getClans(client, interaction.guildId);
          if (!clans.length) return interaction.reply({ content: 'No clans exist in this server.', ephemeral: true });
          return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Server Clans').setDescription(clans.map((item, index) => `${index + 1}. **${item.name}** — <@${item.ownerId}> — \`${item.id}\``).join('\n')).setTimestamp()] });
        }

        if (sub === 'create') {
          const owner = interaction.options.getMember('owner');
          const name = sanitizeClanName(interaction.options.getString('name', true));
          if (!owner || !name) return interaction.reply({ content: 'Invalid clan owner or name.', ephemeral: true });
          const existing = await getClanForUser(client, interaction.guildId, owner.id);
          if (existing) return interaction.reply({ content: `That user already belongs to **${existing.name}**.`, ephemeral: true });
          const clans = await getClans(client, interaction.guildId);
          if (clans.some((clan) => clan.name.toLowerCase() === name.toLowerCase())) return interaction.reply({ content: 'A clan with that name already exists.', ephemeral: true });

          const resources = await createClanResources(interaction, owner, name);
          try {
            const clan = await createClan(client, interaction.guildId, { id: makeClanId(), name, ownerId: owner.id, roleId: resources.role.id, categoryId: resources.category.id, textChannelId: resources.textChannel.id, voiceChannelId: resources.voiceChannel.id, memberIds: [] });
            await resources.textChannel.send(`Welcome to **${name}**!\nOwner: <@${owner.id}>\nUse \`/clan members\` and \`/clan add\` to manage your clan.`).catch(() => {});
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Clan Created').setDescription(`**${name}** has been created for ${owner}.\n\n${resources.textChannel}\n${resources.voiceChannel}\nRole: ${resources.role}\nClan ID: \`${clan.id}\``).setTimestamp()] });
          } catch (error) {
            await resources.voiceChannel.delete().catch(() => {});
            await resources.textChannel.delete().catch(() => {});
            await resources.category.delete().catch(() => {});
            await resources.role.delete().catch(() => {});
            throw error;
          }
        }

        const clanId = interaction.options.getString('clan_id', true);
        const clan = await getClan(client, interaction.guildId, clanId);
        if (!clan) return interaction.reply({ content: 'Clan not found.', ephemeral: true });
        if (sub === 'info') return interaction.reply({ embeds: [clanEmbed(clan)] });
        if (sub === 'delete') {
          for (const channelId of [clan.voiceChannelId, clan.textChannelId, clan.categoryId]) {
            const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            await channel?.delete(`Deleting clan ${clan.name}`).catch(() => {});
          }
          const role = await interaction.guild.roles.fetch(clan.roleId).catch(() => null);
          await role?.delete(`Deleting clan ${clan.name}`).catch(() => {});
          await deleteClan(client, interaction.guildId, clan.id);
          return interaction.reply({ content: `Deleted clan **${clan.name}** and its role/channels.`, ephemeral: true });
        }
      }

      const clan = await getClanForUser(client, interaction.guildId, interaction.user.id);
      if (!clan) return interaction.reply({ content: 'You are not a member of a clan.', ephemeral: true });
      if (sub === 'info') return interaction.reply({ embeds: [clanEmbed(clan)] });

      if (sub === 'members') {
        const ids = [clan.ownerId, ...clan.memberIds];
        const members = await Promise.all(ids.map(async (id) => {
          const member = await interaction.guild.members.fetch(id).catch(() => null);
          return member ? `${member} — ${id === clan.ownerId ? 'Owner' : 'Member'}` : `<@${id}>`;
        }));
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`${clan.name} Members`).setDescription(members.join('\n') || 'No members.').setTimestamp()] });
      }

      if (clan.ownerId !== interaction.user.id) return interaction.reply({ content: 'Only the clan owner can manage members or rename the clan.', ephemeral: true });

      if (sub === 'add') {
        const user = interaction.options.getUser('user', true);
        if (user.bot) return interaction.reply({ content: 'Bots cannot be added to clans.', ephemeral: true });
        const currentClan = await getClanForUser(client, interaction.guildId, user.id);
        if (currentClan) return interaction.reply({ content: `That user already belongs to **${currentClan.name}**.`, ephemeral: true });
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const role = await interaction.guild.roles.fetch(clan.roleId).catch(() => null);
        if (!member || !role) return interaction.reply({ content: 'Could not find the member or clan role.', ephemeral: true });
        await member.roles.add(role, `Added to clan ${clan.name}`);
        await addClanMember(client, interaction.guildId, clan.id, user.id);
        return interaction.reply({ content: `${user} was added to **${clan.name}**.` });
      }

      if (sub === 'remove') {
        const user = interaction.options.getUser('user', true);
        if (user.id === clan.ownerId) return interaction.reply({ content: 'The clan owner cannot be removed.', ephemeral: true });
        if (!clan.memberIds.includes(user.id)) return interaction.reply({ content: 'That user is not in your clan.', ephemeral: true });
        await removeClanMember(client, interaction.guildId, clan.id, user.id);
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const role = await interaction.guild.roles.fetch(clan.roleId).catch(() => null);
        await member?.roles.remove(role).catch(() => {});
        return interaction.reply({ content: `${user} was removed from **${clan.name}**.` });
      }

      if (sub === 'rename') {
        const name = sanitizeClanName(interaction.options.getString('name', true));
        if (!name) return interaction.reply({ content: 'Invalid clan name.', ephemeral: true });
        const clans = await getClans(client, interaction.guildId);
        if (clans.some((item) => item.id !== clan.id && item.name.toLowerCase() === name.toLowerCase())) return interaction.reply({ content: 'A clan with that name already exists.', ephemeral: true });
        await updateClan(client, interaction.guildId, clan.id, { name });
        const role = await interaction.guild.roles.fetch(clan.roleId).catch(() => null);
        await role?.setName(name).catch(() => {});
        const category = await interaction.guild.channels.fetch(clan.categoryId).catch(() => null);
        await category?.setName(`Clan • ${name}`.slice(0, 100)).catch(() => {});
        return interaction.reply({ content: `Your clan has been renamed to **${name}**.` });
      }

      return interaction.reply({ content: 'Unknown clan action.', ephemeral: true });
    } catch (error) {
      return interaction.reply({ content: `Clan operation failed: ${error.message || 'Unknown error'}`, ephemeral: true }).catch(() => {});
    }
  },
};
