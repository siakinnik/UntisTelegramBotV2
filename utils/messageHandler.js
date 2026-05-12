// ---------------------------------
// messageHandler.js - onMessage function
// ---------------------------------

// Dependencies
const api = require('webuntis'); // Untis web-api
const createConn = require('../db'); // MySQL-like sqlite wrapper
const encrypt = require('../encrypter/encrypter'); // Encryption function
const decrypt = require('../encrypter/decrypter'); // Decription functions
const bot = require('./bot'); // Telegram bot(Telegraf bot with some node-telegram-bot-api functions)
const { GoogleGenAI } = require('@google/genai'); // Gemeni
const logger = require("./Logger"); // Custom Logger

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
} = require('../config');
const ru = require('../locales/ru.json'); // Russian language package
const en = require('../locales/en.json'); // English language package
const de = require('../locales/de.json'); // German language package


// Functions && Variables
const activeSessions = require("../store/activeSessions");
const isChanging = require('../store/isChanging');
const memory = require("../store/memory");
const adminStates = {};

const { menuButton } = require("./menuButton"); // (lang) 
const { Lang } = require("./lang"); // async (ctx) 
const { menu } = require("./menu"); // async (lang, chatId, msg) 
const { ShowTimetable } = require("./ShowTimetable");
const { getHomeworksForWeek } = require("./getHomeworksForWeek");
const { getTimetableForDay } = require("./getTimetableForDay");
const { formatTimetable } = require("./formatTimetable");
const { getLineNumber } = require("./getLineNumber");
const { isInOwner } = require("./isInOwner"); // (owner, id)

const ai = new GoogleGenAI({ apiKey: `${apiKey}` });

// Main function
const onMessage = async (ctx) => {
    const msg = ctx.message;
    const isOwner = isInOwner(owner, msg.from.id);

    if (msg.chat.type !== 'private') {
        return;
    };

    if (onlyOwner && !isOwner) {
        return;
    };

    const currentDate = new Date();
    const currentTimestamp = Date.now()
    const chatId = msg.chat.id;

    let lang;
    let userLang;

    if (!msg.text) {
        return ctx.reply('Only text.', { reply_markup: { inline_keyboard: [menuButton(en)] } })
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
        // logger.log("DEBUG DB:", chatId, DBinfo, { level: "info" });
        if (lang === null) {
            if (/^\/lang( (.+))?$/.test(msg.text)) {
                Lang(ctx)
            } else {
                // ctx.reply(`Bitte wählen Sie eine Sprache aus - /lang.\n\nПожалуйста выберите язык - /lang.\n\nPlease select a language - /lang.`);
                Lang(ctx);
            };
        } else {
            userLang = lang === 'RU' ? ru : lang === 'EN' ? en : lang === 'DE' ? de : null;
            if (isOwner && adminStates[ctx.chat.id]?.sending === true) {
                try {
                    const [results] = await connection.query(`SELECT telegramid FROM users`);
                    for (const user of results) {
                        if (!isInOwner(owner, user.telegramid)) {
                            try {
                                await ctx.telegram.copyMessage(
                                    user.telegramid,
                                    ctx.chat.id,
                                    ctx.message.message_id
                                );
                            } catch (e) {
                                logger.log(`index.js (line ${getLineNumber()}) | Unknown Error ${e.message}`, {
                                    level: 'error',
                                    error: e
                                });
                            }
                        }
                    }

                    await ctx.telegram.sendMessage(owner, userLang.adminPanel.sendall.success);
                } catch (error) {
                    await ctx.telegram.sendMessage(owner, `${userLang.errors.unknown_error} ${error.message}`);
                    logger.log(`index.js(line ${getLineNumber()}) | Unknown error: ${error.message}`, { level: "error", error: error })
                    // await ctx.telegram.sendMessage(errChannel, `ERROR:\nuser:${ownerId}\n${error}`);
                } finally {
                    adminStates[ctx.chat.id] = { sending: false };
                    if (connection) {
                        await connection.close()
                    }
                    return
                };
            };
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
                        logger.log(`index.js (line ${getLineNumber()}) | Unknown Error ${e.message}`, {
                            level: 'error',
                            error: e
                        });
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
                            { parse_mode: "MarkdownV2", reply_markup: { inline_keyboard: [menuButton(userLang)] } }
                        ).catch((e) => {
                            logger.log(`index.js (line ${getLineNumber()}) | Unknown Error ${e.message}`, {
                                level: 'error',
                                error: e
                            });
                        });
                        // await connection.close();
                    } catch (error) {
                        await ctx.reply(`${userLang.errors.unknown_error} ${error.message}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                        logger.log(`index.js (line ${getLineNumber()}) | Unknown Error ${error.message}`, {
                            level: 'error',
                            error: error
                        });
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
            } else if (/^\/start(\s+(.+))?$/.test(msg.text)) {

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
                            ctx.reply(`${userLang.errors.untis_credentials_required}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
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
                    await ctx.reply(`⛔️${userLang.errors.fetch_timetable}. ${error.message}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                    logger.log(`index.js (line ${getLineNumber()}) | Unknown Error ${error.message}`, {
                        level: 'error',
                        error: error
                    });
                }
            } else if (/^\/donate( (.+))?$/.test(msg.text)) {
                // siakinnik - deleted, no donations
            } else if (msg.text.toLowerCase() === 'menu' || msg.text.toLowerCase() === 'меню' || msg.text.toLowerCase() === 'menü') {
                menu(userLang, chatId, msg)
            } else if (msg.text === '/resetai') {
                if (memory[chatId]) {
                    delete memory[chatId];
                    await ctx.reply(userLang.ai.memoryCleared, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                } else {
                    await ctx.reply(userLang.ai.memoryEmpty, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
                }
            } else {
                let username, password;
                const [results] = await connection.query(
                    `SELECT * FROM users WHERE telegramid = ?`, [chatId]
                );
                if (results.length > 0) {
                    const msgId = results[0].msgid
                    if (msgId === 0) {
                        ctx.reply(`${userLang.errors.untis_credentials_required}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } })
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
                if (!isOwner) {
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
                if (memory[chatId].filter(m => m.you).length > ownerAiLimit && isOwner) {
                    while (memory[chatId].filter(m => m.you).length > ownerAiLimit) {
                        memory[chatId].shift();
                    };
                }

                if (results[0].msgCount > userAiLimit && !isOwner) {
                    // console.log('test')
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

                if (isOwner) {
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

                            bot.sendMessage(ctx.chat.id, `${adminLang.adminPanel.getUsers.header}${toShow(results)}`, { parse_mode: 'Markdown' });
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
                            bot.sendMessage(ctx.chat.id, `${adminLang.adminPanel.getUsers.header}TG id|Message id|Notif|Lang\n\n${toShow(results)}`, { parse_mode: 'Markdown' });
                        }
                    } else if (/^\/sendall( (.+))?$/.test(msg.text)) {
                        const adminLang = userLang;
                        const messageToSend = msg.text.split(' ').slice(1).join(' ');
                        const [results] = await connection.query(`SELECT telegramid FROM users`);
                        if (!messageToSend || messageToSend === '') {
                            bot.sendMessage(ctx.chat.id, adminLang.adminPanel.sendall.header, { parse_mode: 'Markdown' })
                            adminStates[ctx.chat.id] = { sending: true };
                            return
                        } else {
                            results.forEach(user => {
                                if (user.telegramid !== owner) {
                                    try {
                                        bot.sendMessage(user.telegramid, `${messageToSend.replace(/\\n/gi, '\n')}`, { parse_mode: "Markdown" }).catch((e) => logger.log(`index.js(line ${getLineNumber()}) | Unknown error: ${e.message}`, { level: "error", error: e }));
                                    } catch (e) {
                                        logger.log(`index.js(line ${getLineNumber()}) | Unknown error: ${e.message}`, { level: "error", error: e })
                                    }
                                }
                            });
                            bot.sendMessage(ctx.from.id, adminLang.adminPanel.sendall.success);
                        }
                    }
                }
            }
        }
    } catch (error) {
        ctx.reply(`⛔️${error.message}`, { reply_markup: { inline_keyboard: [menuButton(userLang)] } });
        // bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${error}`);
        logger.log(`index.js(line ${getLineNumber()}) | Unknown error: ${error.message}`, {
            level: 'error',
            error: error
        });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch { }; // fail-safe
        };
    }
};

module.exports = { onMessage }