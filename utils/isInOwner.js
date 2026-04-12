// ---------------------------------
// isInOwner.js - isInOwner function
// ---------------------------------

const isInOwner = (owner, id) => {
    return owner.indexOf(id) !== -1;
};

module.exports = { isInOwner };
