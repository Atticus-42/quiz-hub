// Real rendered layout checks for every exam. No live class-history traffic.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.superpowers/reference-layout');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 let name=new URL(req.url,'http://localhost').pathname;if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{let data=fs.readFileSync(file);if(file.endsWith('.html'))data=Buffer.from(data.toString().replace(/var HISTORY_ENDPOINT = '[^']*';/g,"var HISTORY_ENDPOINT = '';"));
 res.setHeader('Content-Type',({'.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404).end();}
});
(async()=>{
 const {loadLessons}=await import(pathToFileURL(path.join(root,'scripts/build.mjs')).href);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||chromium.executablePath()});const external=[],errors=[];let checks=0;
 try{
  for(const width of [1440,375]){
   const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
   await context.route('**/*',r=>{if(!r.request().url().startsWith(origin)){external.push(r.request().url());return r.abort();}return r.continue();});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   for(const lesson of loadLessons().lessons){
    for(const mode of ['easy','medium','hard']){
     await page.goto(`${origin}/${lesson.slug}/`);await page.locator('#student-name').fill('Local Reference Layout');await page.locator('#study-confirm').check();await page.locator('#mode-'+mode).click();
     const state=await page.evaluate(()=>window.__quiz.getState());assert.equal(state.historyConfigured,false);
     await page.locator(`label[for="answer-option-${state.attempt.questions[0].answer}"]`).click();await page.locator('#btn-check').click();
     const group=page.locator('#answer-feedback .explanation-group');assert.ok(await group.locator('.explanation-note').isVisible());
     assert.ok(!(await group.locator('.explanation-note').innerText()).includes('References:'));
     const references=group.locator('.explanation-references');
     if(await references.count()){
      assert.equal((await references.locator('.section-label').innerText()).toLowerCase(),'references');
      assert.equal(await references.locator('.section-label').evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return range.getClientRects().length;}),1,`${lesson.key}/${mode}/${width}: References must stay on one line`);
      const noteBox=await group.locator('.explanation-note').boundingBox(),refBox=await references.boundingBox();
      assert.ok(refBox.y>=noteBox.y+noteBox.height,`${lesson.key}/${mode}: note and sources overlap`);
      const label=await references.locator('.section-label').boundingBox(),refText=await references.locator('.source-ref').first().boundingBox();
      assert.ok(label.y+label.height<=refText.y+1||label.x+label.width<=refText.x+1,'reference label must not overlap citation');
     }
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${lesson.key}/${mode}/${width}: overflow`);
     if(lesson.key==='modulefive'&&mode==='easy')await group.screenshot({path:path.join(out,`feedback-${width}.png`)});
     if(mode==='easy'){
      await page.evaluate(()=>{const api=window.__quiz;for(let i=0;i<api.getState().attempt.questions.length;i++){api.goToQuestion(i);const a=api.getState().attempt;if(!a.responses[i].checked){api.selectAnswer(a.questions[i].answer);api.checkAnswer();}}api.finishQuiz();});
      assert.ok(await page.locator('#view-results').isVisible());
      assert.equal(await page.locator('#results-review .explanation-note').count(),state.attempt.questions.length);
      assert.ok((await page.locator('#results-review .explanation-note').allTextContents()).every(t=>!t.includes('References:')));
      assert.ok(await page.locator('#results-review .explanation-references .section-label').evaluateAll(labels=>labels.every(el=>{const range=document.createRange();range.selectNodeContents(el);return range.getClientRects().length===1;})),`${lesson.key}/${width}: review reference headings must stay on one line`);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     }
     checks++;
    }
    console.log(`PASS ${lesson.key}: all modes, feedback and full results, ${width}px`);
   }
   await context.close();
  }
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);console.log(`PASS ${checks} feedback cases; 42 completed results; zero external requests/browser errors.`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
