// -------------------------------
// index.js - main file in Untis Telegram Bot by siakinnik
// -------------------------------

// Dependencies
const api = require('webuntis'); // Untis web-api
const createConn = require('./db'); // MySQL-like sqlite wrapper
const encrypt = require('./encrypter/encrypter'); // Encryption function
const decrypt = require('./encrypter/decrypter'); // Decription functions
const bot = require('./utils/bot'); // Telegram bot(Telegraf bot with some node-telegram-bot-api functions)
const cron = require('node-cron'); // Timers
const { GoogleGenAI } = require('@google/genai'); // Gemeni

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
const ru = require('./ru.json'); // Russian language package
const en = require('./en.json'); // English language package
const de = require('./de.json'); // German language package

const ai = new GoogleGenAI({ apiKey: `${apiKey}` });
// siakinnik - removed, replaced with utils/bot.js
// const bot = new Telegraf(config.token);

// Functions && Variables
const activeSessions = new Map();
const isChanging = [];
const prevData = require("./store/prevData");
const memory = {};

const { menuButton } = require("./utils/menuButton"); // (lang) 
const { Lang } = require("./utils/lang"); // async (ctx) 
// const { formatDate } = require("./utils/formatDate"); // (date)
const { menu } = require("./utils/menu"); // async (lang, chatId, msg) 
const { ShowTimetable } = require("./utils/ShowTimetable");
const { getHomeworksForWeek } = require("./utils/getHomeworksForWeek");
const { getTimetableForDay } = require("./utils/getTimetableForDay");
// const { formatTime } = require("./utils/formatTime");
const { formatTimetable } = require("./utils/formatTimetable");
const { CheckCanceles } = require("./utils/CheckCanceles");

const { goodMorning } = require("./utils/goodMorning");

// const CheckHW = async () => siakinnik - TODO

setInterval(CheckCanceles, 3600000);
setInterval(() => Object.assign(prevData, {}), 86400000)

cron.schedule('30 6 * * 1-5', () => {
    goodMorning();
}, {
    timezone: "Europe/Berlin"
});

bot.on('message', async (ctx) => {
    const msg = ctx.message;
    if (onlyOwner && msg.chat.id !== owner) {
        return
    }
    const currentDate = new Date();
    const currentTimestamp = Date.now()
    const chatId = msg.chat.id;

    let lang;
    let userLang;

    if (msg.chat.type !== 'private') {
        return;
    }
    if (!msg.text) {
        return ctx.reply('Only text.')
    }
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
        console.log("DEBUG DB:", chatId, DBinfo);
        if (lang === null) {
            if (/^\/lang( (.+))?$/.test(msg.text)) {
                Lang(ctx)
            } else {
                ctx.reply(`Bitte wählen Sie eine Sprache aus - /lang.\n\nПожалуйста выберите язык - /lang.\n\nPlease select a language - /lang.`);
            }
        } else {
            userLang = lang === 'RU' ? ru : lang === 'EN' ? en : lang === 'DE' ? de : null;
            const chatId = ctx.from.id;

            if (isChanging.includes(chatId)) {

                const session = activeSessions.get(chatId);

                if (session.step === 'username') {
                    session.username = ctx.message.text;
                    session.step = 'password';
                    await ctx.reply(userLang.untis_data.pass, { parse_mode: "Markdown" });
                } else if (session.step === 'password') {
                    session.password = ctx.message.text;

                    try {
                        await ctx.deleteMessage(ctx.message.message_id).catch(() => { });
                    } catch (e) { }

                    const { username, password } = session;
                    const untis = new api.WebUntis(school, username, password, domain);
                    let isValid = true;

                    try {
                        await untis.login();
                    } catch (e) {
                        isValid = false;
                        await ctx.telegram.sendMessage(errChannel, `ERROR login:\nuser: ${chatId}\n${e}`);
                    }

                    if (!isValid) {
                        const index = isChanging.indexOf(chatId);
                        if (index > -1) isChanging.splice(index, 1);
                        activeSessions.delete(chatId);

                        await ctx.reply(userLang.errors.ChangeData, {
                            parse_mode: "Markdown",
                            reply_markup: {
                                inline_keyboard: [menuButton(userLang)],
                            },
                        });
                        return;
                    }
                    let conn;
                    try {
                        conn = await createConn();
                        const [results] = await conn.query(
                            `SELECT msgid FROM users WHERE telegramid = ?`, [chatId]
                        );

                        const jsonMsg = `{"username": "${encrypt(username)}", "pass": "${encrypt(password)}"}`;

                        if (results[0].msgid === 0) {
                            const sentMsg = await ctx.telegram.sendMessage(dataChannel, jsonMsg);
                            await conn.query(
                                `UPDATE users SET msgid = ? WHERE telegramid = ?`, [sentMsg.message_id, chatId]
                            );
                        } else {
                            await ctx.telegram.editMessageText(
                                dataChannel,
                                results[0].msgid,
                                null,
                                jsonMsg
                            ).catch(() => { });
                        }

                        const masked = '\\*'.repeat(password.length);

                        await ctx.reply(
                            userLang.untis_data.success
                                .replace('{{username}}', username)
                                .replace('{{pass}}', masked),
                            { parse_mode: "MarkdownV2" }
                        ).catch((e) => { console.log(e) });
                        // await connection.close();
                    } catch (error) {
                        await ctx.reply(`${userLang.errors.unknown_error} ${error.message}`);
                        await ctx.telegram.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                    } finally {
                        if (conn) {
                            await conn.close();
                        };
                    }

                    const index = isChanging.indexOf(chatId);
                    if (index > -1) isChanging.splice(index, 1);
                    activeSessions.delete(chatId);
                    return; // siakinnik - added
                }
            }

            if (isChanging.includes(chatId)) return;
            if (/^\/lang( (.+))?$/.test(msg.text)) {
                Lang(ctx)
            } else if (/^\/start(  (.+))?$/.test(msg.text)) {

                menu(userLang, chatId, msg);

            } else if (/^\/timetable( (.+))?$/.test(msg.text)) {
                let params = msg.text.match(/^\/timetable( (.+))?$/);
                if (params && params[2]) {
                    params = params[2];
                } else {
                    params = false;
                }
                try {
                    const [results] = await connection.query(
                        `SELECT view, msgid FROM users WHERE telegramid = ?`, [chatId]
                    );
                    if (results.length > 0) {
                        const view = results[0].view
                        const msgId = results[0].msgid
                        if (msgId === 0) {
                            ctx.reply(`${userLang.errors.untis_credentials_required}`)
                        } else {
                            const sentMessage = await bot.telegram.sendMessage(dataChannel, '.', { reply_to_message_id: msgId })
                            bot.telegram.deleteMessage(dataChannel, sentMessage.message_id).catch(() => { })
                            const parsedData = JSON.parse(sentMessage.reply_to_message.text)
                            const username = decrypt(parsedData.username);
                            const password = decrypt(parsedData.pass);
                            ShowTimetable(userLang, view, username, password, chatId, msg, currentDate, new Date(currentTimestamp), currentTimestamp, msgId)
                        }
                    } else {
                        ctx.reply(`${userLang.errors.user_not_found}`);
                    }
                } catch (error) {
                    ctx.reply(`⛔️${userLang.errors.fetch_timetable}. ${error.message}`);
                    bot.telegram.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`)
                }
            } else if (/^\/donate( (.+))?$/.test(msg.text)) {
                const params = msg.text.match(/^\/donate( (.+))?$/);
                let amount = 1
                if (params && params[2]) {
                    if (!isNaN(+params[2])) {
                        if (+params[2] < 100001) {
                            amount = +params[2]
                        } else {
                            amount = 100000
                            s
                        }
                    }
                }
                const info = {
                    chatId: msg.chat.id,
                    title: 'Donation',
                    description: `Donation ${amount} star(s) to Untis`,
                    payload: `donation_${Date.now()}`,
                    provider_token: '',
                    currency: 'XTR',
                    prices: [
                        {
                            label: 'Donate to Untis Pro Max',
                            amount: amount,
                        }
                    ],
                };
                bot.sendInvoice(info.chatId, info.title, info.description, info.payload, info.provider_token, info.currency, JSON.stringify(info.prices));
            } else if (msg.text.toLowerCase() === 'menu' || msg.text.toLowerCase() === 'меню' || msg.text.toLowerCase() === 'menü') {
                menu(userLang, chatId, msg)
            } else if (msg.text === '/resetai') {
                if (memory[chatId]) {
                    delete memory[chatId];
                    await ctx.reply(userLang.ai.memoryCleared);
                } else {
                    await ctx.reply(userLang.ai.memoryEmpty);
                }
            } else {
                let username, password;
                const [results] = await connection.query(
                    `SELECT * FROM users WHERE telegramid = ?`, [chatId]
                );
                if (results.length > 0) {
                    const msgId = results[0].msgid
                    if (msgId === 0) {
                        ctx.reply(`${userLang.errors.untis_credentials_required}`)
                    } else {
                        const sentMessage = await bot.telegram.sendMessage(dataChannel, '.', { reply_to_message_id: msgId })
                        bot.telegram.deleteMessage(dataChannel, sentMessage.message_id).catch(() => { })
                        const parsedData = JSON.parse(sentMessage.reply_to_message.text)
                        username = decrypt(parsedData.username);
                        password = decrypt(parsedData.pass);
                    }
                } else {
                    return ctx.reply(`${userLang.errors.user_not_found}`);
                }
                if (chatId !== owner) {
                    if (results[0].lastReset) {
                        const lastResetTime = new Date(results[0].lastReset); // String to Date
                        const now = new Date();

                        const diffMs = now - lastResetTime;

                        const diffHours = diffMs / (1000 * 60 * 60);

                        if (diffHours < 24) {
                            bot.sendMessage(chatId, `${userLang.general.nocommand}`, {
                                chat_id: chatId,
                                message_id: msg.message_id,
                                reply_markup: {
                                    inline_keyboard: [
                                        menuButton(userLang)
                                    ]
                                }
                            })
                            return;
                        }
                    }
                    connection.query("UPDATE users SET msgCount = msgCount + 1 WHERE telegramid = ?", [chatId]);
                }
                if (!memory[chatId]) memory[chatId] = [];
                if (memory[chatId].filter(m => m.you).length > ownerAiLimit && chatId === owner) {
                    while (memory[chatId].filter(m => m.you).length > ownerAiLimit) {
                        memory[chatId].shift();
                    };
                }

                if (results[0].msgCount > userAiLimit && chatId !== owner) {
                    console.log('test')
                    memory[chatId] = [];
                    await connection.query("UPDATE users SET lastReset = CURRENT_TIMESTAMP WHERE telegramid = ?", [chatId]);
                    await connection.query("UPDATE users SET msgCount = 0 WHERE telegramid = ?", [chatId]);
                }
                let response = await ai.models.generateContent({
                    model,
                    config: {
                        systemInstruction: `
    ${aiInstruction}${JSON.stringify(memory[chatId])}
    `
                    },
                    contents: ctx.message.text,
                });

                // ai sends command
                if (response.text.startsWith('!')) {
                    if (response.text.startsWith('!stundenplan!')) {
                        memory[chatId].push({ user: msg.text, you: '' });
                        ctx.reply(`${userLang.ai.timetable}`);
                        response = await ai.models.generateContent({
                            model,
                            config: {
                                systemInstruction: `
    ${aiInstruction}${JSON.stringify(memory[chatId])}
    `
                            },
                            contents: `!command_response!!stundenplan!
    The DATA (timetable) is an intermediate result generated by the function.
    They can be in Russian, German or English, depending on the userLang.
    This is NOT the language of the answer, but only the source of information.

    ${formatTimetable(
                                userLang,
                                await getTimetableForDay(chatId, username, password, new Date(Date.now())),
                                undefined,
                                new Date(Date.now())
                            )}

    THE USER'S ORIGINAL QUESTION:
    ${ctx.message.text}

    important:
    - Always form an answer in the language spoken or explicitly requested by the user (for example, if the user writes in French, answer in French).
    - Never copy data from the schedule verbatim. Reformulate and formalize it in Markdown v1.
    - Use data only as a source of facts (time, subject, teacher, office, status).
    - If the class field is *active* = true → the lesson will take place (display as normal).
    - If the class field is *active* = false → the lesson has been canceled (be sure to indicate in the response that it has been canceled).
    - Form a full-fledged friendly response.
    !`
                        });
                    }
                    if (response.text.startsWith('!morgen!')) {
                        memory[chatId].push({ user: msg.text, you: '' });
                        ctx.reply(`${userLang.ai.timetable}`);
                        response = await ai.models.generateContent({
                            model,
                            config: {
                                systemInstruction: `
    ${aiInstruction}${JSON.stringify(memory[chatId])}
    `
                            },
                            contents: `!command_response!!morgen!
    The DATA (the schedule for tomorrow) is an intermediate result generated by the function.
    They can be in Russian, German or English, depending on the userLang.
    This is NOT the language of the answer, but only the source of information.

    ${formatTimetable(
                                userLang,
                                await getTimetableForDay(chatId, username, password, new Date(Date.now() + 24 * 60 * 60 * 1000)),
                                undefined,
                                new Date(Date.now() + 24 * 60 * 60 * 1000)
                            )}

    THE USER'S ORIGINAL QUESTION:
    ${ctx.message.text}

    important:
    - Always form an answer in the language spoken or explicitly requested by the user (for example, if the user writes in French, answer in French).
    - Never copy data from the schedule verbatim. Reformulate and formalize it in Markdown v1.
    - Use data only as a source of facts (time, subject, teacher, office, status).
    - If the class field is *active* = true → the lesson will take place (display as normal).
    - If the class field is *active* = false → the lesson has been canceled (be sure to indicate in the response that it has been canceled).
    - Form a full-fledged friendly response.
    !`
                        });
                    }
                    if (response.text.startsWith('!hausaufgaben!')) {
                        memory[chatId].push({ user: msg.text, you: '' });
                        ctx.reply(`${userLang.ai.timetable}`);
                        let homeWorks;
                        try {
                            if (!connection) {
                                connection = await createConn();
                            }
                            homeWorks = await getHomeworksForWeek(chatId, connection, bot, userLang, dataChannel, errChannel, school, domain, currentTimestamp);
                        } catch {
                            homeWorks = "no homeworks available"
                        } finally {
                            // if (connection) connection.close();
                        };
                        response = await ai.models.generateContent({
                            model,
                            config: {
                                systemInstruction: `
    ${aiInstruction}${JSON.stringify(memory[chatId])}
    `
                            },
                            contents: `!command_response!!hausaufgaben!
    The DATA (homeworks) is an intermediate result generated by the function.
    If it is undefined - it means no homeworks
    They can be in Russian, German or English, depending on the userLang.
    This is NOT the language of the answer, but only the source of information.

    homeworks - ${homeWorks}

    THE USER'S ORIGINAL QUESTION:
    ${ctx.message.text}

    important:
    - Always form an answer in the language spoken or explicitly requested by the user (for example, if the user writes in French, answer in French).
    - Never copy data from the schedule verbatim. Reformulate and formalize it in Markdown v1.
    - Use data only as a source of facts (time, subject, teacher, office, status).
    - If the class field is *active* = true → the lesson will take place (display as normal).
    - If the class field is *active* = false → the lesson has been canceled (be sure to indicate in the response that it has been canceled).
    - Form a full-fledged friendly response.
    !`
                        });
                    }

                }

                memory[chatId].push({ user: ctx.message.text, you: response.text });

                ctx.reply(response.text);

                if (chatId === owner) {
                    if (/^\/getallusers( (.+))?$/.test(msg.text)) {
                        let params = msg.text.match(/^\/getallusers( (.+))?$/);
                        if (params && params[2]) {
                            params = params[2];
                        } else {
                            params = false;
                        }

                        if (!params || params !== 'data') {
                            const [results] = await connection.query(
                                `SELECT id, telegramid FROM users`
                            );
                            const adminLang = userLang;

                            const toShow = (results) => {
                                let result = ``;
                                results.forEach((user) => {
                                    result += `${user.id}. [${user.telegramid}](tg://user?id=${user.telegramid})\n`;
                                });
                                return result || adminLang.adminPanel.getUsers.noUsers;
                            };

                            bot.sendMessage(owner, `${adminLang.adminPanel.getUsers.header}${toShow(results)}`, { parse_mode: 'Markdown' });
                        } else if (params === 'data') {
                            const [results] = await connection.query(
                                `SELECT * FROM users ORDER BY id`
                            );

                            const adminLang = userLang;
                            const toShow = (results) => {
                                let result = ``;
                                results.forEach((user) => {
                                    const username = user.username || '-';
                                    const msgid = user.msgid || '-'
                                    const notif = user.notif.replace('no', '❌').replace('yes', '✅')
                                    const lang = user.lang || '-';
                                    result += `${user.id}. [${user.telegramid}](tg://user?id=${user.telegramid}) ${msgid} ${notif} ${lang}\n`;
                                });
                                return result || adminLang.adminPanel.getUsers.noUsers;
                            };
                            bot.sendMessage(owner, `${adminLang.adminPanel.getUsers.header}TG id|Message id|Notif|Lang\n\n${toShow(results)}`, { parse_mode: 'Markdown' });
                        }
                    } else if (/^\/sendall( (.+))?$/.test(msg.text)) {
                        const adminLang = userLang;
                        const messageToSend = msg.text.split(' ').slice(1).join(' ');
                        const [results] = await connection.query(`SELECT telegramid FROM users`);
                        if (!messageToSend || messageToSend === '') {
                            bot.sendMessage(owner, adminLang.adminPanel.sendall.header, { parse_mode: 'Markdown' })
                            let forwardMode = false;

                            bot.on('message', async (ctx, next) => {
                                if (!forwardMode) return next();

                                const ownerId = ctx.from.id;
                                if (ownerId !== owner) return;

                                try {
                                    for (const user of results) {
                                        if (user.telegramid !== owner) {
                                            try {
                                                await ctx.telegram.copyMessage(
                                                    user.telegramid,
                                                    ctx.chat.id,
                                                    ctx.message.message_id
                                                );
                                            } catch (e) {
                                                await ctx.telegram.sendMessage(errChannel, `ERROR:\n${e}`);
                                            }
                                        }
                                    }

                                    await ctx.telegram.sendMessage(owner, adminLang.adminPanel.sendall.success);
                                } catch (error) {
                                    await ctx.telegram.sendMessage(ownerId, `${userLang.errors.unknown_error} ${error.message}`);
                                    await ctx.telegram.sendMessage(errChannel, `ERROR:\nuser:${ownerId}\n${error}`);
                                } finally {
                                    forwardMode = false;
                                }
                            });

                        } else {
                            results.forEach(user => {
                                if (user.telegramid !== owner) {
                                    try {
                                        bot.sendMessage(user.telegramid, `${messageToSend.replace(/\\n/gi, '\n')}`, { parse_mode: "Markdown" }).catch((e) => bot.sendMessage(errChannel, `ERROR:\n${e}`));
                                    } catch (e) {
                                        bot.sendMessage(errChannel, `ERROR:\n${e}`)
                                    }
                                }
                            });
                            bot.sendMessage(owner, adminLang.adminPanel.sendall.success);
                        }
                    }
                }
            }
        }
    } catch (error) {
        bot.sendMessage(chatId, `⛔️${error.message}`);
        bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch { }; // fail-safe
        };
    }
});


// on callback

bot.on('callback_query', async (ctx) => {
    const callbackQuery = ctx.callbackQuery;
    if (onlyOwner && callbackQuery.message.chat.id !== owner) {
        return
    }
    let currentDate = new Date();
    let currentTimestamp = Date.now()
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    let lang;
    let userLang;

    if (msg.chat.type !== 'private') {
        return
    }
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
                        bot.sendMessage(chatId, `${userLang.errors.untis_credentials_required}`)
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
                bot.sendMessage(chatId, `${userLang.errors.fetch_timetable} ${error.message}`);
                bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                console.error(error);
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
                        bot.sendMessage(chatId, `${userLang.errors.untis_credentials_required}`)
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
                bot.sendMessage(chatId, `${userLang.errors.fetch_timetable}. ${error.message}`);
                bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                console.error(error);
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
            if (callbackQuery.from.id !== owner) {
                return
            } else {
                const [results] = await connection.query(
                    `SELECT lang FROM users WHERE telegramid = ?`, [chatId]
                );
                const lang = results[0].lang === 'RU' ? ru : results[0].lang === 'EN' ? en : results[0].lang === 'DE' ? de : null
                bot.sendMessage(owner, userLang.adminPanel.header, {
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
                        bot.sendMessage(chatId, `${userLang.errors.untis_credentials_required}`)
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
                bot.sendMessage(chatId, `${userLang.errors.fetch_timetable} ${error.message}`);
                bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                console.error(error);
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
                        bot.sendMessage(chatId, `${userLang.errors.untis_credentials_required}`)
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
                bot.sendMessage(chatId, `${userLang.errors.fetch_timetable} ${error.message}`);
                bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                console.error(error);
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
                bot.sendMessage(chatId, `${userLang.errors.fetch_timetable} ${error.message}`);
                bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                console.error(error);
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
                bot.sendMessage(chatId, `${userLang.errors.info} ${error.message}`);
                bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                console.error(error);
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
                        const sentMessage = await bot.sendMessage(dataChannel, '.', { reply_to_message_id: msgid }).catch((e) => { console.log(e) });
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
                bot.sendMessage(chatId, `${userLang.errors.fetch_timetable} ${error.message}`);
                bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                console.error(error);
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
                    bot.sendMessage(chatId, `${userLang.errors.fetch_timetable} ${error.message}`);
                    bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                    console.error(error);
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
                    bot.sendMessage(chatId, `${userLang.errors.fetch_timetable} ${error.message}`);
                    bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                    console.error(error);
                }
            }
        } else if (callbackQuery.data === 'ChangeData') {
            if (isChanging.includes(chatId)) {
                return;
            }
            isChanging.push(chatId);

            const parse_mode = { parse_mode: 'Markdown' };
            bot.sendMessage(chatId, `${userLang.untis_data.login}`, parse_mode);

            // Инициализируем сессию пользователя для ввода имени
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
                bot.sendMessage(chatId, `⛔️${error.message}`);
                bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
                console.error(error);
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
                    return bot.sendMessage(
                        chatId,
                        userLang.errors.untis_credentials_required
                    );
                }

                bot.sendMessage(
                    chatId,
                    `${userLang.errors.fetch_timetable} ${error.message}`
                );

                bot.sendMessage(
                    errChannel,
                    `ERROR:\nuser:${chatId}\n${error}`
                );

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
bot.launch().then(() => {
    console.log('Bot running.');
}).catch((err) => {
    console.error('Error launching bot:', err);
});
