// ---------------------------------
// formatTimetable.js - formatTimetable function
// ---------------------------------

const { formatTime } = require("./formatTime");

// Main function
const formatTimetable = (lang, timetable, view = `day`, startDate) => {
    let result
    if (view === `day`) {
        result = `${lang.timetable.header} ${startDate.toDateString() === new Date().toDateString() ? `${lang.timetable.today}` : startDate.toLocaleDateString()}\n\n`;
        if (timetable.length === 0) {
            result += `${lang.timetable.no_lessons}`;
        } else {
            timetable.forEach(entry => {
                const startTime = formatTime(entry.startTime);
                const endTime = formatTime(entry.endTime);
                const getTeachers = () => {
                    let count = 0;
                    let result = ``;
                    entry.te.forEach(te => {
                        count += 1;
                        if (count > 1) {
                            result += `, `;
                        }
                        result += `${te.longname}(${te.name})`;
                    });
                    return result;
                };
                const teacher = entry.te && entry.te[0] ? getTeachers() : '-';
                const subject = entry.su && entry.su[0] ? `${entry.su[0].longname}(${entry.su[0].name})` : '-';
                const room = entry.ro && entry.ro[0] ? `${entry.ro[0].longname}(${entry.ro[0].name})` : '-';
                const status = entry.code === 'cancelled' ? `${lang.timetable.canceled}` : `${lang.timetable.active}`;
                result += `${startTime}-${endTime}\n${lang.timetable.lesson.teacher} ${teacher}\n${lang.timetable.lesson.subject} ${subject}\n${lang.timetable.lesson.room} ${room}\n${lang.timetable.lesson.status} ${status}\n-----------------------------\n`;
            });
        }
    } else if (view === 'week') {
        result = `${lang.timetable.week.unavailable}`
    }
    return result;
};


module.exports = { formatTimetable };