const puppeteer = require('puppeteer-core');
const path = require('path');

const EXT = path.resolve(__dirname, '..');
const TEST_PAGE = 'file:///' + path.resolve(__dirname, 'test-page.html').replace(/\\/g, '/');

(async () => {
  console.log('🧪 Local Typing Test (simulated Google Translate textarea)\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--no-sandbox','--disable-gpu',
      '--allow-file-access-from-files',
    ],
    ignoreDefaultArgs: ['--disable-component-extensions-with-background-pages'],
  });

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  try {
    await page.goto(TEST_PAGE, { waitUntil: 'load', timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000)); // Wait for extension + page stabilise
    console.log('✅ Test page loaded\n');

    // 1. Focus the textarea and verify events work
    console.log('1️⃣  Typing via native setter approach (key-events.js method)...');
    const result1 = await page.evaluate(() => {
      const ta = document.querySelector('textarea[role="combobox"]');
      if (!ta) return { error: 'textarea not found' };

      ta.focus();
      ta.value = '';
      ta.setSelectionRange(0, 0);

      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      ).set;

      let eventCount = { keydown: 0, beforeinput: 0, input: 0, keyup: 0 };
      const unsubs = [];
      ['keydown','beforeinput','input','keyup'].forEach(type => {
        const fn = () => { eventCount[type]++; };
        ta.addEventListener(type, fn);
        unsubs.push(() => ta.removeEventListener(type, fn));
      });

      const text = 'Hello';
      for (const ch of text) {
        const start = ta.selectionStart;
        const val = ta.value;

        ta.dispatchEvent(new KeyboardEvent('keydown', {
          key: ch, code: 'Key' + ch.toUpperCase(),
          keyCode: ch.toUpperCase().charCodeAt(0), bubbles: true, cancelable: true,
        }));

        ta.dispatchEvent(new InputEvent('beforeinput', {
          data: ch, inputType: 'insertText', bubbles: true, cancelable: true,
        }));

        nativeSetter.call(ta, val.slice(0, start) + ch + val.slice(start));
        ta.setSelectionRange(start + 1, start + 1);

        ta.dispatchEvent(new InputEvent('input', {
          data: ch, inputType: 'insertText', bubbles: true, cancelable: true,
        }));

        ta.dispatchEvent(new KeyboardEvent('keyup', {
          key: ch, code: 'Key' + ch.toUpperCase(),
          keyCode: ch.toUpperCase().charCodeAt(0), bubbles: true, cancelable: true,
        }));
      }

      unsubs.forEach(fn => fn());
      return { value: ta.value, length: ta.value.length, eventCount };
    });

    console.log(`   Value:   "${result1.value}"`);
    console.log(`   Length:  ${result1.length}`);
    console.log(`   Events:  kd=${result1.eventCount.keydown} bi=${result1.eventCount.beforeinput} in=${result1.eventCount.input} ku=${result1.eventCount.keyup}`);
    if (result1.value === 'Hello') console.log('   ✅ Native setter typing works!');
    else console.log('   ❌ Failed: ' + JSON.stringify(result1));

    // 2. Test via our actual KeyEvents API (content script)
    console.log('\n2️⃣  Typing via KeyEvents.simulateKeyPress (content script)...');
    // Need to reach into content script's isolated world... that's hard from puppeteer.
    // Instead, we evaluate code that mirrors our key-events.js logic.
    const result2 = await page.evaluate(() => {
      const ta = document.querySelector('textarea[role="combobox"]');
      ta.focus();
      ta.value = '';
      ta.setSelectionRange(0, 0);

      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      ).set;

      const text = 'World';
      for (const ch of text) {
        // -- Mimic KeyEvents.simulateKeyPress --
        const upper = ch.toUpperCase();
        const keyInfo = { key: ch, code: 'Key' + upper, keyCode: upper.charCodeAt(0), shiftKey: false };

        // beforeinput
        ta.dispatchEvent(new InputEvent('beforeinput', { data: ch, inputType: 'insertText', bubbles: true, cancelable: true }));

        // keydown
        ta.dispatchEvent(new KeyboardEvent('keydown', { ...keyInfo, bubbles: true, cancelable: true, composed: true, view: window }));

        // keypress
        ta.dispatchEvent(new KeyboardEvent('keypress', { ...keyInfo, bubbles: true, cancelable: true, composed: true, view: window }));

        // DOM mutation via native setter
        const start = ta.selectionStart;
        nativeSetter.call(ta, ta.value.slice(0, start) + ch + ta.value.slice(start));
        ta.setSelectionRange(start + 1, start + 1);

        // input event
        ta.dispatchEvent(new InputEvent('input', { data: ch, inputType: 'insertText', bubbles: true, cancelable: true, composed: true }));

        // keyup
        ta.dispatchEvent(new KeyboardEvent('keyup', { ...keyInfo, bubbles: true, cancelable: true, composed: true, view: window }));

        // change event (for React)
        ta.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      }

      return { value: ta.value };
    });

    console.log(`   Value:   "${result2.value}"`);
    if (result2.value === 'World') console.log('   ✅ Full event cascade typing works!');
    else console.log('   ❌ Failed: ' + JSON.stringify(result2));

    // 3. Test backspace
    console.log('\n3️⃣  Testing backspace...');
    const result3 = await page.evaluate(() => {
      const ta = document.querySelector('textarea[role="combobox"]');
      ta.focus();
      nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeSetter.call(ta, 'Test');

      // Backspace 2 chars
      for (let i = 0; i < 2; i++) {
        const ki = { key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8 };
        ta.dispatchEvent(new InputEvent('beforeinput', { inputType: 'deleteContentBackward', bubbles: true, cancelable: true }));
        ta.dispatchEvent(new KeyboardEvent('keydown', { ...ki, bubbles: true, cancelable: true, composed: true, view: window }));
        const start = ta.selectionStart;
        nativeSetter.call(ta, ta.value.slice(0, Math.max(0, start - 1)) + ta.value.slice(start));
        ta.setSelectionRange(Math.max(0, start - 1), Math.max(0, start - 1));
        ta.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true, cancelable: true, composed: true }));
        ta.dispatchEvent(new KeyboardEvent('keyup', { ...ki, bubbles: true, cancelable: true, composed: true, view: window }));
      }

      return { value: ta.value };
    });

    console.log(`   Value after backspace x2: "${result3.value}"`);
    if (result3.value === 'Te') console.log('   ✅ Backspace works!');
    else console.log('   ❌ Failed');

  } catch (e) {
    console.log(`❌ ${e.message}`);
  } finally {
    await browser.close();
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`Page errors: ${errors.length}`);
  if (errors.length) errors.slice(0, 3).forEach(e => console.log(`  - ${e.slice(0, 150)}`));
})();
