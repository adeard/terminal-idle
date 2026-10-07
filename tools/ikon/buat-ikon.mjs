// Membuat ikon aplikasi (PWA & layar utama) dari gambar vektor di bawah:
// public/ikon.svg, ikon-192.png, ikon-512.png, ikon-maskable-512.png, apple-touch-icon.png.
//
//   node --experimental-websocket tools/ikon/buat-ikon.mjs
//
// PNG dirender lewat Chrome headless (CDP), sama seperti skrip screenshot di
// .claude/skills/terminal-threejs/shot.mjs. Env CHROME = path chrome.exe (opsional).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PUBLIK = resolve('public');
const WARNA_LATAR = '#1a2129';

/** Bus tampak depan (ruang 512×512), warna tahap terminal: badan oranye, strip peron hijau toska. */
const BUS = `
  <ellipse cx="256" cy="424" rx="156" ry="16" fill="#000" opacity=".32"/>
  <rect x="108" y="176" width="20" height="50" rx="7" fill="#2b3440"/>
  <rect x="384" y="176" width="20" height="50" rx="7" fill="#2b3440"/>
  <rect x="156" y="376" width="50" height="44" rx="11" fill="#0f1419"/>
  <rect x="306" y="376" width="50" height="44" rx="11" fill="#0f1419"/>
  <rect x="132" y="102" width="248" height="280" rx="42" fill="#f59e0b"/>
  <rect x="132" y="102" width="248" height="70" rx="42" fill="#f7b23b"/>
  <rect x="160" y="120" width="192" height="36" rx="9" fill="#1d232b"/>
  <text x="256" y="146" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="23" letter-spacing="2" fill="#fbbf24">TERMINAL</text>
  <rect x="154" y="170" width="204" height="108" rx="15" fill="#8fd3f0"/>
  <path d="M154 238 L262 170 L300 170 L154 262 Z" fill="#fff" opacity=".28"/>
  <rect x="253" y="170" width="6" height="108" fill="#5aa9c9"/>
  <rect x="132" y="290" width="248" height="18" fill="#2a9d8f"/>
  <circle cx="178" cy="336" r="17" fill="#fff7d6"/>
  <circle cx="334" cy="336" r="17" fill="#fff7d6"/>
  <rect x="222" y="324" width="68" height="26" rx="7" fill="#1d232b" opacity=".35"/>
  <rect x="122" y="362" width="268" height="26" rx="11" fill="#2b3440"/>`;

/** @param penuh latar penuh tanpa sudut membulat (maskable, apple-touch) */
function svg(penuh, skala = 1) {
  const latar = penuh
    ? `<rect width="512" height="512" fill="url(#latar)"/>`
    : `<rect width="512" height="512" rx="112" fill="url(#latar)"/>`;
  const geser = 256 * (1 - skala);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="latar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3644"/><stop offset="1" stop-color="${WARNA_LATAR}"/></linearGradient></defs>
  ${latar}
  <g transform="translate(${geser} ${geser + 8 * skala}) scale(${skala})">${BUS}
  </g>
</svg>
`;
}

// Maskable: isi di dalam lingkaran aman 80 %, jadi bus diperkecil.
const DAFTAR = [
  { berkas: 'ikon-192.png', ukuran: 192, svg: svg(false) },
  { berkas: 'ikon-512.png', ukuran: 512, svg: svg(false) },
  { berkas: 'ikon-maskable-512.png', ukuran: 512, svg: svg(true, 0.74) },
  { berkas: 'apple-touch-icon.png', ukuran: 180, svg: svg(true, 0.86) },
];

mkdirSync(PUBLIK, { recursive: true });
writeFileSync(join(PUBLIK, 'ikon.svg'), svg(false));

const port = 9333 + Math.floor(Math.random() * 500);
const profil = join(tmpdir(), `terminal-ikon-${port}`);
mkdirSync(profil, { recursive: true });
const chrome = spawn(
  process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run', 'about:blank'],
  { stdio: 'ignore' },
);
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
let daftar = [];
for (let i = 0; i < 50 && !daftar.some((t) => t.type === 'page'); i++) {
  try {
    daftar = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  } catch {
    await tidur(200);
  }
}
const ws = new WebSocket(daftar.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const tunda = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && tunda.has(m.id)) {
    tunda.get(m.id)(m);
    tunda.delete(m.id);
  }
});
const kirim = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    tunda.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

await kirim('Page.enable');
await kirim('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
for (const d of DAFTAR) {
  await kirim('Emulation.setDeviceMetricsOverride', { width: d.ukuran, height: d.ukuran, deviceScaleFactor: 1, mobile: false });
  const html = `<!doctype html><html><body style="margin:0;overflow:hidden;background:transparent">${d.svg.replace('<svg ', `<svg style="display:block" width="${d.ukuran}" height="${d.ukuran}" `)}</body></html>`;
  await kirim('Page.navigate', { url: `data:text/html;base64,${Buffer.from(html).toString('base64')}` });
  await tidur(400);
  const r = await kirim('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: d.ukuran, height: d.ukuran, scale: 1 } });
  writeFileSync(join(PUBLIK, d.berkas), Buffer.from(r.result.data, 'base64'));
  console.log('tersimpan', join('public', d.berkas));
}
ws.close();
chrome.kill();
process.exit(0);
