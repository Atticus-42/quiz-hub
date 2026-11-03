import { formatRichSchedule } from '../../scripts/telegram-schedule.mjs';
import { loadSchedule, ROOT } from '../../scripts/build.mjs';
const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
const date = '2026-11-04';
const call = async (method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, ...body }) });
  const j = await r.json(); return j;
};
const markup = { inline_keyboard: [[
  { text: 'Full Schedule', url: `https://atticus-42.github.io/quiz-hub/schedule/?v=day-picker-2#day-${date}` },
  { text: 'Practice Quizzes', url: 'https://atticus-42.github.io/quiz-hub/' },
], [{ text: 'Training Directorate', url: 'https://atticus-42.github.io/quiz-hub/class/#dir-heading' }]] };
const data = loadSchedule(ROOT, undefined, { allDays: true });
const rich = formatRichSchedule(data, date, 'Tomorrow’s Schedule');
console.log('rich size', JSON.stringify(rich).length, 'menus', JSON.stringify(rich).includes('Menu: '));
let found = null;
for (let id = Number(process.env.START); id <= Number(process.env.END); id++) {
  const j = await call('editMessageReplyMarkup', { message_id: id, reply_markup: markup });
  const d = String(j.description || '');
  console.log(id, j.ok ? 'MODIFIED (not the schedule post)' : d.replace(/\d{6,}/g, '[n]'));
  if (!j.ok && /message is not modified/i.test(d)) { found = id; break; }
  if (j.ok) { const u = await call('editMessageReplyMarkup', { message_id: id, reply_markup: { inline_keyboard: [] } }); console.log('reverted', id, u.ok); }
}
if (!found) { console.log('NOT FOUND'); process.exit(1); }
const e = await call('editMessageText', { message_id: found, rich_message: rich, reply_markup: markup });
console.log('edit', found, e.ok ? 'OK' : String(e.description).replace(/\d{6,}/g, '[n]'));
if (!e.ok) process.exit(1);
