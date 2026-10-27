import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
const base=process.env.IGT_VERIFY_WEB_URL;
assert.ok(base);
const browser=await puppeteer.launch({headless:true,executablePath:process.env.PUPPETEER_EXECUTABLE_PATH,args:['--no-sandbox']});
try {
 const page=await browser.newPage();
 const errors=[],blockedWrites=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);
 page.on('request',request=>{
  const url=new URL(request.url());
  if(request.method()==='POST'&&url.pathname==='/vocab/seed')return request.respond({status:200,contentType:'application/json',body:'{"seeded":0}'});
  if(request.method()==='POST'&&url.pathname!=='/review/check'){blockedWrites.push(url.pathname);return request.abort();}
  return request.continue();
 });
 await page.setViewport({width:1440,height:1000});
 await page.goto(`${base}/#word-review`,{waitUntil:'networkidle0'});
 await page.waitForSelector('#review-answer');
 assert.equal(await page.$eval('#review-answer',el=>document.activeElement===el),true);
 const checked=page.waitForResponse(response=>new URL(response.url()).pathname==='/review/check');
 await page.click('.review-check');
 const response=await checked;
 assert.equal(response.status(),200);
 const result=await response.json();
 assert.equal(result.persistence.saved,false);
 assert.deepEqual(Object.keys(result.ratings),['again','hard','good','easy']);
 await page.waitForSelector('.review-rating-button');
 assert.equal(await page.$$eval('.review-rating-button',els=>els.length),4);
 assert.equal(await page.$eval('.review-actions .primary',el=>el.disabled),true);
 const output=path.join(process.cwd(),'artifacts','vocabulary-ratings');
 for(const width of [1440,390]){
  await page.setViewport({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(output,`live-readonly-${width}.png`),fullPage:true});
 }
 assert.deepEqual(errors,[]);
 assert.deepEqual(blockedWrites,[]);
 console.log(JSON.stringify({liveWeb:true,liveCheckApi:true,ratingButtons:4,previewIntervals:Object.fromEntries(Object.entries(result.ratings).map(([key,value])=>[key,value.intervalDays])),reviewWrites:0}));
}finally{await browser.close();}
