/**
 * Pewarnaan livery mitra PO (murni, tanpa DOM & three.js): mengenali piksel
 * cat badan di gambar samping dasar (bukan kaca, karet, rok abu-abu, atau
 * tulisan), mewarnainya ulang dengan warna PO sambil mempertahankan bayangan &
 * sorotannya, dan menentukan area pola & tulisan nama. kendaraan3d.ts yang
 * menerapkannya ke kanvas lembar livery.
 *
 * Koordinat gambar samping: u 0 = belakang … 1 = depan, v 0 = atas … 1 = bawah.
 * Hasil ukur atlas: pita atas (v ±0,05–0,33) cat penuh, pita jendela
 * v ±0,35–0,6, badan bawah v ±0,6–0,75, lalu rok abu-abu & roda.
 */
import type { PolaLivery } from '../config/livery.config';

export type Rgb = readonly [number, number, number];

export const rgbDariHex = (c: number): Rgb => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** RGB 0–255 → [rona 0–360, saturasi 0–1, terang 0–1]. */
export function keHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const maks = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (maks + min) / 2;
  if (maks === min) return [0, 0, l];
  const d = maks - min;
  const s = l > 0.5 ? d / (2 - maks - min) : d / (maks + min);
  const h = maks === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : maks === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h * 60, s, l];
}

export function dariHsl(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const kanal = (t: number): number => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const hn = h / 360;
  return [Math.round(kanal(hn + 1 / 3) * 255), Math.round(kanal(hn) * 255), Math.round(kanal(hn - 1 / 3) * 255)];
}

/** Pengenal cat badan: cukup jenuh, ronanya dekat rona cat dasar, tidak terlalu gelap/terang. */
const CAT = { saturasiMin: 0.3, selisihRona: 30, terangMin: 0.2, terangMaks: 0.88 } as const;

/** Piksel ini cat badan gambar dasar (rona dasar dalam derajat)? */
export function pikselCatBadan(r: number, g: number, b: number, ronaDasar: number): boolean {
  const [h, s, l] = keHsl(r, g, b);
  if (s < CAT.saturasiMin || l < CAT.terangMin || l > CAT.terangMaks) return false;
  const selisih = Math.abs(h - ronaDasar);
  return Math.min(selisih, 360 - selisih) < CAT.selisihRona;
}

/**
 * Warna baru piksel cat badan: rona & saturasi warna PO, terangnya mengikuti
 * perbandingan terang piksel terhadap cat dasar (bayangan tetap lebih gelap,
 * sorotan tetap lebih terang).
 */
export function warnaiUlang(r: number, g: number, b: number, terangDasar: number, target: number): Rgb {
  const [, , l] = keHsl(r, g, b);
  const [ht, st, lt] = keHsl(...rgbDariHex(target));
  const rasio = l / Math.max(1e-3, terangDasar);
  const lBaru = rasio <= 1 ? lt * rasio : lt + (1 - lt) * Math.min(1, (rasio - 1) / Math.max(1e-3, 1 / terangDasar - 1));
  return dariHsl(ht, st, Math.min(1, Math.max(0, lBaru)));
}

/** Pola livery menutupi titik (u, v) gambar samping? Hanya diterapkan pada piksel cat badan. */
export function polaMenutup(pola: PolaLivery, u: number, v: number): boolean {
  switch (pola) {
    case 'polos':
      return false;
    case 'garis':
      return (v >= 0.285 && v <= 0.335) || (v >= 0.64 && v <= 0.675);
    case 'dua':
      return v >= 0.6;
    case 'sapuan':
      return Math.abs(v - (0.8 - 0.62 * u + 0.03 * Math.sin(u * 9))) <= 0.065;
  }
}

/** Area tulisan nama PO di pita atas (pecahan gambar samping); di atas garis pola & di luar sapuan. */
export const AREA_TULISAN = { u0: 0.07, u1: 0.62, v0: 0.07, v1: 0.28 } as const;

/** Bobot livery tiap mitra PO dibanding satu livery bawaan: bus PO lebih sering muncul. */
export const BOBOT_PO = 2;

export type PilihanLivery<P> = { readonly jenis: 'bawaan'; readonly indeks: number } | { readonly jenis: 'po'; readonly po: P };

/**
 * Livery bus terminal: livery bawaan (gambar atlas) atau livery mitra PO yang
 * sudah bergabung (masing-masing berbobot BOBOT_PO). Tetap untuk bus yang sama
 * selama daftar PO sama; pemanggil menyimpannya per bus supaya bus yang sudah
 * berjalan tidak berganti cat saat PO baru bergabung.
 */
export function pilihLivery<P>(idBus: number, acakLivery: number, jumlahBawaan: number, po: readonly P[]): PilihanLivery<P> {
  const n = jumlahBawaan + BOBOT_PO * po.length;
  const u = (((idBus * 0.6180339887 + acakLivery * 0.1377) % 1) + 1) % 1;
  const k = Math.min(n - 1, Math.floor(u * n));
  if (k < jumlahBawaan) return { jenis: 'bawaan', indeks: k };
  return { jenis: 'po', po: po[Math.floor((k - jumlahBawaan) / BOBOT_PO)]! };
}
