import { getPartnerData, savePartnerData, applicationEmbed, applicationButtons } from '../../utils/partner.js';

export default {
  name: 'partner_apply_modal',
  async execute(interaction, client) {
    const server = interaction.fields.getTextInputValue('server_name').trim();
    const invite = interaction.fields.getTextInputValue('invite').trim();
    const membersRaw = interaction.fields.getTextInputValue('members').trim();
    const description = interaction.fields.getTextInputValue('description').trim();
    const members = Number(membersRaw.replace(/[^0-9]/g, ''));
    if (!server || !description || !Number.isFinite(members)) return interaction.reply({ content: '❌ تأكد من تعبئة جميع بيانات الطلب بشكل صحيح.', ephemeral: true });
    const data = await getPartnerData(client, interaction.guildId);
    if (data.requirements.requireInvite && !/^https?:\/\/discord(?:\.gg|\.com\/invite)\//i.test(invite)) return interaction.reply({ content: '❌ أرسل رابط دعوة صالح لسيرفرك.', ephemeral: true });
    if (members < data.requirements.minMembers) return interaction.reply({ content: `❌ يجب أن يحتوي سيرفرك على ${data.requirements.minMembers} عضوًا على الأقل.`, ephemeral: true });
    const duplicate = data.applications.find(a => a.applicantId === interaction.user.id && a.status === 'pending');
    if (duplicate) return interaction.reply({ content: `❌ لديك طلب شراكة معلق بالفعل (#${duplicate.id}).`, ephemeral: true });

    data.counter += 1;
    const app = { id: data.counter, serverName: server, invite, members, description, applicantId: interaction.user.id, status: 'pending', createdAt: new Date().toISOString(), messageId: null };
    const target = interaction.guild.channels.cache.get(data.requestChannelId);
    if (!target) return interaction.reply({ content: '❌ روم طلبات الشراكة غير موجود. شغّل `/partner setup` مرة أخرى.', ephemeral: true });
    const message = await target.send({ embeds: [applicationEmbed(app)], components: applicationButtons(app) });
    app.messageId = message.id;
    data.applications.push(app);
    await savePartnerData(client, interaction.guildId, data);
    return interaction.reply({ content: `✅ تم إرسال طلب الشراكة #${app.id} بنجاح.`, ephemeral: true });
  },
};
