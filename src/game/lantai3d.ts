/**
 * Lantai tambahan di adegan (documents/18; letak di tata-letak.ts, logika di lantai-adegan.ts):
 * cangkang lantai 2 aula, ruang tunggu, dan sayap barat, gedung parkir bentuk A, dan jalur
 * aksesnya. Semua di ekor mesh gabungan utama per unit (Kumpulan bagian 'lantai') dengan bahan
 * yang sudah ada di mesh itu, kecuali kaca jendela malam (m.kacaLantai). Jadi tahap 0–2 tidak
 * menambah draw call, dan membeli lantai hanya menulis ulang index buffer.
 */
import * as THREE from 'three';
import { bidang, bidangPutar, kotak, KumpulanUnit, persegiTegak, pita, uvDunia, type Kumpulan, type OpsiMesh } from './geometri';
import { BAGIAN_LANTAI, hLantaiAtas, unitIsi, unitLantai } from './lantai-adegan';
import { SKALA_UV, type PustakaMaterial } from './material3d';
import { buatPenampilan, Kerumunan3D, type DataOrang, type Penampilan } from './orang3d';
import { balok, warnai } from './sayap2-3d';
import { AKSES_PARKIR, GEDUNG_PARKIR, JALAN_SAMPING, RUANG_LANTAI, SELASAR, tinggiRamp, titikLengkungS, type RuangLantai, type Titik } from './tata-letak';

type Tambah = (unit: number, bahan: THREE.Material, g: THREE.BufferGeometry, opsi?: OpsiMesh) => void;

const PENUH = { u0: 0, v0: 0, u1: 1, v1: 1 } as const;
const POLOS = { bayangan: false } as const;
const KACA = { bayangan: false, terimaBayangan: false, urutan: 2 } as const;
/** Aspal akses di atas paving & marka petak tanah, di bawah marka jalan dalam yang tidak ditimpanya. */
const H_ASPAL = 0.031;
const WARNA = { biru: 0x1d4ed8, putih: 0xf1f3f5, lantaiLajur: 0x2f7d6b, kaca: 0x1b2430, tiang: 0x2a2d33 } as const;
const WARNA_MOBIL = [0xf2f2f0, 0xb8bcc2, 0x2a2d33, 0xb3261e, 0x1f4e9c, 0x5c6168, 0x6d1f2a, 0xd8cfb8];

/** Bangun semua lantai tambahan ke ekor mesh gabungan utama. */
export function bangunLantai(k: Kumpulan, m: PustakaMaterial): void {
  k.bagian = 'lantai';
  const t: Tambah = (unit, bahan, g, opsi) => {
    k.unitLantai = unit;
    k.tambah(bahan, g, opsi);
  };
  ruang(t, m, 'aula', RUANG_LANTAI.aula);
  ruang(t, m, 'ruangTunggu', RUANG_LANTAI.ruangTunggu);
  selasar(t, m);
  gedungParkir(t, m);
  aksesParkir(t, m);
  k.bagian = 'dasar';
}

// ---------------------------------------------------------------------------
// Lantai 2 berbentuk kotak (aula, ruang tunggu, sayap barat)

/**
 * Pelat, lantai granit, dinding (struktur); pita jendela menyala di malam hari, lis, atap logam
 * (atap); pagar kaca rendah pengganti atap di mode lantai (pagar). Muka selatan dan timur menghadap
 * kamera awal dan berjendela, muka barat polos.
 */
function ruang(t: Tambah, m: PustakaMaterial, g: 'aula' | 'ruangTunggu', R: RuangLantai): void {
  const [u0, u1, u2] = [unitLantai(g, 2, BAGIAN_LANTAI.struktur), unitLantai(g, 2, BAGIAN_LANTAI.atap), unitLantai(g, 2, BAGIAN_LANTAI.pagar)];
  const hT = hLantaiAtas(g);
  const hJ0 = hT + 0.06;
  const hJ1 = R.hA - 0.16;
  t(u0, m.batu, uvDunia(kotak(R.x0, R.y0, R.x1, R.y1, R.hL, hT), SKALA_UV.beton));
  t(u0, m.lantaiGranit, uvDunia(bidang(R.x0 + 0.06, R.y0 + 0.06, R.x1 - 0.06, R.y1 - 0.06, hT + 0.002), SKALA_UV.granit), POLOS);
  t(u0, m.panel, kotak(R.x0 - 0.02, R.y1 - 0.02, R.x1 + 0.02, R.y1 + 0.03, R.hL - 0.02, hT + 0.04));
  t(u0, m.dindingDalam, uvDunia(kotak(R.x0, R.y0, R.x1, R.y0 + 0.06, hT, R.hA), SKALA_UV.plester), POLOS);
  t(u0, m.plester, uvDunia(kotak(R.x0, R.y0, R.x0 + 0.06, R.y1, hT, R.hA), SKALA_UV.plester));
  t(u0, m.panel, kotak(R.x1, R.y0, R.x1 + 0.03, R.y1 + 0.03, R.hL - 0.02, hT + 0.04));

  // Pita jendela bermullion tiap 0,5 di muka selatan & timur, lis atas, atap logam datar.
  t(u1, m.kacaLantai, persegiTegak([R.x0, R.y1], [R.x1, R.y1], hJ0, hJ1, PENUH, 0.003), POLOS);
  for (let x = R.x0 + 0.5; x < R.x1 - 0.1; x += 0.5) t(u1, m.panel, kotak(x - 0.02, R.y1 - 0.01, x + 0.02, R.y1 + 0.035, hJ0, hJ1));
  t(u1, m.panel, kotak(R.x0 - 0.03, R.y1 - 0.03, R.x1 + 0.03, R.y1 + 0.04, hJ1, R.hA));
  t(u1, m.kacaLantai, persegiTegak([R.x1, R.y1], [R.x1, R.y0], hJ0, hJ1, PENUH, 0.003), POLOS);
  for (let y = R.y0 + 0.5; y < R.y1 - 0.1; y += 0.5) t(u1, m.panel, kotak(R.x1 - 0.01, y - 0.02, R.x1 + 0.035, y + 0.02, hJ0, hJ1));
  t(u1, m.panel, kotak(R.x1 - 0.03, R.y0 - 0.03, R.x1 + 0.04, R.y1 + 0.04, hJ1, R.hA));
  t(u1, m.atapLogam, uvDunia(kotak(R.x0 - 0.05, R.y0 - 0.05, R.x1 + 0.05, R.y1 + 0.06, R.hA, R.hA + 0.05), SKALA_UV.logamU));
  t(u1, m.panel, kotak(R.x0 - 0.06, R.y1 + 0.01, R.x1 + 0.06, R.y1 + 0.08, R.hA - 0.02, R.hA + 0.1));

  // Mode lantai: atap & pita jendela dibuka, pagar kaca rendah menggantikannya.
  t(u2, m.kacaDinding, persegiTegak([R.x0, R.y1 + 0.02], [R.x1, R.y1 + 0.02], hT, hT + 0.3, PENUH, 0), KACA);
  t(u2, m.panel, kotak(R.x0, R.y1, R.x1, R.y1 + 0.035, hT + 0.29, hT + 0.32));
  t(u2, m.kacaDinding, persegiTegak([R.x1 + 0.02, R.y1], [R.x1 + 0.02, R.y0], hT, hT + 0.3, PENUH, 0), KACA);
  t(u2, m.panel, kotak(R.x1, R.y0, R.x1 + 0.035, R.y1, hT + 0.29, hT + 0.32));
}

// ---------------------------------------------------------------------------
// Selasar penghubung Sayap barat lantai 2 (owner, pesan 257 & 260)

const WARNA_SELASAR = { karpet: 0x0e7490, tepiKarpet: 0xe2e8f0, pintu: 0x1b2430 } as const;

/**
 * Selasar dari muka timur A1 Sayap 2 Lantai (x 6,4; ujung barat terbuka) ke dinding barat aula (x 11,6), lantainya
 * setinggi lantai 2 Sayap 2 Lantai. Struktur: pelat tebal (seperti jembatan), lantai granit, jalur karpet berpanah,
 * bingkai bukaan barat, pintu kaca di dinding aula. Atap & jendela: pita kaca kedua sisi (menyala di malam hari),
 * atap logam rata, leher beratap rendah di bawah tritisan aula. Pagar: kaca rendah kedua sisi, di mode lantai.
 */
function selasar(t: Tambah, m: PustakaMaterial): void {
  const g = 'sayapBarat';
  const [u0, u1, u2] = [unitLantai(g, 2, BAGIAN_LANTAI.struktur), unitLantai(g, 2, BAGIAN_LANTAI.atap), unitLantai(g, 2, BAGIAN_LANTAI.pagar)];
  const R = RUANG_LANTAI.sayapBarat;
  const xA = SELASAR.xAula;
  const hT = SELASAR.hLantai;
  const hJ0 = hT + 0.06;
  const hJ1 = R.hA - 0.12;
  const hLeher = SELASAR.hAtapLeher;
  // Pelat setebal jembatan dari atap kaca sayap barat sampai lantai jalan, lis putih di sisi selatan.
  t(u0, m.batu, uvDunia(kotak(R.x0, R.y0, xA, R.y1, R.hL, hT), SKALA_UV.beton));
  t(u0, m.panel, kotak(R.x0, R.y1 - 0.02, xA, R.y1 + 0.03, hT - 0.08, hT + 0.03));
  t(u0, m.lantaiGranit, uvDunia(bidang(R.x0, R.y0 + 0.04, xA, R.y1 - 0.04, hT + 0.002), SKALA_UV.granit), POLOS);
  // Karpet jalan di separuh selatan (bilik toilet di separuh utara), bertepi, berpanah dua arah.
  const [yk0, yk1] = [12.2, 12.9];
  t(u0, m.daun, balok(R.x0 + 0.05, yk0, xA - 0.05, yk1, hT + 0.002, hT + 0.006, WARNA_SELASAR.karpet), POLOS);
  for (const y of [yk0, yk1 - 0.03]) t(u0, m.daun, balok(R.x0 + 0.05, y, xA - 0.05, y + 0.03, hT + 0.006, hT + 0.008, WARNA_SELASAR.tepiKarpet), POLOS);
  for (let x = 7.2; x < xA - 0.6; x += 1.2) {
    panah(t, u0, m, x, (yk0 + yk1) / 2 - 0.15, hT + 0.009, 0);
    panah(t, u0, m, x + 0.6, (yk0 + yk1) / 2 + 0.15, hT + 0.009, Math.PI);
  }
  // Bukaan barat ke lantai 2 Sayap 2 Lantai: bingkai panel (dua tiang & ambang).
  for (const y of [R.y0 + 0.03, R.y1 - 0.03]) t(u0, m.panel, kotak(R.x0, y - 0.04, R.x0 + 0.08, y + 0.04, hT, R.hA));
  t(u0, m.panel, kotak(R.x0, R.y0, R.x0 + 0.08, R.y1, R.hA - 0.12, R.hA));
  // Pintu kaca di dinding barat aula, berbingkai, menghadap selasar.
  const P = SELASAR.pintu;
  t(u0, m.daun, balok(xA - 0.03, P.y0 - 0.06, xA, P.y1 + 0.06, hT, P.h1 + 0.06, 0xeef1f4), POLOS);
  t(u0, m.kaca, persegiTegak([xA - 0.032, P.y0], [xA - 0.032, P.y1], hT + 0.02, P.h1, PENUH, 0), POLOS);

  // Pita kaca kedua sisi bermullion tiap 0,5, lis atas, atap logam rata; leher beratap rendah di bawah tritisan aula.
  for (const [ya, yb, dy] of [
    [R.y1, R.y1, 1],
    [R.y0, R.y0, -1],
  ] as const) {
    const [a, b] = dy > 0 ? [[R.x0, ya] as const, [R.x1, yb] as const] : [[R.x1, ya] as const, [R.x0, yb] as const];
    t(u1, m.kacaLantai, persegiTegak(a, b, hJ0, hJ1, PENUH, 0.003), POLOS);
    const [al, bl] = dy > 0 ? [[R.x1, ya] as const, [xA, yb] as const] : [[xA, ya] as const, [R.x1, yb] as const];
    t(u1, m.kacaLantai, persegiTegak(al, bl, hJ0, hLeher - 0.08, PENUH, 0.003), POLOS);
    for (let x = R.x0 + 0.5; x < xA - 0.1; x += 0.5) t(u1, m.panel, kotak(x - 0.02, ya - 0.025, x + 0.02, ya + 0.025, hJ0, x < R.x1 ? hJ1 : hLeher - 0.08));
    t(u1, m.panel, kotak(R.x0 - 0.03, ya - 0.035, R.x1 + 0.03, ya + 0.035, hJ1, R.hA));
    t(u1, m.panel, kotak(R.x1, ya - 0.035, xA, ya + 0.035, hLeher - 0.08, hLeher));
  }
  t(u1, m.atapLogam, uvDunia(kotak(R.x0 - 0.05, R.y0 - 0.05, R.x1 + 0.05, R.y1 + 0.06, R.hA, R.hA + 0.05), SKALA_UV.logamU));
  t(u1, m.panel, kotak(R.x0 - 0.06, R.y1 + 0.01, R.x1 + 0.06, R.y1 + 0.08, R.hA - 0.02, R.hA + 0.1));
  t(u1, m.atapLogam, uvDunia(kotak(R.x1, R.y0 - 0.04, xA, R.y1 + 0.05, hLeher, hLeher + 0.04), SKALA_UV.logamU));

  // Mode lantai: atap & pita kaca dibuka, pagar kaca rendah di kedua sisi.
  for (const [ya, dy] of [
    [R.y1 + 0.02, 1],
    [R.y0 - 0.02, -1],
  ] as const) {
    const [a, b] = dy > 0 ? [[R.x0, ya] as const, [xA, ya] as const] : [[xA, ya] as const, [R.x0, ya] as const];
    t(u2, m.kacaDinding, persegiTegak(a, b, hT, hT + 0.3, PENUH, 0), KACA);
    t(u2, m.panel, kotak(R.x0, ya - 0.018, xA, ya + 0.018, hT + 0.29, hT + 0.32));
  }
}

// ---------------------------------------------------------------------------
// Gedung parkir bentuk A

const P = GEDUNG_PARKIR;
/** Ujung timur pagar utara ramp 2: bukaan dari dek 2 ke kaki ramp 2 (lebih lebar dari mobil 0,36). */
const X_BUKAAN_RAMP2 = 35.1;
/** Rentang x mobil diam baris 1 dek (di luarnya petak kosong, lihat puncakDek). */
const X_MOBIL_DEK1 = [32.0, 34.6] as const;
/** Bibir dek di atas landasan timur, terbuka bila ada ramp ke dek berikutnya. */
const X_BIBIR = 34.8;
const unitS = (n: number): number => unitLantai('parkir', n, BAGIAN_LANTAI.struktur);
const unitP = (n: number): number => unitLantai('parkir', n, BAGIAN_LANTAI.puncak);

/** Balok miring sepanjang x: permukaan atas dari hA di xA ke hB di xB, setebal `tebal` ke bawah. */
function landaiX(xA: number, xB: number, y0: number, y1: number, hA: number, hB: number, tebal: number): THREE.BufferGeometry {
  const g = kotak(Math.min(xA, xB), y0, Math.max(xA, xB), y1, 0, 1);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const atas = hA + ((hB - hA) * (p.getX(i) - xA)) / (xB - xA);
    p.setY(i, p.getY(i) > 0.5 ? atas : atas - tebal);
  }
  g.computeVertexNormals();
  return g;
}

/** Panah lantai (dua goresan) menunjuk `sudut` (radian di bidang x–y, 0 = +x). */
function panah(t: Tambah, u: number, m: PustakaMaterial, x: number, y: number, h: number, sudut: number): void {
  const [ca, sa] = [Math.cos(sudut), Math.sin(sudut)];
  for (const s of [-1, 1]) {
    const a = sudut + s * 2.5;
    t(u, m.marka, bidangPutar(x + ca * 0.08 + Math.cos(a) * 0.09, y + sa * 0.08 + Math.sin(a) * 0.09, 0.2, 0.045, a, h), POLOS);
  }
}

/** Benih acak kecil (sama tiap muat). */
function acak(benih: number): () => number {
  let s = benih >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Mobil ringkas diam di dek (vertex color, bahan daun), panjang searah y. */
function mobilDek(t: Tambah, u: number, b: THREE.Material, x: number, y: number, h: number, warna: number): void {
  t(u, b, balok(x - 0.17, y - 0.44, x + 0.17, y + 0.44, h + 0.04, h + 0.19, warna));
  t(u, b, balok(x - 0.15, y - 0.2, x + 0.15, y + 0.18, h + 0.19, h + 0.3, WARNA.kaca));
  t(u, b, balok(x - 0.14, y - 0.18, x + 0.14, y + 0.16, h + 0.3, h + 0.315, warna));
}

/** Papan P persegi dua muka (selatan & timur) pada satu tiang; pusat (x, y), sisi s, bawah h0. */
function papanP(t: Tambah, u: number, m: PustakaMaterial, x: number, y: number, h0: number, s: number, tiangDari: number): void {
  const teks = m.teks('P', { lebar: 128, tinggi: 128, latar: '#1d4ed8', warna: '#ffffff', ukuranHuruf: 104 });
  const d = s / 2;
  t(u, m.daun, balok(x - d, y - d, x + d, y + d, h0, h0 + s, WARNA.biru));
  t(u, teks.material, persegiTegak([x - d, y + d], [x + d, y + d], h0, h0 + s, teks.uv, 0.004), POLOS);
  t(u, teks.material, persegiTegak([x + d, y + d], [x + d, y - d], h0, h0 + s, teks.uv, 0.004), POLOS);
  if (tiangDari < h0) t(u, m.daun, balok(x - 0.035, y - 0.035, x + 0.035, y + 0.035, tiangDari, h0, WARNA.tiang));
}

/**
 * Ramp lurus di lajur selatan, naik ke barat sampai landasan barat dek. Pagar di kedua sisi;
 * pagar utara terbuka 0,6 di ujung atas (masuk dek) dan, di ramp 2, mulai xUtara (bukaan dari dek 2).
 */
function rampLurus(t: Tambah, u: number, m: PustakaMaterial, ramp: 1 | 2, xUtara: number): void {
  const xKaki = ramp === 1 ? P.x1 : P.xKaki2;
  const hPagar = 0.24;
  const [xb, y0, y1] = [P.xBarat, P.yDek, P.y1];
  const [hKaki, hAtas] = [tinggiRamp(ramp, xKaki), tinggiRamp(ramp, xb)];
  t(u, m.beton, uvDunia(landaiX(xKaki, xb, y0, y1, hKaki, hAtas, 0.09), SKALA_UV.beton));
  t(u, m.aspal, uvDunia(landaiX(xKaki, xb, y0 + 0.05, y1 - 0.05, hKaki + 0.004, hAtas + 0.004, 0.003), SKALA_UV.aspal), POLOS);
  t(u, m.beton, uvDunia(landaiX(xKaki, xb, y1 - 0.05, y1, hKaki + hPagar, hAtas + hPagar, hPagar), SKALA_UV.beton));
  const xa = xb + 0.6;
  t(u, m.beton, uvDunia(landaiX(xUtara, xa, y0, y0 + 0.05, tinggiRamp(ramp, xUtara) + hPagar, tinggiRamp(ramp, xa) + hPagar, hPagar), SKALA_UV.beton));
  // Garis kuning tepi jalur.
  t(u, m.markaKuning, landaiX(xKaki, xb, y0 + 0.07, y0 + 0.095, hKaki + 0.009, hAtas + 0.009, 0.002), POLOS);
  t(u, m.markaKuning, landaiX(xKaki, xb, y1 - 0.095, y1 - 0.07, hKaki + 0.009, hAtas + 0.009, 0.002), POLOS);
}

/** Dek ke-n (2 atau 3) setinggi h: pelat, lorong berwarna, panah per lajur, petak, tembok, kolom, lampu strip. */
function dek(t: Tambah, m: PustakaMaterial, n: 2 | 3, h: number, hBawah: number): void {
  const u = unitS(n);
  const [x0, x1, y0, yD] = [P.x0, P.x1, P.y0, P.yDek];
  const L = P.lorongDek;
  t(u, m.beton, uvDunia(kotak(x0, y0, x1, yD, h - 0.1, h), SKALA_UV.beton));
  t(u, m.aspal, uvDunia(bidang(x0 + 0.05, y0 + 0.05, x1 - 0.05, yD, h + 0.004), SKALA_UV.aspal), POLOS);
  // Landasan barat: ujung atas ramp masuk dek.
  t(u, m.beton, uvDunia(kotak(x0, yD, P.xBarat, P.y1, h - 0.1, h), SKALA_UV.beton));
  t(u, m.aspal, uvDunia(bidang(x0 + 0.05, yD, P.xBarat, P.y1 - 0.05, h + 0.004), SKALA_UV.aspal), POLOS);
  // Lorong dek berwarna, sisi barat (dari ramp) dan sambungan timur (putar balik & ke ramp berikutnya).
  t(u, m.daun, balok(x0 + 0.05, L.y0, x1 - 0.05, L.y1, h + 0.005, h + 0.007, WARNA.lantaiLajur), POLOS);
  t(u, m.daun, balok(x0 + 0.05, L.y1, x0 + 0.65, yD, h + 0.005, h + 0.007, WARNA.lantaiLajur), POLOS);
  t(u, m.daun, balok(x0 + 0.05, yD, P.xBarat, P.y1 - 0.05, h + 0.005, h + 0.007, WARNA.lantaiLajur), POLOS);
  t(u, m.daun, balok(X_BIBIR + 0.02, L.y1, x1 - 0.05, yD, h + 0.005, h + 0.007, WARNA.lantaiLajur), POLOS);
  // Lajur kiri: ke timur di sisi utara, ke barat di sisi selatan.
  for (const x of [32.2, 33.8]) {
    panah(t, u, m, x, L.y0 + 0.2, h + 0.009, 0);
    panah(t, u, m, x + 0.4, L.y1 - 0.2, h + 0.009, Math.PI);
  }
  for (let x = 31.45; x <= x1 - 0.03; x += 0.52) t(u, m.marka, bidang(x - 0.0125, y0 + 0.05, x + 0.0125, L.y0, h + 0.008), POLOS);
  for (let x = 31.45; x <= X_BIBIR + 0.05; x += 0.52) t(u, m.marka, bidang(x - 0.0125, L.y1, x + 0.0125, yD - 0.05, h + 0.008), POLOS);
  // Tembok keliling; sisi lajur ramp ikut pagar ramp, bibir di atas landasan timur ada di bagian puncak.
  const hT = h + P.hTembok;
  t(u, m.beton, uvDunia(kotak(x0, y0, x1, y0 + 0.06, h, hT), SKALA_UV.beton));
  t(u, m.beton, uvDunia(kotak(x0, y0, x0 + 0.06, P.y1, h, hT), SKALA_UV.beton));
  t(u, m.beton, uvDunia(kotak(x1 - 0.06, y0, x1, yD, h, hT), SKALA_UV.beton));
  t(u, m.beton, uvDunia(kotak(P.xBarat + 0.6, yD - 0.05, X_BIBIR, yD, h, hT), SKALA_UV.beton));
  t(u, m.beton, uvDunia(kotak(x0, P.y1 - 0.05, P.xBarat, P.y1, h, hT), SKALA_UV.beton));
  // Kolom utara & selatan. Kolom tenggara dek 3 dibuang: berdiri di bukaan dek 2 ke ramp 2.
  for (const x of [x0 + 0.08, 32.6, 34.3, x1 - 0.08]) {
    t(u, m.beton, uvDunia(kotak(x - 0.07, y0 + 0.02, x + 0.07, y0 + 0.16, hBawah, h - 0.1), SKALA_UV.beton));
    if (n === 3 && x === x1 - 0.08) continue;
    t(u, m.beton, uvDunia(kotak(x - 0.07, yD - 0.15, x + 0.07, yD - 0.01, hBawah, h - 0.1), SKALA_UV.beton));
  }
  // Lampu strip di muka timur dek (malam).
  t(u, m.lampuMenyala, kotak(x1, y0 + 0.1, x1 + 0.02, yD - 0.1, h - 0.075, h - 0.035), POLOS);
}

/** Yang hanya ada di dek teratas yang terlihat: mobil parkir, papan P, tembok bibir di atas landasan timur. */
function puncakDek(t: Tambah, m: PustakaMaterial, n: 2 | 3, h: number): void {
  const u = unitP(n);
  const r = acak(70 + n);
  const [b1, b2] = P.barisDek;
  // Petak baris 1 paling barat dan dua paling timur kosong: disapu pojok mobil yang berbelok ke lorong dan ke ruang putar.
  for (let x = 31.71; x < P.x1 - 0.2; x += 0.52) if (r() < 0.8 && x > X_MOBIL_DEK1[0] && x < X_MOBIL_DEK1[1]) mobilDek(t, u, m.daun, x, b1, h, WARNA_MOBIL[Math.floor(r() * WARNA_MOBIL.length)]!);
  for (let x = 31.71; x < X_BIBIR; x += 0.52) if (r() < 0.8) mobilDek(t, u, m.daun, x, b2 - 0.03, h, WARNA_MOBIL[Math.floor(r() * WARNA_MOBIL.length)]!);
  papanP(t, u, m, P.x1 - 0.22, P.y0 + 0.22, h + 0.5, 0.42, h);
  t(u, m.beton, uvDunia(kotak(X_BIBIR, P.yDek - 0.05, P.x1 - 0.06, P.yDek, h, h + P.hTembok), SKALA_UV.beton));
}

function gedungParkir(t: Tambah, m: PustakaMaterial): void {
  const [s2, s3] = [unitS(2), unitS(3)];
  const [h2, h3] = P.hDek;
  rampLurus(t, s2, m, 1, P.x1);
  rampLurus(t, s3, m, 2, X_BUKAAN_RAMP2);
  // Landasan timur ke ramp 2, di atas kaki ramp 1.
  t(s3, m.beton, uvDunia(kotak(P.xKaki2, P.yDek, P.x1, P.y1, h2 - 0.09, h2), SKALA_UV.beton));
  t(s3, m.aspal, uvDunia(bidang(P.xKaki2, P.yDek + 0.05, P.x1 - 0.05, P.y1 - 0.05, h2 + 0.004), SKALA_UV.aspal), POLOS);
  t(s3, m.beton, uvDunia(kotak(P.xKaki2, P.y1 - 0.05, P.x1, P.y1, h2, h2 + 0.24), SKALA_UV.beton));
  t(s3, m.beton, uvDunia(kotak(P.x1 - 0.05, P.yDek, P.x1, P.y1, h2, h2 + 0.24), SKALA_UV.beton));
  dek(t, m, 2, h2, 0);
  dek(t, m, 3, h3, h2);
  puncakDek(t, m, 2, h2);
  puncakDek(t, m, 3, h3);
  // Kolom di muka selatan, dari kaki sampai pagar ramp.
  for (const x of [30.92, 32.6, 34.3, 35.92]) {
    const a = tinggiRamp(1, x) + 0.24;
    t(s2, m.beton, uvDunia(kotak(x - 0.06, P.y1 - 0.08, x + 0.06, P.y1 + 0.01, 0, a), SKALA_UV.beton));
    t(s3, m.beton, uvDunia(kotak(x - 0.06, P.y1 - 0.08, x + 0.06, P.y1 + 0.01, a, tinggiRamp(2, x) + 0.24), SKALA_UV.beton));
  }
  // Pita biru, lampu strip, dan lis kuning di tembok selatan tiap ramp.
  for (const [s, ramp] of [
    [s2, 1],
    [s3, 2],
  ] as const) {
    const xk = ramp === 1 ? P.x1 : P.xKaki2;
    const [hk, ha] = [tinggiRamp(ramp, xk), tinggiRamp(ramp, P.xBarat)];
    t(s, m.daun, warnai(landaiX(xk, P.xBarat, P.y1, P.y1 + 0.012, hk + 0.18, ha + 0.18, 0.09), WARNA.biru));
    t(s, m.lampuMenyala, landaiX(xk, P.xBarat, P.y1 + 0.012, P.y1 + 0.02, hk + 0.075, ha + 0.075, 0.025), POLOS);
    t(s, m.markaKuning, landaiX(xk, P.xBarat, P.y1 - 0.055, P.y1 + 0.005, hk + 0.25, ha + 0.25, 0.012));
  }
  // Papan nama di muka timur dek 2.
  const papan = m.teks('P  GEDUNG PARKIR', { lebar: 512, tinggi: 72, latar: '#1d4ed8', warna: '#ffffff', ukuranHuruf: 44 });
  t(s2, papan.material, persegiTegak([P.x1 + 0.02, 16.3], [P.x1 + 0.02, 13.8], 0.68, 1.02, papan.uv, 0.004), POLOS);
}

// ---------------------------------------------------------------------------
// Akses: jalan samping, lajur timur ruang tunggu, lorong parkir, lengkung S, gapura

/** Gapura masuk parkir (tiang, balok, papan menghadap selatan) di garis y. */
function gapura(t: Tambah, u: number, m: PustakaMaterial, x0: number, x1: number, y: number): void {
  for (const x of [x0 - 0.08, x1 + 0.08]) t(u, m.daun, balok(x - 0.05, y - 0.05, x + 0.05, y + 0.05, 0, 0.84, WARNA.tiang));
  t(u, m.daun, balok(x0 - 0.13, y - 0.06, x1 + 0.13, y + 0.06, 0.68, 0.86, WARNA.biru));
  const papan = m.teks('P  MASUK PARKIR', { lebar: 512, tinggi: 72, latar: '#1d4ed8', warna: '#ffffff', ukuranHuruf: 46 });
  t(u, papan.material, persegiTegak([x0 - 0.08, y + 0.06], [x1 + 0.08, y + 0.06], 0.69, 0.85, papan.uv, 0.004), POLOS);
}

/** Pos karcis kecil di sisi lajur. */
function pos(t: Tambah, u: number, m: PustakaMaterial, x0: number, y0: number, x1: number, y1: number): void {
  t(u, m.daun, balok(x0, y0, x1, y1, 0, 0.34, WARNA.putih));
  t(u, m.daun, balok(x0 - 0.04, y0 - 0.04, x1 + 0.04, y1 + 0.04, 0.34, 0.39, WARNA.biru));
  t(u, m.kaca, persegiTegak([x0 + 0.04, y1], [x1 - 0.04, y1], 0.16, 0.3, PENUH, 0.003), POLOS);
}

function aksesParkir(t: Tambah, m: PustakaMaterial): void {
  const u = unitLantai('parkir', 1, BAGIAN_LANTAI.akses);
  const A = AKSES_PARKIR;
  const J = JALAN_SAMPING;
  const aspal = (g: THREE.BufferGeometry): void => t(u, m.aspal, uvDunia(g, SKALA_UV.aspal), POLOS);
  // Jalan samping ke pelataran SPBU, dan sudut paving yang menyambungkannya ke lajur timur.
  aspal(bidang(J.x0, J.y0, J.x1, J.y1, H_ASPAL));
  aspal(bidang(J.x0, J.y1, A.xTimur + A.lebarTimur / 2 + 0.25, A.yTimur0 + 0.02, H_ASPAL));
  // Lajur timur ruang tunggu, berbelok ke lorong parkir.
  const titik: Titik[] = [
    [A.xTimur, A.yTimur0],
    [A.xTimur, A.yLorong - A.jariBelok],
  ];
  const pusat: Titik = [A.xTimur - A.jariBelok, A.yLorong - A.jariBelok];
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    titik.push([pusat[0] + A.jariBelok * Math.cos(a), pusat[1] + A.jariBelok * Math.sin(a)]);
  }
  aspal(pita(titik, A.lebarTimur, H_ASPAL));
  aspal(bidang(A.xLorongBarat - 0.2, A.yLorong - A.lebarLorong / 2, pusat[0] + 0.05, A.yLorong + A.lebarLorong / 2, H_ASPAL));
  // Lengkung S ke kaki ramp, sedikit di atas aspal lorong supaya tidak bertumpuk.
  const lengkung: Titik[] = [];
  for (let i = 0; i <= 8; i++) lengkung.push(titikLengkungS(i / 8));
  aspal(pita(lengkung, A.lebarLengkung, H_ASPAL + 0.001));
  // Panah per lajur (lajur kiri: masuk dan keluar ±0,2 dari tengah).
  const h = H_ASPAL + 0.003;
  panah(t, u, m, 55.8, J.y1 - 0.2, h, Math.PI);
  panah(t, u, m, 54.2, J.y0 + 0.2, h, 0);
  for (const y of [8.2, 11.2]) {
    panah(t, u, m, A.xTimur + 0.2, y, h, Math.PI / 2);
    panah(t, u, m, A.xTimur - 0.2, y + 1.5, h, -Math.PI / 2);
  }
  for (let x = 48.0; x > 39; x -= 3.6) {
    panah(t, u, m, x, A.yLorong + 0.2, h, Math.PI);
    panah(t, u, m, x - 1.8, A.yLorong - 0.2, h, 0);
  }
  // Gapura melintang lajur timur dan pos karcis di sisi timurnya.
  gapura(t, u, m, A.xTimur - 0.5, A.xTimur + 0.5, A.yGapura);
  pos(t, u, m, A.xTimur + 0.62, A.yGapura - 0.5, A.xTimur + 0.98, A.yGapura - 0.1);
}

// ---------------------------------------------------------------------------
// Isi lantai tambahan (mode lantai saja)

const HEX_ISI = { kursi: [0x1f5fd0, 0x0e8f8a], besi: 0x3b4149, panel: 0xeef1f4, kayu: 0x9a6b3f, pot: 0x8c5a3c, daun: 0x2f7d4f } as const;
/** Menghadap selatan (+y, ke pita jendela & kamera awal). */
const SELATAN = Math.PI / 2;
const UTARA = -Math.PI / 2;
/** Jarak kursi dalam satu deret, sama dengan kursi ruang tunggu. */
const JARAK_KURSI = 0.17;

/**
 * Isi lantai tambahan untuk mode lantai: kursi, kios, toko, bilik toilet, dan orang yang diam (dibakar). Satu
 * KumpulanUnit bahan kendaraan tanpa bayangan, dibangun saat mode lantai pertama kali dibuka. Nomor unit dari
 * unitIsi (lantai-adegan.ts): satu unit per unit bangunan, jadi yang belum dibangun atau dibongkar tidak tampak.
 */
export class IsiLantai {
  readonly objek = new THREE.Group();
  private readonly unit = new KumpulanUnit();
  private readonly pembakar = new Kerumunan3D(1);
  private benih = 0;

  constructor(m: PustakaMaterial) {
    const b = m.kendaraan;
    // Ruang tunggu 2: empat blok kursi (dua deret menghadap pita jendela) dan satu kios di ujung timur.
    const RT = RUANG_LANTAI.ruangTunggu;
    const hRT = RT.hL + 0.1;
    [32.0, 36.8, 41.6, 46.4].forEach((cx, i) => {
      const u = unitIsi('ruangTunggu', 2, 'kursi', i + 1);
      [12.32, 12.72].forEach((y, r) => {
        const x0 = cx - 7 * JARAK_KURSI;
        this.deretKursi(u, b, x0, y, 14, hRT, HEX_ISI.kursi[i % 2]!);
        for (const c of [2 + i + r * 3, 9 - i + r]) this.orang(u, b, x0 + JARAK_KURSI * (c + 0.5), y, hRT, SELATAN, true);
      });
    });
    this.kios(unitIsi('ruangTunggu', 2, 'kios', 1), b, 48.6, 12.1, 49.95, 12.55, hRT, 0xdc2626);
    // Aula 2 (mezanin di belakang dinding utara): dua toko di barat, dua blok kursi.
    const A = RUANG_LANTAI.aula;
    const hA = A.hL + 0.1;
    this.kios(unitIsi('aula', 2, 'toko', 1), b, 11.75, A.y0 + 0.1, 13.45, A.y0 + 0.55, hA, 0xb91c1c);
    this.kios(unitIsi('aula', 2, 'toko', 2), b, 13.65, A.y0 + 0.1, 14.95, A.y0 + 0.55, hA, 0x15803d);
    [19.2, 25.7].forEach((cx, i) => {
      const u = unitIsi('aula', 2, 'kursi', i + 1);
      [0.5, 0.88].forEach((dy, r) => {
        const x0 = cx - 8 * JARAK_KURSI;
        this.deretKursi(u, b, x0, A.y0 + dy, 16, hA, HEX_ISI.kursi[r]!);
        for (const c of [3 + r * 5, 8, 12 - r * 2]) this.orang(u, b, x0 + JARAK_KURSI * (c + 0.5), A.y0 + dy, hA, SELATAN, true);
      });
    });
    // Selasar Sayap barat 2 (bagian tetap): orang yang lewat di karpet, bangku & tanaman pot di separuh utara. Tanpa
    // toilet (owner, pesan 272 & 274): +1 toilet lantai ini digambar di lantai dasar (GEDUNG_ISI_DI_DASAR).
    const SB = RUANG_LANTAI.sayapBarat;
    const hSB = hLantaiAtas('sayapBarat');
    const uS = unitIsi('sayapBarat', 2, null, 0);
    for (const x of [7.6, 9.9]) {
      this.unit.tambah(uS, b, balok(x - 0.45, SB.y0 + 0.22, x + 0.45, SB.y0 + 0.4, hSB + 0.07, hSB + 0.1, HEX_ISI.kayu), POLOS);
      this.unit.tambah(uS, b, balok(x - 0.45, SB.y0 + 0.1, x + 0.45, SB.y0 + 0.14, hSB + 0.1, hSB + 0.22, HEX_ISI.kayu), POLOS);
      for (const dx of [-0.38, 0.38]) this.unit.tambah(uS, b, balok(x + dx - 0.02, SB.y0 + 0.12, x + dx + 0.02, SB.y0 + 0.38, hSB, hSB + 0.07, HEX_ISI.besi), POLOS);
    }
    for (const x of [SB.x0 + 0.35, 8.75, 11.0]) {
      this.unit.tambah(uS, b, balok(x - 0.12, SB.y0 + 0.12, x + 0.12, SB.y0 + 0.36, hSB, hSB + 0.16, HEX_ISI.pot), POLOS);
      this.unit.tambah(uS, b, balok(x - 0.16, SB.y0 + 0.08, x + 0.16, SB.y0 + 0.4, hSB + 0.16, hSB + 0.42, HEX_ISI.daun), POLOS);
    }
    this.orang(uS, b, 7.4, 12.4, hSB, 0, false);
    this.orang(uS, b, 8.9, 12.7, hSB, Math.PI, false);
    this.orang(uS, b, 10.5, 12.4, hSB, 0, false);
    this.orang(uS, b, 11.0, 12.75, hSB, Math.PI, false);
    // Gedung parkir: mobilnya bagian cangkang (satu unit per dek); isi = pengemudi di samping mobil tiap baris (lahan).
    P.hDek.forEach((h, i) => {
      this.orang(unitIsi('parkir', i + 2, 'lahanParkir', 1), b, 31.97, 14.35, h + 0.004, 0, false);
      this.orang(unitIsi('parkir', i + 2, 'lahanParkir', 2), b, 33.53, 15.84, h + 0.004, Math.PI, false);
    });
    this.unit.bangun(this.objek);
  }

  /** Tampilkan unit isi yang terlihat (lihat unitIsiTerlihat). Tidak untuk tiap frame: menulis ulang index buffer. */
  tampilkan(terlihat: ReadonlySet<number>): void {
    this.unit.tampilkan((u) => terlihat.has(u));
    this.objek.visible = terlihat.size > 0;
  }

  private deretKursi(u: number, b: THREE.Material, x0: number, y: number, jumlah: number, h: number, warna: number): void {
    this.unit.tambah(u, b, balok(x0 + 0.02, y - 0.012, x0 + JARAK_KURSI * jumlah - 0.02, y + 0.012, h, h + 0.068, HEX_ISI.besi), POLOS);
    for (let c = 0; c < jumlah; c++) {
      const x = x0 + JARAK_KURSI * (c + 0.5);
      this.unit.tambah(u, b, balok(x - 0.072, y - 0.045, x + 0.072, y + 0.065, h + 0.075, h + 0.095, warna), POLOS);
      this.unit.tambah(u, b, balok(x - 0.072, y - 0.072, x + 0.072, y - 0.05, h + 0.1, h + 0.235, warna), POLOS);
    }
  }

  /** Kios atau toko kecil (dinding belakang, meja depan berwarna, kanopi) dengan penjaga di baliknya dan satu pembeli. */
  private kios(u: number, b: THREE.Material, x0: number, y0: number, x1: number, y1: number, h: number, warna: number): void {
    this.unit.tambah(u, b, balok(x0, y0, x1, y0 + 0.12, h, h + 0.5, HEX_ISI.panel), POLOS);
    this.unit.tambah(u, b, balok(x0 + 0.05, y1 - 0.14, x1 - 0.05, y1, h, h + 0.24, warna), POLOS);
    this.unit.tambah(u, b, balok(x0, y0, x1, y1 + 0.06, h + 0.5, h + 0.56, warna), POLOS);
    const x = (x0 + x1) / 2;
    this.orang(u, b, x - 0.2, (y0 + 0.12 + y1 - 0.14) / 2, h, SELATAN, false, true);
    this.orang(u, b, x + 0.25, y1 + 0.2, h, UTARA, false);
  }

  /** Bakar satu orang jadi geometri di unitnya, memakai bagian tubuh Kerumunan3D supaya rupanya sama dengan orang lain. */
  private orang(u: number, bahan: THREE.Material, x: number, y: number, h: number, hadap: number, duduk: boolean, pekerja = false): void {
    const p: Penampilan = buatPenampilan(1, 1500 + this.benih++)[0]!;
    const d: DataOrang = { id: 1, x, y, h: duduk ? h + 0.005 : h, penampilan: pekerja ? { ...p, ransel: null, koper: null } : p, hadap };
    const k = this.pembakar;
    k.mulai();
    k.tambah(duduk ? { ...d, pose: 'duduk' } : d, 0);
    k.selesai();
    const matriks = new THREE.Matrix4();
    const warna = new THREE.Color();
    for (const anak of k.objek.children as THREE.InstancedMesh[]) {
      for (let i = 0; i < anak.count; i++) {
        anak.getMatrixAt(i, matriks);
        anak.getColorAt(i, warna);
        const g = anak.geometry.clone().applyMatrix4(matriks);
        const c = g.getAttribute('color');
        for (let v = 0; v < c.count; v++) c.setXYZ(v, c.getX(v) * warna.r, c.getY(v) * warna.g, c.getZ(v) * warna.b);
        this.unit.tambah(u, bahan, g, POLOS);
      }
    }
  }
}
