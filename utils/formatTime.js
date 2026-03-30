// ---------------------------------
// formatTime.js - formatTime function
// ---------------------------------

const formatTime = (time) => {
    const hours = Math.floor(time / 100);
    const minutes = time % 100;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

module.exports = { formatTime };