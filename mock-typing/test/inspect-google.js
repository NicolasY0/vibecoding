const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox','--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.goto('https://translate.google.com/?hl=zh-CN&sl=auto&tl=en&op=translate', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  const elements = await page.evaluate(() => {
    const els = document.querySelectorAll(
      '[contenteditable="true"], textarea, input[type="text"], input:not([type]), [role="textbox"], [role="combobox"]'
    );
    return Array.from(els).slice(0, 15).map(el => ({
      tag: el.tagName,
      id: el.id || '',
      cls: (typeof el.className === 'string' ? el.className : 'SVG')?.slice(0, 100),
      role: el.getAttribute('role') || '',
      contentEditable: el.isContentEditable || false,
      ariaLabel: (el.getAttribute('aria-label') || '').slice(0, 80),
      offsetW: el.offsetWidth,
      offsetH: el.offsetHeight,
      inDOM: document.body.contains(el),
      textLen: (el.textContent || el.value || '').length,
      placeholder: el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || '',
    }));
  });

  console.log(JSON.stringify(elements, null, 2));
  await browser.close();
})();
