import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { setupPartnerPanel, partnerDashboard } from '../../utils/partner.js';

export default {
  data: new SlashCommandBuilder()
    .setName('partner')
    .setDescription('إدارة نظام الشراكات')
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('إعداد نظام الشراكات')
      .addChannelOption(opt => opt
        .setName('announcement_channel')
        .setDescription('الروم الذي سيتم نشر الشراكة المقبولة فيه')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('dashboard')
      .setDescription('فتح لوحة إدارة الشراكات'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'setup') {
      const announcementChannel = interaction.options.getChannel('announcement_channel');
      return setupPartnerPanel(interaction, announcementChannel);
    }
    return partnerDashboard(interaction);
  },
};
