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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]).replace(/\r?\n/g, '<br>');
}

// Every line is a complete rich HTML block, so splitting never cuts a tag or entry.
export function formatRichSchedule(data, date) {
  const day = data.days.find(item => item.date === date);
  const label = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date(`${date}T00:00:00Z`));
  const header = [
    '<p><b>SOAC 52–2026</b></p>', '<h2>Tomorrow’s Schedule</h2>',
    `<p>${day ? `${escapeHtml(day.day)}, ` : ''}${label}<br><i>Philippine time · Asia/Manila</i></p>`, '<hr/>',
  ];
  if (!day) return [...header,
    '<p>Tomorrow’s schedule has not been uploaded yet. Please check with the Training Directorate.</p>',
  ].join('\n');
  // Stable sort retains source order for simultaneous activities; never alter source data.
  const startTime = block => Number((block.time || '').match(/^\d{4}/)?.[0] ?? Infinity);
  const blocks = [...day.blocks].sort((a, b) => startTime(a) - startTime(b));
  return [...header, ...blocks.map(block => {
    const time = escapeHtml((block.time || 'Time not printed').replace(/-/g, '–'));
    const details = [
      `<b>${time} · ${escapeHtml(block.activity)}</b>`,
      `Instructor: ${escapeHtml(block.instructor)}`,
      [block.venue ? `Venue: ${escapeHtml(block.venue)}` : '',
        block.uniform ? `Uniform: <b>${escapeHtml(block.uniform)}</b>` : ''].filter(Boolean).join(' · '),
      ...(block.remarks ? [`<i>Note: ${escapeHtml(block.remarks)}</i>`] : []),
    ].filter(Boolean);
    return `<p>${details.join('<br>')}</p>`;
  }), '<hr/>', '<footer><i>Training Directorate announcements take precedence.</i></footer>'].join('\n');
}

function richMessages(data, date) {
  const html = formatRichSchedule(data, date);
  // Conservative encoded-length limit stays below Telegram's 32768-character rich limit.
  if (html.split('\n').some(block => block.length > 26000)) {
    throw new Error('A single schedule entry exceeds the rich message limit; shorten that entry before sending.');
  }
  return splitMessage(html, 26000);
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
  const fingerprint = createHash('sha256').update(messages.join('\n')).digest('hex');
  if (state.date !== date || state.destination !== destination) state = { date, destination, fingerprint, sent: 0 };
  else if (state.fingerprint !== fingerprint) throw new Error('Schedule changed during a partial delivery. Inspect the group before retrying.');
  for (let index = state.sent || 0; index < messages.length; index++) {
    let response;
    try {
      response = await fetchFn(`https://api.telegram.org/bot${token}/sendRichMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ chat_id: chatId, rich_message: { html: messages[index], skip_entity_detection: true },
          ...(index === messages.length - 1 ? { reply_markup: { inline_keyboard: [[
            { text: 'Full Schedule', url: `https://atticus-42.github.io/quiz-hub/schedule/?v=day-picker-2#day-${date}` },
            { text: 'Practice Quizzes', url: 'https://atticus-42.github.io/quiz-hub/' },
          ]] } } : {}), ...(topicId ? { message_thread_id: Number(topicId) } : {}) }),
      });
    } catch { throw new Error('Telegram request did not finish; check the group before retrying to avoid an uncertain duplicate.'); }
    let result;
    try { result = await response.json(); } catch { throw new Error('Telegram returned an unreadable response; check the group before retrying.'); }
    if (!response.ok || !result.ok) throw new Error(`Telegram rejected the post (HTTP ${response.status}); check bot membership and permission to send messages.`);
    state.sent = index + 1; state.complete = state.sent === messages.length;
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify(state));
  }
  return { date, skipped: false, messages: messages.length };
}

async function main() {
  if (process.argv.includes('--preview')) {
    console.log(richMessages(loadSchedule(), tomorrowInManila()).join('\n\n')); return;
  }
  const result = await postTomorrow({ token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID, topicId: process.env.TELEGRAM_TOPIC_ID });
  console.log(result.skipped ? `Schedule for ${result.date} was already sent.` : `Schedule for ${result.date} sent (${result.messages} message(s)).`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
