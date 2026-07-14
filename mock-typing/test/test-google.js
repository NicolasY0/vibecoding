const puppeteer = require('puppeteer-core');
const path = require('path');

const EXT = path.resolve(__dirname, '..');
const URL = 'https://translate.google.com/?hl=zh-CN&sl=auto&tl=en&op=translate';

(async () => {
  console.log('🧪 Google Translate Typing Test\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--no-sandbox','--disable-gpu','--window-size=1280,800',
    ],
    ignoreDefaultArgs: ['--disable-component-extensions-with-background-pages'],
  });

  const page = await browser.newPage();
  const errors = [];

  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  page.on('pageerror', (e) => errors.push(e.message));

  try {
    // 1. Load page
    console.log('1️⃣  Loading Google Translate...');
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    console.log('   ✅ Page loaded');

    // 2. Check no crash
    const body = await page.evaluate(() => document.body?.innerText?.slice(0, 200) || '');
    if (body.includes('error') || body.includes('Error')) {
      console.log('   ⚠️  Page contains error text, but may be normal');
    } else {
      console.log('   ✅ No error overlay');
    }

    // 3. Find editable element
    const el = await page.evaluate(() => {
      const els = document.querySelectorAll(
        'textarea, [contenteditable="true"], [role="textbox"], [role="combobox"]'
      );
      for (const e of els) {
        if (e.offsetWidth > 0 && e.offsetHeight > 0) {
          return {
            tag: e.tagName,
            role: e.getAttribute('role') || '',
            visible: true,
            w: e.offsetWidth, h: e.offsetHeight,
            contentEditable: e.isContentEditable || false,
          };
        }
      }
      return null;
    });
    if (el) {
      console.log(`   ✅ Found <${el.tag}> role="${el.role}" ${el.w}x${el.h}, contentEditable=${el.contentEditable}`);
    } else {
      console.log('   ❌ No editable element found');
    }

    // 4. Click the textarea and manually simulate typing via page.evaluate
    console.log('\n2️⃣  Simulating keystrokes...');

    const result = await page.evaluate(() => {
      // Find Google Translate's source textarea
      const ta = document.querySelector('textarea[aria-label="原文"], textarea[role="combobox"]');
      if (!ta) return { error: 'Textarea not found' };

      ta.focus();
      ta.value = '';
      ta.dispatchEvent(new Event('focus', { bubbles: true }));

      // Type "Hello world" character by character
      const text = 'Hello';
      let success = 0;

      for (const ch of text) {
        // Use native setter approach (key-events.js strategy)
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set;

        const start = ta.selectionStart || 0;
        const val = ta.value || '';
        const newVal = val.slice(0, start) + ch + val.slice(start);

        // keydown
        ta.dispatchEvent(new KeyboardEvent('keydown', {
          key: ch, code: 'Key' + ch.toUpperCase(),
          keyCode: ch.toUpperCase().charCodeAt(0), which: ch.charCodeAt(0),
          bubbles: true, cancelable: true, composed: true,
        }));

        // beforeinput
        ta.dispatchEvent(new InputEvent('beforeinput', {
          data: ch, inputType: 'insertText', bubbles: true, cancelable: true,
        }));

        // Set value via native setter
        nativeSetter.call(ta, newVal);
        ta.setSelectionRange(start + 1, start + 1);

        // input
        ta.dispatchEvent(new InputEvent('input', {
          data: ch, inputType: 'insertText', bubbles: true, cancelable: true,
        }));

        // keyup
        ta.dispatchEvent(new KeyboardEvent('keyup', {
          key: ch, code: 'Key' + ch.toUpperCase(),
          keyCode: ch.toUpperCase().charCodeAt(0), which: ch.charCodeAt(0),
          bubbles: true, cancelable: true, composed: true,
        }));

        if (ta.value.includes(ch)) success++;
      }

      return {
        value: ta.value,
        valueLength: ta.value.length,
        charsStuck: success,
        expected: text,
      };
    });

    console.log(`   Value in textarea: "${result.value}"`);
    console.log(`   Expected:          "${result.expected}"`);
    if (result.value === result.expected) {
      console.log('   ✅ Textarea accepted all characters!');
    } else if (result.valueLength > 0) {
      console.log(`   🟡 Partial: ${result.valueLength}/${result.expected.length} chars`);
    } else {
      console.log('   ❌ Textarea did not accept any characters');
    }

    // 5. Screenshot
    const ssDir = path.join(EXT, 'test', 'screenshots');
    require('fs').mkdirSync(ssDir, { recursive: true });
    await page.screenshot({ path: path.join(ssDir, 'google-translate-test.png') });
    console.log('   📸 Screenshot saved');

  } catch (e) {
    console.log(`   ❌ ${e.message}`);
  } finally {
    await browser.close();
  }

  // Filter out Baidu/Google internal errors
  const realErrors = errors.filter(e =>
    !e.includes('favicon') && !e.includes('net::') &&
    !e.includes('googleads') && !e.includes('analytics')
  );
  console.log(`\n📊 Console errors: ${realErrors.length} (filtered)`);
  if (realErrors.length > 0) {
    realErrors.slice(0, 5).forEach(e => console.log(`   - ${e.slice(0, 150)}`));
  }
})();
