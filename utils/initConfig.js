// ---------------------------------
// initConfig.js - initConfig function, creates config file if not exists
// ---------------------------------

const fs = require('fs');
const path = require('path');

const initConfig = () => {
    try {
        const configPath = path.join(__dirname, '../config.js');
        const examplePath = path.join(__dirname, '../config.js.example');

        const configExists = fs.existsSync(configPath);

        if (configExists) {
            try {
                fs.copyFileSync(example, target);
                console.log('\x1b[33m%s\x1b[0m', 'Config file was not found and created using example.');
                console.log('Please change settings in config.js and run index.js again.\nAlso don\'t forget about .env');
                process.exit(0);
            } catch (err) {
                console.error('Unknown error in initConfig.js', err);
                process.exit(1);
            }
        }
        try {
            const currentConfig = require(configPath);
            const exampleConfig = require(examplePath);

            const currentKeys = Object.keys(currentConfig);
            const exampleKeys = Object.keys(exampleConfig);

            const missingKeys = exampleKeys.filter(key => !currentKeys.includes(key));

            if (missingKeys.length > 0) {
                console.error("\x1b[31m%s\x1b[0m", "===============================================");
                console.error("\x1b[31m%s\x1b[0m", "       CRITICAL ERROR: CONFIG INVALID          ");
                console.error("\x1b[31m%s\x1b[0m", "===============================================");
                console.error(`Missing keys in config.js: ${missingKeys.join(', ')}`);
                console.log("\nIt seems the configuration structure has changed after an update.");
                console.log("Recommended actions:");
                console.log("1. Back up your current settings from config.js.");
                console.log("2. Delete the existing config.js file.");
                console.log("3. Run index.js again to generate a fresh config.js from the example.");
                console.log("4. Restore your settings into the new config.js file.");
                process.exit(1);
            }
        } catch (err) {
            console.error("\x1b[31m%s\x1b[0m", "ERROR: Could not validate config structure.");
            console.error(err.message);
            process.exit(1);
        }
        return;
    } catch (err) {
        console.error("Unknown error in initConfig.js", err)
        process.exit(1);
    }
};

module.exports = { initConfig };

