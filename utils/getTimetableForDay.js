// ---------------------------------
// getTimetableForDay.js - getTimetableForDay function
// ---------------------------------

// Dependencies
const api = require('webuntis'); // Untis web-api
const bot = require('./bot');
const {
    errChannel,
    school,
    domain
} = require('../config');
// Main function
const getTimetableForDay = async (chatId, username, pass, date) => {
    const untis = new api.WebUntis(school, username, pass, domain);
    try {
        await untis.login();
        try {
            untis.getCurrentSchoolyear()
        } catch {
            return 'NoSchoolYear'
        }
    } catch (e) {
        // bot.sendMessage(errChannel, `ERROR login:\nuser: ${chatId}\n${e}`)
        logger.log(`getTimetableForDay.js (line ${getLineNumber()}) | Unknown Error ${e.message}`, {
            level: 'error',
            error: e
        });
        return 'LoginFailed'
    }
    try {
        return await untis.getOwnTimetableFor(date)
    } catch (e) {
        // bot.sendMessage(errChannel, `ERROR:\nuser: ${chatId}\n${e}`);
        logger.log(`getTimetableForDay.js (line ${getLineNumber()}) | Unknown Error ${e.message}`, {
            level: 'error',
            error: e
        });
        return
    }
};

module.exports = { getTimetableForDay };