// -------------------------------
// index.js - main file in Untis Telegram Bot by siakinnik
// -------------------------------

// Dependencies
const { initConfig } = require("./utils/initConfig"); // Creates config file if not exists
initConfig();
const api = require('webuntis'); // Untis web-api
const createConn = require('./db'); // MySQL-like sqlite wrapper
const encrypt = require('./encrypter/encrypter'); // Encryption function
const decrypt = require('./encrypter/decrypter'); // Decription functions
const bot = require('./utils/bot'); // Telegram bot(Telegraf bot with some node-telegram-bot-api functions)
// const cron = require('node-cron'); // Timers
const { GoogleGenAI } = require('@google/genai'); // Gemeni
const logger = require("./utils/Logger"); // Custom Logger

// Constants
const {
    owner,
    dataChannel,
    errChannel,
    school,
    domain,
    apiKey,
    onlyOwner,
    ownerAiLimit,
    userAiLimit,
    aiInstruction,
    model
} = require('./config');
const ru = require('./locales/ru.json'); // Russian language package
const en = require('./locales/en.json'); // English language package
const de = require('./locales/de.json'); // German language package

const ai = new GoogleGenAI({ apiKey: `${apiKey}` });

// Functions && Variables
const activeSessions = require("./store/activeSessions");
const isChanging = require('./store/isChanging');
const prevData = require("./store/prevData");
const memory = require("./store/memory");

const { menuButton } = require("./utils/menuButton"); // (lang) 
const { onMessage } = require("./utils/messageHandler"); // async (ctx)
const { Lang } = require("./utils/lang"); // async (ctx) 
// const { formatDate } = require("./utils/formatDate"); // (date)
const { menu } = require("./utils/menu"); // async (lang, chatId, msg) 
const { ShowTimetable } = require("./utils/ShowTimetable");
const { getHomeworksForWeek } = require("./utils/getHomeworksForWeek");
const { getTimetableForDay } = require("./utils/getTimetableForDay");
// const { formatTime } = require("./utils/formatTime");
const { formatTimetable } = require("./utils/formatTimetable");
const { CheckCanceles } = require("./utils/CheckCanceles");
const { getLineNumber } = require("./utils/getLineNumber");
const { preInit } = require("./utils/preinit");
const { isInOwner } = require("./utils/isInOwner"); // (owner, id)

// const { goodMorning } = require("./utils/goodMorning");

CheckCanceles();
// setInterval(CheckCanceles, 5000);
setInterval(CheckCanceles, 3600000);
// const CheckHW = async () => siakinnik - TODO
setInterval(() => { for (const key in prevData) { if (Object.hasOwnProperty.call(prevData, key)) { delete prevData[key]; } } }, 172800000);

// cron.schedule('30 6 * * 1-5', () => {
//     goodMorning();
// }, {
//     timezone: "Europe/Berlin"
// });

bot.on('message', onMessage);

// on callback

bot.on('callback_query', async (ctx) => {
    const callbackQuery = ctx.callbackQuery;
    const from = callbackQuery.from;
    const fromId = callbackQuery.from.id;
    const isOwner = isInOwner(owner, fromId);

    if (onlyOwner && !isOwner) return;

    let currentDate = new Date();
    let currentTimestamp = Date.now()
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    let lang;
    let userLang;


    if (msg.chat.type !== 'private' || (await bot.telegram.getChat(fromId)).type !== 'private') return;

    let connection
    try {
        connection = await createConn();
        const [results] = await connection.query(
            `SELECT * FROM users WHERE telegramid = ?`, [chatId]
        );

        if (results.length === 0) {
            await connection.query(
                `INSERT INTO users (telegramid) VALUES (?)`, [chatId]
            );
        }
        const [DBinfo] = await connection.query(
            `SELECT lang FROM users WHERE telegramid = ?`, [chatId]
        );
        lang = DBinfo[0]?.lang;
        if (lang === null) {
            if (callbackQuery.data === 'RU') {
                await connection.query(
                    `UPDATE users SET lang = ? WHERE telegramid = ?`, [callbackQuery.data, chatId]
                );
                bot.sendMessage(chatId, `Установлен русский язык.`, {
                    parse_mode: "Markdown",
                    chat_id: chatId,
                    message_id: msg.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            menuButton(ru)
                        ]
                    }
                });
                bot.answerCallbackQuery(callbackQuery.id, 'Язык установлен на русский.');
            } else if (callbackQuery.data === 'DE') {
                await connection.query(
                    `UPDATE users SET lang = ? WHERE telegramid = ?`, [callbackQuery.data, chatId]
                );
                bot.sendMessage(chatId, `Die Sprache ist auf Deutsch eingestellt.`, {
                    parse_mode: "Markdown",
                    chat_id: chatId,
                    message_id: msg.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            menuButton(de)
                        ]
                    }
                });
                bot.answerCallbackQuery(callbackQuery.id, 'Die Sprache ist auf Deutsch eingestellt.');
            } else if (callbackQuery.data === 'EN') {
                await connection.query(
                    `UPDATE users SET lang = ? WHERE telegramid = ?`, [callbackQuery.data, chatId]
                );
                bot.sendMessage(chatId, `The language is set to English.`, {
                    parse_mode: "Markdown",
                    chat_id: chatId,
                    message_id: msg.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            menuButton(en)
                        ]
                    }
                });
                bot.answerCallbackQuery(callbackQuery.id, 'The language is set to English.');
            } else {
                bot.sendMessage(chatId, `Bitte wählen Sie eine Sprache aus - /lang.\n\nПожалуйста выберите язык - /lang.\n\nPlease select a language - /lang.`);
            }
            return
        } else {
            userLang = lang === 'RU' ? ru : lang === 'EN' ? en : lang === 'DE' ? de : null;
        }
        if (isChanging.includes(chatId)) {
            return bot.answerCallbackQuery(callbackQuery.id, userLang.general.editDataFirst)
        }

        if (/^toggle_view:((.+))?$/.test(callbackQuery.data)) {
            const splited = callbackQuery.data.split(':')
            let date
            splited.forEach((entry) => {
                if (entry === 'toggle_view') {
                    return
                } else {
                    date = entry
                }
            });
            bot.telegram.deleteMessage(msg.chat.id, msg.message_id).catch(() => { })
            try {
                const [results] = await connection.query(
                    `SELECT view, msgid FROM users WHERE telegramid = ?`, [chatId]
                );
                if (results.length > 0) {
                    const view = results[0].view
                    const msgId = results[0].msgid
                    if (msgId === 0) {
                        bot.sendMessage(chatId, `${userLang.errors.untis_credentials_required}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                    } else {
                        NewView = view === 'day' ? 'week' : 'day';
                        const sentMessage = await bot.sendMessage(dataChannel, '.', { reply_to_message_id: msgId })
                        bot.telegram.deleteMessage(dataChannel, sentMessage.message_id).catch(() => { })
                        const parsedData = JSON.parse(sentMessage.reply_to_message.text)
                        const username = decrypt(parsedData.username);
                        const password = decrypt(parsedData.pass);
                        ShowTimetable(userLang, NewView, username, password, chatId, msg, currentDate, new Date(currentTimestamp), currentTimestamp, msgId)
                        await connection.query(
                            `UPDATE users SET view = ? WHERE telegramid = ?`, [NewView, chatId]
                        );
                    }
                }
            } catch (error) {
                bot.sendMessage(chatId, `${userLang.errors.fetch_timetable} ${error.message}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                // bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                // console.error(error);
                logger.log(`index.js(line ${getLineNumber()}) | Unknown error: ${error.message}`, {
                    level: 'error',
                    error: error
                });
            }
        } else if (callbackQuery.data === 'timetable') {
            bot.telegram.deleteMessage(msg.chat.id, msg.message_id).catch(() => { })
            try {
                const [results] = await connection.query(
                    `SELECT view, msgid FROM users WHERE telegramid = ?`, [chatId]
                );
                if (results.length > 0) {
                    const view = results[0].view
                    const msgId = results[0].msgid
                    if (msgId === 0) {
                        bot.sendMessage(chatId, `${userLang.errors.untis_credentials_required}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                    } else {
                        const sentMessage = await bot.sendMessage(dataChannel, '.', { reply_to_message_id: msgId })
                        bot.telegram.deleteMessage(dataChannel, sentMessage.message_id).catch(() => { })
                        const parsedData = JSON.parse(sentMessage.reply_to_message.text)
                        const username = decrypt(parsedData.username);
                        const password = decrypt(parsedData.pass);
                        ShowTimetable(userLang, view, username, password, chatId, msg, currentDate, new Date(currentTimestamp), currentTimestamp, msgId)
                    }
                }
            } catch (error) {
                bot.sendMessage(chatId, `${userLang.errors.fetch_timetable}. ${error.message}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                // bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                // console.error(error);
                logger.log(`index.js(line ${getLineNumber()}) | Unknown error: ${error.message}`, {
                    level: 'error',
                    error: error
                });
            }
        } else if (callbackQuery.data === 'menu') {
            bot.telegram.deleteMessage(msg.chat.id, msg.message_id).catch(() => { })
            menu(userLang, chatId, msg)
        } else if (callbackQuery.data === 'RU') {
            await connection.query(
                `UPDATE users SET lang = ? WHERE telegramid = ?`, [callbackQuery.data, chatId]
            );
            bot.sendMessage(chatId, `Установлен русский язык.`, {
                parse_mode: "Markdown",
                chat_id: chatId,
                message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        menuButton(ru)
                    ]
                }
            });
            bot.answerCallbackQuery(callbackQuery.id, 'Установлен русский язык.');
        } else if (callbackQuery.data === 'DE') {
            await connection.query(
                `UPDATE users SET lang = ? WHERE telegramid = ?`, [callbackQuery.data, chatId]
            );
            bot.sendMessage(chatId, `Die Sprache ist auf Deutsch eingestellt.`, {
                parse_mode: "Markdown",
                chat_id: chatId,
                message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        menuButton(de)
                    ]
                }
            });
            bot.answerCallbackQuery(callbackQuery.id, 'Die Sprache ist auf Deutsch eingestellt.');
        } else if (callbackQuery.data === 'EN') {
            await connection.query(
                `UPDATE users SET lang = ? WHERE telegramid = ?`, [callbackQuery.data, chatId]
            );
            bot.sendMessage(chatId, `The language is set to English.`, {
                parse_mode: "Markdown",
                chat_id: chatId,
                message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        menuButton(en)
                    ]
                }
            });
            bot.answerCallbackQuery(callbackQuery.id, 'The language is set to English.');
        } else if (callbackQuery.data === 'admin') {
            if (!isOwner) {
                return
            } else {
                const [results] = await connection.query(
                    `SELECT lang FROM users WHERE telegramid = ?`, [chatId]
                );
                const lang = results[0].lang === 'RU' ? ru : results[0].lang === 'EN' ? en : results[0].lang === 'DE' ? de : null
                bot.sendMessage(from.id, userLang.adminPanel.header, {
                    parse_mode: "Markdown",
                    chat_id: chatId,
                    message_id: msg.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: userLang.adminPanel.buttons.userList, callback_data: 'users' },
                                // siakinnik - deleted
                                // { text: `Table users`, callback_data: 'users:data' },
                                { text: userLang.adminPanel.buttons.sendNotification, callback_data: 'sendall' }],
                            [{ text: userLang.adminPanel.buttons.errorLink, url: `https://t.me/c/${errChannel.toString().split('-100')[1]}/` }],
                            menuButton(userLang)
                        ]
                    }
                })
            }
        } else if (/^next:((.+))?$/.test(callbackQuery.data)) {
            const splited = callbackQuery.data.split(':')
            let date
            splited.forEach((entry) => {
                if (entry === 'next') {
                    return
                } else {
                    date = entry
                }
            });
            bot.telegram.deleteMessage(chatId, msg.message_id).catch(() => { })
            try {
                const [results] = await connection.query(
                    `SELECT view, msgid FROM users WHERE telegramid = ?`, [chatId]
                );
                if (results.length > 0) {
                    const view = results[0].view
                    const msgId = results[0].msgid
                    if (msgId === 0) {
                        bot.sendMessage(chatId, `${userLang.errors.untis_credentials_required}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                    } else {
                        const sentMessage = await bot.sendMessage(dataChannel, '.', { reply_to_message_id: msgId })
                        bot.telegram.deleteMessage(dataChannel, sentMessage.message_id).catch(() => { })
                        const parsedData = JSON.parse(sentMessage.reply_to_message.text)
                        const username = decrypt(parsedData.username);
                        const password = decrypt(parsedData.pass);
                        const getPlus = () => {
                            if (view === 'day') {
                                return +date + 86400000
                            } else {
                                return +date + 86400000 * 7
                            }
                        }
                        const datePlus = getPlus()
                        ShowTimetable(userLang, view, username, password, chatId, msg, currentDate, new Date(datePlus), datePlus, msgId)
                    }
                }
            } catch (error) {
                bot.sendMessage(chatId, `${userLang.errors.fetch_timetable} ${error.message}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                // bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                // console.error(error);
                logger.log(`index.js(line ${getLineNumber()}) | Unknown error: ${error.message}`, {
                    level: 'error',
                    error: error
                });
            }
        } else if (/^prev:((.+))?$/.test(callbackQuery.data)) {
            const splited = callbackQuery.data.split(':')
            let date
            splited.forEach((entry) => {
                if (entry === 'prev') {
                    return
                } else {
                    date = entry
                }
            });
            bot.telegram.deleteMessage(chatId, msg.message_id).catch(() => { })
            try {
                const [results] = await connection.query(
                    `SELECT view, msgid FROM users WHERE telegramid = ?`, [chatId]
                );
                if (results.length > 0) {
                    const view = results[0].view
                    const msgId = results[0].msgid
                    if (msgId === 0) {
                        bot.sendMessage(chatId, `${userLang.errors.untis_credentials_required}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                    } else {
                        const sentMessage = await bot.sendMessage(dataChannel, '.', { reply_to_message_id: msgId })
                        bot.telegram.deleteMessage(dataChannel, sentMessage.message_id).catch(() => { })
                        const parsedData = JSON.parse(sentMessage.reply_to_message.text)
                        const username = decrypt(parsedData.username);
                        const password = decrypt(parsedData.pass);
                        const getMinus = () => {
                            if (view === 'day') {
                                return +date - 86400000
                            } else {
                                return +date - 86400000 * 7
                            }
                        }
                        const dateMinus = getMinus()
                        ShowTimetable(userLang, view, username, password, chatId, msg, currentDate, new Date(dateMinus), dateMinus, msgId)
                    }
                }
            } catch (error) {
                bot.sendMessage(chatId, `${userLang.errors.fetch_timetable} ${error.message}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                // bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                // console.error(error);
                logger.log(`index.js(line ${getLineNumber()}) | Unknown error: ${error.message}`, {
                    level: 'error',
                    error: error
                });
            }
        } else if (/^settings((.+))?$/.test(callbackQuery.data)) {
            try {
                const [results] = await connection.query(
                    `SELECT msgid, lang, notif, morningNotif, HWNotif  FROM users WHERE telegramid = ?`, [chatId]
                );

                if (results.length > 0) {
                    const msgid = results[0].msgid;
                    const langid = results[0].lang;
                    const isnotif = results[0].notif;
                    const ismorningNotif = results[0].morningNotif;
                    const isHWNotif = results[0].HWNotif;
                    let data
                    if (msgid === 0) {
                        data = `${userLang.settings.no_info}`
                    } else {
                        let stat = 1
                        const sentMessage = await bot.sendMessage(dataChannel, '.', { reply_to_message_id: msgid }).catch(async () => {
                            await connection.query(
                                `UPDATE users SET msgid = ? WHERE telegramid = ?`, [0, chatId]
                            );
                            stat = 0
                        });
                        if (stat === 1) {
                            bot.telegram.deleteMessage(dataChannel, sentMessage.message_id).catch(() => { })
                            const parsedData = JSON.parse(sentMessage.reply_to_message.text)
                            let passLength = decrypt(parsedData.pass).length
                            let pass = ''
                            while (passLength > 0) {
                                pass += '\\*';
                                passLength--
                            }
                            data = `${decrypt(parsedData.username)}, ${pass}`
                            try {
                                const untis = new api.WebUntis(school, decrypt(parsedData.username), decrypt(parsedData.pass), domain);
                                await untis.login()
                            } catch (e) {
                                data = `${userLang.settings.no_info}`
                                bot.telegram.deleteMessage(dataChannel, msgid).catch(() => { })
                                const connection = await createConn()
                                await connection.query(
                                    `UPDATE users SET msgid = 0 WHERE telegramid = ?`, [chatId]
                                );
                                await connection.close();
                                return
                            }
                        } else {
                            data = `${userLang.settings.no_info}`;
                        }
                    }
                    const lang = langid === 'RU' ? '🇷🇺Русский' : langid === 'EN' ? '🇬🇧English' : langid == 'DE' ? '🇩🇪Deutsch' : '❌No info.'
                    const notif = isnotif === 'yes' ? `${userLang.settings.on}` : `${userLang.settings.off}`
                    const morningNotif = ismorningNotif === 'yes' ? `${userLang.settings.on}` : `${userLang.settings.off}`
                    const HWNotif = isHWNotif === 'yes' ? `${userLang.settings.on}` : `${userLang.settings.off}`
                    bot.sendMessage(chatId, `*${userLang.settings.header}*\n\n${userLang.settings.untis_data} ${data}\n${userLang.settings.language} ${lang}\n${userLang.settings.notifications} ${notif}\n${userLang.settings.morningNotifications} ${morningNotif}\n${userLang.settings.HWNotif} ${HWNotif}`, {
                        parse_mode: "Markdown",
                        chat_id: chatId,
                        message_id: msg.message_id,
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '🌎Language', callback_data: 'lang' },
                                    { text: `${userLang.settings.buttons.notifications}`, callback_data: 'notif' },
                                    { text: `${userLang.settings.buttons.untis_data}`, callback_data: 'UntisData' }],
                                menuButton(userLang)
                            ]
                        }
                    });
                }
            } catch (error) {
                bot.sendMessage(chatId, `${userLang.errors.fetch_timetable} ${error.message}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                // bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                // console.error(error);
                logger.log(`index.js(line ${getLineNumber()}) | Unknown error: ${error.message}`, {
                    level: 'error',
                    error: error
                });
            }
        } else if (callbackQuery.data === 'lang') {
            Lang(ctx)
        } else if (callbackQuery.data === 'notif') {
            try {
                const [results] = await connection.query(
                    `SELECT notif, morningNotif, HWNotif  FROM users WHERE telegramid = ?`, [chatId]
                );

                if (results.length > 0) {
                    const isnotifid = results[0].notif;
                    const ismorningNotif = results[0].morningNotif;
                    const isHWNotif = results[0].HWNotif;
                    const btns = userLang.settings.notifications_prompt.buttons;

                    const toSend = `${userLang.settings.notifications_prompt.text}`;
                    const buttons =
                        [
                            [{ text: `${ismorningNotif === 'yes' ? '🟢' : '🔴'}${btns.morning}${ismorningNotif === 'yes' ? btns.enabled : btns.disabled}`, callback_data: `notif:MR:${ismorningNotif === 'yes' ? 'off' : 'on'}` }],
                            [{ text: `${isHWNotif === 'yes' ? '🟢' : '🔴'}${btns.homework}${isHWNotif === 'yes' ? btns.enabled : btns.disabled}`, callback_data: `notif:HW:${isHWNotif === 'yes' ? 'off' : 'on'}` }],
                            [{ text: `${isnotifid === 'yes' ? '🟢' : '🔴'}${btns.canc_subs}${isnotifid === 'yes' ? btns.enabled : btns.disabled}`, callback_data: `notif:${isnotifid === 'yes' ? 'off' : 'on'}` }],
                            menuButton(userLang)
                        ];
                    bot.sendMessage(chatId, toSend, {
                        parse_mode: "Markdown",
                        chat_id: chatId,
                        message_id: msg.message_id,
                        reply_markup: {
                            inline_keyboard: buttons
                        }
                    });
                }
            } catch (error) {
                bot.sendMessage(chatId, `${userLang.errors.info} ${error.message}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                // bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                // console.error(error);
                logger.log(`index.js(line ${getLineNumber()}) | Unknown error: ${error.message}`, {
                    level: 'error',
                    error: error
                });
            }
        } else if (callbackQuery.data === 'UntisData') {
            try {
                const [results] = await connection.query(
                    `SELECT msgid FROM users WHERE telegramid = ?`, [chatId]
                );

                if (results.length > 0) {
                    const msgid = results[0].msgid
                    let data = {}
                    if (msgid === 0) {
                        data.isInfo = false
                        data.msgid = msgid
                    } else {
                        data.isInfo = true
                        const sentMessage = await bot.sendMessage(dataChannel, '.', { reply_to_message_id: msgid }).catch((e) => {
                            logger.log(`index.js (line 1014) | Unknown Error ${e.message}`, {
                                level: 'error',
                                error: e
                            });
                        });
                        bot.telegram.deleteMessage(dataChannel, sentMessage.message_id).catch(() => { })
                        const parsedData = JSON.parse(sentMessage.reply_to_message.text)
                        data.uname = decrypt(parsedData.username);
                        data.upass = decrypt(parsedData.pass);
                        let passLength = data.upass.length
                        let pass = ''
                        while (passLength > 0) {
                            pass += '\\*';
                            passLength--
                        }
                        data.pass = pass
                    }

                    bot.telegram.deleteMessage(chatId, msg.message_id).catch(() => { })
                    let message
                    let inline
                    if (data.isInfo) {
                        let isValid = true
                        try {
                            const untis = new api.WebUntis(school, data.uname, data.upass, domain);
                            await untis.login()
                        } catch (e) {
                            isValid = false
                            bot.telegram.deleteMessage(dataChannel, data.msgid).catch(() => { })
                            const connection = await createConn()
                            await connection.query(
                                `UPDATE users SET msgid = 0 WHERE telegramid = ?`, [chatId]
                            );
                            await connection.close();
                            return
                        }
                        const status = isValid ? userLang.untis_data.valid : userLang.untis_data.invalid
                        message = `${userLang.untis_data.head}${userLang.untis_data.isInfo.replace('{{data.uname}}', data.uname).replace('{{data.pass}}', data.pass)}${status}`
                        inline = {
                            parse_mode: "Markdown",
                            chat_id: chatId,
                            message_id: msg.message_id,
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: `${userLang.untis_data.ChangeData}`, callback_data: 'ChangeData' },
                                        { text: `${userLang.untis_data.RmData}`, callback_data: 'RmData' }
                                    ],
                                    menuButton(userLang)
                                ]
                            }
                        }
                    } else {
                        message = `${userLang.untis_data.head}${userLang.untis_data.noInfo}`
                        inline = {
                            parse_mode: "Markdown",
                            chat_id: chatId,
                            message_id: msg.message_id,
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: `${userLang.untis_data.ChangeData}`, callback_data: 'ChangeData' },
                                    ],
                                    menuButton(userLang)
                                ]
                            }
                        }
                    }
                    bot.sendMessage(chatId, message, inline);
                }
            } catch (error) {
                bot.sendMessage(chatId, `${userLang.errors.fetch_timetable} ${error.message}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                // bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                // console.error(error);
                logger.log(`index.js(line ${getLineNumber()}) | Unknown error: ${error.message}`, {
                    level: 'error',
                    error: error
                });
            }
        } else if (/^notif:((.+))?$/.test(callbackQuery.data)) {
            const splited = callbackQuery.data.split(':')
            if (!splited[2]) {
                const isOn = splited[1] === 'on' ? 'yes' : 'no'
                try {
                    await connection.query(
                        `UPDATE users SET notif = ? WHERE telegramid = ?`, [isOn, chatId]
                    );
                    const [results] = await connection.query(
                        `SELECT notif, morningNotif, HWNotif  FROM users WHERE telegramid = ?`, [chatId]
                    );
                    const isnotifid = results[0].notif;
                    const ismorningNotif = results[0].morningNotif;
                    const isHWNotif = results[0].HWNotif;
                    const btns = userLang.settings.notifications_prompt.buttons;
                    const buttons =
                        [
                            [{ text: `${ismorningNotif === 'yes' ? '🟢' : '🔴'}${btns.morning}${ismorningNotif === 'yes' ? btns.enabled : btns.disabled}`, callback_data: `notif:MR:${ismorningNotif === 'yes' ? 'off' : 'on'}` }],
                            [{ text: `${isHWNotif === 'yes' ? '🟢' : '🔴'}${btns.homework}${isHWNotif === 'yes' ? btns.enabled : btns.disabled}`, callback_data: `notif:HW:${isHWNotif === 'yes' ? 'off' : 'on'}` }],
                            [{ text: `${isnotifid === 'yes' ? '🟢' : '🔴'}${btns.canc_subs}${isnotifid === 'yes' ? btns.enabled : btns.disabled}`, callback_data: `notif:${isnotifid === 'yes' ? 'off' : 'on'}` }],
                            menuButton(userLang)
                        ];
                    bot.telegram.editMessageReplyMarkup(
                        chatId,
                        msg.message_id,
                        undefined,
                        {
                            inline_keyboard: buttons
                        }
                    );

                    bot.answerCallbackQuery(callbackQuery.id, userLang.general.success);
                } catch (error) {
                    bot.sendMessage(chatId, `${userLang.errors.fetch_timetable} ${error.message}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                    // bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                    // console.error(error);
                    logger.log(`index.js(line ${getLineNumber()}) | Unknown error: ${error.message}`, {
                        level: 'error',
                        error: error
                    });
                }
            } else {
                const type = splited[1] === 'MR' ? 'morningNotif' : 'HWNotif'
                const isOn = splited[2] === 'on' ? 'yes' : 'no'
                try {
                    await connection.query(
                        `UPDATE users SET ${type} = ? WHERE telegramid = ?`, [isOn, chatId]
                    );
                    const [results] = await connection.query(
                        `SELECT notif, morningNotif, HWNotif  FROM users WHERE telegramid = ?`, [chatId]
                    );
                    const isnotifid = results[0].notif;
                    const ismorningNotif = results[0].morningNotif;
                    const isHWNotif = results[0].HWNotif;
                    const btns = userLang.settings.notifications_prompt.buttons;
                    const buttons =
                        [
                            [{ text: `${ismorningNotif === 'yes' ? '🟢' : '🔴'}${btns.morning}${ismorningNotif === 'yes' ? btns.enabled : btns.disabled}`, callback_data: `notif:MR:${ismorningNotif === 'yes' ? 'off' : 'on'}` }],
                            [{ text: `${isHWNotif === 'yes' ? '🟢' : '🔴'}${btns.homework}${isHWNotif === 'yes' ? btns.enabled : btns.disabled}`, callback_data: `notif:HW:${isHWNotif === 'yes' ? 'off' : 'on'}` }],
                            [{ text: `${isnotifid === 'yes' ? '🟢' : '🔴'}${btns.canc_subs}${isnotifid === 'yes' ? btns.enabled : btns.disabled}`, callback_data: `notif:${isnotifid === 'yes' ? 'off' : 'on'}` }],
                            menuButton(userLang)
                        ];
                    bot.telegram.editMessageReplyMarkup(
                        chatId,
                        msg.message_id,
                        undefined,
                        {
                            inline_keyboard: buttons
                        }
                    );

                    bot.answerCallbackQuery(callbackQuery.id, userLang.general.success);
                } catch (error) {
                    bot.sendMessage(chatId, `${userLang.errors.fetch_timetable} ${error.message}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                    // bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                    // console.error(error);
                    logger.log(`index.js(line ${getLineNumber()}) | Unknown error: ${error.message}`, {
                        level: 'error',
                        error: error
                    });
                }
            }
        } else if (callbackQuery.data === 'ChangeData') {
            if (isChanging.includes(chatId)) {
                return;
            }
            isChanging.push(chatId);

            const parse_mode = { parse_mode: 'Markdown' };
            bot.sendMessage(chatId, `${userLang.untis_data.login}`, parse_mode);

            activeSessions.set(chatId, { step: 'username', username: null, password: null });

        } else if (callbackQuery.data === 'RmData') {
            const inline = {
                chat_id: chatId,
                message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        menuButton(userLang)
                    ]
                }
            }
            let conn;
            try {
                conn = await createConn();
                const [results] = await conn.query(
                    `SELECT msgid FROM users WHERE telegramid = ?`, [chatId]
                );
                if (results[0].msgid === 0) {
                    bot.sendMessage(chatId, `${userLang.general.success}`, inline)
                } else {
                    bot.telegram.deleteMessage(dataChannel, results[0].msgid).catch(() => { })
                    await conn.query(
                        `UPDATE users SET msgid = 0 WHERE telegramid = ?`, [chatId]
                    );
                    bot.sendMessage(chatId, `${userLang.general.success}`, inline)
                }
            } catch (error) {
                ctx.reply(`⛔️${error.message}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                // bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                // console.error(error);
                logger.log(`index.js(line ${getLineNumber()}) | Unknown error: ${error.message}`, {
                    level: 'error',
                    error: error
                });
            } finally {
                if (conn) conn.close();
            }
        } else if (callbackQuery.data === 'homework') {
            try {
                const data = await getHomeworksForWeek({
                    chatId,
                    connection,
                    bot,
                    userLang,
                    dataChannel,
                    errChannel,
                    school,
                    domain,
                    currentTimestamp
                });

                await bot.sendMessage(chatId,
                    `*${userLang.homeworks.header}*\n\n${data}`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                menuButton(userLang)
                            ]
                        }
                    }
                );

            } catch (error) {
                if (error.message === 'UNTIS_CREDENTIALS_REQUIRED') {
                    return ctx.reply(
                        userLang.errors.untis_credentials_required,
                        { reply_markup: { inline_keyboard: [menuButton(userLang)] } }
                    );
                };

                ctx.reply(
                    `${userLang.errors.fetch_timetable} ${error.message}`,
                    { reply_markup: { inline_keyboard: [menuButton(userLang)] } }
                );

                logger.log(`index.js (line ${getLineNumber()}) | Unknown Error ${error.message}`, {
                    level: 'error',
                    error: error
                });

                console.error(error);
            }
        }
    } finally {
        if (connection) {
            await connection.close();;
        }
    }
});


// Bot start
(async () => {
    await logger.startup();
    await preInit();
    bot.launch().then(() => {
        logger.log(`index.js | Bot running.`, {
            level: 'info'
        });
    }).catch((err) => {
        logger.log(`index.js (bot start/line ${getLineNumber()}) | Unknown Error ${err.message}`, {
            level: 'error',
            error: err
        });
    });
})();

// Error handling
process.on('uncaughtException', err => {
    logger.log(`index.js (uncaughtException/line ${getLineNumber()}) | UncaughtException: ${err.message}`, {
        level: 'error',
        error: err
    });
});

process.on('unhandledRejection', err => {
    logger.log(`index.js (unhandledRejection/line ${getLineNumber()}) |UnhandledRejection: ${err.message}`, {
        level: 'error',
        error: err
    });
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));