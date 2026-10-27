import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from '../build.mjs';
import {runPage, findAll, hasClass} from './harness.mjs';

const pages=build({write:false,endpoint:''});
function exercise(slug, transform, pick=()=>true) {
  const html=pages[`${slug}/index.html`].replace(/(<script type="application\/json" id="questions-easy">)([\s\S]*?)(<\/script>)/,
    (_,open,json,close)=>open+JSON.stringify(JSON.parse(json).map(transform))+close);
  const app=runPage(html),api=app.window.__quiz;
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
  return {feedback,finish};
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
