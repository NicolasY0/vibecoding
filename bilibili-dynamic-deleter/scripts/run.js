// B站动态批量删除 — 自动化脚本
// Usage:
//   node scripts/run.js <UID>
//   node scripts/run.js <UID> --type 1          # 只删转发
//   node scripts/run.js <UID> --type 8          # 只删视频
//   node scripts/run.js <UID> --preserve-liked 3           # 保留点赞最高的3条
//   node scripts/run.js <UID> --preserve-keyword 抽奖      # 保留含"抽奖"的动态
//   node scripts/run.js <UID> --preserve-keyword 福利 --preserve-keyword 转发

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

// ── CLI 参数解析 ──
function parseArgs(argv) {
  const conf = { targetType: 'all', preserveLiked: 0, preserveKeywords: [], uid: null };

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--type' && argv[i+1])         { conf.targetType = isNaN(argv[i+1]) ? argv[i+1] : Number(argv[i+1]); i++; }
    else if (argv[i] === '--preserve-liked' && argv[i+1])  { conf.preserveLiked = parseInt(argv[i+1]) || 0; i++; }
    else if (argv[i] === '--preserve-keyword' && argv[i+1]) { conf.preserveKeywords.push(argv[i+1]); i++; }
    else if (!conf.uid && !argv[i].startsWith('--')) { conf.uid = argv[i]; }
  }
  return conf;
}

const CONFIG = parseArgs(process.argv);
if (!CONFIG.uid) {
  console.error('Usage: node scripts/run.js <UID> [options]');
  console.error('Options: --type <num>  --preserve-liked <N>  --preserve-keyword <text>');
  process.exit(1);
}

// ── 注入脚本 ──
const DELETE_SCRIPT = `
(async () => {
  const CONFIG = ${JSON.stringify(CONFIG)};
  const csrf = document.cookie.split('; ').find(r => r.startsWith('bili_jct='))?.split('=')[1];
  if (!csrf) return 'NOT_LOGGED_IN';
  const uid = window.location.pathname.split('/')[1];

  async function api(url, data) {
    const res = await fetch(url, {
      method: data ? 'POST' : 'GET', credentials: 'include',
      headers: data ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
      body: data ? Object.entries(data).map(([k,v]) => k+'='+encodeURIComponent(v)).join('&') : undefined
    });
    if (res.status === 412) throw new Error('IP_BANNED');
    if (res.status === 429) throw new Error('RATE_LIMITED');
    const text = await res.text();
    if (text.startsWith('<!DOCTYPE')) throw new Error('HTML');
    return JSON.parse(text);
  }

  // 收集匹配类型的动态
  let all=[], offset='', hasMore=true;
  while(hasMore){
    let resp;
    try {
      resp = await api('https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid='+uid+(offset?'&offset='+offset:''));
      if(resp?.data?.items){
        hasMore=resp.data.has_more; offset=resp.data.offset;
        for(const item of resp.data.items){
          if(CONFIG.targetType==='all'||Number(item.type)===Number(CONFIG.targetType)){
            all.push({id_str:item.id_str, likes:item.modules?.module_stat?.like?.count||0, content:item.modules?.module_dynamic?.desc?.text||''});
          }
        }
        continue;
      }
    } catch(e){}
    resp = await api('https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/space_history?visitor_uid='+uid+'&host_uid='+uid+'&offset_dynamic_id='+(offset||0));
    const cards=resp?.data?.cards||[]; hasMore=resp?.data?.has_more; offset=cards.length?cards[cards.length-1].desc.dynamic_id_str:offset;
    for(const card of cards){
      if(CONFIG.targetType==='all'||Number(card.desc.type)===Number(CONFIG.targetType)){
        let c=''; try{const j=JSON.parse(card.card);c=j?.item?.content||j?.item?.description||'';}catch(e){}
        all.push({id_str:card.desc.dynamic_id_str, likes:card.desc.like||0, content:c});
      }
    }
  }

  // 应用保留规则
  let toDelete=[...all]; const skipped=[];
  if(CONFIG.preserveLiked>0){
    const topIds=new Set(all.sort((a,b)=>b.likes-a.likes).slice(0,CONFIG.preserveLiked).map(d=>d.id_str));
    skipped.push(...toDelete.filter(d=>topIds.has(d.id_str)));
    toDelete=toDelete.filter(d=>!topIds.has(d.id_str));
  }
  if(CONFIG.preserveKeywords.length>0){
    skipped.push(...toDelete.filter(d=>CONFIG.preserveKeywords.some(kw=>d.content&&d.content.includes(kw))));
    toDelete=toDelete.filter(d=>!CONFIG.preserveKeywords.some(kw=>d.content&&d.content.includes(kw)));
  }
  if(!toDelete.length) return 'NOTHING_TO_DELETE:'+all.length+':'+skipped.length;

  // 删除
  let deleted=0, speed=60, rateHits=0;
  for(const item of toDelete){
    try {
      const rm = await api('https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/rm_dynamic',{dynamic_id:item.id_str,csrf_token:csrf});
      if(rm.code===0){deleted++;rateHits=0;if(speed>60)speed=Math.max(60,speed-5);}
    } catch(e) {
      if(e.message==='RATE_LIMITED'){rateHits++;speed=Math.min(speed+30,500);await new Promise(r=>setTimeout(r,3000));continue;}
      if(e.message==='IP_BANNED') return 'IP_BANNED';
    }
    await new Promise(r=>setTimeout(r,speed));
  }
  return 'DONE:'+deleted+':'+skipped.length;
})();
`;

async function main() {
  if (!fs.existsSync(CHROME_BIN)) {
    console.error('Chrome not found. Run: npm i -g agent-browser && agent-browser install');
    process.exit(1);
  }

  console.log(`🚀 Config: type=${CONFIG.targetType} preserveLiked=${CONFIG.preserveLiked} preserveKeywords=${CONFIG.preserveKeywords.join(',')||'none'}`);
  console.log('🚀 Launching Chrome...');

  const chrome = spawn(CHROME_BIN, [
    '--remote-debugging-port=9223',
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run', '--no-default-browser-check',
  ], { stdio: 'ignore', detached: true });

  await new Promise(r => setTimeout(r, 3000));

  // Connect
  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223', defaultViewport: null });
  } catch (e) {
    const http = require('http');
    const wsUrl = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9223/json/version', (res) => {
        let data = ''; res.on('data', c => data += c); res.on('end', () => {
          try { resolve(JSON.parse(data).webSocketDebuggerUrl); } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
    browser = await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
  }

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  // Navigate
  console.log(`Opening dynamic page for UID ${CONFIG.uid}...`);
  await page.goto(`https://space.bilibili.com/${CONFIG.uid}/dynamic`, { waitUntil: 'networkidle2', timeout: 30000 });

  // Login check
  const loggedIn = await page.evaluate(() => document.cookie.includes('bili_jct='));
  if (!loggedIn) {
    console.log('Not logged in. Opening login...');
    await page.goto('https://www.bilibili.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('*')];
      const loginBtn = btns.find(el => el.textContent.trim() === '登录' && el.offsetParent !== null);
      if (loginBtn) loginBtn.click();
    });
    console.log('Scan QR code with Bilibili App...');
    await page.waitForFunction(() => document.cookie.includes('bili_jct='), { timeout: 120000 });
    console.log('Logged in!');
    await page.goto(`https://space.bilibili.com/${CONFIG.uid}/dynamic`, { waitUntil: 'networkidle2', timeout: 30000 });
  }

  // Inject
  console.log('Starting deletion...');
  const result = await page.evaluate(DELETE_SCRIPT);

  if (result === 'NOT_LOGGED_IN') console.error('Still not logged in.');
  else if (result === 'IP_BANNED') console.error('IP banned temporarily.');
  else if (result.startsWith('NOTHING_TO_DELETE:')) {
    const [,total,skipped] = result.split(':');
    console.log(`Nothing to delete. ${total} found, ${skipped} preserved.`);
  } else if (result.startsWith('DONE:')) {
    const [,deleted,skipped] = result.split(':');
    console.log(`Done! Deleted ${deleted}, skipped ${skipped||0}.`);
  } else {
    console.error('Error:', result);
  }

  await browser.close();
  chrome.kill();
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
