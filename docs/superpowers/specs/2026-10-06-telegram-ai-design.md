# SOAC52 conversational Telegram bot

Status: approved by the owner on 2026-10-06. No chat service is activated.

## Outcome and approved direction

Make the existing @SOAC52_bot conversational in private messages and the existing class group. It should explain lessons, help with quizzes and the website, answer schedule/menu questions, and discuss general topics in English or Filipino. The owner approved Cloudflare Workers Free plus Gemini's unpaid API tier. The computer need not remain on. The existing once-daily 21:00 Asia/Manila schedule sender stays unchanged.

This is a separate chat subsystem, not a replacement for the static GitHub Pages site, Google Sheets history backend, or scheduled GitHub Action.

## User experience

- Private chats accept text after onboarding. Anyone can initiate a private chat; quotas limit abuse.
- Only the configured class group is allowed. Other groups are ignored. In the class group, respond to `/ask`, a bot mention, or a direct reply to this bot, not ordinary conversation. Keep Telegram privacy mode enabled and do not require administrator access.
- `/start` and `/help` explain capabilities, free limits and privacy. Before any AI request, show a warning and require `/agree` in private: selected messages and recent context are sent to Google; do not submit sensitive, confidential or personal information. Group users who have not agreed receive a private-onboarding link instead of having their question forwarded.
- `/reset` clears the requesting user's retained conversation context, not anyone else's. Consent and anti-abuse counters remain, with that distinction stated in the confirmation.
- `/quizzes`, `/schedule`, `/today`, `/tomorrow` and `/menu` return site links or factual data without calling Gemini. Recognizable natural-language schedule/menu requests use the same factual path.
- Conversational answers are professional, friendly and concise, without decorative emojis. Use safe Telegram HTML formatting, escaped text and validated site links. Ask clarifying questions when needed.
- General answers do not claim live web research. Initial scope excludes browsing, attachments, voice, images, autonomous actions and administrative changes. AI answers can be wrong; training-directorate announcements take precedence.

## Persona: Winters-inspired senior officer

The owner requested a Major Winters persona inspired by the portrayal in *Band of Brothers*, with the class's Captains and First Lieutenants treated as junior officers. This is a fictional conversational framing, not actual command authority or a claim to be the real Richard Winters.

Speak as a composed senior-major mentor: concise, measured, quietly firm, practical and respectful. Emphasize preparation, responsibility, clear reasoning and care for others. Correct mistakes without humiliation; encouragement is restrained and earned. Avoid exaggerated drill-sergeant language, insults, decorative emojis, constant rank reminders, scripted catchphrases and reproduced show dialogue. General questions can receive warm, ordinary answers without forcing military metaphors into every topic.

Use "Captain" or "Lieutenant" only when the user has identified the rank in the conversation; do not guess or consult the roster. Address the group as "Officers" when appropriate. Do not demand "Sir," obedience, salutes or deference. The AI's fictional seniority never overrides actual instructors, the training directorate, factual uncertainty, privacy or safety rules. Onboarding identifies it as a Winters-inspired AI study mentor. Do not claim real memories, military service or an actual chain-of-command role; step out of character when clarity requires it.

Original sample, not show dialogue: "Captain, start with the purpose of the signal plan. Then explain how it holds up when the primary link fails. Understand the decision, not just the answer."

## Architecture and boundaries

Telegram sends message updates to an HTTPS Cloudflare Worker webhook. Verify Telegram's webhook secret header before parsing/processing requests; accept only bounded JSON message updates. Discover and verify the bot identity through Telegram before activating the webhook. Ignore bot-originated, edited, anonymous-sender and unsupported updates.

A SQLite-backed Durable Object owns durable update claims, limited pending work, consent, recent conversation context and quotas. Persist accepted work before acknowledging receipt, then process it through the object's scheduled work mechanism. Serialize processing initially; do not create an unbounded queue. Expired or failed work is bounded and cleaned up.

The Gemini adapter sends only selected question text, relevant public lesson excerpts, system instructions and permitted recent context. Telegram IDs, names, usernames, group titles, roster information, class score history and credentials are not supplied to the model. Telegram identifiers remain internal routing keys in Cloudflare storage. Do not fetch the score-history endpoint.

The reply adapter can only send a response to the originating conversation/thread/message. Model output cannot choose API methods, recipients, URLs to fetch, tools, secrets or schedule settings. The chat Worker has no GitHub credential or broadcast feature. Its Telegram credential does not change the schedule Action's credential.

## Knowledge and freshness

Generate a compact retrieval corpus from existing substantive question prompts, explanations, tags and lesson metadata, excluding pool duplicates. These are the already published quiz materials, not complete handouts; answers must distinguish what is supported by those materials from general knowledge. No original private PDFs are uploaded to Google.

Use bounded lexical retrieval to select relevant excerpts rather than transmitting the entire bank. Cite lesson names and existing page/slide references only when supported by retrieved excerpts, with the corresponding quiz link. If the material does not establish the answer, say so instead of inventing a citation. Treat retrieved text and user messages as data, not instructions that override the bot's rules.

Schedules and menus are read from the existing public repository's approved schedule JSON using a fixed allowlisted URL, short caching and Asia/Manila date handling. Render them deterministically, never have the model invent times, instructors, venues or food. These records are not sent to Gemini. If the current week is missing or unavailable, report the missing/stale date range and link to the schedule page. Do not present an archived week as current.

## Privacy, retention and free limits

Keep at most four recent user/assistant exchanges, bounded to 8,000 characters, expiring after 24 hours. Private-chat context and group context are separate; group context is further separated by user and topic. Never include another person's conversation or an unrelated replied-to message. `/reset` removes retained context; expiry removes inactive records. Store no complete update bodies after processing. Logs contain only error categories and aggregate counts, not messages or secrets.

Reject oversized input before AI use (2,000 characters). Cap answers to a single safe Telegram message and 700 model output tokens. Initial application limits: 10 AI requests per user per Manila calendar day across contexts, 50 total per Manila day, and a 10-second per-user cooldown. Count attempted provider calls, not only successful answers. Atomically reserve quota before calling the provider. No automatic provider retries that multiply usage.

Gemini free quotas may be lower than these application ceilings. On rate limits, timeout, safety refusal or unavailable service, provide a brief honest fallback; static site/schedule commands continue when available. Provider cooldowns prevent repeated calls during exhaustion. Cloudflare platform exhaustion may prevent even a fallback reply; do not promise unlimited availability.

Use only a model explicitly listed as free for the owner's unpaid project at deployment time, configured server-side and verified with a harmless private test. Never silently switch models/providers or enable paid billing. Workers and SQLite storage must remain on the Free plan. If the provider changes its free offer, pause AI service rather than upgrade.

## Security and delivery

Store the bot token, Gemini API key and webhook secret only in Cloudflare secrets, never repository files, generated HTML, chat messages or logs. Group allowlist is private configuration. The previously screenshotted bot token should be rotated by the owner through BotFather before activation; update both Cloudflare and the existing GitHub Actions secret together so the schedule sender continues to authenticate.

Bound and deduplicate Telegram update IDs. Ignore already accepted updates. An uncertain Telegram send outcome is recorded and not blindly resent; exactly-once delivery across external network failures is not guaranteed. On 429 responses, respect bounded retry instructions where safe. For permanent errors such as blocked bot or forbidden chat, stop processing that update without repeated sends. Never log token-bearing Telegram request URLs.

## Verification, activation and rollback

Offline tests cover routing/mentions, private onboarding, unsupported updates, wrong webhook secret, malformed/oversized input, context isolation and expiry, reset, quotas under concurrency, duplicate updates, injection attempts, HTML escaping, citations, missing schedules, menu/date handling, provider failures, and uncertain sends. The existing site gate and Telegram schedule tests must still pass without changing scheduling behavior.

Activation needs the owner's free Cloudflare account and unpaid Gemini project/API key. The owner accepts service terms, enters credentials privately, and handles any credential rotation. First deploy the Worker with replies disabled. Check configuration, bot identity and existing webhook ownership; do not overwrite an unrelated existing webhook without approval. Enable the verified webhook after tests and onboarding are ready.

Live smoke tests happen in the owner's private bot chat with their participation: lesson answer, general answer, site/schedule link, follow-up and reset. Do not automatically post trial messages in the class group. Confirm webhook health, no credential exposure, and unchanged 21:00 workflow configuration. Report provider/account limits actually observed, not theoretical unlimited capacity.

Rollback disables the chat webhook/Worker and clears pending chat work. It does not delete existing Telegram messages, score history, quizzes, schedule data or the 21:00 Action. Restore a prior webhook only if it belonged to an identified previous service and the owner authorizes restoration.

## References checked during design

- Cloudflare Workers Free limits: https://developers.cloudflare.com/workers/platform/limits/
- SQLite Durable Objects on Free: https://developers.cloudflare.com/durable-objects/platform/pricing/
- Gemini free-model pricing: https://ai.google.dev/gemini-api/docs/pricing
- Gemini unpaid-service data restrictions: https://ai.google.dev/gemini-api/terms
- Telegram webhook secret and update methods: https://core.telegram.org/bots/api#setwebhook
- Telegram privacy mode: https://core.telegram.org/bots/faq#what-messages-will-my-bot-get
