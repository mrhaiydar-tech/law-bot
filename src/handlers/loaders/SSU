import {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('session')
        .setDescription('Start a Washington State Roleplay session.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🦅 | SESSION STARTED')
            .setDescription(
                '**Washington State Roleplay** is now hosting a session!\n\n' +
                '🎮 **Game Code:** `WSSRPe`\n' +
                '👥 **Join the session and begin roleplay!**\n\n' +
                'Please maintain professionalism and follow all community rules during the session.'
            )
            .setTimestamp()
            .setFooter({
                text: 'Washington State Roleplay'
            });

        await interaction.reply({
            content: '@here',
            embeds: [embed],
            allowedMentions: {
                parse: ['everyone']
            }
        });
    }
};
