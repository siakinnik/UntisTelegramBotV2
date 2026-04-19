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
const ru = require('../locales/ru.json'); // Russian language package
const en = require('../locales/en.json'); // English language package
const de = require('../locales/de.json'); // Germal language package

// Functions && Variables
const prevData = require("../store/prevData");

const { formatDate } = require("./formatDate"); // (date)
const { formatTime } = require("./formatTime");


// Main function
const goodMorning = async () => {
// siakinnik - to rewrite like CheckCanceles.js
};

module.exports = { goodMorning };