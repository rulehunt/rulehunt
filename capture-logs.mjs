// Temporary script to capture console logs from data mode
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture console messages
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
    console.log(`[${msg.type()}] ${text}`);
  });

  // Capture errors
  page.on('pageerror', error => {
    console.error('Page error:', error.message);
  });

  console.log('Opening data mode...');
  await page.goto('http://localhost:3001/?data=true', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Wait for 10 seconds to capture logs
  console.log('Capturing logs for 10 seconds...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('\n=== SUMMARY ===');
  console.log(`Captured ${logs.length} console messages`);

  await browser.close();
})();
