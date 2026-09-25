const { Client, GatewayIntentBits } = require('discord.js');
const { DisTube } = require('distube');

// احرص على وجود هذه الـ Intents ليعمل الصوت والرسائل
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// إعداد DisTube
client.distube = new DisTube(client, {
    leaveOnStop: false,
    emitNewSongOnly: true,
});

// الأحداث الخاص بالتشغيل والأخطاء
client.distube.on('playSong', (queue, song) => {
    queue.textChannel.send(`🎶 تم بدء تشغيل: **${song.name}** - \`${song.formattedDuration}\``);
});

client.distube.on('addSong', (queue, song) => {
    queue.textChannel.send(`✅ تم إضافة **${song.name}** إلى قائمة الانتظار.`);
});

client.distube.on('error', (channel, e) => {
    if (channel) channel.send(`❌ حدث خطأ: ${e.message.slice(0, 2000)}`);
    else console.error(e);
});
