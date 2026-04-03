// ---------------------------------
// ShowTimetable.js - ShowTimetable function
// ---------------------------------

// Dependencies
const bot = require('./bot'); // Telegram bot(Telegraf bot with some node-telegram-bot-api functions)
const dateTools = require('date-fns'); // Date formating tool
const createConn = require('../db'); // MySQL-like sqlite wrapper
const { getLineNumber } = require("./getLineNumber");

// Constants
const {
    dataChannel,
    // errChannel
} = require('../config');

const { menuButton } = require("./menuButton"); // (lang) 
const { menu } = require("./menu"); // async (lang, chatId, msg) 
const { getTimetableForDay } = require("./getTimetableForDay");
const { getTimetableForWeek } = require("./getTimetableForWeek");
const { formatTimetable } = require("./formatTimetable");

// Main function
const ShowTimetable = async (lang, currentView, username, password, chatId, msg, currentDate, date, timestamp, msgId) => {
    let connection;
    try {
        connection = await createConn();
        const timetable = currentView === 'day' ? await getTimetableForDay(chatId, username, password, date) : await getTimetableForWeek(username, password, date);
        if (timetable === 'LoginFailed') {
            await bot.sendMessage(chatId, lang.errors.login, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        menu(lang)
                    ]
                }
            });
            await bot.telegram.deleteMessage(dataChannel, msgId).catch(() => { });
            await connection.query(
                `UPDATE users SET msgid = 0 WHERE telegramid = ?`, [chatId]
            );
            await connection.close();
            return
        }
        timetable.sort((a, b) => a.startTime - b.startTime);
        const startDate = date
        const endDate = currentView === 'week' ? dateTools.endOfWeek(new Date(), { weekStartsOn: 1 }) : currentDate;
        const formattedTimetable = formatTimetable(lang, timetable, currentView, startDate, endDate);
        await bot.sendMessage(chatId, formattedTimetable, {
            chat_id: chatId,
            message_id: msg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: currentView === 'day' ? `${lang.timetable.buttons.week_view}` : `${lang.timetable.buttons.day_view}`, callback_data: `toggle_view:${timestamp}` },
                        { text: `${lang.timetable.buttons.prev}`, callback_data: `prev:${timestamp}` },
                        { text: `${lang.timetable.buttons.next}`, callback_data: `next:${timestamp}` },
                    ],
                    menuButton(lang)
                ]
            }
        });
    } catch (e) {
        if (e.name === 'TypeError') {
            await bot.sendMessage(chatId, lang.timetable.error.replace('{{date}}', `${date}`), {
                chat_id: chatId,
                message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: currentView === 'day' ? `${lang.timetable.buttons.week_view}` : `${lang.timetable.buttons.day_view}`, callback_data: `toggle_view:${timestamp}` },
                            { text: `${lang.timetable.buttons.prev}`, callback_data: `prev:${timestamp}` },
                            { text: `${lang.timetable.buttons.next}`, callback_data: `next:${timestamp}` },
                        ],
                        menuButton(lang)
                    ]
                }
            })
        } else {
            // await bot.sendMessage(errChannel, `ERROR:\nuser:${chatId}\n${e}`);
            logger.log(`ShowTimetable.js (line ${getLineNumber()}) | Unknown Error ${e.message}`, {
                level: 'error',
                error: e
            });
            console.error(e);
        };
    } finally {
        if (connection) await connection.close();
    };
};

module.exports = { ShowTimetable };