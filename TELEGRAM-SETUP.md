# Daily Telegram schedule

The workflow `.github/workflows/telegram-schedule.yml` targets **21:00 Asia/Manila daily** (13:00 UTC). GitHub Actions may delay or miss scheduled runs; delivery at exactly 21:00 is not guaranteed. Scheduled workflows in public repositories can be disabled after 60 days without activity. No paid service is required.

## Connect the bot once

1. In Telegram, open the verified [@BotFather](https://t.me/BotFather), send `/newbot`, and complete its name/username steps. Keep the token private.
2. Add your bot to the class group and allow it to send messages. It does not need administrator rights unless the group's restrictions require them.
3. Open [this repository's Actions secrets](https://github.com/Atticus-42/quiz-hub/settings/secrets/actions). Add `TELEGRAM_BOT_TOKEN` with the token and `TELEGRAM_CHAT_ID` with the group's negative numeric ID. Never put the token in the website, a commit, or a message to the group.
4. If posting to a particular group topic, also add `TELEGRAM_TOPIC_ID`. Otherwise omit it.
5. Open [Actions](https://github.com/Atticus-42/quiz-hub/actions), select **Tomorrow's schedule to Telegram**, and run it with **Preview tomorrow's post without sending it** checked. Review the preview.
6. Run it again with preview unchecked to verify one real group post. Once credentials are present, the daily workflow sends automatically. Do not manually resend if a network timeout leaves delivery uncertain; inspect the group first.

For a private group's chat ID, add the bot and send a command addressed to it in the group (for example `/schedule@YourBotUsername`). Telegram's `getUpdates` API returns the message's `chat.id`. Obtain this privately using the bot token; do not paste a token-bearing URL into public chats. Bots using an existing webhook require a different lookup; do not remove another integration's webhook.

## What it sends

- Tomorrow's date is calculated in Asia/Manila.
- Every activity includes time, instructor, venue and uniform when provided, plus a direct link to that selected day.
- It reads `data/schedule.json` checked out from `main`, so future updates use the same data as the website.
- If tomorrow is missing, it sends a short notice that the schedule has not been uploaded. It never silently sends an old week's activities.
- Long schedules are divided into Telegram-sized messages. Saved state prevents ordinary same-day reruns from duplicating posts, including already successful parts of a split message. This protection depends on GitHub's cache being retained; it is not an exactly-once delivery guarantee.
- Credentials and the group ID stay in repository secrets. The sender only logs the date and delivery result. Public workflow previews contain only the already-public timetable.

Local preview: `node scripts/telegram-schedule.mjs --preview`

Tests: `node --test scripts/test/telegram-schedule.test.mjs`

To stop posts, disable the workflow in GitHub Actions or remove its bot token secret.
