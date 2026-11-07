const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../..');const all=Object.assign({},...fs.readdirSync(path.join(root,'data/reviewer-focus')).map(f=>JSON.parse(fs.readFileSync(path.join(root,'data/reviewer-focus',f)))));
 const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
 const p=await b.newPage({viewport:{width:375,height:850}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 for(const key of Object.keys(all)){await p.goto(base+'/reviewer/'+key+'/');assert.equal(await p.locator('[data-focus-card]').count(),all[key].keyPoints.length);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),key+' overflow');}
 await p.goto(base+'/reviewer/leadershipattributes/');await p.locator('[data-focus-recall]').click();assert.equal(await p.locator('[data-focus-answer][open]').count(),0);await p.locator('[data-focus-answer] summary').first().click();assert.equal(await p.locator('[data-focus-answer][open]').count(),1);
 await p.locator('[data-focus-mark="again"]').first().click();await p.locator('[data-focus-filter]').click();assert.equal(await p.locator('[data-focus-card]:visible').count(),1);await p.reload();assert.equal(await p.locator('[data-state="again"]').count(),1);await p.locator('[data-focus-reset]').click();assert.equal(await p.locator('[data-state="again"]').count(),0);
 await p.setViewportSize({width:1440,height:1000});await p.locator('#exam-focus').scrollIntoViewIfNeeded();fs.mkdirSync(path.join(root,'tmp'),{recursive:true});await p.screenshot({path:path.join(root,'tmp/reviewer-focus-desktop.png')});await p.setViewportSize({width:375,height:850});await p.screenshot({path:path.join(root,'tmp/reviewer-focus-mobile.png')});
 const nojs=await b.newContext({javaScriptEnabled:false});const np=await nojs.newPage();await np.goto(base+'/reviewer/leadershipattributes/');assert.equal(await np.locator('[data-focus-answer][open]').count(),5);assert(await np.locator('.focus-answer').first().isVisible());await nojs.close();assert.deepEqual(errors,[]);
 console.log('PASS: 32 mobile reviewers, recall/reveal, weak-point filtering, saved marks/reset, desktop layout and readable without JavaScript.');
 }finally{await b.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
