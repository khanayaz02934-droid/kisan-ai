// One-off E2E check (headless Edge + CDP): admin login -> dashboard render -> refresh.
import { spawn } from 'node:child_process';
import net from 'node:net';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHttp(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* retry */ }
    await sleep(250);
  }
  throw new Error('edge devtools endpoint never came up');
}

const proc = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\edge-cdp-${Date.now()}`,
  'about:blank',
], { stdio: 'ignore' });

try {
  await waitForHttp(`http://127.0.0.1:${PORT}/json/version`);
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, err) => { ws.onopen = ok; ws.onerror = err; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
      ws.send(JSON.stringify({ id: mid, method, params }));
    });

  const goto = async (url) => {
    await send('Page.navigate', { url });
    // Give SPA React a moment to mount and settle.
    await sleep(3500);
  };
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    return r.result?.value;
  };
  const text = (sel) => `document.querySelector(${JSON.stringify(sel)})?.innerText || ''`;
  const route = () => evalJs('location.pathname + location.search');

  const setVal = (sel, val) => `
    (() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      desc.set.call(el, ${JSON.stringify(val)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return 'ok';
    })()`;
  const results = [];
  const check = (name, pass, detail = '') => {
    results.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
  };

  // ---- Scenario A: legacy URL /auth/admin while logged OUT -> login page, never 404
  await goto('http://localhost:5173/auth/admin');
  check('A1: /auth/admin (logged out) redirects to /login, not 404',
    (await route()) === '/login' && !(await evalJs(text('body'))).includes('Phase 1 foundation'),
    await route());

  // ---- Scenario B: normal USER cannot reach admin pages
  await goto('http://localhost:5173/login');
  await evalJs(setVal('input[type=email]', 'mohan@kisanai.com'));
  await evalJs(setVal('input[type=password]', 'password123'));
  await evalJs(`document.querySelector('form button[type=submit]').click(); 'ok'`);
  await sleep(2500);
  check('B1: user login lands on home (/)', (await route()) === '/', await route());
  await goto('http://localhost:5173/admin/dashboard');
  check('B2: USER blocked from /admin/dashboard -> bounced to /',
    (await route()) === '/' && !(await evalJs(text('body'))).includes('Dashboard'),
    await route());
  // logout user
  await evalJs('localStorage.removeItem("kisan_token"); localStorage.removeItem("kisan_user"); "ok"');

  // ---- Scenario C: ADMIN login -> /admin/dashboard renders real dashboard
  await goto('http://localhost:5173/login');
  await evalJs(setVal('input[type=email]', 'admin@kisanai.com'));
  await evalJs(setVal('input[type=password]', 'password123'));
  await evalJs(`document.querySelector('form button[type=submit]').click(); 'ok'`);
  await sleep(3500);
  const afterLoginRoute = await route();
  check('C1: admin login redirects to /admin/dashboard',
    afterLoginRoute === '/admin/dashboard', afterLoginRoute);
  const bodyAfter = await evalJs(text('body'));
  check('C2: dashboard renders real data (Total Users stat + recent tables)',
    bodyAfter.includes('Total Users') && bodyAfter.includes('Recent registered users'),
    `bytes=${bodyAfter.length}`);
  check('C3: no Phase-1 placeholder anywhere',
    !bodyAfter.includes('Phase 1 foundation'));

  // ---- Scenario D: hard refresh on /admin/dashboard keeps working
  await goto('http://localhost:5173/admin/dashboard');
  const afterRefresh = await route();
  const bodyRefresh = await evalJs(text('body'));
  check('D1: refresh keeps /admin/dashboard URL', afterRefresh === '/admin/dashboard', afterRefresh);
  check('D2: refresh still renders dashboard', bodyRefresh.includes('Total Users'));

  // ---- Scenario E: legacy /auth/admin while LOGGED IN as admin -> /admin
  await goto('http://localhost:5173/auth/admin');
  check('E1: /auth/admin (admin) redirects into admin area -> /admin', (await route()) === '/admin', await route());

  const fails = results.filter((r) => !r.pass);
  console.log(fails.length ? `\n${fails.length} failure(s)` : '\nALL CHECKS PASSED');
  ws.close();
} finally {
  proc.kill();
}
