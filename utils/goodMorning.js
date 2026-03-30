// ---------------------------------
// goodMorning.js - goodMorning function
// ---------------------------------

// Dependencies
const api = require('webuntis'); // Untis web-api
const createConn = require('../db'); // MySQL-like sqlite wrapper
const decrypt = require('../encrypter/decrypter'); // Decription functions
const bot = require('./bot'); // Telegram bot(Telegraf bot with some node-telegram-bot-api functions)

// Constants
const {
    dataChannel,
    errChannel,
    school,
    domain
} = require('../config');
const ru = require('../ru.json'); // Russian language package
const en = require('../en.json'); // English language package
const de = require('../de.json'); // Germal language package

// Functions && Variables
const prevData = require("../store/prevData");

const { formatDate } = require("./formatDate"); // (date)
const { formatTime } = require("./formatTime");


// Main function
const goodMorning = async () => {
    let connection;
    try {
        connection = await createConn();
        const [results] = await connection.query(
            `SELECT telegramid, msgid, morningNotif, lang FROM users`
        );
        // results.forEach(async (user) => {
        for (const user of results) {
            const msgid = user.msgid
            if (msgid !== 0 && user.morningNotif === 'yes') {
                const sentMessage = await bot.sendMessage(dataChannel, '.', { reply_to_message_id: msgid })
                    .catch(async () => {
                        await connection.query(
                            `UPDATE users SET msgid = ? WHERE telegramid = ?`, [0, user.telegramid]
                        );
                    });
                if (!sentMessage || !sentMessage.reply_to_message || !sentMessage.reply_to_message.text) {
                    await connection.query(
                        `UPDATE users SET msgid = 0 WHERE telegramid = ?`,
                        [user.telegramid]
                    );
                    continue;
                }
                await bot.telegram.deleteMessage(dataChannel, sentMessage.message_id).catch(() => { })
                // const parsedData = JSON.parse(sentMessage.reply_to_message.text)
                // const username = decrypt(parsedData.username);
                // const password = decrypt(parsedData.pass);
                let parsedData, username, password;
                try {
                    parsedData = JSON.parse(sentMessage.reply_to_message.text);
                    username = decrypt(parsedData.username);
                    password = decrypt(parsedData.pass);
                } catch (err) {
                    await connection.query(`UPDATE users SET msgid = 0 WHERE telegramid = ?`, [user.telegramid]);
                    continue;
                }
                const userLang = user.lang === 'EN' ? en : user.lang === 'RU' ? ru : de
                try {
                    const untis = new api.WebUntis(school, username, password, domain);
                    await untis.login()
                    try {
                        untis.getCurrentSchoolyear()
                    } catch {
                        return 'NoSchoolYear'
                    }
                    const data = await untis.getOwnTimetableFor(new Date());
                    if (!prevData[user.telegramid]) {
                        prevData[user.telegramid] = { canceled: {}, irregular: {} };
                    };
                    const getCanceles = async () => {
                        const canceledLessons = data.filter(lesson => lesson.code === 'cancelled');
                        const irregularLessons = data.filter(lesson => lesson.code === 'irregular');

                        const teacherSubstit = data.filter(lesson => {
                            const key = `${lesson.date}(${lesson.startTime})`;
                            const existingLesson = prevData[user.telegramid]?.[key];

                            if (!existingLesson || JSON.stringify(existingLesson.teachers) !== JSON.stringify(lesson.te)) {
                                prevData[user.telegramid] = prevData[user.telegramid] || { canceled: {}, irregular: {} };
                                prevData[user.telegramid][key] = {
                                    teachers: lesson.te,
                                    rooms: lesson.ro,
                                    subjects: lesson.su,
                                    date: lesson.date,
                                    startTime: lesson.startTime,
                                    endTime: lesson.endTime,
                                    code: lesson.code
                                };
                                return true;
                            }
                            return false;
                        });

                        const roomSubstit = data.filter(lesson => {
                            const key = `${lesson.date}(${lesson.startTime})`;
                            const existingLesson = prevData[user.telegramid]?.[key];

                            if (!existingLesson || JSON.stringify(existingLesson.rooms) !== JSON.stringify(lesson.ro)) {
                                prevData[user.telegramid] = prevData[user.telegramid] || { canceled: {}, irregular: {} };
                                prevData[user.telegramid][key] = {
                                    teachers: lesson.te,
                                    rooms: lesson.ro,
                                    subjects: lesson.su,
                                    date: lesson.date,
                                    startTime: lesson.startTime,
                                    endTime: lesson.endTime,
                                    code: lesson.code
                                };
                                return true;
                            }
                            return false;
                        });

                        prevData[user.telegramid] = prevData[user.telegramid] || { canceled: {}, irregular: {} };

                        data.forEach((lesson) => {
                            const key = `${lesson.date}(${lesson.startTime})`;
                            prevData[user.telegramid][key] = {
                                teachers: lesson.te,
                                rooms: lesson.ro,
                                subjects: lesson.su,
                                date: lesson.date,
                                startTime: lesson.startTime,
                                endTime: lesson.endTime,
                                code: lesson.code,
                                status: lesson.code || 'active'
                            };
                        });

                        const mapLesson = lesson => ({
                            startTime: lesson.startTime,
                            endTime: lesson.endTime,
                            teachers: lesson.te.map(t => ({ shortName: t.name, fullName: t.longname })),
                            rooms: lesson.ro.map(r => ({ shortName: r.name, fullName: r.longname })),
                            subjects: lesson.su.map(s => ({ shortName: s.name, fullName: s.longname })),
                            date: lesson.date
                        });

                        const notifyUser = (lesson, template, type) => {
                            const key = `${lesson.date}(${lesson.startTime})`;
                            if (!prevData[user.telegramid][type][key]) {
                                prevData[user.telegramid][type][key] = lesson;

                                const data = lesson.teachers.map(t => `${t.fullName}(${t.shortName})`).join(', ') || '???';

                                const msg = template
                                    .replace('{lesson.date}', formatDate(lesson.date))
                                    .replace('{lesson.startTime}', formatTime(lesson.startTime) || '?')
                                    .replace('{lesson.endTime}', formatTime(lesson.endTime) || '?')
                                    .replace('{lesson.subjects[0].fullName}', lesson.subjects[0]?.fullName || '???')
                                    .replace('{lesson.subjects[0].shortName}', lesson.subjects[0]?.shortName || '???')
                                    .replace('{data}', data)
                                    .replace('{lesson.rooms[0].fullName}', lesson.rooms[0]?.fullName || '?')
                                    .replace('{lesson.rooms[0].shortName}', lesson.rooms[0]?.shortName || '???');

                                bot.sendMessage(user.telegramid, msg, { parse_mode: "Markdown" });
                            }
                        };

                        // canceledLessons.map(mapLesson).forEach(lesson =>
                        //     notifyUser(lesson, userLang.notifications.canceled, 'canceled')
                        // );
                        canceledLessons.forEach(lesson => notifyUser(mapLesson(lesson), userLang.notifications.canceled, 'canceled'));

                        // irregularLessons.map(mapLesson).forEach(lesson =>
                        //     notifyUser(lesson, userLang.notifications.substit, 'irregular')
                        // );

                        irregularLessons.forEach(lesson => notifyUser(mapLesson(lesson), userLang.notifications.substit, 'irregular'));

                        teacherSubstit.map(mapLesson).forEach(lesson => {
                            const data = lesson.teachers.map(t => `${t.fullName}(${t.shortName})`).join(', ') || '???';
                            const msg = userLang.notifications.tesubstit
                                .replace('{lesson.date}', formatDate(lesson.date))
                                .replace('{lesson.startTime}', formatTime(lesson.startTime) || '?')
                                .replace('{lesson.endTime}', formatTime(lesson.endTime) || '?')
                                .replace('{lesson.subjects[0].fullName}', lesson.subjects[0]?.fullName || '???')
                                .replace('{lesson.subjects[0].shortName}', lesson.subjects[0]?.shortName || '???')
                                .replace('{data}', data)
                                .replace('{lesson.rooms[0].fullName}', lesson.rooms[0]?.fullName || '?')
                                .replace('{lesson.rooms[0].shortName}', lesson.rooms[0]?.shortName || '???');

                            bot.sendMessage(user.telegramid, msg, { parse_mode: "Markdown" });
                        });

                        roomSubstit.map(mapLesson).forEach(lesson => {
                            const data = lesson.teachers.map(t => `${t.fullName}(${t.shortName})`).join(', ') || '???';
                            const msg = userLang.notifications.rosubstit
                                .replace('{lesson.date}', formatDate(lesson.date))
                                .replace('{lesson.startTime}', formatTime(lesson.startTime) || '?')
                                .replace('{lesson.endTime}', formatTime(lesson.endTime) || '?')
                                .replace('{lesson.subjects[0].fullName}', lesson.subjects[0]?.fullName || '???')
                                .replace('{lesson.subjects[0].shortName}', lesson.subjects[0]?.shortName || '???')
                                .replace('{data}', data)
                                .replace('{lesson.rooms[0].fullName}', lesson.rooms[0]?.fullName || '?')
                                .replace('{lesson.rooms[0].shortName}', lesson.rooms[0]?.shortName || '???');

                            bot.sendMessage(user.telegramid, msg, { parse_mode: "Markdown" });
                        });
                    };
                    await getCanceles();
                } catch (e) {
                    bot.sendMessage(errChannel, `Error:\n${e.message}`);
                    bot.telegram.deleteMessage(dataChannel, msgid).catch(() => { });
                    // const connection = await createConn()
                    if (connection) {
                        await connection.query(
                            `UPDATE users SET msgid = 0 WHERE telegramid = ?`, [user.telegramid]
                        );
                        // await connection.close();
                    };
                    return
                }
            }
        }
        // );
        // await connection.close();
    } catch (e) {
        bot.sendMessage(errChannel, `ERROR:\n${e}`);
    } finally {
        if (connection) await connection.close();
        return;
    };
};

module.exports = { goodMorning };