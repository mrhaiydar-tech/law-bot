const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("blacklist")
        .setDescription("Blacklist a user from the server")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("User to blacklist")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for blacklist")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");

        const member = await interaction.guild.members.fetch(user.id)
            .catch(() => null);

        if (!member) {
            return interaction.reply({
                content: "❌ User is not in this server.",
                ephemeral: true
            });
        }

        await member.ban({
            reason: `Blacklisted: ${reason}`
        });

        const embed = new EmbedBuilder()
            .setTitle("🚫 User Blacklisted")
            .setDescription(
                `**User:** ${user.tag}\n` +
                `**Reason:** ${reason}\n` +
                `**Moderator:** ${interaction.user.tag}`
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });
    }
};
