const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
  
  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded' });
  
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => {
    if (typeof startGame === 'function') {
      console.log('Starting game...');
      startGame(1);
    }
  });
  
  await new Promise(r => setTimeout(r, 3000));
  
  await browser.close();
})();
