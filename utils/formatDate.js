// ------------------------
// formatDate.js - formatDate function
// ------------------------

// main function
const formatDate = (date) => {
    const dateStr = date.toString();

    const day = dateStr.slice(6, 8);
    const month = dateStr.slice(4, 6);
    const year = dateStr.slice(2, 4);

    return `${day}.${month}.${year}`;
};

module.exports = {
    formatDate
};