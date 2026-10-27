import assert from 'node:assert/strict';
import path from 'node:path';
import puppeteer from 'puppeteer';
const browser=await puppeteer.launch({headless:true,executablePath:process.env.PUPPETEER_EXECUTABLE_PATH,args:['--no-sandbox']});
try {
 const page=await browser.newPage(); const errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);
 page.on('request',r=>{if(r.method()==='POST'){writes.push(new URL(r.url()).pathname);return r.abort();}return r.continue();});
 await page.setViewport({width:1440,height:1000});
 await page.goto(`${process.env.IGT_VERIFY_WEB_URL}/#word-library`,{waitUntil:'networkidle0'});
 await page.waitForSelector('.saved-word');
 assert.equal(await page.title(),'Saved words · ClearWrite');
 assert.equal(await page.$$eval('.saved-word',els=>els.length),25);
 const total=await page.$eval('.vocabulary-library-status',el=>el.textContent);
 await page.screenshot({path:path.join(process.cwd(),'artifacts','vocabulary-library','live-list-1440.png')});
 await page.click('.saved-word-row');
 assert.equal(await page.$eval('#saved-word-dialog',el=>el.open),true);
 for(const width of [1440,390]){
  await page.setViewport({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(process.cwd(),'artifacts','vocabulary-library',`live-details-${width}.png`)});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 console.log(JSON.stringify({liveLibrary:true,summary:total,desktopAndMobile:true,reviewWrites:0}));
}finally{await browser.close();}
