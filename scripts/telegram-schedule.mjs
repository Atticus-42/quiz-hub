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
    ]),
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
export function formatRichSchedule(data, date) {
  const day = data.days.find(item => item.date === date);
  const label = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date(`${date}T00:00:00Z`));
  const header = [
    { type: 'paragraph', text: { type: 'bold', text: 'SOAC 52–2026' } },
    { type: 'heading', size: 2, text: 'Tomorrow’s Schedule' },
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
    return details;
  });
  return { blocks: [...header, { type: 'paragraph', text }, { type: 'divider' },
    { type: 'footer', text: { type: 'italic', text: 'Training Directorate announcements take precedence.' } }], skip_entity_detection: true };
}

function richMessages(data, date) {
  const rich = formatRichSchedule(data, date);
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

export async function postTomorrow({ now = new Date(), data = loadSchedule(), token, chatId, topicId,
  statePath = join(ROOT, '.telegram-state', 'sent.json'), fetchFn = fetch } = {}) {
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token || '') || !/^-\d+$/.test(chatId || '')) {
    throw new Error('Configure TELEGRAM_BOT_TOKEN and the numeric group TELEGRAM_CHAT_ID in GitHub Actions secrets.');
  }
  if (topicId && !/^\d+$/.test(topicId)) throw new Error('TELEGRAM_TOPIC_ID must be a positive numeric topic ID.');
  const date = tomorrowInManila(now);
  const destination = createHash('sha256').update(`${chatId}:${topicId || ''}`).digest('hex');
  let state = {};
  if (existsSync(statePath)) {
    try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch { throw new Error('Saved delivery state is invalid; inspect it before sending.'); }
  }
  if (state.date === date && state.destination === destination && state.complete) return { date, skipped: true };
  const messages = richMessages(data, date);
  const fingerprint = createHash('sha256').update(JSON.stringify(messages)).digest('hex');
  if (state.date !== date || state.destination !== destination) state = { date, destination, fingerprint, sent: 0 };
  else if (state.fingerprint !== fingerprint) throw new Error('Schedule changed during a partial delivery. Inspect the group before retrying.');
  for (let index = state.sent || 0; index < messages.length; index++) {
    let response;
    try {
      response = await fetchFn(`https://api.telegram.org/bot${token}/sendRichMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ chat_id: chatId, rich_message: messages[index],
          ...(index === messages.length - 1 ? { reply_markup: { inline_keyboard: [[
            { text: 'Full Schedule', url: `https://atticus-42.github.io/quiz-hub/schedule/?v=day-picker-2#day-${date}` },
            { text: 'Practice Quizzes', url: 'https://atticus-42.github.io/quiz-hub/' },
          ], [
            { text: 'Training Directorate', url: 'https://atticus-42.github.io/quiz-hub/class/#dir-heading' },
          ]] } } : {}), ...(topicId ? { message_thread_id: Number(topicId) } : {}) }),
      });
    } catch { throw new Error('Telegram request did not finish; check the group before retrying to avoid an uncertain duplicate.'); }
    let result;
    try { result = await response.json(); } catch { throw new Error('Telegram returned an unreadable response; check the group before retrying.'); }
    if (!response.ok || !result.ok) throw new Error(`Telegram rejected the post (HTTP ${response.status}); check bot membership and permission to send messages.`);
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
  if (process.argv.includes('--preview')) {
    console.log(JSON.stringify(richMessages(loadSchedule(), tomorrowInManila()), null, 2)); return;
  }
  const result = await postTomorrow({ token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID, topicId: process.env.TELEGRAM_TOPIC_ID });
  console.log(result.skipped ? `Schedule for ${result.date} was already sent.` : `Schedule for ${result.date} sent (${result.messages} message(s)).`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
