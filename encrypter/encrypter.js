// -------------------------------
// encrypter.js - encrypt function
// -------------------------------


// siakinnik - deleted
// const {latinMap, cyrillicMap, digitsMap, symbolsMap} = require('./maps.js')
// const encrypt = (text) => {
//     return text
//       .replace(/[A-Za-z]/g, (match) => latinMap[match] || match)  
//       .replace(/[А-Яа-я]/g, (match) => cyrillicMap[match] || match) 
//       .replace(/[0-9]/g, (match) => digitsMap[match] || match)    
//       .replace(/[^A-Za-z0-9А-Яа-я]/g, (match) => symbolsMap[match] || match); 
//   };  

// Dependencides
const crypto = require("crypto"); // node.js built in

// Constants
const { cryptoPass, cryptoSalt } = require("../config");
const algorithm = 'aes-256-cbc';
const key = crypto.scryptSync(cryptoPass, cryptoSalt, 32);

// main function
const encrypt = (text) => {
    try {
        const iv = crypto.randomBytes(16); 
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const payload = iv.toString('hex') + ':' + encrypted;
        return Buffer.from(payload).toString('base64');
    } catch {
        return "error";
    }
};

module.exports = Object.assign(encrypt, { default: encrypt });