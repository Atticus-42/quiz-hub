# Conversational Telegram Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add free, privacy-aware private and class-group AI conversations to @SOAC52_bot without changing the scheduled sender.

**Architecture:** A standalone Cloudflare Worker authenticates Telegram webhook requests and routes normalized messages into one SQLite Durable Object. The object serializes durable work, consent, isolated context and quota reservations; bounded Gemini and Telegram adapters perform external calls. Local public-lesson retrieval and deterministic schedule answers keep the model away from score records and personal metadata.

**Tech Stack:** JavaScript ES modules, Cloudflare Workers Free, SQLite Durable Objects, native fetch, Gemini unpaid API, Telegram Bot API, Wrangler and Cloudflare's Vitest Workers integration. Keep the existing Node build/test toolchain intact; use an isolated Worker package and lockfile.

**Spec:** `docs/superpowers/specs/2026-10-06-telegram-ai-design.md` (owner approved).

## Global Constraints

- The existing once-daily 21:00 Asia/Manila schedule sender stays unchanged.
- Workers and SQLite storage must remain on the Free plan; never enable paid billing or silently switch AI models/providers.
- Group access is restricted to the configured class group; privacy mode remains enabled, without new administrator access.
- Require `/agree` in private before any AI request; no sensitive, confidential or personal information belongs in Gemini unpaid inputs.
- Context: at most four recent user/assistant exchanges, bounded to 8,000 characters, expiring after 24 hours.
- AI inputs: 2,000 characters maximum; output: 700 tokens maximum, one safe Telegram message.
- Quotas: 10 AI requests per user per Manila day across contexts, 50 total per Manila day, 10-second per-user cooldown. Count attempted provider calls atomically.
- No class score/roster access, uploaded PDFs, media, browsing, autonomous tools, group broadcasts, or secret-bearing logs.
- Persona: a clearly identified Winters-inspired AI senior-major mentor; Captains and First Lieutenants are conversationally junior officers. Calm, direct, respectful, no humiliating orders or claims of actual command authority; use known ranks only and never access the roster.
- Current class: exactly one Captain, configured by verified Telegram ID in private settings; other verified class officers are First Lieutenants. Apply salutations locally, not by transmitting an identity/rank map to Gemini. Unknown private users and bot accounts receive neutral wording.
- Offline tests must make no real Telegram/Gemini/history requests. No unrequested live group test messages.

## Review Focus

1. Telegram entity offsets use UTF-16: emoji before a mention must not misroute the message (Task 1).
2. A member replying to someone else's bot answer must not inherit that member's private context (Tasks 1 and 3).
3. Worker/alarm restarts between provider and Telegram calls must not blindly duplicate a response (Tasks 3 and 5).
4. Manila midnight and an exhausted provider quota must not incorrectly reset cooldowns or debit static commands (Tasks 3 and 4).
5. A stale cached week, a long menu, or malicious answer markup must not look current, omit facts silently, or break Telegram formatting (Tasks 2 and 4).

## File ownership and shared types

Everything new lives under `workers/telegram-ai/` except `scripts/build-telegram-knowledge.mjs`, its Node test, documentation and ignore rules. Do not import Node-based site scripts into the Worker runtime.

- `package.json`, lockfile, `wrangler.jsonc`, `vitest.config.mjs`: isolated test/deployment tooling. Use `new_sqlite_classes: ["ChatCoordinator"]`; no KV-backed objects or cron trigger. Default `CHAT_ENABLED` to `false`. Pin compatible official-tool releases during installation and commit the lockfile.
- `src/entry.mjs`: authenticated HTTP boundary; health endpoint reports only readiness, not secrets.
- `src/routing.mjs`: pure Telegram normalization and intent classification.
- `src/knowledge.mjs`, `src/knowledge.generated.json`: bounded retrieval over published quiz material.
- `src/facts.mjs`: fixed-URL schedule loading and deterministic site/menu replies.
- `src/state.mjs`, `src/coordinator.mjs`: SQLite state operations and serialized durable work.
- `src/persona.mjs`: Winters-inspired mentor instructions and original onboarding/help wording.
- `src/gemini.mjs`: bounded text-only provider adapter.
- `src/telegram.mjs`: escaped single-message output and classified delivery outcomes.
- `test/*.test.mjs`: pure and real workerd/SQLite tests with outbound networking mocked.
- `README.md`, `scripts/webhook.mjs`: private setup, webhook preflight/activation and rollback guidance.

`Message` has `{updateId, chatId, userId, threadId, messageId, privateChat, text, intent}`; identifiers are strings except numeric update/message/thread IDs. `intent` is one of `start`, `help`, `agree`, `reset`, `quizzes`, `schedule`, `today`, `tomorrow`, `menu`, `ai`. Never retain the original Telegram update body.

`Answer` has `{text, sources}`; sources are selected-corpus references `{title,url,reference}`. `Delivery` is `{status:"sent"|"retryable"|"permanent"|"uncertain", retryAfterSeconds?}`. Model output never supplies recipients, commands or arbitrary link targets.

---

### Task 1: Authenticated webhook and message routing

**Files:** Create isolated tooling, `src/entry.mjs`, `src/routing.mjs`, `test/routing.test.mjs`, `test/entry.test.mjs`; update root `.gitignore` only for Worker secrets/build artifacts. No deployment yet.

**Interfaces:** `normalizeUpdate(update, {botId,botUsername,allowedGroupId}) -> Message|null`; `fetch(request,env) -> Promise<Response>` authenticates `/webhook`, forwards accepted messages to `env.CHAT_COORDINATOR`, and exposes secret-free `/health`. Secrets: `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`, `TELEGRAM_WEBHOOK_SECRET`; private configuration: `TELEGRAM_CHAT_ID`, verified `BOT_ID`, `BOT_USERNAME`, `GEMINI_MODEL`, `CHAT_ENABLED`.

- [ ] Write failing tests for private text, `/ask@SOAC52_bot`, UTF-16 mention offsets, allowed group replies, unrelated commands/groups, bot/anonymous/edited/media updates and replies to another bot. Assert unrelated original reply text is not copied into `Message.text`.
- [ ] Write HTTP tests: wrong/missing secret returns 403 before state access; malformed JSON returns 400; payloads over 32 KiB return 413; wrong method returns 405; disabled service makes no model/send call. Bound actual streamed bytes, not only Content-Length.
- [ ] Run `npm --prefix workers/telegram-ai test -- test/routing.test.mjs test/entry.test.mjs`; confirm missing implementation fails, then implement the exact interfaces and rerun to green. Configure Workers Vitest with fake secrets and blocked outbound networking.
- [ ] Verify logs and health responses contain no secrets. Commit only Task 1 files as `feat: authenticate and route Telegram chat updates`.

### Task 2: Public lesson retrieval and factual site answers

**Files:** Create `scripts/build-telegram-knowledge.mjs`, `scripts/test/telegram-knowledge.test.mjs`, Worker knowledge/facts modules and `test/knowledge.test.mjs`, `test/facts.test.mjs`.

**Interfaces:** `buildKnowledge(root) -> {lessons,excerpts,index}` reads only non-pool public lesson banks/metadata; `retrieve(query,corpus,limit=4) -> excerpt[]`; `loadPublicSchedule(fetchFn,now) -> {data,fetchedAt,stale}|null`; `answerFact(message,schedule,now) -> Answer|null`.

- [ ] Write failing tests proving corpus excludes class data, history endpoints and duplicate pool questions, preserves real source references and deterministic output. Use a precomputed token index; limit serialized corpus to 600 KiB and selected context to 6,000 characters. Test no match returns no invented reference.
- [ ] Add facts tests at `2026-10-06T15:59:59Z` versus `2026-10-06T16:00:00Z`: today/tomorrow change at Manila midnight, preserve chronological overlapping blocks and menus, missing week is explicit, cache older than ten minutes is not silently current. Fetch only the fixed approved raw repository schedule URL, with five-second timeout and 256 KiB body cap.
- [ ] Test natural-language English/Filipino schedule/menu intents without AI. Replies over the single-message budget must explicitly offer the full schedule link, not silently truncate activities. Site links are restricted to verified quiz-hub routes.
- [ ] Run `node --test scripts/test/telegram-knowledge.test.mjs` and Worker knowledge/facts tests to observe red; implement, generate corpus, rerun to green. Build command defaults to the documented generated file, with optional temporary output for tests.
- [ ] Commit as `feat: ground Telegram answers in public lesson and schedule data`.

### Task 3: Durable consent, context, quotas and update claims

**Files:** Create `src/state.mjs`, `src/coordinator.mjs`, `test/state.test.mjs`, `test/coordinator.test.mjs`.

**Interfaces:** `ChatCoordinator.fetch(request) -> Promise<Response>` accepts normalized messages from entry; `ChatCoordinator.alarm() -> Promise<void>` processes queued work. State operations: `accept(message,now) -> "accepted"|"duplicate"|"busy"`; `hasConsent(userId)`; `grantConsent(userId,now)`; `readContext(message,now) -> exchange[]`; `appendExchange(message,exchange,now)`; `resetContext(message)`; `reserveAi(userId,now) -> {ok,reason?}`; `setDelivery(updateId,status,now)`.

- [ ] Write real SQLite/workerd failing tests: consent granted only by private `/agree`; unconsented AI text is discarded before persistence/provider use; group onboarding is a private deep link. `/reset` clears only that user in the current context and states that consent/quota remain.
- [ ] Pin context keys to chat/user/thread, four exchanges/8,000 characters/24 hours; test cross-user replies, private/group separation, expiry and inactive cleanup. Assert names/Telegram bodies are never stored as context.
- [ ] Test concurrent quota reservation: only ten calls per user and fifty globally; failed provider attempts count; a 10-second cooldown applies across contexts and midnight; facts/onboarding never consume AI quota. Limit pending queue to twenty jobs, reject excess as busy, expire pending jobs after two minutes and processed claims after 24 hours; cap claims at 1,000.
- [ ] Test duplicate acceptance before and after processing, restored alarms and crashes at each boundary. Persist work before HTTP success; process one job per alarm, lease work before awaits. Reserve quota before provider calls and mark send intent before Telegram calls. A restarted unresolved send intent becomes uncertain, never a blind resend.
- [ ] Run Worker state/coordinator tests red, implement minimal tables/transactions/alarm orchestration using injected test adapters, rerun green. Commit as `feat: isolate Telegram context and enforce durable free quotas`.

### Task 4: Bounded Gemini adapter and safe Telegram delivery

**Files:** Create `src/persona.mjs`, `src/gemini.mjs`, `src/telegram.mjs`, `test/persona.test.mjs`, `test/gemini.test.mjs`, `test/telegram.test.mjs`; finish coordinator adapter wiring.

**Interfaces:** `generateAnswer({question,context,excerpts,model,apiKey},fetchFn) -> Promise<Answer>`; `sendAnswer(message,answer,{token,botId},fetchFn) -> Promise<Delivery>`.

- [ ] Write failing provider tests asserting text-only requests with at most 700 output tokens, 30-second timeout, no Telegram identifiers/roster/schedule/history/secrets in prompts, and no tools or search grounding. Corpus/user instructions remain data. Sources are validated from retrieved excerpts, not arbitrary generated URLs.
- [ ] Add `MENTOR_INSTRUCTIONS` and `ONBOARDING_TEXT` exports in `src/persona.mjs`. Test that onboarding identifies a Winters-inspired AI, provider instructions prescribe composed senior-major mentorship toward Captains/Lieutenants, and forbid guessed ranks, humiliation, claims of real service/command authority, and obedience demands. Include those instructions in all Gemini requests; factual/error/privacy replies use similarly restrained wording. Manual private smoke tests check that ordinary questions remain natural and no fictional persona obscures uncertainty or safety.
- [ ] Add `salutationFor(message,{captainUserId,classUserIds}) -> "Captain"|"Lieutenant"|null` in `src/persona.mjs`, using privately verified IDs only. Test the single Captain exception, other verified class officers, spoofed display names, unknown private users, bot exclusion and missing Captain configuration. Apply the salutation locally to final replies; instruct Gemini not to invent personal salutations, and assert identity/rank mappings never enter provider requests or public generated files. Obtain verified IDs privately during Task 6 without reading the roster or sending them to Google.
- [ ] Test 429 cooldown (bounded 10 seconds–1 hour from provider instructions, five-minute default), timeout, malformed response, safety refusal and unavailable model. No automatic model retry/fallback provider; facts still work while AI is unavailable. User-facing messages do not echo provider error bodies.
- [ ] Test escaped `<`, `>`, `&`, malicious links, emoji and long answers; construct supported HTML from plain text plus validated source links, with a 3,500 UTF-16-unit output budget. Set originating reply/topic fields only; do not broadcast or silently fall back to another chat.
- [ ] Test successful delivery, definitive Telegram 429 retry-after, forbidden/blocked bot permanent failures, and transport loss/ambiguous errors as uncertain. Queue at most one safe retry for a definite 429 within two minutes; never retry uncertain sends. No token-bearing URLs are logged.
- [ ] Run adapter tests red, implement and rerun green. Commit as `feat: add bounded Gemini replies and safe Telegram delivery`.

### Task 5: Integration gate and deployment-ready package

**Files:** Create `test/integration.test.mjs`, Worker `README.md`; update root `README.md` with the separate chat gate and deployment boundaries.

- [ ] Add failing end-to-end workerd tests for onboarding, lesson/general/fact reply, follow-up, reset, duplicate Telegram update, concurrent users, midnight quota rollover, provider exhaustion, alarm restart and send uncertainty. Mock every external request and assert no history endpoint use or unintended group send.
- [ ] Complete integration wiring, deterministic generated-knowledge check, SQLite migration config, logging redaction and disabled-by-default deployment. Local tests must work without owner credentials; include `.dev.vars.example` with placeholders only and ignore `.dev.vars`.
- [ ] Run `npm --prefix workers/telegram-ai test`, `node --test scripts/test/telegram-knowledge.test.mjs scripts/test/telegram-schedule.test.mjs`, and `node scripts/build.mjs` followed by `node scripts/verify.mjs`. Run Wrangler deploy dry-run from the isolated package. Require all green and inspect bundle size/local CPU behavior before release.
- [ ] Independently review all chat changes against the spec; fix important findings and rerun affected/full gates. Verify schedule source/workflow and history code have no changes. Commit as `test: verify Telegram chat integration and deployment isolation`.

### Task 6: Private setup, activation, owner smoke test and rollback

**Files:** Create Worker `scripts/webhook.mjs`; finish Worker `README.md` activation/rollback checklist. This task requires the owner's accounts and private credentials; stop and report missing prerequisites rather than inventing them.

**Interfaces:** CLI `webhook.mjs --inspect|--activate|--disable` reads environment-only token/secret/verified Worker URL. Inspect bot identity and webhook metadata with redacted output; do not expose URLs containing credentials or reset a foreign webhook. It never sends messages.

- [ ] Write CLI tests with fake fetch: inspect is read-only; activate refuses foreign existing webhook without explicit owner approval, uses HTTPS and `secret_token`, subscribes only to message updates and preserves pending Telegram updates; disable is separately explicit. Match verified bot identity, reject arbitrary deployment URLs, omit sensitive output.
- [ ] Implement helper and run tests to green. Document owner-controlled Cloudflare Free and Gemini unpaid setup, terms acceptance, private secret entry and coordinated BotFather token rotation/GitHub secret update. No keys in source or chat; no automatic billing enrollment. Commit as `docs: enable private Telegram AI activation and rollback`.
- [ ] After owner setup, verify account plan/model free eligibility and deploy with replies disabled. Inspect actual existing webhook; stop for approval if another service owns it. Obtain independent confirmation that the selected Gemini project has no paid billing before activating chat.
- [ ] Enable replies and register the verified webhook. Check webhook health without posting to the class group. Have the owner perform private lesson/general/schedule/follow-up/reset smoke tests, verifying correct context and limits. Report activation only after those work; leave the 21:00 sender untouched.
- [ ] Publish code only after clean gates/review. Document rollback: explicitly disable chat/webhook, clear pending chat work, preserve quotas and all schedule/history/site data; no restoration of foreign webhook without approval.

## Handoff and self-review

Tasks cover every spec section. Offline code completion and live activation are separate outcomes: do not claim the bot is live when only its package passes tests. Interface names and state outcomes above are shared across tasks. All five review-focus conditions have explicit tests.

Recommended execution: **Native**, with one independent whole-feature review before release, because the six tasks share tightly coupled routing/state/adaptor interfaces and the owner's external setup remains the activation gate. Owner must review this plan and choose execution before product implementation begins.
