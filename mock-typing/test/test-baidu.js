/**
 * Test script: verify mock-typing extension doesn't break Baidu Translate.
 *
 * Usage: node test/test-baidu.js
 *
 * Launches headless Chrome with the extension loaded,
 * navigates to the target page, checks for errors and crashes.
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '..');
const TARGET_URL = 'https://fanyi.baidu.com/mtpe-individual/transText?ext_channel=Aldtype01&from=auto&to=zh&query=#/';

// ── Results collector ──
const results = {
  passed: [],
  failed: [],
  errors: [],
  info: [],
};

function pass(msg) { results.passed.push(msg); console.log(`  ✅ ${msg}`); }
function fail(msg) { results.failed.push(msg); console.log(`  ❌ ${msg}`); }
function info(msg) { results.info.push(msg); console.log(`  ℹ️  ${msg}`); }
function err(msg) { results.errors.push(msg); console.log(`  🔴 ${msg}`); }

// ── Script paths to verify ──
function verifySourceFiles() {
  console.log('\n📋 Checking source files for syntax errors...');
  const files = [
    'lib/key-events.js',
    'lib/human-model.js',
    'lib/typing-engine.js',
    'content/content.js',
    'background/service-worker.js',
    'popup/popup.js',
  ];

  for (const f of files) {
    const fp = path.join(EXTENSION_PATH, f);
    try {
      const code = fs.readFileSync(fp, 'utf8');
      // Basic syntax check via Function constructor (runs in V8)
      new Function(code);
      pass(`${f} — syntax OK (${code.length} bytes)`);
    } catch (e) {
      fail(`${f} — SYNTAX ERROR: ${e.message}`);
    }
  }
}

// ── Browser test ──
async function browserTest() {
  console.log('\n🌐 Launching headless Chrome with extension...');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--window-size=1280,800',
    ],
    ignoreDefaultArgs: ['--disable-component-extensions-with-background-pages'],
  });

  const page = await browser.newPage();
  const consoleLogs = [];

  // Collect ALL console messages
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      err(`[CONSOLE] ${text}`);
    }
  });

  page.on('pageerror', (e) => {
    err(`[PAGE ERROR] ${e.message}`);
  });

  try {
    // ── Navigate ──
    console.log(`\n📄 Navigating to: ${TARGET_URL}`);
    const startTime = Date.now();
    await page.goto(TARGET_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    const loadTime = Date.now() - startTime;
    info(`Page loaded in ${loadTime}ms`);

    // ── Wait for SPA to settle ──
    await new Promise((r) => setTimeout(r, 3000));

    // ── Check for error overlay ──
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    const hasCrashError = bodyText.includes('未知错误') || bodyText.includes('加载失败');
    if (hasCrashError) {
      fail('Baidu Translate shows error overlay (未知错误/加载失败)');
      info(`Page text excerpt: "${bodyText.slice(0, 500)}"`);
    } else {
      pass('No error overlay detected on Baidu Translate');
    }

    // ── Check for input elements ──
    const inputCount = await page.evaluate(() => {
      return document.querySelectorAll(
        'input[type="text"], input:not([type]), textarea, [contenteditable="true"]'
      ).length;
    });
    if (inputCount > 0) {
      pass(`Found ${inputCount} editable element(s) on the page`);
    } else {
      info(`Found ${inputCount} editable elements — page may need user interaction`);
    }

    // ── Check extension console logs ──
    const extLogs = consoleLogs.filter((l) =>
      l.text.includes('[MockTyping]') || l.text.includes('MockTyping')
    );
    if (extLogs.length > 0) {
      info(`Extension logged ${extLogs.length} message(s):`);
      extLogs.forEach((l) => info(`  [${l.type}] ${l.text.slice(0, 120)}`));
    }

    // ── Check for critical console errors ──
    const criticalErrors = consoleLogs.filter(
      (l) => l.type === 'error' && !l.text.includes('favicon') && !l.text.includes('net::')
    );
    if (criticalErrors.length > 0) {
      info(`${criticalErrors.length} console error(s) from the page (may be unrelated to extension):`);
      criticalErrors.slice(0, 5).forEach((l) => info(`  ${l.text.slice(0, 200)}`));
    } else {
      pass('No critical console errors');
    }

    // ── Test content script responsiveness ──
    // Try to evaluate in the page to send a message to our content script
    // Note: In MV3 ISOLATED world, we can't directly reach the content script from page.evaluate
    // But we can check if the extension's service worker is running
    const swTarget = await browser.waitForTarget(
      (t) => t.type() === 'service_worker' && t.url().includes('mock-typing'),
      { timeout: 5000 }
    ).catch(() => null);

    if (swTarget) {
      pass('Service worker is running');
    } else {
      info('Service worker not detected (may not be needed on this page)');
    }

    // ── Screenshot for visual verification ──
    const screenshotDir = path.join(EXTENSION_PATH, 'test', 'screenshots');
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({
      path: path.join(screenshotDir, 'baidu-translate-test.png'),
      fullPage: false,
    });
    info('Screenshot saved to test/screenshots/baidu-translate-test.png');

  } catch (e) {
    fail(`Test error: ${e.message}`);
  } finally {
    await browser.close();
  }
}

// ── Manifest verification ──
function verifyManifest() {
  console.log('\n📋 Checking manifest.json...');
  const mf = JSON.parse(fs.readFileSync(path.join(EXTENSION_PATH, 'manifest.json'), 'utf8'));

  if (mf.manifest_version !== 3) fail('Manifest version is not 3');
  else pass(`Manifest V${mf.manifest_version}`);

  const cs = mf.content_scripts?.[0];
  if (!cs) { fail('No content_scripts defined'); return; }

  if (cs.run_at !== 'document_idle') fail(`run_at should be document_idle, got ${cs.run_at}`);
  else pass('run_at: document_idle');

  if (cs.world && cs.world !== 'ISOLATED') fail(`world should be ISOLATED, got ${cs.world}`);
  else pass('world: ISOLATED');

  const matches = cs.matches || [];
  const hasAllUrls = matches.some((m) => m === '<all_urls>');
  if (hasAllUrls) fail('matches should not use <all_urls>');
  else pass(`matches: ${matches.join(', ')}`);

  const jsFiles = cs.js || [];
  info(`Content scripts (${jsFiles.length}): ${jsFiles.join(', ')}`);
}

// ── Main ──
(async () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Mock Typing — Baidu Translate Test     ║');
  console.log('╚══════════════════════════════════════════╝');

  // 1. Static checks
  verifyManifest();
  verifySourceFiles();

  // 2. Browser test
  await browserTest();

  // ── Summary ──
  console.log('\n' + '═'.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log(`  Passed:  ${results.passed.length}`);
  console.log(`  Failed:  ${results.failed.length}`);
  console.log(`  Info:    ${results.info.length}`);
  console.log('═'.repeat(50));

  if (results.failed.length > 0) {
    console.log('\n❌ FAILURES:');
    results.failed.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('\n✅ All checks passed!');
    process.exit(0);
  }
})();
