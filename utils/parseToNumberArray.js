// ---------------------------------
// parseToNumberArray.js - parseToNumberArray function
// ---------------------------------

// Main function
const parseToNumberArray = (value) => {
    if (!value) return undefined;
    if (value.trim().startsWith("[")) {
        try {
            return JSON.parse(value).map(Number).filter(n => !Number.isNaN(n));
        } catch (e) {
            return undefined;
        }
    }
    return value
        .split(",")
        .map(v => v.trim())
        .filter(Boolean)
        .map(Number)
        .filter(n => !Number.isNaN(n));
};

module.exports = { parseToNumberArray };
