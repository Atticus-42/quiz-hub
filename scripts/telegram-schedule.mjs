// Daily Telegram post. Credentials are environment variables, never website data.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, loadSchedule } from './build.mjs';

export function tomorrowInManila(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = name => parts.find(part => part.type === name).value;
  const next = new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function formatSchedule(data, date) {
  const day = data.days.find(item => item.date === date);
  const label = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date(`${date}T00:00:00Z`));
  const url = `https://atticus-42.github.io/quiz-hub/schedule/?v=day-picker-2#day-${date}`;
  if (!day) return [
    `SOAC 52 - 2026 · Tomorrow, ${label}`,
    '', 'Tomorrow’s schedule has not been uploaded yet. Please check with the Training Directorate.',
    '', 'Schedule page: https://atticus-42.github.io/quiz-hub/schedule/?v=day-picker-2',
  ].join('\n');
  return [
    `SOAC 52 - 2026 · Tomorrow’s schedule`,
    `${day.day}, ${label} · Philippine time`, '',
    ...day.blocks.flatMap(block => [
      `${block.time || 'Time not printed'} — ${block.activity}`,
      `Instructor: ${block.instructor}`,
      [block.venue ? `Venue: ${block.venue}` : '', block.uniform ? `Uniform: ${block.uniform}` : ''].filter(Boolean).join(' · '),
      ...(block.remarks ? [`Note: ${block.remarks}`] : []), '',
      ...(block.menu ? [`Menu: ${block.menu.join(' · ')}`, ''] : []),
    ]),
    ...(data.menuNotice ? [data.menuNotice] : []),
    'Training Directorate announcements take precedence.', url,
  ].join('\n');
}

// Telegram allows 4096 characters. Split at newlines, keeping every block of text.
export function splitMessage(text, limit = 3900) {
  const messages = []; let current = '';
  for (const line of text.split('\n')) {
    let remaining = line;
    while (remaining.length > limit) {
      if (current) { messages.push(current); current = ''; }
      messages.push(remaining.slice(0, limit)); remaining = remaining.slice(limit);
    }
    if (current && current.length + 1 + remaining.length > limit) { messages.push(current); current = ''; }
    current += (current ? '\n' : '') + remaining;
  }
  if (current) messages.push(current);
  return messages;
}

// Explicit rich segments prevent style inheritance; literal blank lines separate entries.
export function formatRichSchedule(data, date, title = 'Tomorrow’s Schedule') {
  const day = data.days.find(item => item.date === date);
  const label = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date(`${date}T00:00:00Z`));
  const header = [
    { type: 'paragraph', text: { type: 'bold', text: 'SOAC 52–2026' } },
    { type: 'heading', size: 2, text: title },
    { type: 'paragraph', text: [`${day ? `${day.day}, ` : ''}${label}\n`, { type: 'italic', text: 'Philippine time · Asia/Manila' }] },
    { type: 'divider' },
  ];
  if (!day) return { blocks: [...header,
    { type: 'paragraph', text: 'Tomorrow’s schedule has not been uploaded yet. Please check with the Training Directorate.' },
  ], skip_entity_detection: true };
  // Stable sort retains source order for simultaneous activities; never alter source data.
  const startTime = block => Number((block.time || '').match(/^\d{4}/)?.[0] ?? Infinity);
  const blocks = [...day.blocks].sort((a, b) => startTime(a) - startTime(b));
  const text = blocks.flatMap((block, index) => {
    const time = (block.time || 'Time not printed').replace(/\s*[-–]\s*/g, ' – ');
    const details = [
      ...(index ? ['\n\n'] : []),
      { type: 'bold', text: `${time} · ${block.activity}` },
      '\n', { type: 'italic', text: `Instructor: ${block.instructor}` },
    ];
    if (block.venue) details.push('\n', { type: 'italic', text: `Venue: ${block.venue}` });
    if (block.uniform) details.push(block.venue ? ' · Uniform: ' : '\nUniform: ', { type: 'bold', text: block.uniform });
    if (block.remarks) details.push('\n', { type: 'italic', text: `Note: ${block.remarks}` });
    if (block.menu) details.push('\n', { type: 'bold', text: 'Menu: ' }, block.menu.join(' · '));
    return details;
  });
  return { blocks: [...header, { type: 'paragraph', text }, { type: 'divider' },
    ...(data.menuNotice ? [{ type: 'paragraph', text: { type: 'italic', text: data.menuNotice } }] : []),
    { type: 'footer', text: { type: 'italic', text: 'Training Directorate announcements take precedence.' } }], skip_entity_detection: true };
}

function richMessages(data, date, title) {
  const rich = formatRichSchedule(data, date, title);
  const text = rich.blocks[4].text;
  if (!Array.isArray(text)) return [rich];
  const entries = [[]];
  for (const segment of text) {
    if (segment === '\n\n') entries.push([]);
    else entries.at(-1).push(segment);
  }
  const chunks = []; let current = []; let length = 0;
  for (const entry of entries) {
    const size = entry.reduce((sum, segment) => sum + (typeof segment === 'string' ? segment : segment.text).length, 0);
    if (size > 24000) throw new Error('A single schedule entry exceeds the rich message limit; shorten that entry before sending.');
    if (length + size + 2 > 24000) { chunks.push(current); current = []; length = 0; }
    if (current.length) { current.push('\n\n'); length += 2; }
    current.push(...entry); length += size;
  }
  if (current.length) chunks.push(current);
  return chunks.map((text, index) => ({ blocks: [
    ...rich.blocks.slice(0, 4), { type: 'paragraph', text },
    ...(index === chunks.length - 1 ? rich.blocks.slice(5) : []),
  ], skip_entity_detection: true }));
}

const withinAutomaticWindow = now => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(now) === '19:00';

export async function postTomorrow({ now = new Date(), scheduled = false, sendClock = () => new Date(), date: requestedDate, data = loadSchedule(), token, chatId, topicId,
  statePath = join(ROOT, '.telegram-state', 'sent.json'), fetchFn = fetch } = {}) {
  if (scheduled && !withinAutomaticWindow(now)) return { skipped: true, reason: 'outside-window' };
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token || '') || !/^-\d+$/.test(chatId || '')) {
    throw new Error('Configure TELEGRAM_BOT_TOKEN and the numeric group TELEGRAM_CHAT_ID in GitHub Actions secrets.');
  }
  if (topicId && !/^\d+$/.test(topicId)) throw new Error('TELEGRAM_TOPIC_ID must be a positive numeric topic ID.');
  const date = requestedDate || tomorrowInManila(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('Provide a valid YYYY-MM-DD date.');
  if (requestedDate && !data.days.some(day => day.date === date)) throw new Error('The requested date has no uploaded schedule.');
  const today = new Date(new Date(`${tomorrowInManila(now)}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
  const title = requestedDate ? (date === today ? 'Today’s Schedule' : 'Daily Schedule') : 'Tomorrow’s Schedule';
  const destination = createHash('sha256').update(`${chatId}:${topicId || ''}`).digest('hex');
  let state = {};
  if (existsSync(statePath)) {
    try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch { throw new Error('Saved delivery state is invalid; inspect it before sending.'); }
  }
  if (state.date === date && state.destination === destination && state.complete) return { date, skipped: true };
  const messages = richMessages(data, date, title);
  const fingerprint = createHash('sha256').update(JSON.stringify(messages)).digest('hex');
  if (state.date !== date || state.destination !== destination) state = { date, destination, fingerprint, sent: 0 };
  else if (state.fingerprint !== fingerprint) throw new Error('Schedule changed during a partial delivery. Inspect the group before retrying.');
  let resolvedChatId = chatId;
  for (let index = state.sent || 0; index < messages.length; index++) {
    let response, result;
    for (let attempt = 0; attempt < 2; attempt++) {
    if (scheduled && !withinAutomaticWindow(sendClock())) return { skipped: true, reason: 'outside-window' };
    try {
      response = await fetchFn(`https://api.telegram.org/bot${token}/sendRichMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ chat_id: resolvedChatId, rich_message: messages[index],
          ...(index === messages.length - 1 ? { reply_markup: { inline_keyboard: [[
            { text: 'Full Schedule', url: `https://atticus-42.github.io/quiz-hub/schedule/?v=day-picker-2#day-${date}` },
            { text: 'Practice Quizzes', url: 'https://atticus-42.github.io/quiz-hub/' },
          ], [
            { text: 'Training Directorate', url: 'https://atticus-42.github.io/quiz-hub/class/#dir-heading' },
          ]] } } : {}), ...(topicId ? { message_thread_id: Number(topicId) } : {}) }),
      });
    } catch { throw new Error('Telegram request did not finish; check the group before retrying to avoid an uncertain duplicate.'); }
    try { result = await response.json(); } catch { throw new Error('Telegram returned an unreadable response; check the group before retrying.'); }
    // A rejected migration response guarantees no post; retry only the server-specified same group's new ID.
    const migrated = result.parameters?.migrate_to_chat_id;
    if (attempt === 0 && response.status === 400 && !result.ok && Number.isSafeInteger(migrated) && migrated < 0 && /group chat was upgraded to a supergroup chat/i.test(result.description || '')) {
      resolvedChatId = String(migrated);
      console.log('Following Telegram-confirmed migration of the destination group.');
      continue;
    }
    break;
    }
    if (!response.ok || !result.ok) {
      const reason = String(result.description || 'No additional details')
        .replaceAll(token, '[redacted]').replaceAll(chatId, '[redacted]')
        .replace(/https?:\/\/\S+|\b\d+:[A-Za-z0-9_-]+|-?\d{6,}/g, '[redacted]').slice(0, 240);
      throw new Error(`Telegram rejected the post (HTTP ${response.status}): ${reason}`);
    }
    state.sent = index + 1; state.complete = state.sent === messages.length;
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify(state));
    // Only the public schedule text is inspected; never log the response chat or token.
    const returned = result.result?.rich_message?.blocks?.find(block => block.type === 'paragraph' && Array.isArray(block.text) && block.text.some(segment => segment === '\n\n'));
    if (returned) {
      const gaps = returned.text.filter(segment => segment === '\n\n').length;
      const bold = returned.text.filter(segment => segment?.type === 'bold').length;
      const italic = returned.text.filter(segment => segment?.type === 'italic').length;
      console.log(`Telegram format confirmation: ${gaps} blank-line separators; ${bold} bold spans; ${italic} italic spans.`);
    }
  }
  return { date, skipped: false, messages: messages.length };
}

async function main() {
  const date = process.env.SCHEDULE_DATE || undefined;
  if (process.argv.includes('--preview')) {
    console.log(JSON.stringify(richMessages(loadSchedule(), date || tomorrowInManila(), date ? 'Daily Schedule' : undefined), null, 2)); return;
  }
  const result = await postTomorrow({ token: process.env.TELEGRAM_BOT_TOKEN, date,
    scheduled: process.env.GITHUB_EVENT_NAME === 'schedule',
    ...(date ? { statePath: join(ROOT, '.telegram-state', `manual-${date}.json`) } : {}),
    chatId: process.env.TELEGRAM_CHAT_ID, topicId: process.env.TELEGRAM_TOPIC_ID });
  console.log(result.reason === 'outside-window' ? 'Skipped automatic delivery outside 19:00–19:00:59 Asia/Manila; no late catch-up post.' :
    result.skipped ? `Schedule for ${result.date} was already sent.` : `Schedule for ${result.date} sent (${result.messages} message(s)).`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
