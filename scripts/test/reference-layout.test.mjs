import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from '../build.mjs';
import {runPage, findAll, hasClass} from './harness.mjs';

const pages=build({write:false,endpoint:''});
function exercise(slug, transform, pick=()=>true) {
  const html=pages[`${slug}/index.html`].replace(/(<script type="application\/json" id="questions-easy">)([\s\S]*?)(<\/script>)/,
    (_,open,json,close)=>open+JSON.stringify(JSON.parse(json).map(transform))+close);
  const app=runPage(html),api=app.window.__quiz;
  const reviewer=findAll(app.document.root,n=>hasClass(n,'reviewer-button'))[0];
  const landingReviewer=reviewer.getAttribute('href');
  const input=app.document.getElementById('student-name');input.value='Local Reference Test';
  input.dispatchEvent({type:'input',target:input});input.dispatchEvent({type:'blur',target:input});
  api.setStudyConfirmed(true);assert.equal(api.startQuiz('easy'),true);
  const index=api.getState().attempt.questions.findIndex(pick);assert.ok(index>=0);
  for(let i=0;i<index;i++){
    api.goToQuestion(i);const prior=api.getState().attempt.questions[i];api.selectAnswer(prior.answer);api.checkAnswer();
  }
  api.goToQuestion(index);const q=api.getState().attempt.questions[index];api.selectAnswer(q.answer);api.checkAnswer();
  const feedback=findAll(app.document.getElementById('answer-feedback'),n=>hasClass(n,'feedback-explanation'))[0];
  const finish=()=>{
    for(let i=0;i<api.getState().attempt.questions.length;i++){
      api.goToQuestion(i);const attempt=api.getState().attempt;
      if(!attempt.responses[i].checked){api.selectAnswer(attempt.questions[i].answer);api.checkAnswer();}
    }
    api.finishQuiz();assert.equal(api.getState().view,'results');
    const row=app.document.getElementById('results-review').children[index];
    return findAll(row,n=>hasClass(n,'review-explanation'))[0];
  };
  return {feedback,finish,reviewer,landingReviewer};
}
function assertSeparated(group,note,refs){
  const noteBox=findAll(group,n=>hasClass(n,'explanation-note'))[0];
  const refBox=findAll(group,n=>hasClass(n,'explanation-references'))[0];
  assert.ok(noteBox,'a distinct Note section is required');
  assert.equal(findAll(noteBox,n=>hasClass(n,'explanation-text'))[0].textContent,note);
  if(refs.length){
    assert.ok(refBox,'a distinct References section is required');
    assert.notEqual(noteBox,refBox);assert.equal(noteBox.parentNode,refBox.parentNode);
    assert.equal(findAll(refBox,n=>hasClass(n,'section-label'))[0].textContent,'References');
    assert.deepEqual(findAll(refBox,n=>hasClass(n,'source-ref')).map(n=>n.textContent),refs);
  }else assert.equal(refBox,undefined,'no empty References section');
}
test('inline multi-source references are separate from the note in feedback and review, with literal text safety',()=>{
  const note='The <b>study note</b> stays literal.',reference='First lesson, pages 7, 9; <img src=x> lesson, slide 8.';
  const app=exercise('module-5-exam',q=>({...q,explanation:note+' References: '+reference}));
  for(const group of [app.feedback,app.finish()]){
    assertSeparated(group,note,[reference]);
    assert.equal(findAll(group,n=>['img','b'].includes(n.localName)).length,0);
  }
});
test('structured lesson references get their own section without changing the note',()=>{
  const app=exercise('manet-c4istar-planning',q=>({...q,explanation:'A standalone study note.',sourceSlides:[12,17]}));
  for(const group of [app.feedback,app.finish()])assertSeparated(group,'A standalone study note.',['Lesson reference: page 12, 17']);
});
test('combined exam citations separate only the known source suffix, retaining other parentheses',()=>{
  const note='A study note (with a useful qualification).';
  const app=exercise('combined',q=>({...q,explanation:note+` (${q.lesson}, slide 26)`}),q=>q.lessonKey==='isr');
  for(const group of [app.feedback,app.finish()])assertSeparated(group,note,['ISR Operations, slide 26']);
});
test('uncited explanations remain notes without an invented or empty reference section',()=>{
  const app=exercise('module-5-exam',q=>({...q,explanation:'A note with no supplied citation.'}));
  for(const group of [app.feedback,app.finish()])assertSeparated(group,'A note with no supplied citation.',[]);
});
test('verified manual page numbers open the PDF directly from feedback and results',()=>{
  const app=exercise('signal-estimate',q=>({...q,sourceSlides:[27,44]}));
  for(const group of [app.feedback,app.finish()]){
    const links=findAll(group,n=>hasClass(n,'library-reference')).map(node=>node.getAttribute('href'));
    assert.deepEqual(links,[
      '../library/files/pam-6-0102.pdf#page=27',
      '../library/files/pam-6-0102.pdf#page=44'
    ]);
  }
});
test('the Troop Leading Procedure manual opens at the verified start of Annex A',()=>{
  const app=exercise('troop-leading-procedure',q=>q);
  for(const group of [app.feedback,app.finish()]){
    const manual=findAll(group,n=>hasClass(n,'library-reference')&&n.textContent.includes('PAM 3-0101-04'))[0];
    assert.equal(manual.getAttribute('href'),'../library/files/pam-3-0101-04.pdf#page=253');
  }
});
test('unavailable manual PDFs are explicitly marked in feedback and results',()=>{
  const app=exercise('electronic-intelligence',q=>q);
  for(const group of [app.feedback,app.finish()]){
    const links=findAll(group,n=>hasClass(n,'library-reference'));
    const unavailable=links.filter(n=>hasClass(n,'reference-unavailable'));
    assert.deepEqual(unavailable.map(n=>n.getAttribute('href')),[
      '../library/?doc=pam-3-0702-01#document',
    ]);
    for(const link of unavailable)assert.match(link.textContent,/PDF unavailable/);
  }
});
test('course sources open on the authored ECCM, ELINT and Signal Propagation pages',()=>{
  for(const [slug,qid,pages] of [
    ['electronic-counter-countermeasures','eccm-e-01',[6]],
    ['electronic-intelligence','elint-e-01',[5,7]],
    ['signal-propagation','propagation-e-01',[15,16]],
  ]){
    const app=exercise(slug,q=>q,q=>q.qid===qid);
    for(const group of [app.feedback,app.finish()]){
      const links=findAll(group,n=>hasClass(n,'library-reference')).map(n=>n.getAttribute('href'));
      assert.deepEqual(links.filter(href=>href.includes('#page=')),
        pages.map(page=>'../library/files/lesson-'+slug+'.pdf#page='+page));
    }
  }
});
test('module exam locators open the correct PDFs for each cited lesson',()=>{
  const app=exercise('module-5-exam',q=>q,q=>q.qid==='modulefive-e-06');
  for(const group of [app.feedback,app.finish()]){
    const links=findAll(group,n=>hasClass(n,'library-reference')).map(n=>n.getAttribute('href'));
    assert.deepEqual(links.filter(href=>href.includes('#page=')),[
      '../library/files/lesson-manet-c4istar-planning.pdf#page=9',
      '../library/files/lesson-manet-c4istar-planning.pdf#page=12',
      '../library/files/lesson-c4istar-sensors-integration.pdf#page=18',
    ]);
    assert.ok(links.includes('../library/files/pam-6-00.pdf'));
  }
});
test('module exams point the reviewer to the current question’s primary lesson',()=>{
  const app=exercise('module-5-exam',q=>q,q=>q.qid==='modulefive-e-06');
  assert.equal(app.landingReviewer,'../reviewer/#module-5');
  assert.equal(app.reviewer.getAttribute('href'),'../reviewer/manet/');
  app.finish();
  assert.equal(app.reviewer.getAttribute('href'),'../reviewer/#module-5');
});
