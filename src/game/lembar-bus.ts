/**
 * Lembar livery bus: satu kanvas tekstur 2048² berisi sel tampilan bus yang
 * dipakai InstancedMesh badan bus (kendaraan3d.ts). Sel kendaraan lewat & Bus
 * Emas tetap; sel bus terminal (kelas bus × livery bawaan/mitra PO) dilukis
 * saat bus itu datang dan menempati slot bergantian (CacheSel), lalu hanya
 * sel itu yang diunggah ulang ke GPU. Susunan tiap sel:
 *
 *   sel 512×256 px:  [ sisi kanan 320×128 ][ depan 96 ][ belakang 96 ]
 *                    [ sisi kiri (cermin) ][ atap 192×128         ]
 *
 * Gambar samping menghadap kanan (depan di kanan) = sisi kanan bus. Bus kota
 * (ekonomi, patas) memakai gambar atlas; livery mitra PO-nya dibuat dengan
 * mewarnai ulang cat gambar atlas, diberi pola & nama PO (lihat livery.ts).
 * Kelas lain (eksekutif, sleeper, double decker) dilukis dari tata letak di
 * kelas-bus.ts. Peta kekasaran/logam (setengah resolusi) dibuat dari sel
 * warna: kaca gelap mengilap, bodi doff.
 */
import * as THREE from 'three';
import { CAT_BAWAAN_KELAS, LIVERY_PO, type CatLivery, type Livery } from '../config/livery.config';
import type { KelasBusId, PoId } from '../sim/fitur';
import { BUS_TERMINAL, type TipeKendaraan } from './aset';
import { FRAME_ASET, type NamaFrame } from './aset-data';
import { CacheSel } from './cache-sel';
import { JARI_LENGKUNG_RODA, LABEL_KELAS_BUS, panjangSisiBadan, pusatRoda, TAMPIL_KELAS_BUS, type Kotak, type TampilKelasBus, type TataLukis } from './kelas-bus';
import { AREA_TULISAN, keHsl, pikselCatBadan, polaMenutup, rgbDariHex, warnaiUlang } from './livery';
import { BUS } from './tata-letak';

export const SEL = { w: 512, h: 256 } as const;
const LEBAR = 2048;
const TINGGI = 2048;
const KOLOM = LEBAR / SEL.w;
const JUMLAH_SLOT = KOLOM * (TINGGI / SEL.h);
/** Lebih dari sebanyak ini sel baru dalam satu frame (mis. adegan baru dibuka): unggah ulang seluruh lembar saja. */
const MAKS_UNGGAH_SEBAGIAN = 4;
/** Bagian sel (px, y ke bawah). */
export const R = {
  kanan: [0, 0, 320, 128],
  kiri: [0, 128, 320, 128],
  depan: [320, 0, 96, 128],
  belakang: [416, 0, 96, 128],
  atap: [320, 128, 192, 128],
} as const;
/** Gambar samping dasar livery PO per varian: cat badannya mudah dikenali & diwarnai ulang. */
const DASAR_PO: Readonly<Record<Livery['varian'], NamaFrame>> = { 1: 'bus/oranye-1', 2: 'bus/kuning-2' };
const PANJANG_SISI = panjangSisiBadan();

const hexAngka = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
const hex = (c: THREE.Color): string => `#${c.getHexString()}`;

function buatKanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Livery bus terminal: salah satu livery bawaan (indeks BUS_TERMINAL) atau livery mitra PO. */
export type LiveryBus = { readonly jenis: 'bawaan'; readonly indeks: number } | { readonly jenis: 'po'; readonly po: PoId };

// ---------------------------------------------------------------------------
// Depan, belakang, atap

type GayaDepan = 'kota' | 'tingkat' | 'mewah' | 'mewahTingkat';

function jalurKotakBulat(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** Isian kaca gelap kebiruan (dikenali peta permukaan sebagai kaca yang mengilap). */
function isiKaca(ctx: CanvasRenderingContext2D, y0: number, y1: number): void {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#36506a');
  g.addColorStop(0.35, '#1c2c3c');
  g.addColorStop(1, '#0c141c');
  ctx.fillStyle = g;
}

function gambarDepan(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, badan: THREE.Color, gaya: GayaDepan, papan = 'TERMINAL'): void {
  ctx.fillStyle = hex(badan);
  ctx.fillRect(x, y, w, h);
  const kaca = (y0: number, y1: number, x0 = 0.07, x1 = 0.93): void => {
    const g = ctx.createLinearGradient(0, y + y0, 0, y + y1);
    g.addColorStop(0, '#9fc3dc');
    g.addColorStop(0.35, '#35526a');
    g.addColorStop(1, '#1b2a38');
    ctx.fillStyle = g;
    ctx.fillRect(x + w * x0, y + y0, w * (x1 - x0), y1 - y0);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(x + w * (x0 + 0.05), y + y0);
    ctx.lineTo(x + w * (x0 + 0.28), y + y0);
    ctx.lineTo(x + w * (x0 + 0.13), y + y1);
    ctx.lineTo(x + w * (x0 + 0.03), y + y1);
    ctx.fill();
  };
  const papanLed = (y0: number, y1: number): void => {
    ctx.fillStyle = '#1d232b';
    ctx.fillRect(x + w * 0.12, y + y0, w * 0.76, y1 - y0);
    ctx.fillStyle = '#ffb020';
    ctx.font = `700 ${Math.round((y1 - y0) * 0.75)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(papan, x + w / 2, y + (y0 + y1) / 2 + 0.5, w * 0.7);
  };
  switch (gaya) {
    case 'tingkat':
      kaca(h * 0.1, h * 0.38);
      kaca(h * 0.46, h * 0.72);
      break;
    case 'kota':
      papanLed(h * 0.06, h * 0.16);
      kaca(h * 0.2, h * 0.66);
      break;
    case 'mewah':
      // Kaca depan besar; papan tujuan LED di balik kaca bagian atas.
      kaca(h * 0.08, h * 0.69, 0.05, 0.95);
      papanLed(h * 0.1, h * 0.18);
      break;
    case 'mewahTingkat':
      kaca(h * 0.05, h * 0.4, 0.05, 0.95);
      papanLed(h * 0.43, h * 0.5);
      kaca(h * 0.53, h * 0.72, 0.06, 0.94);
      break;
  }
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(x, y + h * 0.86, w, h * 0.14);
  const mewah = gaya === 'mewah' || gaya === 'mewahTingkat';
  for (const lx of [0.06, 0.78]) {
    ctx.fillStyle = '#fff7d6';
    ctx.fillRect(x + w * lx, y + h * (mewah ? 0.76 : 0.75), w * 0.16, h * (mewah ? 0.045 : 0.07));
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x + w * lx, y + h * (mewah ? 0.81 : 0.82), w * 0.16, h * 0.03);
  }
  if (mewah) {
    // Gril berlapis krom di antara lampu.
    ctx.fillStyle = '#c9ced6';
    ctx.fillRect(x + w * 0.28, y + h * 0.765, w * 0.44, h * 0.035);
  }
  ctx.fillStyle = '#f5f5f0';
  ctx.fillRect(x + w * 0.34, y + h * 0.88, w * 0.32, h * 0.08);
  ctx.fillStyle = '#111';
  ctx.font = `700 ${Math.round(h * 0.055)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('B 7 TC', x + w / 2, y + h * 0.922, w * 0.3);
}

/** @param tulisan kelas bus di badan belakang (bus kelas lukis). */
function gambarBelakang(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, badan: THREE.Color, tulisan?: string): void {
  ctx.fillStyle = hex(badan.clone().multiplyScalar(0.92));
  ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(0, y + h * 0.15, 0, y + h * 0.45);
  g.addColorStop(0, '#6c8aa3');
  g.addColorStop(1, '#1f2d3d');
  ctx.fillStyle = g;
  ctx.fillRect(x + w * 0.12, y + h * 0.15, w * 0.76, h * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 5; i++) ctx.fillRect(x + w * 0.2, y + h * (0.52 + i * 0.045), w * 0.6, h * 0.02);
  ctx.fillStyle = '#b91c1c';
  for (const lx of [0.05, 0.83]) ctx.fillRect(x + w * lx, y + h * 0.62, w * 0.12, h * 0.16);
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(x, y + h * 0.86, w, h * 0.14);
  ctx.fillStyle = '#f5f5f0';
  ctx.fillRect(x + w * 0.34, y + h * 0.8, w * 0.32, h * 0.07);
  if (tulisan) {
    // Tulisan gelap di cat terang, putih di cat gelap.
    const terang = badan.getHSL({ h: 0, s: 0, l: 0 }).l > 0.62;
    ctx.font = `italic 900 ${Math.round(h * 0.05)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = terang ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
    ctx.fillText(tulisan, x + w / 2 + 0.5, y + h * 0.485 + 0.5, w * 0.8);
    ctx.fillStyle = terang ? '#1f2937' : '#f8fafc';
    ctx.fillText(tulisan, x + w / 2, y + h * 0.485, w * 0.8);
  }
}

/** Atap (sel melintang: kiri–kanan = belakang–depan bus, atas–bawah = lebar bus). */
function gambarAtap(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, badan: THREE.Color, jenis: TampilKelasBus['atap'] | 'polos'): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  const terang = badan.clone().lerp(new THREE.Color(0xffffff), 0.25);
  g.addColorStop(0, hex(badan));
  g.addColorStop(0.5, hex(terang));
  g.addColorStop(1, hex(badan));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const palka = (u: number): void => {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + w * u - 1, y + h * 0.31 - 1, w * 0.1 + 2, h * 0.38 + 2);
    ctx.fillStyle = '#c9ced6';
    ctx.fillRect(x + w * u, y + h * 0.31, w * 0.1, h * 0.38);
  };
  switch (jenis) {
    case 'polos':
      return;
    case 'palka':
      // Bus ekonomi tanpa AC: dua palka ventilasi.
      palka(0.2);
      palka(0.62);
      return;
    case 'ac':
      ctx.fillStyle = '#d9dde3';
      ctx.fillRect(x + w * 0.38, y + h * 0.22, w * 0.3, h * 0.56);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + w * (0.41 + i * 0.065), y + h * 0.3, w * 0.03, h * 0.4);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + w * 0.12, y + h * 0.32, w * 0.12, h * 0.36);
      return;
    case 'acPanjang':
      // AC ramping memanjang (bus antarkota), palka darurat di belakangnya.
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      jalurKotakBulat(ctx, x + w * 0.3 - 1, y + h * 0.26 - 1, w * 0.46 + 2, h * 0.48 + 2, h * 0.2);
      ctx.fill();
      ctx.fillStyle = '#e2e6eb';
      jalurKotakBulat(ctx, x + w * 0.3, y + h * 0.26, w * 0.46, h * 0.48, h * 0.2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      for (let i = 0; i < 6; i++) ctx.fillRect(x + w * (0.34 + i * 0.065), y + h * 0.36, w * 0.025, h * 0.28);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + w * 0.1, y + h * 0.34, w * 0.1, h * 0.32);
      return;
  }
}

// ---------------------------------------------------------------------------
// Sisi: atlas, livery PO, kelas lukis

/** Gambar samping atlas di sisi kanan & (dicerminkan) sisi kiri sel. */
function gambarSisiAtlas(ctx: CanvasRenderingContext2D, atlas: CanvasImageSource, frame: NamaFrame, cx: number, cy: number): void {
  const f = FRAME_ASET[frame];
  const [kx, ky, kw, kh] = R.kanan;
  ctx.drawImage(atlas, f.x, f.y, f.w, f.h, cx + kx, cy + ky, kw, kh);
  ctx.save();
  ctx.translate(cx + R.kiri[0] + R.kiri[2], cy + R.kiri[1]);
  ctx.scale(-1, 1);
  ctx.drawImage(atlas, f.x, f.y, f.w, f.h, 0, 0, R.kiri[2], R.kiri[3]);
  ctx.restore();
}

/**
 * Sisi kanan & kiri livery PO: gambar samping dasar yang cat badannya
 * diwarnai ulang + pola aksen, lalu nama PO di pita atas. Nama ditulis
 * terpisah di tiap sisi (tidak ikut dicerminkan) dan dipotong ke cat badan,
 * jadi terputus di pintu & jendela seperti stiker sungguhan.
 */
function gambarSisiPo(ctx: CanvasRenderingContext2D, atlas: CanvasImageSource, livery: Livery, cx: number, cy: number): void {
  const f = FRAME_ASET[DASAR_PO[livery.varian]];
  const sisi = buatKanvas(f.w, f.h);
  const cs = sisi.getContext('2d', { willReadFrequently: true })!;
  cs.drawImage(atlas, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  const gambar = cs.getImageData(0, 0, f.w, f.h);
  const masker = buatKanvas(f.w, f.h);
  const cm = masker.getContext('2d')!;
  const dataMasker = cm.createImageData(f.w, f.h);
  const [rona, , terang] = keHsl(...rgbDariHex(f.warna));
  const d = gambar.data;
  for (let j = 0; j < f.h; j++) {
    for (let i = 0; i < f.w; i++) {
      const k = (j * f.w + i) * 4;
      if (d[k + 3]! < 128 || !pikselCatBadan(d[k]!, d[k + 1]!, d[k + 2]!, rona)) continue;
      const warna = polaMenutup(livery.pola, (i + 0.5) / f.w, (j + 0.5) / f.h) ? livery.aksen : livery.warna;
      const [r, g, b] = warnaiUlang(d[k]!, d[k + 1]!, d[k + 2]!, terang, warna);
      d[k] = r;
      d[k + 1] = g;
      d[k + 2] = b;
      dataMasker.data[k + 3] = 255;
    }
  }
  cs.putImageData(gambar, 0, 0);
  cm.putImageData(dataMasker, 0, 0);
  const [kx, ky, kw, kh] = R.kanan;
  const [lx, ly, lw, lh] = R.kiri;
  ctx.drawImage(sisi, cx + kx, cy + ky, kw, kh);
  ctx.save();
  ctx.translate(cx + lx + lw, cy + ly);
  ctx.scale(-1, 1);
  ctx.drawImage(sisi, 0, 0, lw, lh);
  ctx.restore();
  tulisNamaPo(ctx, livery, masker, cx + kx, cy + ky, kw, kh, false);
  tulisNamaPo(ctx, livery, masker, cx + lx, cy + ly, lw, lh, true);
}

/** Nama PO di pita atas satu sisi; `cermin` = sisi kiri (depan bus di kiri gambar). */
function tulisNamaPo(ctx: CanvasRenderingContext2D, livery: Livery, masker: HTMLCanvasElement, x: number, y: number, w: number, h: number, cermin: boolean): void {
  const kanvas = buatKanvas(w, h);
  const c = kanvas.getContext('2d')!;
  const a = AREA_TULISAN;
  const u0 = cermin ? 1 - a.u1 : a.u0;
  const u1 = cermin ? 1 - a.u0 : a.u1;
  const tinggi = (a.v1 - a.v0) * h;
  c.font = `900 ${Math.round(tinggi * 0.8)}px system-ui, 'Segoe UI', sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const tx = ((u0 + u1) / 2) * w;
  const ty = ((a.v0 + a.v1) / 2) * h;
  const lebar = (u1 - u0) * w;
  // Bayangan tipis supaya tetap terbaca di cat yang terang.
  c.fillStyle = 'rgba(0, 0, 0, 0.35)';
  c.fillText(livery.papan, tx + 1, ty + 1.5, lebar);
  c.fillStyle = hexAngka(livery.teks ?? livery.aksen);
  c.fillText(livery.papan, tx, ty, lebar);
  c.globalCompositeOperation = 'destination-in';
  if (cermin) {
    c.translate(w, 0);
    c.scale(-1, 1);
  }
  c.drawImage(masker, 0, 0, w, h);
  ctx.drawImage(kanvas, x, y);
}

/** Pemetaan satuan sisi (x dari belakang, h dari dasar badan) ke piksel gambar samping w×h. */
function skalaSisi(w: number, h: number, tinggiBadan: number): { sx: number; sy: number; X: (x: number) => number; Y: (t: number) => number } {
  const sx = w / BUS.panjang;
  const sy = h / (tinggiBadan * PANJANG_SISI);
  return { sx, sy, X: (x) => x * sx, Y: (t) => h - t * sy };
}

/** Sisi kanan kelas lukis tanpa tulisan (dicerminkan untuk sisi kiri). */
function lukisSisi(tampil: TampilKelasBus, tata: TataLukis, cat: CatLivery): HTMLCanvasElement {
  const [, , w, h] = R.kanan;
  const c = buatKanvas(w, h);
  const g = c.getContext('2d')!;
  const { sx, sy, X, Y } = skalaSisi(w, h, tampil.tinggi);
  const persegi = (k: Kotak): [number, number, number, number] => [X(k.x0), Y(k.h1), X(k.x1) - X(k.x0), Y(k.h0) - Y(k.h1)];

  // Cat dasar & pola aksen.
  g.fillStyle = hexAngka(cat.warna);
  g.fillRect(0, 0, w, h);
  g.fillStyle = hexAngka(cat.aksen);
  const p = tata.pola;
  if (cat.pola === 'garis') {
    for (const [a, b] of p.garis) g.fillRect(0, Y(b), w, Y(a) - Y(b));
  } else if (cat.pola === 'dua') {
    g.fillRect(0, Y(p.dua), w, h - Y(p.dua));
  } else if (cat.pola === 'sapuan') {
    const [s0, s1] = p.sapuan;
    const tengah = (x: number): number => {
      const t = x / BUS.panjang;
      return s0 + (s1 - s0) * t * t * (3 - 2 * t);
    };
    const tebal = 0.075;
    const n = 24;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * BUS.panjang;
      if (i === 0) g.moveTo(X(x), Y(tengah(x) + tebal / 2));
      else g.lineTo(X(x), Y(tengah(x) + tebal / 2));
    }
    for (let i = n; i >= 0; i--) {
      const x = (i / n) * BUS.panjang;
      g.lineTo(X(x), Y(tengah(x) - tebal / 2));
    }
    g.closePath();
    g.fill();
  }
  // Kilap di pita atas, bayangan di badan bawah.
  const kilap = g.createLinearGradient(0, 0, 0, h);
  kilap.addColorStop(0, 'rgba(255,255,255,0.2)');
  kilap.addColorStop(0.22, 'rgba(255,255,255,0.04)');
  kilap.addColorStop(0.7, 'rgba(0,0,0,0)');
  kilap.addColorStop(1, 'rgba(0,0,0,0.2)');
  g.fillStyle = kilap;
  g.fillRect(0, 0, w, h);

  // Rok bawah & lengkung roda (roda 3D menutupi bagian tengahnya).
  g.fillStyle = '#2b2f36';
  g.fillRect(0, Y(0.03), w, h - Y(0.03));
  for (const [x, t] of pusatRoda()) {
    g.fillStyle = '#111418';
    g.beginPath();
    g.ellipse(X(x), Y(t), JARI_LENGKUNG_RODA * sx, JARI_LENGKUNG_RODA * sy, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Tutup bagasi: garis panel & pegangan.
  g.lineWidth = 1;
  for (const k of tata.bagasi) {
    const [x, y, lw, lh] = persegi(k);
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(lw) - 1, Math.round(lh) - 1);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(x + lw / 2 - 3, y + 2.5, 6, 1.5);
  }

  // Jendela (kaca gelap), tiang, gorden kabin tidur.
  for (const k of tata.jendela) {
    const [x, y, lw, lh] = persegi(k);
    jalurKotakBulat(g, x, y, lw, lh, 2.5);
    isiKaca(g, y, y + lh);
    g.fill();
    g.strokeStyle = 'rgba(8,10,12,0.75)';
    g.stroke();
    if (tata.jarakTiang > 0) {
      g.fillStyle = 'rgba(0,0,0,0.5)';
      for (let xt = k.x0 + tata.jarakTiang; xt < k.x1 - 0.06; xt += tata.jarakTiang) g.fillRect(X(xt) - 0.75, y, 1.5, lh);
    }
    if (tata.gorden) {
      g.fillStyle = 'rgba(214,185,140,0.6)';
      g.fillRect(x + 1.5, y + 1.5, lw * 0.26, lh - 3);
    }
    // Pantulan langit di kaca.
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.beginPath();
    g.moveTo(x + lw * 0.12, y + 1);
    g.lineTo(x + lw * 0.12 + lh * 0.6, y + 1);
    g.lineTo(x + lw * 0.12 + lh * 0.2, y + lh - 1);
    g.lineTo(x + lw * 0.12 - lh * 0.4, y + lh - 1);
    g.closePath();
    g.fill();
  }

  // Kaca depan dilihat dari samping: sisi atasnya miring ke belakang.
  for (const k of tata.kacaDepan) {
    const [x, y, lw, lh] = persegi(k);
    const miring = Math.min(lw * 0.4, 7);
    g.beginPath();
    g.moveTo(x + miring, y);
    g.lineTo(x + lw, y + 2);
    g.lineTo(x + lw, y + lh);
    g.lineTo(x, y + lh);
    g.closePath();
    isiKaca(g, y, y + lh);
    g.fill();
    g.strokeStyle = 'rgba(8,10,12,0.75)';
    g.stroke();
  }

  // Pintu depan: bingkai gelap, kaca di atas, panel sewarna badan di bawah.
  {
    const [x, y, lw, lh] = persegi(tata.pintu);
    g.fillStyle = '#1b222b';
    g.fillRect(x, y, lw, lh);
    jalurKotakBulat(g, x + 2, y + 2, lw - 4, lh * 0.56, 1.5);
    isiKaca(g, y, y + lh * 0.6);
    g.fill();
    g.fillStyle = hexAngka(cat.warna);
    g.fillRect(x + 2, y + lh * 0.62, lw - 4, lh * 0.38 - 2);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x + 2, y + lh * 0.62, lw - 4, lh * 0.38 - 2);
    g.fillStyle = '#c9ced6';
    g.fillRect(x + 3, y + lh * 0.5, 1.5, lh * 0.14);
  }

  // Lampu belakang, lampu depan sudut, lampu penanda samping.
  g.fillStyle = '#c81e1e';
  g.fillRect(0, Y(0.42), Math.max(2, X(0.025)), Y(0.12) - Y(0.42));
  g.fillStyle = '#f5f5f0';
  g.fillRect(X(BUS.panjang - 0.03), Y(0.17), X(0.03), Y(0.1) - Y(0.17));
  g.fillStyle = '#f59e0b';
  g.fillRect(X(BUS.panjang - 0.08), Y(0.17), X(0.04), Y(0.13) - Y(0.17));
  for (const xm of [0.35, 1.2, 1.62]) g.fillRect(X(xm) - 1, Y(0.055) - 1, 2.5, 2);
  return c;
}

/** Nama di badan kelas lukis, satu sisi (`cermin` = sisi kiri: depan bus di kiri gambar). */
function tulisNamaKelas(ctx: CanvasRenderingContext2D, teks: string, warna: number, area: Kotak, tinggiBadan: number, x: number, y: number, w: number, h: number, cermin: boolean): void {
  const { X, Y } = skalaSisi(w, h, tinggiBadan);
  const x0 = cermin ? w - X(area.x1) : X(area.x0);
  const x1 = cermin ? w - X(area.x0) : X(area.x1);
  const y0 = Y(area.h1);
  const y1 = Y(area.h0);
  ctx.save();
  ctx.font = `italic 900 ${Math.round((y1 - y0) * 0.86)}px system-ui, 'Segoe UI', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tx = x + (x0 + x1) / 2;
  const ty = y + (y0 + y1) / 2 + 0.5;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillText(teks, tx + 1, ty + 1.2, x1 - x0);
  ctx.fillStyle = hexAngka(warna);
  ctx.fillText(teks, tx, ty, x1 - x0);
  ctx.restore();
}

function gambarSisiLukis(ctx: CanvasRenderingContext2D, cx: number, cy: number, tampil: TampilKelasBus, tata: TataLukis, cat: CatLivery, nama: string): void {
  const sisi = lukisSisi(tampil, tata, cat);
  const [kx, ky, kw, kh] = R.kanan;
  const [lx, ly, lw, lh] = R.kiri;
  ctx.drawImage(sisi, cx + kx, cy + ky);
  ctx.save();
  ctx.translate(cx + lx + lw, cy + ly);
  ctx.scale(-1, 1);
  ctx.drawImage(sisi, 0, 0);
  ctx.restore();
  // Nama di atas warna aksen (pola dua warna) memakai warna badan supaya tetap terbaca.
  const diAtasAksen = cat.pola === 'dua' && tata.nama.h1 <= tata.pola.dua + 1e-6;
  const warna = diAtasAksen ? cat.warna : (cat.teks ?? cat.aksen);
  tulisNamaKelas(ctx, nama, warna, tata.nama, tampil.tinggi, cx + kx, cy + ky, kw, kh, false);
  tulisNamaKelas(ctx, nama, warna, tata.nama, tampil.tinggi, cx + lx, cy + ly, lw, lh, true);
}

/** Cat kelas lukis untuk livery ini. */
function catUntuk(livery: LiveryBus): CatLivery {
  return livery.jenis === 'po' ? LIVERY_PO[livery.po] : CAT_BAWAAN_KELAS[livery.indeks % CAT_BAWAAN_KELAS.length]!;
}

/** Warna badan bawah bus di sel ini (untuk daun pintu bagasi 3D). */
function warnaBagasi(kelas: KelasBusId, livery: LiveryBus): number {
  const tampil = TAMPIL_KELAS_BUS[kelas];
  if (!tampil.lukis) return livery.jenis === 'po' ? LIVERY_PO[livery.po].warna : FRAME_ASET[BUS_TERMINAL[livery.indeks % BUS_TERMINAL.length]!.frame].warna;
  const cat = catUntuk(livery);
  return cat.pola === 'dua' ? cat.aksen : cat.warna;
}

// ---------------------------------------------------------------------------
// Lembar

const kunciSel = (kelas: KelasBusId, l: LiveryBus): string => `${kelas}|${l.jenis === 'po' ? `po:${l.po}` : `b${l.indeks}`}`;

export interface SelBus {
  readonly slot: number;
  /** Kelas bus sel ini (bisa lain dari yang diminta bila semua slot sedang terpakai). */
  readonly kelas: KelasBusId;
  /** Warna daun pintu bagasi. */
  readonly warnaBagasi: number;
}

export class LembarBus {
  readonly peta: THREE.CanvasTexture;
  readonly permukaan: THREE.CanvasTexture;
  /** Ukuran satu sel dalam UV lembar. */
  readonly ukuranSelUv: readonly [number, number] = [SEL.w / LEBAR, SEL.h / TINGGI];
  private readonly kanvas = buatKanvas(LEBAR, TINGGI);
  private readonly ctx: CanvasRenderingContext2D;
  private readonly kanvasPermukaan = buatKanvas(LEBAR / 2, TINGGI / 2);
  private readonly ctxPermukaan: CanvasRenderingContext2D;
  /** Kanvas sementara untuk membaca piksel sel (peta permukaan). */
  private readonly baca: CanvasRenderingContext2D;
  /** Satu sel (warna & permukaan) yang disalin ke GPU saat unggah sebagian. */
  private readonly salin: { readonly ctx: CanvasRenderingContext2D; readonly tekstur: THREE.Texture };
  private readonly salinPermukaan: { readonly ctx: CanvasRenderingContext2D; readonly tekstur: THREE.Texture };
  private readonly slotFrame = new Map<NamaFrame, number>();
  private readonly cache: CacheSel;
  private readonly jumlahTetap: number;
  /** Isi tiap kunci yang pernah dilukis (untuk sel yang dipakai bersama saat slot penuh; paling banyak kelas × livery). */
  private readonly isiKunci = new Map<string, { readonly kelas: KelasBusId; readonly livery: LiveryBus }>();
  private readonly kotor = new Set<number>();
  private readonly posisi = new THREE.Vector2();

  /** @param tetap kendaraan dengan sel tetap (kendaraan lewat & Bus Emas), satu sel per frame atlas. */
  constructor(
    private readonly atlas: CanvasImageSource,
    anisotropi: number,
    tetap: readonly TipeKendaraan[],
  ) {
    // Kanvas di memori biasa (bukan GPU): tiap sel baru dibaca ulang (peta permukaan,
    // salinan unggah), dan membaca kanvas GPU memaksa salinan balik yang mahal.
    const cpu: CanvasRenderingContext2DSettings = { willReadFrequently: true };
    const ctx = this.kanvas.getContext('2d', cpu);
    const ctxPermukaan = this.kanvasPermukaan.getContext('2d', cpu);
    const baca = buatKanvas(SEL.w / 2, SEL.h / 2).getContext('2d', cpu);
    if (!ctx || !ctxPermukaan || !baca) throw new Error('Canvas 2D tidak tersedia');
    this.ctx = ctx;
    this.ctxPermukaan = ctxPermukaan;
    this.baca = baca;
    const kecil = (w: number, h: number): { ctx: CanvasRenderingContext2D; tekstur: THREE.Texture } => {
      const c = buatKanvas(w, h);
      return { ctx: c.getContext('2d', cpu)!, tekstur: new THREE.Texture(c) };
    };
    this.salin = kecil(SEL.w, SEL.h);
    this.salinPermukaan = kecil(SEL.w / 2, SEL.h / 2);

    let slot = 0;
    for (const t of tetap) {
      if (this.slotFrame.has(t.frame)) continue;
      this.lukisAtlas(slot, t.frame, t.warna, t.panjang >= 2 ? 'ac' : 'polos', t.frame === 'bus/tingkat-oranye' ? 'tingkat' : 'kota', 'TERMINAL');
      this.lukisPermukaan(slot);
      this.slotFrame.set(t.frame, slot++);
    }
    this.jumlahTetap = slot;
    this.cache = new CacheSel(JUMLAH_SLOT - slot);

    this.peta = new THREE.CanvasTexture(this.kanvas);
    this.peta.colorSpace = THREE.SRGBColorSpace;
    this.peta.anisotropy = anisotropi;
    this.permukaan = new THREE.CanvasTexture(this.kanvasPermukaan);
    this.permukaan.anisotropy = anisotropi;
  }

  /** Slot sel tetap frame atlas ini. */
  slotTetap(frame: NamaFrame): number {
    return this.slotFrame.get(frame) ?? 0;
  }

  /** Pojok kiri-bawah sel slot ini dalam UV (dihitung sekali; dipanggil tiap bus tiap frame). */
  uvSlot(slot: number): readonly [number, number] {
    return UV_SLOT[slot] ?? UV_SLOT[0]!;
  }

  /**
   * Sel bus terminal dengan kelas & livery ini: yang sudah tersimpan, atau
   * dilukis di slot yang tidak terpakai. Bila semua slot sedang dipakai bus
   * lain, bus ini memakai sel kelas yang sama (atau sel apa saja) yang sudah ada.
   * @param acak 0–1, memilih sel pinjaman.
   */
  pesan(kelas: KelasBusId, livery: LiveryBus, acak: number): SelBus {
    const kunci = kunciSel(kelas, livery);
    const p = this.cache.pesan(kunci);
    if (p) {
      const slot = p.slot + this.jumlahTetap;
      if (p.baru) {
        this.isiKunci.set(kunci, { kelas, livery });
        this.lukisTerminal(slot, kelas, livery);
      }
      return { slot, kelas, warnaBagasi: warnaBagasi(kelas, livery) };
    }
    const pinjam = this.cache.cari((k) => this.isiKunci.get(k)?.kelas === kelas, acak) ?? this.cache.cari(() => true, acak);
    const isi = pinjam ? this.isiKunci.get(pinjam) : undefined;
    const q = pinjam ? this.cache.pesan(pinjam) : null;
    if (!isi || !q) return { slot: 0, kelas: 'ekonomi', warnaBagasi: 0x888888 };
    return { slot: q.slot + this.jumlahTetap, kelas: isi.kelas, warnaBagasi: warnaBagasi(isi.kelas, isi.livery) };
  }

  /** Bus yang memakai slot ini sudah pergi. */
  lepas(slot: number): void {
    if (slot >= this.jumlahTetap) this.cache.lepas(slot - this.jumlahTetap);
  }

  /**
   * Kirim sel yang baru dilukis ke GPU: hanya sel itu (salin ke bagian tekstur),
   * atau seluruh lembar bila banyak sekaligus.
   */
  unggah(renderer: THREE.WebGLRenderer): void {
    if (this.kotor.size === 0) return;
    if (this.kotor.size > MAKS_UNGGAH_SEBAGIAN) {
      this.peta.needsUpdate = true;
      this.permukaan.needsUpdate = true;
    } else {
      for (const slot of this.kotor) {
        const [cx, cy] = posisiSlot(slot);
        // Tekstur flipY: baris 0 GPU = bawah lembar.
        this.salin.ctx.drawImage(this.kanvas, cx, cy, SEL.w, SEL.h, 0, 0, SEL.w, SEL.h);
        renderer.copyTextureToTexture(this.salin.tekstur, this.peta, null, this.posisi.set(cx, TINGGI - cy - SEL.h));
        const [px, py, pw, ph] = [cx / 2, cy / 2, SEL.w / 2, SEL.h / 2];
        this.salinPermukaan.ctx.drawImage(this.kanvasPermukaan, px, py, pw, ph, 0, 0, pw, ph);
        renderer.copyTextureToTexture(this.salinPermukaan.tekstur, this.permukaan, null, this.posisi.set(px, TINGGI / 2 - py - ph));
      }
    }
    this.kotor.clear();
  }

  private lukisTerminal(slot: number, kelas: KelasBusId, livery: LiveryBus): void {
    const tampil = TAMPIL_KELAS_BUS[kelas];
    const [cx, cy] = posisiSlot(slot);
    const ctx = this.ctx;
    const tata = tampil.lukis;
    if (!tata) {
      if (livery.jenis === 'bawaan') {
        const t = BUS_TERMINAL[livery.indeks % BUS_TERMINAL.length]!;
        this.lukisAtlas(slot, t.frame, t.warna, tampil.atap, 'kota', LABEL_KELAS_BUS[kelas]);
      } else {
        const l = LIVERY_PO[livery.po];
        const badan = new THREE.Color(l.warna);
        ctx.fillStyle = hex(badan);
        ctx.fillRect(cx, cy, SEL.w, SEL.h);
        gambarSisiPo(ctx, this.atlas, l, cx, cy);
        this.lukisUjung(cx, cy, badan, 'kota', l.papan, tampil.atap);
      }
    } else {
      const cat = catUntuk(livery);
      const nama = livery.jenis === 'po' ? LIVERY_PO[livery.po].papan : LABEL_KELAS_BUS[kelas];
      const badan = new THREE.Color(cat.warna);
      ctx.fillStyle = hex(badan);
      ctx.fillRect(cx, cy, SEL.w, SEL.h);
      gambarSisiLukis(ctx, cx, cy, tampil, tata, cat, nama);
      this.lukisUjung(cx, cy, badan, kelas === 'tingkat' ? 'mewahTingkat' : 'mewah', nama, tampil.atap, LABEL_KELAS_BUS[kelas]);
    }
    this.lukisPermukaan(slot);
    this.kotor.add(slot);
  }

  private lukisAtlas(slot: number, frame: NamaFrame, warna: number, atap: TampilKelasBus['atap'] | 'polos', gaya: GayaDepan, papan: string): void {
    const [cx, cy] = posisiSlot(slot);
    const badan = new THREE.Color(warna);
    this.ctx.fillStyle = hex(badan);
    this.ctx.fillRect(cx, cy, SEL.w, SEL.h);
    gambarSisiAtlas(this.ctx, this.atlas, frame, cx, cy);
    this.lukisUjung(cx, cy, badan, gaya, papan, atap);
  }

  /** Depan, belakang, atap satu sel. */
  private lukisUjung(cx: number, cy: number, badan: THREE.Color, gaya: GayaDepan, papan: string, atap: TampilKelasBus['atap'] | 'polos', tulisanBelakang?: string): void {
    const ctx = this.ctx;
    gambarDepan(ctx, cx + R.depan[0], cy + R.depan[1], R.depan[2], R.depan[3], badan, gaya, papan);
    gambarBelakang(ctx, cx + R.belakang[0], cy + R.belakang[1], R.belakang[2], R.belakang[3], badan, tulisanBelakang);
    gambarAtap(ctx, cx + R.atap[0], cy + R.atap[1], R.atap[2], R.atap[3], badan, atap);
  }

  /**
   * Peta kekasaran (G) & logam (B) satu sel dari warnanya, setengah resolusi:
   * piksel gelap kebiruan = kaca (licin, memantulkan langit), gelap netral =
   * ban/karet (kasar), sisanya cat.
   */
  private lukisPermukaan(slot: number): void {
    const [cx, cy] = posisiSlot(slot);
    const w = SEL.w / 2;
    const h = SEL.h / 2;
    this.baca.drawImage(this.kanvas, cx, cy, SEL.w, SEL.h, 0, 0, w, h);
    const sumber = this.baca.getImageData(0, 0, w, h);
    const hasil = this.ctxPermukaan.createImageData(w, h);
    for (let i = 0; i < sumber.data.length; i += 4) {
      const r = sumber.data[i]!;
      const g = sumber.data[i + 1]!;
      const b = sumber.data[i + 2]!;
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      let kasar = 0.5;
      let logam = 0.08;
      if (lum < 80 && b >= r - 4) {
        kasar = 0.1;
        logam = 0;
      } else if (lum < 50) {
        kasar = 0.85;
        logam = 0;
      }
      hasil.data[i] = 255;
      hasil.data[i + 1] = Math.round(kasar * 255);
      hasil.data[i + 2] = Math.round(logam * 255);
      hasil.data[i + 3] = 255;
    }
    this.ctxPermukaan.putImageData(hasil, cx / 2, cy / 2);
  }
}

function posisiSlot(slot: number): [number, number] {
  return [(slot % KOLOM) * SEL.w, Math.floor(slot / KOLOM) * SEL.h];
}

const UV_SLOT: readonly (readonly [number, number])[] = Array.from({ length: JUMLAH_SLOT }, (_, slot) => {
  const [cx, cy] = posisiSlot(slot);
  return [cx / LEBAR, 1 - (cy + SEL.h) / TINGGI] as const;
});
