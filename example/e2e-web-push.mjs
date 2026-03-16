import puppeteer from 'puppeteer';

const URL = 'https://localhost:3443/';

(async () => {
  console.log('[1] Launching Chrome (headful, notifications allowed)...');
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

  console.log('[2] Navigating to', URL);
  await page.goto(URL, { waitUntil: 'networkidle0' });

  console.log('[3] Clicking "Initialize Push"...');
  await page.click('#init');

  // Wait for status to change from "Initializing..."
  console.log('[4] Waiting for SDK initialization...');
  await page.waitForFunction(
    () => {
      const el = document.getElementById('status');
      return el && !el.textContent.includes('Initializing') && !el.textContent.includes('Not initialized');
    },
    { timeout: 30000 }
  );

  const statusText = await page.$eval('#status', el => el.textContent);
  console.log('[5] Status:', statusText);

  if (statusText.includes('Error')) {
    console.error('FAILED:', statusText);
    await browser.close();
    process.exit(1);
  }

  // Extract IC ID
  const match = statusText.match(/IC ID:\s*(\d+)/);
  const icId = match ? match[1] : 'unknown';
  console.log('[6] Instance created, IC ID:', icId);

  console.log('[7] Browser stays open for push delivery test.');
  console.log('    Send push from backend, then press Ctrl+C to close.');
  console.log('    IC_ID=' + icId);

  // Keep alive for 120 seconds to receive push
  await new Promise(resolve => setTimeout(resolve, 120000));
  await browser.close();
})();
