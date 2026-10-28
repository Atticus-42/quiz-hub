// Real browser flows against local generated pages. All class-history endpoints are removed in memory.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const moduleExams=Boolean(process.env.POI_MODULE_EXAMS);
const names=moduleExams?['module-5-exam','module-7-exam']:['manet-c4istar-planning','c4istar-sensors-integration','c4istar-weapon-system-integration','nist-framework','zero-trust','gsomia-compliance','cyber-risk-assessment'];
const server=http.createServer((req,res)=>{
 let name=new URL(req.url,'http://localhost').pathname;if(name.endsWith('/'))name+='index.html';
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{
  let bytes=fs.readFileSync(file);
  if(file.endsWith('.html'))bytes=Buffer.from(bytes.toString().replace(/var HISTORY_ENDPOINT = '[^']*';/g,"var HISTORY_ENDPOINT = '';"));
  res.setHeader('Content-Type',({'.html':'text/html','.woff2':'font/woff2','.jpg':'image/jpeg','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||chromium.executablePath()});
 const out=path.join(root,moduleExams?'.superpowers/sdd/2026-10-27-module-5-7-exams':'.superpowers/sdd/2026-10-25-poi-exam-realignment');
 try{
  const errors=[],external=[];let flows=0;
  for(const width of (process.env.POI_WIDTH?[Number(process.env.POI_WIDTH)]:[1440,375])){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await context.route('**/*',route=>{if(!route.request().url().startsWith(origin)){external.push(route.request().url());return route.abort();}return route.continue();});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   const legacy=moduleExams?[]:['signal-support','combined','module-3-exam'].map(slug=>[slug,'medium']);
   const jobs=process.env.POI_HUB_ONLY?[]:process.env.POI_LEGACY_ONLY?legacy:[...names.flatMap(slug=>['easy','medium','hard'].map(mode=>[slug,mode])),...legacy];
   for(const [slug,mode] of jobs){
    await page.goto(`${origin}/${slug}/`);
    assert.ok(await page.locator('#mode-'+mode).isDisabled());
    await page.locator('#student-name').fill('Local Browser Test');await page.locator('#study-confirm').check();
    await page.locator('#mode-'+mode).click();
    let state=await page.evaluate(()=>window.__quiz.getState());
    assert.equal(state.historyConfigured,false);const total=state.attempt.questions.length;assert.ok(total>=20&&total<=35);
    if(moduleExams)assert.equal(total,slug==='module-5-exam'?30:32);
    for(let i=0;i<total;i++){
     state=await page.evaluate(()=>window.__quiz.getState());assert.equal(state.attempt.current,i);
     if(i===0){await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');assert.equal((await page.evaluate(()=>window.__quiz.getState())).attempt.responses[0].selected,0);}
     const answer=state.attempt.questions[i].answer,choice=i===0?(answer+1)%4:answer;
     await page.locator(`label[for="answer-option-${choice}"]`).click();await page.locator('#btn-check').click();
     assert.ok(await page.locator('#answer-feedback').isVisible());
     if(moduleExams)assert.ok(await page.locator('#answer-feedback .explanation-references').isVisible());
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${slug}/${mode}/${width} overflow`);
     if(i===1){await page.keyboard.press('z');assert.equal((await page.evaluate(()=>window.__quiz.getState())).attempt.current,0);await page.locator('#btn-next').click();}
     if(i<total-1)await page.locator('#btn-next').click();
    }
    await page.locator('#btn-finish').click();assert.ok(await page.locator('#view-results').isVisible());
    assert.equal(await page.locator('#results-review > li').count(),total);
    assert.ok(await page.locator('#btn-retry-missed').isVisible());
    if(moduleExams){
     assert.equal(await page.locator('#topics-heading').innerText(),'Lesson analysis');
     const categories=Object.groupBy(state.attempt.questions,q=>q.category);
     assert.equal(Object.keys(categories).length,slug==='module-5-exam'?3:4);
     const share=slug==='module-5-exam'?10:8;
     for(const rows of Object.values(categories))assert.equal(rows.length,share);
     const resultRows=await page.locator('#results-categories-body > tr').allTextContents();
     assert.equal(resultRows.length,Object.keys(categories).length);
     for(const name of Object.keys(categories))assert.ok(resultRows.some(row=>row.includes(name)&&row.includes(`of ${share} (`)));
     await page.screenshot({path:path.join(out,`${slug}-${mode}-${width}.png`),fullPage:false});
     await page.locator('#btn-retry-missed').click();
     const retry=await page.evaluate(()=>window.__quiz.getState());
     assert.equal(retry.attempt.questions.length,1);assert.equal(retry.attempt.practice,true);
     const answer=retry.attempt.questions[0].answer;
     await page.locator(`label[for="answer-option-${answer}"]`).click();await page.locator('#btn-check').click();await page.locator('#btn-finish').click();
     assert.ok(await page.locator('#view-results').isVisible());assert.equal(await page.locator('#results-review > li').count(),1);
    }
    if(slug==='nist-framework'&&mode==='hard')await page.screenshot({path:path.join(out,`exam-${width}.png`),fullPage:false});
    console.log(`PASS ${slug} ${mode} ${width}px: ${total} questions, previous, check, finish and review`);
    flows++;
   }
   await page.goto(origin+'/#module-7');assert.equal(await page.locator('#exam-grid-module-7 > li').count(),5);
   assert.equal(await page.locator('#class-crest img').evaluate(img=>getComputedStyle(img).transform),'none','class logo stays upright');
   assert.equal(await page.locator('.crest-mount').evaluate(mount=>getComputedStyle(mount,'::before').content),'none','class crest has no extra oval outline');
   await page.screenshot({path:path.join(out,`hub-${width}.png`),fullPage:false});
   const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,items:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right}))}));
   assert.ok(overflow.scroll<=overflow.width,JSON.stringify(overflow));
   await page.goto(origin+'/schedule/#day-2026-10-27');assert.ok(await page.locator('#day-2026-10-27').isVisible());assert.match(await page.locator('#day-2026-10-27').innerText(),/Beef kare-kare/);
   await page.goto(origin+'/schedule-2026-11-02/#day-2026-11-02');assert.doesNotMatch(await page.locator('#schedule-note').innerText(),/Partial schedule/);
   assert.equal(await page.locator('#day-2026-11-02 .blk-title').innerText(),'Admin Break');
   await page.locator('.week-nav a[href="#day-2026-11-08"]').click();assert.ok(await page.locator('#day-2026-11-08').isVisible());
   await page.goto(origin+'/schedule/#day-2026-11-12');await page.waitForURL('**/schedule-2026-11-09/#day-2026-11-12');
   assert.ok((await page.locator('#day-2026-11-12').innerText()).includes('MODULE 8 ASSESSMENT'));
   await page.locator('.week-nav a[href="#day-2026-11-15"]').click();assert.ok(await page.locator('#day-2026-11-15').isVisible());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:path.join(out,`upcoming-schedule-${width}.png`),fullPage:false});
   await context.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log(`PASS ${flows} complete browser flows; schedule and hub layout checks; zero external requests.`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
