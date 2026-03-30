// -------------------------------
// encrypter.js - decrypt function
// -------------------------------

// siakinnik - deleted
// const {reversedLatinMap, reversedCyrillicMap, reversedDigitsMap, reversedSymbolsMap} = require('./maps.js')
// const decrypt = (text) => {
//     return text      
//     .replace(/[A-Za-z]/g, (match) => reversedLatinMap[match] || match)  
//     .replace(/[А-Яа-я]/g, (match) => reversedCyrillicMap[match] || match) 
//     .replace(/[0-9]/g, (match) => reversedDigitsMap[match] || match)    
//     .replace(/[^A-Za-z0-9А-Яа-я]/g, (match) => reversedSymbolsMap[match] || match); 
//   }

// Dependencides
const crypto = require("crypto"); // node.js built in

// Constants
const { cryptoPass, cryptoSalt } = require("../config");
const algorithm = 'aes-256-cbc';
const key = crypto.scryptSync(cryptoPass, cryptoSalt, 32);
// const iv = crypto.randomBytes(16);

// main function
const decrypt = (text) => {
  try {
    const decoded = Buffer.from(text, "base64").toString("utf8");
    const [ivHex, encrypted] = decoded.split(":");
    if (!ivHex || !encrypted) return "error";
    const iv = Buffer.from(ivHex, "hex");
    if (iv.length !== 16) return "error";
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "error";
  };
};

module.exports = Object.assign(decrypt, { default: decrypt });
