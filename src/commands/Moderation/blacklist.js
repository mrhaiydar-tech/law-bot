commands/moderation/blacklist.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("blacklist")
        .setDescription("Blacklist a member from the server")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member to blacklist")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for blacklist")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {

        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");

    const member = await interaction.guild.members.fetch(user.id)
            .catch(() => null);

        if (!member) {
            return interaction.reply({
                content: "❌ That user is not in this server.",
                ephemeral: true
            });
        }

        if (!member.bannable) {
            return interaction.reply({
                content: "❌ I cannot blacklist this user. Check my role position and permissions.",
                ephemeral: true
            });
        }

        await member.ban({
            reason: `Blacklisted by ${interaction.user.tag}: ${reason}`
        });

        const embed = new EmbedBuilder()
            .setTitle("🚫 Member Blacklisted")
            .addFields(
                {
                    name: "Member",
                    value: `${user.tag}`
                },
                {
                    name: "Reason",
                    value: reason
                },
                {
                    name: "Staff",
                    value: `${interaction.user.tag}`
                }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });
    }
};
