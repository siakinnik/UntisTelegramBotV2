// ------------------------
// menu.js - menu function
// ------------------------

// Dependencies
const bot = require('./bot'); // Telegram bot(Telegraf bot with some node-telegram-bot-api functions)

const {
    owner
} = require('../config');

// main function
const menu = async (lang, chatId, msg) => {
    const params = chatId === owner ? { chat_id: chatId, message_id: msg.message_id, reply_markup: { inline_keyboard: [[{ text: `${lang.menu.buttons.timetable}`, callback_data: 'timetable' }, { text: `${lang.menu.buttons.homework}`, callback_data: 'homework' }], [{ text: `${lang.menu.buttons.profile}`, callback_data: 'UntisData' }, { text: `${lang.menu.buttons.settings}`, callback_data: 'settings' }], [{ text: `${lang.adminPanel.buttons.header}`, callback_data: 'admin' }]] } } : { chat_id: chatId, message_id: msg.message_id, reply_markup: { inline_keyboard: [[{ text: `${lang.menu.buttons.timetable}`, callback_data: 'timetable' }, { text: `${lang.menu.buttons.homework}`, callback_data: 'homework' }], [{ text: `${lang.menu.buttons.profile}`, callback_data: 'UntisData' }, { text: `${lang.menu.buttons.settings}`, callback_data: 'settings' }]] } }
    bot.sendMessage(chatId, `${lang.menu.welcome.replace('{{firstName}}', msg.chat.first_name)}`, params)
};

module.exports = {
    menu
};