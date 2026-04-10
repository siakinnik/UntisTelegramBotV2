# Untis Telegram Bot (v2)

![Status](https://img.shields.io/badge/status-production-green)
![License](https://img.shields.io/badge/license-MIT-blue)

<img width="962" height="810" alt="image" src="https://github.com/user-attachments/assets/65633569-c372-42fb-9a7d-7875ddcd778f" />

**✅ Current Version: v2**  
v2 is the **active, maintained version** of UntisBot.  
The older repository/version is **outdated, broken, and not recommended**. Use this version instead.  

**BUILT IN AI**
Can be turned off in config.js

## Technical Stack & Security

- **Framework:** Telegraf (Telegram bot library for Node.js)
- **Database:** SQLite for storing user settings and metadata
- **Encryption:** AES encryption of Untis logins and passwords, stored as Base64 in a dedicated Telegram channel
- **AI Integration:** Gemini AI (optional, controlled via config.js)
- **Secrets Management:** All sensitive keys and tokens are stored in `.env` and never committed to the repository

UntisBot is a multilingual Telegram bot (Russian, English, and German) made to keep you updated with your school timetable. It provides features, such as checking your timetable every hour for the next 3 days and notifying you about canceled or substituted classes, or built in AI assistant.

## Features

- **Timetable Access**: Get your daily timetable directly in Telegram.
- **Instant Notifications**: Receive alerts about canceled classes and substitutions.
- **AI Assistant**:  Ask questions in Russian, English, or German (Gemini AI integration).  
<!-- - **Homework Tracker**: Keep track of your homework assignments and due dates. -->

## Notifications

UntisBot will notify you about:

- Canceled classes
- Substitutions

## Installation

To install UntisBot, follow these steps:

1. Clone the repository:

   ```sh
   git clone https://github.com/siakinnik/UntisTelegramBotV2.git
   ```

2. Navigate to the project directory:

   ```sh
   cd UntisTelegramBotV2
   ```

3. Install the required dependencies:

   ```sh
   npm install
   ```

4. Configure your Telegram bot token and other secrets in `.env`:

   ```env
   BOT_TOKEN=TelegramBotToken // Telegram bot token
   CRYPTO_PASS=changeMeInProduction  // Pass for AES
   CRYPTO_SALT=changeMeInProduction // Salt for AES
   API_KEY=GeminiApiKey  // Gemini api key, only needed if aiEnabled = true in config.js
   DB_PATH=./untis.db // Path to database
   OWNER=OwnerUserId(Not username) // Owner's telegram chat id(not username)
   DATACN=ChannelForUntisId(Not username, do not forget -100) // Channel for untis logins/passwords (AES + base64)
   ERRCN=ChannelForErrorLogsId(Not username, do not forget -100) // Channel for errors
   SCHOOL=YourUntisSchoolName // School name on untis
   UNTIS_DOMAIN=example:wilhelms-gymnasium.webuntis.com // School domain on untis (no http/https in front of it)
   ```

5. (Optional) change settings in `config.js`.

6. Start the bot:

   ```sh
   node index.js
   ```

## Database Management

To edit the database, use the following command in the project folder:

```sh
node sqlite-CLI.js
```

Specify the database name as configured in `dbPath` inside `.env`:

```sh
node sqlite-CLI.js <database_name>
```

## Usage

Once the bot is running, you can interact with it through Telegram using the following commands:

### Users & Admin Commands

- `/start` - Start the bot and receive a welcome message with options (Timetable, Homework, Settings, Untis Login Data).
- `/lang` - Select your preferred language.
- `/timetable` - Timetable.
- `/resetai` - Reset ai memory

### Admin-Only Commands

- `/sendall` - Prompts for a message to send to all users.
- `/sendall <message>` - Sends the specified message to all users.
- `/getallusers` - Retrieves a list of all user Telegram IDs.
- `/getallusers data` - Retrieves a list of all users along with their data (excluding Untis passwords and usernames).

## Contributing

We welcome contributions! Feel free to participate in the development of UntisBot.

**Contributor TODOs:**

- Make inline admin-panel functional
- Update /getallusers data for new DB format
- Implement homework check
- Fix memory leak in nested bot.on('message', ...)
- Split large handlers into separate files
- Move Gemini AI interaction into a service module
- Optimize database queries
- Add AI settings to clear history and toggle AI

## License

This project is licensed under the MIT License. See the [LICENSE](./License.md) file for details.

## Contact

If you have any questions or need assistance, feel free to contact me(Nikita) at [siakin-nikita@siakinnik.com](mailto:siakin-nikita@siakinnik.com).
