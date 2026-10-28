import test from 'node:test';
import assert from 'node:assert/strict';
import {loadLessons} from '../build.mjs';
const {lessons}=loadLessons();
const all=lessons.filter(l=>!l.pool).flatMap(l=>Object.values(l.banks).flat());
// Confirmed, item-specific giveaway regressions; not a blanket ban on words
// such as "only" that may be necessary to state a source's actual distinction.
const giveaways={
 'fieldartillery-e-19':/focusing only/i,
 'fieldartillery-m-40':/only on aerial lift|borrow every vehicle|M35 trucks only/i,
 'armor-m-38':/howitzer|man-portable/i,
 'isr-e-14':/always blurred|cannot observe large areas|always blocked/i,
 'isr-m-11':/only by space-based|only.*surface ships|never been placed/i,
 'armyops-m-01':/sovereignty excludes people|every risk is eliminated|all responsibility to law enforcement/i,
 'armyops-h-25':/ignore the objective|24 hours without rest/i,
 'intcycle-e-15':/equal width|rename the spreadsheet/i,
 'intcycle-m-13':/remove the dates|makes the expected trend easiest/i,
 'intcycle-h-25':/public link|withhold all general findings/i,
 'signal-m-09':/always|automatically/i,
 'signal-m-19':/^only\b|no others/i,
 'signaljoint-e-29':/eliminate.*spectrum|improve.*coverage|only.*cyber/i,
 'sigint-e-08':/all future messages|everyone.s identity|no.*planning/i,
 'rdf-h-25':/all survivor.*identit|all.*locations.*identit|every arrival angle/i,
 'manet-m-03':/roster|paint/i,
 'sensors-m-11':/wallpaper|convenience overrides/i,
 'weapons-e-11':/battery inventory|documentation-replacing/i,
 'weapons-h-10':/capitalization|modernity/i,
 'nist-h-25':/logo|procurement/i,
 'zerotrust-e-13':/shared password|inventory label/i,
 'zerotrust-h-13':/expensive|diagram vocabulary/i,
 'gsomia-e-11':/printer|familiarity|interest/i,
 'cyberrisk-e-11':/product.name length|desktop theme|paper price/i,
 'cyberrisk-m-11':/lighting|display calibration|leave planning/i,
 'moduleseven-e-29':/popularity|brochure/i,
};
test('confirmed giveaway distractors are replaced by relevant alternatives',()=>{
 for(const[qid,pattern]of Object.entries(giveaways)){
  const q=all.find(q=>q.qid===qid);assert.ok(q,qid);
  for(const[slot,option]of q.options.entries())if(slot!==q.answer)assert.doesNotMatch(option,pattern,`${qid}: irrelevant or conspicuous foil`);
 }
});
test('the two module exams retain distinct, source-matched foundation alternatives',()=>{
 for(const lesson of lessons.filter(l=>['modulefive','moduleseven'].includes(l.key)))for(const bank of Object.values(lesson.banks))for(const q of bank)assert.equal(new Set(q.options.map(o=>o.trim().toLowerCase())).size,4,q.qid);
});
