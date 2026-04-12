// ---------------------------------
// isInOwner.js - isInOwner function
// ---------------------------------

const isInOwner = (owner, id) => {
    return owner.indexOf(msg.chat.id) !== -1;
};

module.exports = { isInOwner };
