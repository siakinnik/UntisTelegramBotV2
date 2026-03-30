// ---------------------------------
// getHomeworksForWeek.js - getHomeworksForWeek function
// ---------------------------------

// Dependencies
const api = require('webuntis'); // Untis web-api
const decrypt = require('../encrypter/decrypter'); // Decription functions
const { menu } = require("./menu"); // async (lang, chatId, msg) 
const { formatDate } = require("./formatDate"); // (date)

// Main function
const getHomeworksForWeek = async ({
    chatId,
    connection,
    bot,
    userLang,
    dataChannel,
    errChannel,
    school,
    domain,
    currentTimestamp
}) => {
    const [results] = await connection.query(
        `SELECT msgid FROM users WHERE telegramid = ?`,
        [chatId]
    );

    if (!results.length || results[0].msgid === 0) {
        throw new Error('UNTIS_CREDENTIALS_REQUIRED');
    }

    const msgid = results[0].msgid;

    const sentMessage = await bot.sendMessage(
        dataChannel,
        '.',
        { reply_to_message_id: msgid }
    );

    await bot.telegram.deleteMessage(
        dataChannel,
        sentMessage.message_id
    ).catch(() => { });

    const parsedData = JSON.parse(sentMessage.reply_to_message.text);

    let untis;
    try {
        untis = new api.WebUntis(
            school,
            decrypt(parsedData.username),
            decrypt(parsedData.pass),
            domain
        );
        await untis.login();
        await untis.getCurrentSchoolyear();
    } catch (e) {
        bot.sendMessage(chatId, userLang.errors.login, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [menu(userLang)]
            }
        });

        bot.sendMessage(
            errChannel,
            `ERROR login:\nuser: ${chatId}\n${e}`
        );

        await bot.telegram.deleteMessage(dataChannel, msgid).catch(() => { });

        await connection.query(
            `UPDATE users SET msgid = 0 WHERE telegramid = ?`,
            [chatId]
        );

        throw new Error('LOGIN_FAILED');
    }

    const result = await untis.getHomeWorksFor(
        new Date(currentTimestamp),
        new Date(currentTimestamp + 86400000 * 7)
    );

    let data = '';

    result.homeworks.forEach(hw => {
        const lesson = result.lessons.find(
            l => l.id === hw.lessonId
        )?.subject || userLang.homeworks.unknown_lesson;

        data +=
            `${userLang.homeworks.lesson} ${lesson}\n` +
            `${formatDate(hw.date)} - ${formatDate(hw.dueDate)}\n\n` +
            `_${hw.text}_\n` +
            `-----------------------------\n`;
    });

    return data || userLang.homeworks.empty;
};

module.exports = { getHomeworksForWeek };