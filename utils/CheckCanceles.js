// ---------------------------------
// CheckCanceles.js - CheckCanceles function
// ---------------------------------

// Dependencies
// const api = require('webuntis'); // Untis web-api
const createConn = require('../db'); // MySQL-like sqlite wrapper
const decrypt = require('../encrypter/decrypter'); // Decription functions
const bot = require('./bot'); // Telegram bot(Telegraf bot with some node-telegram-bot-api functions)
const logger = require("./Logger"); // Custom Logger

// Constants
const {
    dataChannel,
    // school,
    // domain
} = require('../config');
const ru = require('../ru.json'); // Russian language package
const en = require('../en.json'); // English language package
const de = require('../de.json'); // German language package

// Functions && Variables

const { formatDate } = require("./formatDate"); // (date)
const { formatTime } = require("./formatTime");
const { processUserTimetable } = require("./processUserTimetable"); // async ({ user, username, password })

// Main function 
const CheckCanceles = async () => {
    let connection;
    try {
        connection = await createConn();

        const [users] = await connection.query(
            `SELECT telegramid, msgid, notif, lang FROM users WHERE notif = 'yes'`
        );

        for (const user of users) {
            try {
                if (!user.msgid) continue; // If user has no untis data - go to the next one
                const tempMsg = await bot.telegram.sendMessage(dataChannel, '.', {
                    reply_to_message_id: user.msgid
                });
                await bot.telegram.deleteMessage(dataChannel, tempMsg.message_id).catch(() => { });
                const msgText = tempMsg.reply_to_message?.text;
                if (!msgText) throw new Error('No stored credentials message');

                const parsed = JSON.parse(msgText);
                const username = decrypt(parsed.username);
                const password = decrypt(parsed.pass);

                const userLang = user.lang === 'EN' ? en : user.lang === 'RU' ? ru : de;

                /**
                { newChanges, fullData }
                */
                const data = await processUserTimetable({
                    user,
                    username,
                    password
                });

                const { newChanges } = data;

                if (newChanges.partialChanges && newChanges.partialChanges.length > 0) {
                    for (const lesson of newChanges.partialChanges) {
                        const room = lesson.ro && lesson.ro[0]; // Line SIX SEEEEVEN!!!
                        const displayRoom = room ? `${room.longname || '---'}(${room.name || '???'})` : "---";
                        const teachers = lesson.te || [];
                        const subject = lesson.su && lesson.su[0];

                        let messageText = "";

                        const roomChanged = !!room?.orgname;
                        const teacherChanged = teachers.some(t => t.orgname);
                        const formatedTeachers = teachers.map(t => `${t.longname || t.name || '???'} (${t.name || '???'})`).join(', ');
                        const formatedChangedTeachers = teachers.filter(t => t.orgname).map(t => `${t.orgname}`).join(', ');

                        if (roomChanged && teacherChanged) {
                            messageText = userLang.notifications.bothsubstit
                                .replace("{lesson.date}", formatDate(lesson.date))
                                .replace("{lesson.startTime}", formatTime(lesson.startTime))
                                .replace("{lesson.endTime}", formatTime(lesson.endTime))
                                .replace("{lesson.subjects[0].fullName}", subject?.longname || "---")
                                .replace("{lesson.subjects[0].shortName}", subject?.name || "---")
                                .replace("{lesson.rooms[0].orgname}", lesson.ro[0]?.orgname || "???")
                                // .replace("{lesson.rooms[0].fullName}", room?.longname || "---")
                                // .replace("{lesson.rooms[0].shortName}", room?.name || "---")
                                .replace("{lesson.rooms[0].fullName}", displayRoom)
                                .replace("{lesson.teachers[0].fullName}", formatedTeachers)
                                .replace("{lesson.teachers[0].orgname}", formatedChangedTeachers)
                        } else if (roomChanged) {
                            messageText = userLang.notifications.rosubstit
                                .replace("{lesson.date}", formatDate(lesson.date))
                                .replace("{lesson.startTime}", formatTime(lesson.startTime))
                                .replace("{lesson.endTime}", formatTime(lesson.endTime))
                                .replace("{lesson.subjects[0].fullName}", subject?.longname || "---")
                                .replace("{lesson.subjects[0].shortName}", subject?.name || "---")
                                .replace("{lesson.rooms[0].orgname}", lesson.ro[0]?.orgname || "???")
                                // .replace("{lesson.rooms[0].fullName}", room?.longname || "---")
                                // .replace("{lesson.rooms[0].shortName}", room?.name || "---")
                                .replace("{lesson.rooms[0].fullName}", displayRoom)
                                .replace("{lesson.teachers[0].fullName}", formatedTeachers)
                        } else if (teacherChanged) {
                            messageText = userLang.notifications.tesubstit
                                .replace("{lesson.date}", formatDate(lesson.date))
                                .replace("{lesson.startTime}", formatTime(lesson.startTime))
                                .replace("{lesson.endTime}", formatTime(lesson.endTime))
                                .replace("{lesson.subjects[0].fullName}", subject?.longname || "---")
                                .replace("{lesson.subjects[0].shortName}", subject?.name || "---")
                                // .replace("{lesson.rooms[0].fullName}", room?.longname || "---")
                                // .replace("{lesson.rooms[0].shortName}", room?.name || "---")
                                .replace("{lesson.rooms[0].fullName}", displayRoom)
                                .replace("{lesson.teachers[0].fullName}", formatedTeachers)
                                .replace("{lesson.teachers[0].orgname}", formatedChangedTeachers)
                        } else {
                            continue;
                        }

                        // siakinnik - ChatGPT written function!!!
                        const escapeMarkdownV2 = (text) => {
                            if (!text) return '';
                            const specials = ['\\', '.', '!', '[', ']', '(', ')', '{', '}', '>', '#', '+', '=', '|', '`', '-'];
                            specials.forEach(char => {
                                const re = new RegExp(`\\${char}`, 'g');
                                text = text.replace(re, `\\${char}`);
                            });
                            return text;
                        };
                        await bot.sendMessage(user.telegramid, escapeMarkdownV2(messageText), { parse_mode: "MarkdownV2" });
                    }
                }
            } catch (e) {
                logger.log(`CheckCanceles.js | Error processing user ${user.telegramid}: ${e.message}`, {
                    level: 'error',
                    error: e
                });
                if (connection) {
                    await connection.query(`UPDATE users SET msgid = 0 WHERE telegramid = ?`, [user.telegramid]);
                };
            };
        };
    } catch (e) {
        logger.log(`CheckCanceles.js | Unknown Error ${e.message}`, {
            level: 'error',
            error: e
        });
    } finally {
        if (connection) {
            await connection.close()
        };
    };
};

module.exports = { CheckCanceles };