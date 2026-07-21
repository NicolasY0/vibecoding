// B站动态批量删除 — 自动化脚本
// Usage: node scripts/run.js [UID]
// If UID not given, reads from space page redirect

const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME_BIN = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.agent-browser', 'browsers', 'chrome-151.0.7922.34', 'chrome.exe'
);

const USER_DATA = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.bilibili-deleter-profile'
);

const DELETE_SCRIPT = `
(async () => {
  const csrf = document.cookie.split('; ').find(r => r.startsWith('bili_jct='))?.split('=')[1];
  if (!csrf) return 'NOT_LOGGED_IN';
  const uid = window.location.pathname.split('/')[1];

  async function api(url, data) {
    const res = await fetch(url, {
      method: data ? 'POST' : 'GET',
      credentials: 'include',
      headers: data ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
      body: data ? Object.entries(data).map(([k,v]) => k+'='+encodeURIComponent(v)).join('&') : undefined
    });
    if (res.status === 412) throw new Error('IP_BANNED');
    if (res.status === 429) throw new Error('RATE_LIMITED');
    const text = await res.text();
    if (text.startsWith('<!DOCTYPE')) throw new Error('HTML');
    return JSON.parse(text);
  }

  async function listDynamics(uid, offset) {
    try {
      const r = await api('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid='+uid+(offset?'&offset='+offset:''));
      if (r?.data?.items) return { items: r.data.items.map(i=>({id_str:i.id_str})), has_more: r.data.has_more||false, offset: r.data.offset||'' };
    } catch(e) {}
    const r = await api('https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/space_history?visitor_uid='+uid+'&host_uid='+uid+'&offset_dynamic_id='+(offset||0));
    const cards = r?.data?.cards||[];
    return { items: cards.map(c=>({id_str:c.desc.dynamic_id_str})), has_more: r?.data?.has_more||false, offset: cards.length?cards[cards.length-1].desc.dynamic_id_str:offset };
  }

  let total=0, offset='', hasMore=true, speed=60, rateHits=0;
  while (hasMore) {
    let page;
    try { page = await listDynamics(uid, offset); }
    catch(e) { if(e.message==='RATE_LIMITED'){rateHits++;speed=Math.min(speed+30,500);await new Promise(r=>setTimeout(r,rateHits*2000));continue;} if(e.message==='IP_BANNED')return 'IP_BANNED'; return 'ERROR:'+e.message; }
    hasMore=page.has_more; offset=page.offset;
    if(!page.items?.length) break;
    for(const item of page.items){
      try {
        const rm = await api('https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/rm_dynamic',{dynamic_id:item.id_str,csrf_token:csrf});
        if(rm.code===0){total++;rateHits=0;if(speed>60)speed=Math.max(60,speed-5);}
      } catch(e) { if(e.message==='RATE_LIMITED'){rateHits++;speed=Math.min(speed+30,500);await new Promise(r=>setTimeout(r,3000));continue;} if(e.message==='IP_BANNED')return 'IP_BANNED'; }
      await new Promise(r=>setTimeout(r,speed));
    }
  }
  return 'DONE:'+total;
})();
`;

async function main() {
  const uid = process.argv[2];
  if (!uid) {
    console.error('Usage: node scripts/run.js <UID>');
    console.error('Example: node scripts/run.js 1675268210');
    process.exit(1);
  }

  // Check Chrome
  if (!fs.existsSync(CHROME_BIN)) {
    console.error('❌ Chrome not found at:', CHROME_BIN);
    console.error('Please install agent-browser first: npm i -g agent-browser && agent-browser install');
    process.exit(1);
  }

  // Launch Chrome with CDP
  console.log('🚀 Launching Chrome...');
  const chrome = spawn(CHROME_BIN, [
    `--remote-debugging-port=9223`,
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
  ], { stdio: 'ignore', detached: true });

  // Wait for CDP to be ready
  await new Promise(r => setTimeout(r, 3000));

  // Connect via puppeteer
  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9223',
      defaultViewport: null,
    });
  } catch (e) {
    console.error('❌ Failed to connect to Chrome:', e.message);
    console.error('Trying to find debugging URL...');
    // Try to get the WebSocket URL from the HTTP endpoint
    const http = require('http');
    const wsUrl = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9223/json/version', (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve(JSON.parse(data).webSocketDebuggerUrl); }
          catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
    browser = await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
  }

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  // Navigate to user's dynamic page
  console.log(`📄 Opening dynamic page for UID ${uid}...`);
  await page.goto(`https://space.bilibili.com/${uid}/dynamic`, { waitUntil: 'networkidle2', timeout: 30000 });

  // Check login
  const loggedIn = await page.evaluate(() => {
    return document.cookie.includes('bili_jct=');
  });

  if (!loggedIn) {
    console.log('⚠️ Not logged in. Opening login page...');
    await page.goto('https://www.bilibili.com/', { waitUntil: 'networkidle2', timeout: 30000 });

    // Click login button to show QR
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('*')];
      const loginBtn = btns.find(el => el.textContent.trim() === '登录' && el.offsetParent !== null);
      if (loginBtn) loginBtn.click();
    });

    console.log('📱 QR code should be visible. Please scan with Bilibili App.');
    console.log('⏳ Waiting for login (max 120s)...');

    // Wait for login
    await page.waitForFunction(() => {
      return document.cookie.includes('bili_jct=');
    }, { timeout: 120000 });

    console.log('✅ Logged in!');
    await page.goto(`https://space.bilibili.com/${uid}/dynamic`, { waitUntil: 'networkidle2', timeout: 30000 });
  }

  // Inject delete script
  console.log('🗑 Starting deletion...');
  const result = await page.evaluate(DELETE_SCRIPT);

  if (result.startsWith('DONE:')) {
    const count = result.split(':')[1];
    console.log(`✅ Deleted ${count} dynamics!`);
  } else if (result === 'NOT_LOGGED_IN') {
    console.error('❌ Still not logged in. Please try again.');
  } else if (result === 'IP_BANNED') {
    console.error('💀 IP temporarily banned. Try again later.');
  } else {
    console.error('❌ Error:', result);
  }

  await browser.close();
  chrome.kill();
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
