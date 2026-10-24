const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';
  const target=path.resolve(root,'.'+p);if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.woff2':'font/woff2'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(target));}catch{res.writeHead(404).end();}
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||chromium.executablePath()});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.CIPHER_TEST_URL||`http://127.0.0.1:${server.address().port}/codes-ciphers/`);
    await page.locator('[data-system="playfair"]').click();
    assert.equal(await page.locator('input[name="direction"]:checked').inputValue(),'encode','Playfair opens ready for plaintext');
    assert.ok(await page.locator('#padding-fields').isHidden());
    assert.equal(await page.locator('select#null-letter').count(),0);
    for(const text of ['why are do balloons float','A','AX','BOOKKEEPER']){
      await page.locator('#message').fill(text);await page.waitForFunction(()=>document.getElementById('answer-state').textContent==='ANSWER READY');
      assert.match(await page.locator('#answer').textContent(),/^(?:[A-Z]{5} )*[A-Z]{1,5}$/);
      const pairs=(await page.locator('#prepared').textContent()).split(' ');assert.ok(pairs.every(p=>p.length===2&&p[0]!==p[1]));
      await page.locator('#reverse').click();assert.equal((await page.locator('#answer').textContent()).replaceAll(' ',''),pairs.join(''));
      await page.locator('input[value="encode"]').check();
    }
    await page.locator('#message').fill('XX');await page.waitForFunction(()=>document.getElementById('answer-message').textContent.includes('X-only'));
    assert.equal(await page.locator('#answer').textContent(),'—');
    await page.locator('#load-example').click();assert.equal(await page.locator('#answer').textContent(),'CBRUR YHO');
    assert.equal(await page.locator('#prepared').textContent(),'BA LX LO ON');
    await page.locator('input[value="decode"]').check();await page.locator('#message').fill('AA');
    await page.waitForFunction(()=>document.getElementById('answer-state').textContent==='CHECK INPUT'&&document.getElementById('answer-message').textContent.includes('identical pair'));
    assert.match(await page.locator('#answer-message').textContent(),/Encipher/);
    assert.match(await page.locator('#answer-message').textContent(),/identical pair/);
    await page.locator('[data-system="single"]').click();await page.locator('[data-system="playfair"]').click();
    assert.equal(await page.locator('input[name="direction"]:checked').inputValue(),'decode','Do not override an explicitly selected mode');
    await page.locator('input[value="encode"]').check();await page.waitForFunction(()=>document.getElementById('answer-state').textContent==='ANSWER READY');
    await page.setViewportSize({width:375,height:812});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
    for(const width of [1440,375]){
      await page.setViewportSize({width,height:900});
      for(const system of ['dsacs','rsacs','keyword','decimation','numerical','playfair','single','double']){
        await page.locator(`[data-system="${system}"]`).click();
        await page.locator('input[value="encode"]').check();
        await page.locator('#message').fill('MEET AT DAWN');
        if(['single','double'].includes(system))await page.locator('#generate-columns').fill('8');
        await page.locator('#generate-key').click();
        assert.match(await page.locator('#generate-status').textContent(),/^Generated/);
        assert.equal(await page.locator('#message').inputValue(),'MEET AT DAWN');
        assert.equal(await page.locator('input[name="direction"]:checked').inputValue(),'encode');
        assert.equal(await page.locator('#answer-state').textContent(),'ANSWER READY');
        if(['single','double'].includes(system))assert.equal((await page.locator('#key1').inputValue()).split(' ').length,8);
        if(system==='double')assert.notEqual(await page.locator('#key1').inputValue(),await page.locator('#key2').inputValue());
        const prepared=(await page.locator('#prepared').textContent()).replaceAll(' ','');
        await page.locator('#reverse').click();
        assert.equal((await page.locator('#answer').textContent()).replaceAll(' ',''),prepared);
        await page.locator('#generate-key').click();
        assert.equal(await page.locator('input[name="direction"]:checked').inputValue(),'decode');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      }
    }
    const previousKey=await page.locator('#key1').inputValue();
    await page.locator('#generate-columns').fill('41');await page.locator('#generate-key').click();
    assert.match(await page.locator('#generate-status').textContent(),/Column count/);
    assert.equal(await page.locator('#key1').inputValue(),previousKey);
    assert.deepEqual(errors,[]);
    console.log('PASS: Playfair conventions; all eight generators preserve text/mode, round trip, validate columns and fit desktop/mobile.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
