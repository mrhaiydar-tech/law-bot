const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("blacklist")
        .setDescription("Blacklist a community member")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Select the member to blacklist")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for blacklist")
                .setRequired(true)
        ),

    async execute(interaction) {

        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({
                content: "❌ You do not have permission to use this command.",
                ephemeral: true
            });
        }

        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");

        const member = await interaction.guild.members.fetch(user.id)
            .catch(() => null);

        if (!member) {
            return interaction.reply({
                content: "❌ Member not found.",
                ephemeral: true
            });
        }

        await member.ban({
            reason: reason
        });

        const embed = new EmbedBuilder()
            .setTitle("🚫 Member Blacklisted")
            .setDescription(
                `**Member:** ${user.tag}\n` +
                `**Reason:** ${reason}\n` +
                `**Action by:** ${interaction.user.tag}`
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });
    }
};
