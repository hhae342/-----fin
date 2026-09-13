const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.NODE_PATH || 'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));

(async () => {
  const root = __dirname;
  const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'};
  const server = http.createServer((req,res) => {
    const file = path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if (!file.startsWith(root+path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file,(error,data) => { res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream'}); res.end(error?'not found':data); });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true,channel:'msedge'});
    const page = await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?profile=c`);
    await page.locator('.view-slider-labels span').nth(2).click();
    await page.waitForTimeout(700);
    assert.equal(await page.locator('#stage-guide').isVisible(),false,'C guide is hidden');
    assert.equal(await page.locator('#cloud-source').evaluate(e=>getComputedStyle(e).filter),'none');
    await page.evaluate(()=>{
      const create=Matter.Engine.create;
      Matter.Engine.create=(...args)=>{window.testCEngine=create(...args);return window.testCEngine;};
    });
    const box=await page.locator('#footage').boundingBox();
    const x=box.x+box.width*.45,y=box.y+box.height*.55;
    await page.mouse.move(x,y);
    const homes=await page.evaluate(()=>Matter.Composite.allBodies(testCEngine.world).filter(b=>!b.isStatic).map(b=>({...b.position})));
    assert.ok(homes.length>=8 && homes.length<=20,'large architectural fragments, not particles');
    const before=await page.locator('#footage-canvas').evaluate(c=>c.toDataURL());
    await page.mouse.down();
    await page.mouse.move(x+box.width*.22,y-box.height*.2,{steps:25});
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#footage').evaluate(e=>e.classList.contains('is-pressed')),true);
    await page.mouse.up();
    await page.waitForTimeout(1800);
    const after=await page.locator('#footage-canvas').evaluate(c=>c.toDataURL());
    assert.notEqual(after,before,'drag changes the image');
    await page.mouse.move(box.x-10,box.y-10);
    await page.waitForTimeout(100);
    const settled=await page.locator('#footage-canvas').evaluate(c=>c.toDataURL());
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#footage-canvas').evaluate(c=>c.toDataURL()),settled,'settled layout persists after pointer leaves');
    const screenshot=path.join(os.tmpdir(),'c-deconstruction-after.png');
    await page.locator('#footage').screenshot({path:screenshot});
    await page.mouse.dblclick(x,y);
    await page.waitForTimeout(850);
    await page.mouse.move(box.x-10,box.y-10);
    const restored=await page.locator('#footage-canvas').evaluate(c=>c.toDataURL());
    const recovered=await page.evaluate(()=>Matter.Composite.allBodies(testCEngine.world).filter(b=>!b.isStatic).map(b=>({...b.position})));
    assert.deepEqual(recovered,homes,'all fragments return to their original positions');
    assert.notEqual(restored,settled,'double-click restores the collage');
    await page.locator('#footage').screenshot({path:path.join(os.tmpdir(),'c-deconstruction-restored.png')});
    await page.locator('.archive-nav button[data-letter="e"]').click();
    assert.equal(await page.locator('#footage').evaluate(e=>e.classList.contains('cloud-mode')),false);
    assert.equal(await page.locator('#stage-guide').isVisible(),true,'other profiles keep their guide');
    await page.locator('.archive-nav button[data-letter="c"]').click();
    await page.setViewportSize({width:760,height:950});
    await page.locator('#footage').hover();
    assert.equal(await page.locator('#footage-canvas').evaluate(c=>c.width),await page.locator('#footage').evaluate(e=>e.clientWidth*2),'resize retains sharp canvas');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('#footage').dblclick();
    assert.deepEqual(errors,[]);
    console.log('PASS: drag, settling, pointer leave, rewind, profile switch, resize, reduced motion; no browser errors.');
    console.log(screenshot);
  } finally { if (browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
