import puppeteer from 'puppeteer';

const URL = 'https://localhost:3443/';

(async () => {
  console.log('[1] Launching Chrome...');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: [
      '--ignore-certificate-errors',
      '--allow-insecure-localhost',
    ],
  });

  const context = browser.defaultBrowserContext();
  await context.overridePermissions('https://localhost:3443', ['notifications']);

  const page = await browser.newPage();
  page.on('console', msg => console.log('[BROWSER]', msg.text()));
  page.on('pageerror', err => console.log('[PAGE_ERROR]', err.message));

  console.log('[2] Navigating to', URL);
  await page.goto(URL, { waitUntil: 'networkidle0' });

  console.log('[3] Clicking "Initialize Push"...');
  await page.click('#init');

  console.log('[4] Waiting for SDK initialization (60s timeout)...');
  try {
    await page.waitForFunction(
      () => {
        const el = document.getElementById('status');
        return el && !el.textContent.includes('Initializing') && !el.textContent.includes('Not initialized');
      },
      { timeout: 60000 }
    );
  } catch (e) {
    const statusText = await page.$eval('#status', el => el.textContent);
    console.log('[TIMEOUT] Status element text:', statusText);
  }

  const statusText = await page.$eval('#status', el => el.textContent);
  console.log('[5] Status:', statusText);

  if (statusText.includes('IC ID')) {
    const match = statusText.match(/IC ID:\s*(\d+)/);
    const icId = match ? match[1] : 'unknown';
    console.log('[6] SUCCESS! IC ID:', icId);
  } else {
    console.log('[6] SDK did not finish. Check browser console.');
  }

  console.log('[7] Browser stays open for 5 minutes for push testing.');
  await new Promise(resolve => setTimeout(resolve, 300000));
  await browser.close();
})();
