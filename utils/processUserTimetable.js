// ---------------------------------
// processUserTimetable.js - processUserTimetable helper function
// for CheckCanceles and goodMorning
// ---------------------------------

// Dependencies
const api = require('webuntis'); // Untis web-api

// Constants
const {
    school,
    domain
} = require('../config');

const prevData = require("../store/prevData");

const processUserTimetable = async ({ user, username, password }) => {
    const untis = new api.WebUntis(school, username, password, domain);
    try {
        await untis.login();
    } catch {
        throw new Error("LOGIN_FAILED")
    };

    // const dates = [-3, -4, -5].map(offset => {
    const dates = [1, 2, 3].map(offset => {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        return date;
    });

    const data = (await Promise.all(
        dates.map(date => untis.getOwnTimetableFor(date).catch((e) => { return [] }))
    )).flat();

    const canceledLessons = data.filter(lesson => lesson.code === 'cancelled');
    const irregularLessons = data.filter(lesson => lesson.code === 'irregular');
    const partialChanges = data.filter(lesson => {
        if (lesson.code === 'cancelled' || lesson.code === 'irregular') return false;
        const roomChange = lesson.ro && lesson.ro[0] && lesson.ro[0].orgname;
        const teacherChange = lesson.te && lesson.te[0] && lesson.te[0].orgname;
        return roomChange || teacherChange;
    });


    if (!prevData[user.telegramid]) {
        prevData[user.telegramid] = { canceled: {}, irregular: {}, partial: {} };
    };

    const lastUserData = prevData[user.telegramid];

    const newCanceled = canceledLessons.filter(l => !lastUserData.canceled[l.id]);
    const newIrregular = irregularLessons.filter(l => !lastUserData.irregular[l.id]);
    const newPartial = partialChanges.filter(l => !lastUserData.partial[l.id]);

    newCanceled.forEach(l => lastUserData.canceled[l.id] = true);
    newIrregular.forEach(l => lastUserData.irregular[l.id] = true);
    newPartial.forEach(l => lastUserData.partial[l.id] = true);

    const newChanges = { canceledLessons: newCanceled, irregularLessons: newIrregular, partialChanges: newPartial };
    const fullData = { canceledLessons, irregularLessons, partialChanges, lessons: data };

    // newCanceled.forEach(l => lastUserData.canceled[l.id] = true);
    // newIrregular.forEach(l => lastUserData.irregular[l.id] = true);

    return { newChanges, fullData }
};

module.exports = {
    processUserTimetable
};