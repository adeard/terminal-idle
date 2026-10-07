// Screenshot adegan game lewat Chrome DevTools Protocol (headless, WebGL via ANGLE/D3D11).
//
//   node --experimental-websocket .claude/skills/terminal-threejs/shot.mjs <out.png> [tunggu_ms] [aksi-json]
//
// Butuh server dev berjalan: `npx vite --port 5199 --strictPort` (dari D:\html\terminal).
// Semua screenshot ("shot" di aksi) ditulis di folder yang sama dengan <out.png>.
//
// Variabel lingkungan:
//   URL         halaman (bawaan http://localhost:5199/?tingkat=1; ?tingkat=0..4 mengunci kualitas grafis)
//   W, H        ukuran jendela (bawaan 540×960 portrait; mis. 900×420 landscape)
//   SAVE        "peron,loket,keberangkatan" → suntik save (format v1, dimigrasikan game ke v2) dengan level itu & semua Kepala
//   JAM, HARI   jam terminal (0–24) & hari ke- (0 = Senin) di save yang disuntik
//   SAVE_EXTRA  JSON {"terminal": {...}} digabung ke terminal (fasilitas, teknologi, jalur); kunci lain menimpa
//               blok save v1, mis. {"armada":{"po":["ondelOndel","peuyeumKilat"]},"prestige":{"poin":"0e0","jumlahReset":1}}
//   OFFLINE_MS  waktuTerakhirMs mundur sekian ms (memunculkan popup offline)
//   PRA         skrip JS yang dijalankan sebelum halaman dimuat (mis. localStorage pilihan UI)
//   CHROME      path chrome.exe (bawaan C:/Program Files/Google/Chrome/Application/chrome.exe)
//
// Aksi (dijalankan berurutan setelah tunggu_ms):
//   {"roda":[x,y,deltaY]}         roda mouse (deltaY negatif = zoom masuk)
//   {"seret":[x0,y0,x1,y1]}       seret klik kiri (geser kamera; klik = seret di titik sama)
//   {"seretKanan":[x0,y0,x1,y1]}  seret klik kanan (putar/miringkan kamera)
//   {"pelintir":[cx,cy,r,a0,a1]}  pelintir dua jari (sentuh)
//   {"kamera":[tx,tz,px,py,pz,fov]}  arahkan kamera langsung (butuh window.__terminalDebug, lihat SKILL.md)
//   {"tunggu":ms}  {"throttle":4}  {"eval":"js"}  {"shot":"nama.png"} (nama.jpg = JPEG kualitas 86)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'shot.png');
const folder = dirname(out);
const tunggu = Number(process.argv[3] ?? 15000);
const aksi = JSON.parse(process.argv[4] ?? '[]');
const url = process.env.URL ?? 'http://localhost:5199/?tingkat=1';
const W = Number(process.env.W ?? 540);
const H = Number(process.env.H ?? 960);
const port = 9333 + Math.floor(Math.random() * 500);
const profil = join(tmpdir(), `terminal-shot-${port}`);
mkdirSync(profil, { recursive: true });
mkdirSync(folder, { recursive: true });

const chrome = spawn(
  process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, `--window-size=${W},${H}`, '--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=d3d11', '--no-first-run', 'about:blank'],
  { stdio: 'ignore' },
);

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
let daftar;
for (let i = 0; i < 50; i++) {
  try {
    daftar = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    if (daftar.some((t) => t.type === 'page')) break;
  } catch {}
  await tidur(200);
}
const halaman = daftar.find((t) => t.type === 'page');
const ws = new WebSocket(halaman.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const tunda = new Map();
const log = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && tunda.has(m.id)) {
    tunda.get(m.id)(m);
    tunda.delete(m.id);
  } else if (m.method === 'Runtime.consoleAPICalled') {
    log.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  } else if (m.method === 'Log.entryAdded') {
    log.push('[log ' + m.params.entry.level + '] ' + m.params.entry.text);
  } else if (m.method === 'Runtime.exceptionThrown') {
    log.push('[exception] ' + JSON.stringify(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
  }
});
const kirim = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    tunda.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

await kirim('Runtime.enable');
await kirim('Page.enable');
await kirim('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false, screenWidth: 1920, screenHeight: 1080 });
await kirim('Log.enable');
if (process.env.SAVE) {
  const [p, l, k] = process.env.SAVE.split(',').map(Number);
  const tahap = (level) => ({ level, kepala: { direkrut: true } });
  const jam = process.env.JAM ? ((Number(process.env.JAM) - 6 + 24) % 24) + 24 * Number(process.env.HARI ?? 0) : 0;
  const save = {
    schemaVersion: 1,
    uang: '1e3',
    terminal: { id: 'tipe-c', tahap: { peron: tahap(p), loket: tahap(l), keberangkatan: tahap(k) } },
    prestige: { poin: '0e0', jumlahReset: 0 },
    statistik: { totalPendapatanRun: '0e0', totalPendapatanSepanjangMasa: '0e0', waktuMainDetik: jam * 60 },
  };
  if (process.env.SAVE_EXTRA) {
    // {"terminal": {...}} digabung ke terminal; kunci lain (mis. "armada", "prestige", "statistik") menimpa bloknya.
    const { terminal, ...lain } = JSON.parse(process.env.SAVE_EXTRA);
    Object.assign(save.terminal, terminal ?? {});
    Object.assign(save, lain);
  }
  const js = `const s=${JSON.stringify(save)};s.waktuTerakhirMs=Date.now()-${Number(process.env.OFFLINE_MS ?? 0)};localStorage.setItem('terminal-bus-tycoon/save',JSON.stringify(s));`;
  await kirim('Page.addScriptToEvaluateOnNewDocument', { source: js });
}
if (process.env.PRA) await kirim('Page.addScriptToEvaluateOnNewDocument', { source: process.env.PRA });
await kirim('Page.navigate', { url });
await tidur(tunggu);

const seret = async ([x0, y0, x1, y1], button, buttons) => {
  await kirim('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
  await kirim('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button, buttons, clickCount: 1 });
  for (let t = 1; t <= 12; t++) {
    await kirim('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + ((x1 - x0) * t) / 12, y: y0 + ((y1 - y0) * t) / 12, button, buttons });
    await tidur(30);
  }
  await kirim('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button, buttons: 0, clickCount: 1 });
};
const jalankanJs = async (expression) => {
  const r = await kirim('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  log.push('[eval] ' + JSON.stringify(r.result?.result?.value ?? r.result));
};

for (const a of aksi) {
  if (a.roda) {
    const [x, y, d] = a.roda;
    await kirim('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await kirim('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: d });
    await tidur(60);
  } else if (a.seret) {
    await seret(a.seret, 'left', 1);
  } else if (a.seretKanan) {
    await seret(a.seretKanan, 'right', 2);
  } else if (a.pelintir) {
    const [cx, cy, r, a0, a1] = a.pelintir;
    const titik = (u) => [
      { x: cx - Math.cos(u) * r, y: cy - Math.sin(u) * r, id: 1 },
      { x: cx + Math.cos(u) * r, y: cy + Math.sin(u) * r, id: 2 },
    ];
    await kirim('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: titik(a0) });
    for (let t = 1; t <= 20; t++) {
      await kirim('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: titik(a0 + ((a1 - a0) * t) / 20) });
      await tidur(30);
    }
    await kirim('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else if (a.kamera) {
    const [tx, tz, px, py, pz, fov = 40] = a.kamera;
    await jalankanJs(
      `(() => { const a = window.__terminalDebug?.adegan; if (!a) return 'window.__terminalDebug belum dipasang'; const k = a.kontrol; k.minDistance = 1; k.maxDistance = 400; a.kamera.fov = ${fov}; a.kamera.updateProjectionMatrix(); k.target.set(${tx}, 0.2, ${tz}); a.kamera.position.set(${px}, ${py}, ${pz}); k.update(); return 'ok'; })()`,
    );
  } else if (a.shot) {
    const jpeg = /\.jpe?g$/i.test(a.shot);
    const s = await kirim('Page.captureScreenshot', jpeg ? { format: 'jpeg', quality: 86 } : { format: 'png' });
    writeFileSync(join(folder, a.shot), Buffer.from(s.result.data, 'base64'));
  } else if (a.throttle) {
    await kirim('Emulation.setCPUThrottlingRate', { rate: a.throttle });
  } else if (a.tunggu) {
    await tidur(a.tunggu);
  } else if (a.eval) {
    await jalankanJs(a.eval);
  }
}
const r = await kirim('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(r.result.data, 'base64'));
console.log(log.filter((l) => !l.includes('[vite]')).join('\n'));
console.log('tersimpan', out);
ws.close();
chrome.kill();
process.exit(0);
