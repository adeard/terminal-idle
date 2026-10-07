/**
 * Tekstur prosedural (Canvas 2D) untuk material dunia 3D: rumput, aspal,
 * paving, beton, genteng, bata, plester, fasad gedung kota, teks papan nama.
 * Semua tekstur berpola bisa diulang tanpa sambungan (noise periodik).
 * Tidak memakai three.js; hasilnya dibungkus CanvasTexture di material3d.ts.
 */
import { acakBerbenih } from './dunia-visual';

type Rgb = readonly [number, number, number];

function kanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia');
  return { c, ctx };
}

const jepit = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);
const campur = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (w: Rgb, a = 1): string => `rgba(${Math.round(w[0])},${Math.round(w[1])},${Math.round(w[2])},${a})`;

/** Value noise periodik (mengulang tiap `periode` sel) dengan interpolasi halus. */
function bising(periode: number, acak: () => number): (x: number, y: number) => number {
  const kisi = new Float32Array(periode * periode);
  for (let i = 0; i < kisi.length; i++) kisi[i] = acak();
  const h = (i: number, j: number): number => kisi[(((j % periode) + periode) % periode) * periode + (((i % periode) + periode) % periode)]!;
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = h(xi, yi);
    const b = h(xi + 1, yi);
    const c = h(xi, yi + 1);
    const d = h(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/** fBm yang mengulang di tepi tekstur ukuran×ukuran; nilai ±0..1. */
function fbm(ukuran: number, periodeDasar: number, oktaf: number, benih: number): Float32Array {
  const acak = acakBerbenih(benih);
  const lapis = Array.from({ length: oktaf }, (_, k) => ({ n: bising(periodeDasar << k, acak), p: periodeDasar << k, bobot: 0.5 ** k }));
  const total = lapis.reduce((s, l) => s + l.bobot, 0);
  const hasil = new Float32Array(ukuran * ukuran);
  for (let y = 0; y < ukuran; y++) {
    for (let x = 0; x < ukuran; x++) {
      let v = 0;
      for (const l of lapis) v += l.n((x / ukuran) * l.p, (y / ukuran) * l.p) * l.bobot;
      hasil[y * ukuran + x] = v / total;
    }
  }
  return hasil;
}

function isiPiksel(ukuran: number, warna: (i: number, x: number, y: number) => Rgb): HTMLCanvasElement {
  const { c, ctx } = kanvas(ukuran, ukuran);
  const img = ctx.createImageData(ukuran, ukuran);
  for (let y = 0; y < ukuran; y++) {
    for (let x = 0; x < ukuran; x++) {
      const i = y * ukuran + x;
      const w = warna(i, x, y);
      img.data[i * 4] = jepit(w[0]);
      img.data[i * 4 + 1] = jepit(w[1]);
      img.data[i * 4 + 2] = jepit(w[2]);
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Garis pendek yang membungkus di tepi (supaya tetap mulus saat diulang). */
function goresBungkus(ctx: CanvasRenderingContext2D, ukuran: number, x: number, y: number, dx: number, dy: number): void {
  for (const ox of [0, -ukuran, ukuran]) {
    for (const oy of [0, -ukuran, ukuran]) {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(x + dx + ox, y + dy + oy);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------------------
// Permukaan tanah

export function teksturRumput(benih = 3): HTMLCanvasElement {
  const U = 512;
  const besar = fbm(U, 4, 5, benih);
  const petak = fbm(U, 8, 3, benih + 1);
  const acak = acakBerbenih(benih + 2);
  const c = isiPiksel(U, (i) => {
    let w = campur([70, 94, 50], [118, 138, 78], besar[i]!);
    if (petak[i]! > 0.6) w = campur(w, [150, 144, 96], (petak[i]! - 0.6) * 1.4);
    const g = (acak() - 0.5) * 16;
    return [w[0] + g, w[1] + g, w[2] + g * 0.6];
  });
  const ctx = c.getContext('2d')!;
  ctx.lineWidth = 1;
  for (let k = 0; k < 9000; k++) {
    const terang = acak() < 0.5;
    ctx.strokeStyle = terang ? css([150, 168, 104], 0.3) : css([40, 62, 30], 0.3);
    goresBungkus(ctx, U, acak() * U, acak() * U, (acak() - 0.5) * 2, -1.5 - acak() * 2.5);
  }
  return c;
}

export function teksturAspal(benih = 7): HTMLCanvasElement {
  const U = 512;
  const besar = fbm(U, 4, 4, benih);
  const noda = fbm(U, 3, 3, benih + 1);
  const acak = acakBerbenih(benih + 2);
  return isiPiksel(U, (i) => {
    let v = 62 + (besar[i]! - 0.5) * 16 + (acak() - 0.5) * 22;
    const r = acak();
    if (r < 0.018) v += 50 + acak() * 40;
    else if (r < 0.03) v -= 22;
    if (noda[i]! > 0.66) v -= (noda[i]! - 0.66) * 60;
    return [v, v + 1, v + 5];
  });
}

/** Paving block susun bata (running bond), 8×16 blok per ubin. */
export function teksturPaving(benih = 11, dasar: readonly Rgb[] = [[198, 186, 162], [186, 174, 150], [206, 196, 174], [178, 168, 148]]): HTMLCanvasElement {
  const U = 512;
  const bw = 64;
  const bh = 32;
  const acak = acakBerbenih(benih);
  const halus = fbm(U, 16, 2, benih + 1);
  const warnaBlok = new Map<string, Rgb>();
  const blok = (x: number, y: number): { k: string; lx: number; ly: number } => {
    const baris = Math.floor(y / bh);
    const geser = baris % 2 ? bw / 2 : 0;
    const kolom = Math.floor((((x + geser) % U) + U) % U / bw);
    return { k: `${kolom},${baris}`, lx: (((x + geser) % U) + U) % U % bw, ly: y % bh };
  };
  return isiPiksel(U, (i, x, y) => {
    const { k, lx, ly } = blok(x, y);
    let w = warnaBlok.get(k);
    if (!w) {
      const b = dasar[Math.floor(acak() * dasar.length)]!;
      const j = (acak() - 0.5) * 14;
      w = [b[0] + j, b[1] + j, b[2] + j];
      warnaBlok.set(k, w);
    }
    if (lx < 2 || ly < 2) return [118, 110, 96];
    let t = (halus[i]! - 0.5) * 14 + (acak() - 0.5) * 8;
    if (lx < 4 || ly < 4) t += 12;
    if (lx > bw - 3 || ly > bh - 3) t -= 16;
    return [w[0] + t, w[1] + t, w[2] + t];
  });
}

export function teksturBeton(benih = 13): HTMLCanvasElement {
  const U = 512;
  const besar = fbm(U, 4, 4, benih);
  const acak = acakBerbenih(benih + 1);
  return isiPiksel(U, (i, x, y) => {
    if (x % 128 < 2 || y % 128 < 2) return [142, 140, 134];
    const v = 190 + (besar[i]! - 0.5) * 22 + (acak() - 0.5) * 12;
    return [v, v - 1, v - 5];
  });
}

export function teksturLantaiPeron(benih = 17): HTMLCanvasElement {
  const U = 512;
  const acak = acakBerbenih(benih);
  const besar = fbm(U, 4, 3, benih + 1);
  return isiPiksel(U, (i, x, y) => {
    if (x % 64 < 2 || y % 64 < 2) return [168, 162, 148];
    const v = (besar[i]! - 0.5) * 12 + (acak() - 0.5) * 7;
    return [228 + v, 220 + v, 202 + v];
  });
}

// ---------------------------------------------------------------------------
// Bangunan

/** Genteng tanah liat: baris-baris berselang, tiap genteng bergradasi dengan bayangan tumpukan. */
export function teksturGenteng(benih = 19): HTMLCanvasElement {
  const U = 512;
  const th = 32;
  const tw = 42.667;
  const acak = acakBerbenih(benih);
  const bintik = fbm(U, 16, 2, benih + 1);
  const warna = new Map<string, Rgb>();
  return isiPiksel(U, (i, x, y) => {
    const baris = Math.floor(y / th);
    const geser = baris % 2 ? tw / 2 : 0;
    const kolom = Math.floor(((x + geser) % U) / tw);
    const lx = ((x + geser) % U) - kolom * tw;
    const ly = y - baris * th;
    const k = `${kolom},${baris}`;
    let w = warna.get(k);
    if (!w) {
      const j = (acak() - 0.5) * 30;
      w = [150 + j, 80 + j * 0.5, 58 + j * 0.35];
      warna.set(k, w);
    }
    const t = ly / th; // 0 = atas (tertutup genteng di atasnya), 1 = tepi bawah
    let f = 0.72 + t * 0.4;
    if (t > 0.86) f = 0.55; // bayangan tepi bawah
    const tepi = Math.min(lx, tw - lx);
    if (tepi < 1.5) f *= 0.72; // celah antargenteng
    else f *= 0.92 + Math.sin((lx / tw) * Math.PI) * 0.12; // lengkung genteng
    const n = (bintik[i]! - 0.5) * 16;
    return [w[0] * f + n, w[1] * f + n * 0.5, w[2] * f + n * 0.3];
  });
}

export function teksturPlester(benih = 23): HTMLCanvasElement {
  const U = 256;
  const besar = fbm(U, 4, 4, benih);
  const acak = acakBerbenih(benih + 1);
  return isiPiksel(U, (i) => {
    const v = (besar[i]! - 0.5) * 12 + (acak() - 0.5) * 8;
    return [240 + v, 229 + v, 204 + v];
  });
}

export function teksturBata(benih = 29): HTMLCanvasElement {
  const U = 512;
  const bw = 64;
  const bh = U / 20; // jumlah baris genap supaya selang-seling tetap nyambung saat diulang
  const acak = acakBerbenih(benih);
  const warna = new Map<string, Rgb>();
  return isiPiksel(U, (_i, x, y) => {
    const baris = Math.floor(y / bh);
    const geser = baris % 2 ? bw / 2 : 0;
    const kolom = Math.floor(((x + geser) % U) / bw);
    const lx = ((x + geser) % U) - kolom * bw;
    const ly = y - baris * bh;
    if (lx < 3 || ly < 3) return [198, 190, 176];
    const k = `${kolom},${baris}`;
    let w = warna.get(k);
    if (!w) {
      const j = (acak() - 0.5) * 34;
      w = [162 + j, 70 + j * 0.4, 52 + j * 0.3];
      warna.set(k, w);
    }
    const n = (acak() - 0.5) * 12;
    const t = ly > bh - 3 ? -14 : 0;
    return [w[0] + n + t, w[1] + n * 0.6 + t, w[2] + n * 0.5 + t];
  });
}

// ---------------------------------------------------------------------------
// Terminal terpadu

/**
 * Atap logam standing seam: lajur panel searah lengkung (v) dengan lipatan
 * sambungan terang-gelap tiap 1/8 ulangan dan noda halus.
 */
export function teksturAtapLogam(benih = 61): HTMLCanvasElement {
  const U = 256;
  const LAJUR = 32;
  const noda = fbm(U, 4, 4, benih);
  return isiPiksel(U, (i, x) => {
    const p = x % LAJUR;
    let t = 206 + (noda[i]! - 0.5) * 24 + ((((Math.floor(x / LAJUR) * 37) % 7) - 3) * 1.4);
    if (p === 0) t += 36;
    else if (p === 1) t += 16;
    else if (p === LAJUR - 1) t -= 42;
    else if (p === LAJUR - 2) t -= 16;
    return [t * 0.97, t * 0.99, t * 1.02];
  });
}

/**
 * Dinding tirai kaca (curtain wall) seukuran 1×1 unit: kaca kebiruan yang
 * memantulkan langit (gradasi + variasi per panel), mullion tiap ¼ unit dan
 * transom tiap ½ unit.
 */
export function teksturFasadKaca(benih = 67): HTMLCanvasElement {
  const U = 256;
  const acak = acakBerbenih(benih);
  const panel = Array.from({ length: 8 }, () => acak());
  const noda = fbm(U, 2, 3, benih + 1);
  const atas: Rgb = [168, 198, 216];
  const bawah: Rgb = [58, 88, 114];
  return isiPiksel(U, (i, x, y) => {
    const mx = x % 64;
    const my = y % 128;
    if (mx < 5 || my < 6) {
      const t = mx < 2 || my < 2 ? 236 : 206;
      return [t, t + 3, t + 6];
    }
    const k = Math.floor(x / 64) + Math.floor(y / 128) * 4;
    const dasar = campur(atas, bawah, 0.3 + 0.5 * (y / U) + (panel[k]! - 0.5) * 0.35);
    const kilap = Math.max(0, Math.sin((x + y * 0.8) * 0.03 + panel[k]! * 6.28)) * 16;
    const n = (noda[i]! - 0.5) * 16;
    return [dasar[0] + kilap + n, dasar[1] + kilap + n, dasar[2] + kilap + n];
  });
}

/** Lantai granit poles ruang tunggu: ubin besar krem keabuan berbintik, nat tipis. */
export function teksturLantaiGranit(benih = 71): HTMLCanvasElement {
  const U = 512;
  const UBIN = 128;
  const acak = acakBerbenih(benih);
  const nada = Array.from({ length: 16 }, () => acak());
  const awan = fbm(U, 4, 4, benih);
  const bintik = fbm(U, 64, 2, benih + 1);
  return isiPiksel(U, (i, x, y) => {
    if (x % UBIN < 2 || y % UBIN < 2) return [172, 168, 160];
    const k = Math.floor(x / UBIN) + Math.floor(y / UBIN) * 4;
    let v = 224 + (nada[k]! - 0.5) * 12 + (awan[i]! - 0.5) * 20;
    const b = bintik[i]!;
    if (b > 0.7) v -= (48 * (b - 0.7)) / 0.3;
    return [v, v * 0.985, v * 0.958];
  });
}

/** Papan jadwal keberangkatan digital (LED kuning-hijau di latar gelap). */
export function teksturJadwal(): HTMLCanvasElement {
  const W = 512;
  const H = 288;
  const { c, ctx } = kanvas(W, H);
  ctx.fillStyle = '#0a1020';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(0, 0, W, 50);
  ctx.textBaseline = 'middle';
  ctx.font = '800 30px system-ui, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('JADWAL KEBERANGKATAN', W / 2, 27);
  const baris: readonly (readonly [string, string, string, string])[] = [
    ['1', 'SURABAYA', '08.30', 'NAIK'],
    ['2', 'YOGYAKARTA', '08.45', 'NAIK'],
    ['3', 'SEMARANG', '09.00', 'TUNGGU'],
    ['1', 'MALANG', '09.15', 'TUNGGU'],
    ['2', 'BANDUNG', '09.30', 'TUNGGU'],
  ];
  ctx.font = '700 26px ui-monospace, Consolas, monospace';
  baris.forEach(([jalur, kota, jam, status], i) => {
    const y = 78 + i * 45;
    if (i % 2 === 1) {
      ctx.fillStyle = '#111a30';
      ctx.fillRect(0, y - 22, W, 44);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(jalur, 18, y);
    ctx.fillText(kota, 58, y);
    ctx.fillText(jam, 290, y);
    ctx.fillStyle = status === 'NAIK' ? '#4ade80' : '#fbbf24';
    ctx.fillText(status, 390, y);
  });
  return c;
}

/** Fasad gedung kota: jendela kaca memantulkan langit, lantai dipisah lis beton. */
export function teksturFasadKota(benih: number, dinding: Rgb, kaca: Rgb): HTMLCanvasElement {
  const W = 256;
  const H = 256;
  const { c, ctx } = kanvas(W, H);
  const acak = acakBerbenih(benih);
  ctx.fillStyle = css(dinding);
  ctx.fillRect(0, 0, W, H);
  const lantai = 32;
  const kolom = 32;
  for (let y = 0; y < H; y += lantai) {
    ctx.fillStyle = css(campur(dinding, [0, 0, 0], 0.12));
    ctx.fillRect(0, y + lantai - 3, W, 3);
    for (let x = 0; x < W; x += kolom) {
      const g = ctx.createLinearGradient(0, y + 6, 0, y + lantai - 6);
      const pantul = 0.25 + acak() * 0.35;
      g.addColorStop(0, css(campur(kaca, [210, 230, 245], pantul)));
      g.addColorStop(1, css(campur(kaca, [20, 30, 45], 0.35)));
      ctx.fillStyle = g;
      ctx.fillRect(x + 5, y + 6, kolom - 10, lantai - 12);
      if (acak() < 0.3) {
        ctx.fillStyle = css([235, 232, 220], 0.85); // tirai
        ctx.fillRect(x + 5, y + 6, kolom - 10, (lantai - 12) * (0.3 + acak() * 0.5));
      }
    }
  }
  return c;
}

/**
 * Peta cahaya malam untuk fasad kota: grid jendela sama persis dengan
 * teksturFasadKota, sebagian jendela menyala hangat/putih, sisanya gelap.
 * Dipakai sebagai emissiveMap yang kekuatannya naik saat malam.
 */
export function teksturJendelaMalam(benih: number): HTMLCanvasElement {
  const W = 256;
  const H = 256;
  const { c, ctx } = kanvas(W, H);
  const acak = acakBerbenih(benih);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 32) {
    for (let x = 0; x < W; x += 32) {
      if (acak() > 0.55) continue;
      const terang = 0.55 + acak() * 0.45;
      const warna: Rgb = acak() < 0.7 ? [255, 206, 140] : [215, 232, 255];
      ctx.fillStyle = css([warna[0] * terang, warna[1] * terang, warna[2] * terang]);
      ctx.fillRect(x + 5, y + 6, 22, 20);
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// Detail

export interface OpsiTeks {
  readonly lebar: number;
  readonly tinggi: number;
  readonly latar: string;
  readonly warna: string;
  readonly ukuranHuruf: number;
  readonly garisTepi?: string;
  /** Baris kedua lebih kecil di bawah teks utama, diawali ikon kapal feri (kota antarpulau di papan jurusan). */
  readonly barisKapal?: string;
  /** Baris kedua kecil tanpa ikon (mis. kelas terminal di bawah nama terminal). */
  readonly baris2?: string;
}

export const HURUF_PAPAN = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Ikon kapal feri kecil (lambung, anjungan, cerobong, ombak) berpusat di (x, y), setinggi `t`; warna = fillStyle & strokeStyle. */
export function ikonKapal(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const w = t * 1.6;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - t * 0.05);
  ctx.lineTo(x + w / 2, y - t * 0.05);
  ctx.lineTo(x + w * 0.36, y + t * 0.3);
  ctx.lineTo(x - w * 0.4, y + t * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - w * 0.28, y - t * 0.32, w * 0.5, t * 0.22);
  ctx.fillRect(x + w * 0.06, y - t * 0.52, w * 0.1, t * 0.2);
  ctx.lineWidth = Math.max(1.5, t * 0.07);
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const xx = x - w / 2 + (i / 8) * w;
    const yy = y + t * 0.44 + Math.sin((i / 8) * Math.PI * 4) * t * 0.05;
    if (i === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  }
  ctx.stroke();
}

export function teksturTeks(teks: string, o: OpsiTeks): HTMLCanvasElement {
  const { c, ctx } = kanvas(o.lebar, o.tinggi);
  ctx.fillStyle = o.latar;
  ctx.fillRect(0, 0, o.lebar, o.tinggi);
  if (o.garisTepi) {
    ctx.strokeStyle = o.garisTepi;
    ctx.lineWidth = Math.max(2, o.tinggi * 0.06);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, o.lebar - ctx.lineWidth, o.tinggi - ctx.lineWidth);
  }
  ctx.fillStyle = o.warna;
  ctx.strokeStyle = o.warna;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (o.baris2 !== undefined) {
    ctx.font = `800 ${o.ukuranHuruf * 0.7}px ${HURUF_PAPAN}`;
    ctx.fillText(teks, o.lebar / 2, o.tinggi * 0.37, o.lebar * 0.94);
    ctx.font = `800 ${o.ukuranHuruf * 0.42}px ${HURUF_PAPAN}`;
    ctx.fillText(o.baris2, o.lebar / 2, o.tinggi * 0.79, o.lebar * 0.9);
    return c;
  }
  if (o.barisKapal === undefined) {
    ctx.font = `800 ${o.ukuranHuruf}px ${HURUF_PAPAN}`;
    ctx.fillText(teks, o.lebar / 2, o.tinggi / 2 + o.ukuranHuruf * 0.04, o.lebar * 0.94);
    return c;
  }
  // Dua baris: teks utama sedikit mengecil di atas, baris kapal di bawah.
  const besar = o.ukuranHuruf * 0.82;
  const kecil = o.ukuranHuruf * 0.52;
  ctx.font = `800 ${besar}px ${HURUF_PAPAN}`;
  ctx.fillText(teks, o.lebar / 2, o.tinggi * 0.33, o.lebar * 0.94);
  ctx.font = `800 ${kecil}px ${HURUF_PAPAN}`;
  const lebarTeks = Math.min(ctx.measureText(o.barisKapal).width, o.lebar * 0.78);
  const ikon = kecil * 1.6;
  const x0 = o.lebar / 2 - (lebarTeks + ikon + kecil * 0.4) / 2;
  const y = o.tinggi * 0.74;
  ikonKapal(ctx, x0 + ikon / 2, y, kecil);
  ctx.textAlign = 'left';
  ctx.fillText(o.barisKapal, x0 + ikon + kecil * 0.4, y + kecil * 0.04, o.lebar * 0.78);
  return c;
}

export function teksturJam(): HTMLCanvasElement {
  const U = 128;
  const { c, ctx } = kanvas(U, U);
  ctx.fillStyle = '#5b3a24';
  ctx.fillRect(0, 0, U, U);
  ctx.fillStyle = '#f7f3e8';
  ctx.beginPath();
  ctx.arc(U / 2, U / 2, U * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 4;
  ctx.stroke();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ctx.lineWidth = k % 3 ? 2 : 4;
    ctx.beginPath();
    ctx.moveTo(U / 2 + Math.cos(a) * U * 0.32, U / 2 + Math.sin(a) * U * 0.32);
    ctx.lineTo(U / 2 + Math.cos(a) * U * 0.37, U / 2 + Math.sin(a) * U * 0.37);
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(U / 2, U / 2);
  ctx.lineTo(U / 2 + U * 0.16, U / 2 - U * 0.1);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(U / 2, U / 2);
  ctx.lineTo(U / 2 - U * 0.04, U / 2 - U * 0.3);
  ctx.stroke();
  return c;
}

export function teksturTenda(): HTMLCanvasElement {
  const { c, ctx } = kanvas(64, 64);
  for (let k = 0; k < 8; k++) {
    ctx.fillStyle = k % 2 ? '#f5f5f0' : '#d42a2a';
    ctx.fillRect(k * 8, 0, 8, 64);
  }
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

/** Pelepah palem: tulang daun + anak daun, latar transparan. */
export function teksturPelepah(benih = 31): HTMLCanvasElement {
  const W = 64;
  const H = 256;
  const { c, ctx } = kanvas(W, H);
  const acak = acakBerbenih(benih);
  ctx.strokeStyle = '#5c7a2e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2, H);
  ctx.lineTo(W / 2, 4);
  ctx.stroke();
  for (let y = H - 10; y > 6; y -= 5) {
    const t = 1 - y / H;
    const panjang = (W / 2 - 3) * Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.95 + 0.1);
    for (const s of [-1, 1]) {
      ctx.strokeStyle = css(campur([46, 104, 40], [98, 150, 58], acak()));
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(W / 2, y);
      ctx.lineTo(W / 2 + s * panjang, y - 10 - acak() * 4);
      ctx.stroke();
    }
  }
  return c;
}

export function teksturBendera(): HTMLCanvasElement {
  const { c, ctx } = kanvas(64, 44);
  ctx.fillStyle = '#d7263d';
  ctx.fillRect(0, 0, 64, 22);
  ctx.fillStyle = '#f7f7f2';
  ctx.fillRect(0, 22, 64, 22);
  return c;
}

/** Noise skala besar (abu-abu) untuk variasi warna tanah per posisi dunia (anti pola berulang). */
export function teksturMakro(benih = 91): HTMLCanvasElement {
  const U = 256;
  const n = fbm(U, 3, 4, benih);
  return isiPiksel(U, (i) => {
    const v = n[i]! * 255;
    return [v, v, v];
  });
}
