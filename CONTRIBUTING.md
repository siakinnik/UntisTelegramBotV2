# Contributing to Untis Telegram Bot (v2)

Thank you for considering contributing to UntisBot! Even though this project is currently developed solely by Nikita Siakin, contributions are welcome in the future.  

## How to Contribute

### Reporting Bugs

If you find a bug:

1. Check the existing [issues](https://github.com/siakinnik/UntisTelegramBotV2/issues) to see if it has already been reported.
2. If not, open a new issue with a clear description, steps to reproduce, and expected behavior.

### Suggesting Features

1. Check open issues for similar suggestions.
2. Open a new issue with your feature proposal.
3. Provide reasoning and possible implementation details.

**Current TODOs:**

- Make inline admin-panel functional
- Update /getallusers data for new DB format
- Implement homework check
- Fix memory leak in nested bot.on('message', ...)
- Split large handlers into separate files
- Move Gemini AI interaction into a service module
- Optimize database queries
- Add AI settings to clear history and toggle AI

### Submitting Pull Requests

1. Fork the repository.
2. Create a new branch:  

   ```sh
   git checkout -b feature/my-new-feature
   ```

3. Make your changes following the project's style and guidelines.
4. Commit your changes with clear messages:

   ```sh
   git commit -m "Add description of change"
   ```

5. Push to your branch:

   ```sh
   git push origin feature/my-new-feature
   ```

6. Open a pull request describing your changes.

### Code Style

- Use consistent indentation (2 spaces).
- Keep code readable and modular.
- Write comments for complex logic.
- Follow existing conventions in the project.

### AI & Secrets

- Do not commit .env or any sensitive information.
- If you interact with AI modules, ensure API keys are stored only in .env.

### Communication

- For major changes, open an issue first to discuss.
- Respect all contributors and users

Thank you for helping make UntisBot better!
