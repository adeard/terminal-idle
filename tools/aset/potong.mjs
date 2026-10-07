/**
 * Memotong assets/master.jpg menjadi aset terpisah, lalu menyusun atlas game.
 *
 *   npm run aset                       (atau: node tools/aset/potong.mjs)
 *   node tools/aset/potong.mjs --pratinjau pratinjau.png
 *
 * Keluaran:
 *   assets/potongan/<kategori>/<nama>.png   semua potongan, latar sudah dihapus
 *   public/aset/atlas.png + atlas.json      atlas POT (mipmap) untuk Phaser
 *   src/game/aset-data.ts                   ukuran & metadata tiap frame (dibuat otomatis)
 *
 * Latar dihapus dengan flood-fill dari tepi kotak: piksel yang warnanya dekat ke
 * ruas "bayangan gelap → latar → panel terang" dianggap latar, jadi bayangan
 * dan garis petak ikut hilang, sedangkan outline gelap sprite menahan isian.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { DAFTAR_ASET } from './daftar.mjs';

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MASTER = path.join(AKAR, 'assets/master.jpg');
const DIR_POTONGAN = path.join(AKAR, 'assets/potongan');
const DIR_PUBLIK = path.join(AKAR, 'public/aset');
const FILE_DATA = path.join(AKAR, 'src/game/aset-data.ts');

/** Jarak warna (RGB) maksimum ke ruas latar supaya piksel ikut terisi sebagai latar. */
const BATAS_LATAR = 18;
/** Piksel tepi dengan jarak di bawah ini dibuat semi-transparan (anti "halo"). */
const BATAS_TEPI = 50;
/** Warna panel terang di antara petak (sisi kanan gambar master). */
const PANEL_TERANG = [211, 222, 228];
/** Batas x panel kiri (latar slate) di gambar master. */
const BATAS_PANEL_KIRI = 303;
/** Pulau piksel lebih kecil dari ini dianggap noise JPEG. */
const PULAU_MIN = 16;
/** Jarak antarframe di atlas; cukup lebar supaya mipmap tidak saling bocor. */
const PADDING_ATLAS = 6;

// ---------------------------------------------------------------------------
// Gambar RGBA sederhana

const buatGambar = (w, h) => ({ w, h, d: new Uint8ClampedArray(w * h * 4) });

function potong(sumber, [x, y, w, h]) {
  const g = buatGambar(w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const s = ((y + j) * sumber.w + (x + i)) * 4;
      const t = (j * w + i) * 4;
      g.d[t] = sumber.d[s];
      g.d[t + 1] = sumber.d[s + 1];
      g.d[t + 2] = sumber.d[s + 2];
      g.d[t + 3] = 255;
    }
  }
  return g;
}

const warnaDi = (g, i) => [g.d[i * 4], g.d[i * 4 + 1], g.d[i * 4 + 2]];

function median(daftar) {
  return [0, 1, 2].map((c) => {
    const urut = daftar.map((w) => w[c]).sort((a, b) => a - b);
    return urut[urut.length >> 1];
  });
}

/** Jarak warna p ke ruas a→b, plus titik terdekat di ruas (untuk dekontaminasi warna tepi). */
function jarakKeRuas(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
  const q = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
  return { jarak: Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), titik: q };
}

// ---------------------------------------------------------------------------
// Hapus latar

function hapusLatar(g, diPanelKanan) {
  const { w, h } = g;
  const tepi = [];
  for (let x = 0; x < w; x++) tepi.push(warnaDi(g, x), warnaDi(g, (h - 1) * w + x));
  for (let y = 1; y < h - 1; y++) tepi.push(warnaDi(g, y * w), warnaDi(g, y * w + w - 1));
  // Latar selalu abu kebiruan (slate, petak, panel). Sprite yang menyentuh tepi
  // (mis. atap) jangan ikut menentukan warna latar.
  const abuBiru = tepi.filter(([r, g2, b]) => Math.max(r, g2, b) - Math.min(r, g2, b) < 45 && b >= r - 4);
  const latar = median(abuBiru.length >= tepi.length * 0.2 ? abuBiru : tepi);
  const gelap = latar.map((c) => c * 0.62);
  const terang = latar.map((c, i) => Math.max(Math.min(255, c * 1.12), diPanelKanan ? PANEL_TERANG[i] : 0));
  const ukur = (i) => jarakKeRuas(warnaDi(g, i), gelap, terang);

  // Kandidat latar, lalu "inti" = kandidat yang 8 tetangganya juga kandidat.
  // Flood-fill hanya lewat inti, jadi tidak bocor lewat celah outline 1–2 px
  // (mis. bodi van putih); setelah itu dilebarkan 1 px ke kandidat di sekitarnya.
  const kandidat = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) kandidat[i] = ukur(i).jarak < BATAS_LATAR ? 1 : 0;
  const inti = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let semua = kandidat[y * w + x] === 1;
      for (let dy = -1; dy <= 1 && semua; dy++) {
        for (let dx = -1; dx <= 1 && semua; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          // Di luar kotak dianggap latar.
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && !kandidat[ny * w + nx]) semua = false;
        }
      }
      inti[y * w + x] = semua ? 1 : 0;
    }
  }
  const isLatar = new Uint8Array(w * h);
  const antre = [];
  const coba = (i) => {
    if (!isLatar[i] && inti[i]) {
      isLatar[i] = 1;
      antre.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    coba(x);
    coba((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    coba(y * w);
    coba(y * w + w - 1);
  }
  while (antre.length) {
    const i = antre.pop();
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) coba(i - 1);
    if (x < w - 1) coba(i + 1);
    if (y > 0) coba(i - w);
    if (y < h - 1) coba(i + w);
  }
  const terisi = isLatar.slice();
  for (let i = 0; i < w * h; i++) {
    if (terisi[i] || !kandidat[i]) continue;
    const x = i % w;
    const y = (i / w) | 0;
    let dekat = false;
    for (let dy = -1; dy <= 1 && !dekat; dy++) {
      for (let dx = -1; dx <= 1 && !dekat; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && terisi[ny * w + nx]) dekat = true;
      }
    }
    if (dekat) isLatar[i] = 1;
  }

  // Tepi: piksel yang menempel ke latar dan warnanya masih mirip latar dibuat
  // semi-transparan, lalu warnanya "dibersihkan" dari campuran latar.
  const alfa = new Float32Array(w * h).fill(1);
  for (let i = 0; i < w * h; i++) {
    if (isLatar[i]) {
      alfa[i] = 0;
      continue;
    }
    const x = i % w;
    const y = (i / w) | 0;
    const menempel = (x > 0 && isLatar[i - 1]) || (x < w - 1 && isLatar[i + 1]) || (y > 0 && isLatar[i - w]) || (y < h - 1 && isLatar[i + w]);
    if (!menempel) continue;
    const { jarak, titik } = ukur(i);
    if (jarak >= BATAS_TEPI) continue;
    const a = Math.max(0.15, (jarak - BATAS_LATAR) / (BATAS_TEPI - BATAS_LATAR));
    alfa[i] = a;
    for (let c = 0; c < 3; c++) g.d[i * 4 + c] = (g.d[i * 4 + c] - (1 - a) * titik[c]) / a;
  }
  for (let i = 0; i < w * h; i++) g.d[i * 4 + 3] = Math.round(alfa[i] * 255);
  buangPulauKecil(g);
  // Piksel transparan penuh tanpa warna, supaya latar tidak "bocor" saat filter/mipmap.
  for (let i = 0; i < w * h; i++) if (g.d[i * 4 + 3] === 0) g.d[i * 4] = g.d[i * 4 + 1] = g.d[i * 4 + 2] = 0;
}

function buangPulauKecil(g) {
  const { w, h } = g;
  const label = new Int32Array(w * h).fill(-1);
  for (let s = 0; s < w * h; s++) {
    if (g.d[s * 4 + 3] === 0 || label[s] >= 0) continue;
    const anggota = [s];
    label[s] = s;
    for (let k = 0; k < anggota.length; k++) {
      const i = anggota[k];
      const x = i % w;
      const y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (g.d[q * 4 + 3] > 0 && label[q] < 0) {
            label[q] = s;
            anggota.push(q);
          }
        }
      }
    }
    if (anggota.length < PULAU_MIN) for (const i of anggota) g.d[i * 4 + 3] = 0;
  }
}

/** Pangkas ke kotak piksel yang cukup pekat (sisa garis petak yang samar diabaikan) + 1 px ruang. */
function pangkas(g) {
  let x0 = g.w;
  let y0 = g.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.d[(y * g.w + x) * 4 + 3] > 96) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) throw new Error('potongan kosong setelah latar dihapus');
  const hasil = buatGambar(x1 - x0 + 3, y1 - y0 + 3);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const s = (y * g.w + x) * 4;
      const t = ((y - y0 + 1) * hasil.w + (x - x0 + 1)) * 4;
      for (let c = 0; c < 4; c++) hasil.d[t + c] = g.d[s + c];
    }
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Metadata

/** Titik kaki: tengah piksel terlihat di 10% baris terbawah. */
function titikKaki(g) {
  let bawah = -1;
  for (let y = g.h - 1; y >= 0 && bawah < 0; y--) {
    for (let x = 0; x < g.w; x++) if (g.d[(y * g.w + x) * 4 + 3] > 128) bawah = y;
  }
  const batas = bawah - Math.max(1, Math.round(g.h * 0.1));
  let x0 = g.w;
  let x1 = -1;
  for (let y = batas; y <= bawah; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.d[(y * g.w + x) * 4 + 3] > 128) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
    }
  }
  return { x: (x0 + x1 + 1) / 2, y: bawah + 1, lebar: x1 - x0 + 1 };
}

/** Warna dominan pita atas (atap/bodi bus). */
function warnaAtas(g) {
  const kumpulan = [];
  for (let y = Math.round(g.h * 0.08); y < Math.round(g.h * 0.22); y++) {
    for (let x = Math.round(g.w * 0.25); x < Math.round(g.w * 0.75); x++) {
      const i = y * g.w + x;
      if (g.d[i * 4 + 3] === 255) kumpulan.push(warnaDi(g, i));
    }
  }
  if (kumpulan.length === 0) return 0x888888;
  const [r, gr, b] = median(kumpulan);
  return (r << 16) | (gr << 8) | b;
}

/** Salinan dengan bayangan elips di bawah kaki (hanya untuk atlas). */
function denganBayangan(g, kaki) {
  const rx = Math.max(4, Math.round(kaki.lebar * 0.62));
  const ry = Math.max(2, Math.round(rx * 0.32));
  const kiri = Math.max(0, Math.ceil(rx - kaki.x) + 1);
  const kanan = Math.max(0, Math.ceil(kaki.x + rx - g.w) + 1);
  const hasil = buatGambar(g.w + kiri + kanan, g.h + ry + 1);
  const cx = kaki.x + kiri;
  const cy = kaki.y - 1;
  for (let y = 0; y < hasil.h; y++) {
    for (let x = 0; x < hasil.w; x++) {
      const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (e < 1) hasil.d[(y * hasil.w + x) * 4 + 3] = Math.round(78 * Math.min(1, (1 - e) * 2.5));
    }
  }
  // Sprite di atas bayangan (alpha "over").
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const s = (y * g.w + x) * 4;
      const t = (y * hasil.w + x + kiri) * 4;
      const as = g.d[s + 3] / 255;
      const ab = hasil.d[t + 3] / 255;
      const ao = as + ab * (1 - as);
      if (ao === 0) continue;
      for (let c = 0; c < 3; c++) hasil.d[t + c] = (g.d[s + c] * as) / ao;
      hasil.d[t + 3] = Math.round(ao * 255);
    }
  }
  return { gambar: hasil, kakiX: cx, kakiY: kaki.y };
}

// ---------------------------------------------------------------------------
// Atlas

function ukuranPot(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Shelf packing; mencoba ukuran POT dari kecil ke besar. */
function susunAtlas(frame) {
  const urut = [...frame].sort((a, b) => b.gambar.h - a.gambar.h || b.gambar.w - a.gambar.w);
  for (const [lebar, tinggi] of [[512, 512], [1024, 512], [1024, 1024], [2048, 1024], [2048, 2048]]) {
    let x = 0;
    let y = 0;
    let tinggiBaris = 0;
    let muat = true;
    const posisi = new Map();
    for (const f of urut) {
      const w = f.gambar.w + PADDING_ATLAS * 2;
      const h = f.gambar.h + PADDING_ATLAS * 2;
      if (x + w > lebar) {
        x = 0;
        y += tinggiBaris;
        tinggiBaris = 0;
      }
      if (y + h > tinggi || w > lebar) {
        muat = false;
        break;
      }
      posisi.set(f.nama, { x: x + PADDING_ATLAS, y: y + PADDING_ATLAS });
      x += w;
      tinggiBaris = Math.max(tinggiBaris, h);
    }
    if (muat) return { lebar, tinggi: ukuranPot(tinggi), posisi };
  }
  throw new Error('atlas terlalu besar');
}

function tempel(tujuan, g, ox, oy) {
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const s = (y * g.w + x) * 4;
      const t = ((oy + y) * tujuan.w + ox + x) * 4;
      for (let c = 0; c < 4; c++) tujuan.d[t + c] = g.d[s + c];
    }
  }
}

function simpanPng(file, g) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const png = new PNG({ width: g.w, height: g.h });
  png.data = Buffer.from(g.d.buffer, g.d.byteOffset, g.d.byteLength);
  fs.writeFileSync(file, PNG.sync.write(png));
}

// ---------------------------------------------------------------------------

function jalankan() {
  const jpg = jpeg.decode(fs.readFileSync(MASTER), { useTArray: true, formatAsRGBA: true });
  const master = { w: jpg.width, h: jpg.height, d: new Uint8ClampedArray(jpg.data.buffer) };

  const nama = new Set();
  const hasil = [];
  for (const a of DAFTAR_ASET) {
    if (nama.has(a.nama)) throw new Error(`nama ganda: ${a.nama}`);
    nama.add(a.nama);
    const [x, y, w, h] = a.kotak;
    if (x < 0 || y < 0 || x + w > master.w || y + h > master.h) throw new Error(`kotak di luar gambar: ${a.nama}`);
    let g = potong(master, a.kotak);
    if (a.hapusLatar) {
      hapusLatar(g, x >= BATAS_PANEL_KIRI);
      try {
        g = pangkas(g);
      } catch (e) {
        throw new Error(`${a.nama}: ${e.message}`);
      }
    }
    simpanPng(path.join(DIR_POTONGAN, `${a.nama}.png`), g);
    hasil.push({ ...a, gambar: g });
  }

  // Atlas: frame dengan bayangan opsional.
  const frame = hasil
    .filter((a) => a.atlas)
    .map((a) => {
      const kaki = titikKaki(a.gambar);
      const warna = warnaAtas(a.gambar);
      if (a.bayangan) {
        const b = denganBayangan(a.gambar, kaki);
        return { ...a, gambar: b.gambar, kakiX: b.kakiX, kakiY: b.kakiY, warna };
      }
      return { ...a, kakiX: kaki.x, kakiY: kaki.y, warna };
    });
  const susunan = susunAtlas(frame);
  const atlas = buatGambar(susunan.lebar, susunan.tinggi);
  const json = { frames: {}, meta: { app: 'tools/aset/potong.mjs', image: 'atlas.png', format: 'RGBA8888', size: { w: atlas.w, h: atlas.h }, scale: '1' } };
  for (const f of frame) {
    const p = susunan.posisi.get(f.nama);
    tempel(atlas, f.gambar, p.x, p.y);
    const { w, h } = f.gambar;
    json.frames[f.nama] = { frame: { x: p.x, y: p.y, w, h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h } };
  }
  simpanPng(path.join(DIR_PUBLIK, 'atlas.png'), atlas);
  fs.writeFileSync(path.join(DIR_PUBLIK, 'atlas.json'), `${JSON.stringify(json, null, 1)}\n`);

  // Metadata untuk kode game.
  const baris = frame.map((f) => {
    const hadap = f.hadap ? `, hadap: '${f.hadap}'` : '';
    const warna = `0x${f.warna.toString(16).padStart(6, '0')}`;
    const p = susunan.posisi.get(f.nama);
    return `  '${f.nama}': { x: ${p.x}, y: ${p.y}, w: ${f.gambar.w}, h: ${f.gambar.h}, kakiX: ${+f.kakiX.toFixed(1)}, kakiY: ${f.kakiY}, warna: ${warna}${hadap} },`;
  });
  fs.writeFileSync(
    FILE_DATA,
    [
      '/**',
      ' * DIBUAT OTOMATIS oleh `npm run aset` (tools/aset/potong.mjs). Jangan diedit manual.',
      ' * Posisi & ukuran frame di atlas public/aset/atlas.png (piksel); kakiX/kakiY = titik',
      ' * pijak (origin sprite); warna = warna dominan pita atas (atap bus).',
      ' */',
      "export type ArahHadap = 'kanan' | 'kiri' | 'depan' | 'belakang';",
      '',
      'export interface InfoFrame {',
      '  /** Posisi kiri-atas frame di atlas (px). */',
      '  readonly x: number;',
      '  readonly y: number;',
      '  readonly w: number;',
      '  readonly h: number;',
      '  readonly kakiX: number;',
      '  readonly kakiY: number;',
      '  readonly warna: number;',
      '  readonly hadap?: ArahHadap;',
      '}',
      '',
      `export const UKURAN_ATLAS = { w: ${atlas.w}, h: ${atlas.h} } as const;`,
      '',
      'export const FRAME_ASET = {',
      ...baris,
      '} as const satisfies Record<string, InfoFrame>;',
      '',
      'export type NamaFrame = keyof typeof FRAME_ASET;',
      '',
    ].join('\n'),
  );

  const iPratinjau = process.argv.indexOf('--pratinjau');
  if (iPratinjau > 0) simpanPng(process.argv[iPratinjau + 1], pratinjau(hasil));

  console.log(`${hasil.length} potongan → assets/potongan/`);
  console.log(`${frame.length} frame → public/aset/atlas.png (${atlas.w}×${atlas.h})`);
}

/** Lembar kontak di atas papan catur, untuk memeriksa hasil hapus latar. */
function pratinjau(hasil) {
  const lebar = 1400;
  let x = 0;
  let y = 0;
  let tinggiBaris = 0;
  const pos = hasil.map((a) => {
    if (x + a.gambar.w + 8 > lebar) {
      x = 0;
      y += tinggiBaris + 8;
      tinggiBaris = 0;
    }
    const p = { x: x + 4, y: y + 4 };
    x += a.gambar.w + 8;
    tinggiBaris = Math.max(tinggiBaris, a.gambar.h);
    return p;
  });
  const g = buatGambar(lebar, y + tinggiBaris + 8);
  for (let j = 0; j < g.h; j++) {
    for (let i = 0; i < g.w; i++) {
      const v = ((i >> 3) + (j >> 3)) % 2 ? 235 : 190;
      const t = (j * g.w + i) * 4;
      g.d[t] = v;
      g.d[t + 1] = v === 235 ? 120 : 90;
      g.d[t + 2] = v;
      g.d[t + 3] = 255;
    }
  }
  hasil.forEach((a, k) => {
    const { x: ox, y: oy } = pos[k];
    for (let j = 0; j < a.gambar.h; j++) {
      for (let i = 0; i < a.gambar.w; i++) {
        const s = (j * a.gambar.w + i) * 4;
        const t = ((oy + j) * g.w + ox + i) * 4;
        const al = a.gambar.d[s + 3] / 255;
        for (let c = 0; c < 3; c++) g.d[t + c] = a.gambar.d[s + c] * al + g.d[t + c] * (1 - al);
      }
    }
  });
  return g;
}

jalankan();
