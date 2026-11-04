/**
 * Sayap 2 Lantai di taman barat (Perluasan 3; documents/16 bagian 3.1 & 4): blok
 * dua lantai A1, teras food court A2, tangga & eskalator A3. Hanya memakai bahan
 * PustakaMaterial, supaya beban gambarnya kecil di HP:
 * - Cangkang & benda yang selalu ada masuk mesh gabungan utama sebagai bagian
 *   'sayap' (Kumpulan). Semua bahannya sudah ada di mesh utama, jadi tidak menambah
 *   draw call, dan dipotong setDrawRange selama sayap belum berdiri.
 * - Isi yang muncul per unit (jendela, blok kursi, pintu gulung, papan, orang
 *   yang diam) ada di IsiSayap2: satu mesh bervertex color tanpa bayangan dan
 *   satu mesh papan. Dibangun saat pertama dibutuhkan, seperti proyek perluasan.
 * Logika unit mana yang terlihat ada di bentuk-adegan.ts.
 */
import * as THREE from 'three';
import { keHexCss, WARNA_TAHAP } from '../config/tema';
import { ambangOrangL2, keadaanJendelaL2, tingkatKeramaian, type IsiLantai2 } from './bentuk-adegan';
import { atapLengkung, bayanganKontak, bidang, Busur, dindingBusur, kotak, Kumpulan, KumpulanUnit, persegiTegak, rusukBusur, silinder, uvDunia } from './geometri';
import { SKALA_UV, type PustakaMaterial } from './material3d';
import { buatPenampilan, Kerumunan3D, type DataOrang, type Penampilan } from './orang3d';
import {
  ATAP_SAYAP2,
  BLOK_KURSI_L2,
  H_DINDING_L2,
  H_LANTAI_2,
  KIOS_TERAS,
  KURSI,
  LOKET,
  LOKET_L2,
  MEJA_DASAR,
  MEJA_L2,
  MEJA_TERAS,
  PAPAN_L2,
  SAYAP_DUA,
  TANGGA_L2,
  TINGGI_LANTAI_GEDUNG,
  tinggiTanggaL2,
  type BlokKursiL2,
  type JendelaL2,
} from './tata-letak';

const PENUH = { u0: 0, v0: 0, u1: 1, v1: 1 } as const;
const ALAS = TINGGI_LANTAI_GEDUNG;
const POLOS = { bayangan: false } as const;
const TANPA_BAYANGAN = { bayangan: false, terimaBayangan: false } as const;
const KACA = { ...TANPA_BAYANGAN, urutan: 2 } as const;
const KACA_ATAP = { ...TANPA_BAYANGAN, urutan: 3 } as const;

/** Penampang atap A1: sumbu lengkungnya tegak lurus atap aula, ini yang memecah garis atap dari kamera. */
export const BUSUR_A1 = new Busur(ATAP_SAYAP2.x0, ATAP_SAYAP2.x1, ATAP_SAYAP2.hTepi, ATAP_SAYAP2.hPuncak);
/** Tinggi tepi atas teras (sebelum pagar kaca) & puncak pagar kacanya. */
const H_BADAN_TERAS = 1.25;
const H_PAGAR_TERAS = 1.55;
/** Plester rendah di bawah kaca muka selatan & timur teras. */
const H_PLESTER_TERAS = 0.3;
/** Dinding dalam lantai 2 di balik deret jendela. */
const H_DINDING_DALAM_L2 = 2.05;
/** Pintu dari lantai 2 ke teras (di muka timur A1). */
const PINTU_TERAS = { y0: 15.8, y1: 16.6, h: H_LANTAI_2 + 0.7 } as const;
/** Bukaan pagar teras ke arah tangga. */
const Y_UJUNG_BUKAAN_TANGGA = 16.4;
/** Warna payung meja teras (vertex color di bahan daun: sudah ada di mesh utama dan melempar bayangan). */
const WARNA_PAYUNG_TERAS: readonly number[] = [0xd62828, 0x1d4ed8, 0xf2b705, 0x2f7d4f, 0xe76f51, 0x0e8f8a, 0xd62828];

// ---------------------------------------------------------------------------
// Cangkang: masuk mesh gabungan utama

/** Tambahkan cangkang & benda tetap sayap ke kumpulan utama, sebagai bagian 'sayap'. */
export function bangunSayap2(k: Kumpulan, m: PustakaMaterial): void {
  k.bagian = 'sayap';
  blokA1(k, m);
  terasA2(k, m);
  tanggaA3(k, m);
  papanLantai2(k, m);
  k.bagian = 'dasar';
}

function blokA1(k: Kumpulan, m: PustakaMaterial): void {
  const S = SAYAP_DUA.a1;
  const B = BUSUR_A1;
  const [hBarat, hTimur] = [B.tinggi(S.x0), B.tinggi(S.x1)];

  // Podium & lantai dasar.
  k.tambah(m.batu, uvDunia(kotak(S.x0, S.y0, S.x1, S.y1, 0, ALAS), SKALA_UV.beton));
  k.tambah(m.kontak, bayanganKontak(S.x0, S.y0, S.x1, S.y1, 0.5, 0.36), TANPA_BAYANGAN);
  k.tambah(m.lantaiGranit, uvDunia(bidang(S.x0, S.y0, S.x1, S.y1, ALAS + 0.002), SKALA_UV.granit), POLOS);

  // Kaca keliling lantai dasar.
  const hKacaDasar = 1.3;
  k.tambah(m.kacaDinding, persegiTegak([S.x0, S.y1], [S.x1, S.y1], ALAS, hKacaDasar, PENUH, 0), KACA);
  k.tambah(m.kacaDinding, persegiTegak([S.x1, S.y1], [S.x1, S.y0], ALAS, hKacaDasar, PENUH, 0), KACA);
  k.tambah(m.kacaDinding, persegiTegak([S.x1, S.y0], [S.x0, S.y0], ALAS, hKacaDasar, PENUH, 0), KACA);
  k.tambah(m.kacaDinding, persegiTegak([S.x0, S.y0], [S.x0, S.y1], ALAS, hKacaDasar, PENUH, 0), KACA);

  // Tiang tiap 1,0: di muka timur & barat sampai busur, di muka utara & selatan sampai kulit atap di posisinya.
  for (let x = S.x0; x <= S.x1 + 1e-6; x += 1) {
    const h = B.tinggi(x);
    k.tambah(m.panel, kotak(x - 0.03, S.y1 - 0.03, x + 0.03, S.y1 + 0.03, ALAS, h));
    k.tambah(m.panel, kotak(x - 0.03, S.y0 - 0.03, x + 0.03, S.y0 + 0.03, ALAS, h));
  }
  for (let y = S.y0; y <= S.y1 + 1e-6; y += 1) {
    k.tambah(m.panel, kotak(S.x1 - 0.03, y - 0.03, S.x1 + 0.03, y + 0.03, ALAS, hTimur));
    k.tambah(m.panel, kotak(S.x0 - 0.03, y - 0.03, S.x0 + 0.03, y + 0.03, ALAS, hBarat));
  }

  // Pelat lantai 2, tepinya, lantai atas.
  k.tambah(m.batu, uvDunia(kotak(S.x0, S.y0, S.x1, S.y1, 1.28, H_LANTAI_2), SKALA_UV.beton));
  k.tambah(m.panel, kotak(S.x0 - 0.03, S.y1, S.x1 + 0.03, S.y1 + 0.03, 1.28, H_LANTAI_2));
  k.tambah(m.panel, kotak(S.x1, S.y0 - 0.03, S.x1 + 0.03, S.y1 + 0.03, 1.28, H_LANTAI_2));
  k.tambah(m.lantaiGranit, uvDunia(bidang(S.x0, S.y0, S.x1, S.y1, H_LANTAI_2 + 0.002), SKALA_UV.granit), POLOS);

  // Lantai 2: dinding padat di balik deret jendela utara & barat, kaca di atasnya dan di sisi lain.
  k.tambah(m.dindingDalam, uvDunia(kotak(S.x0, S.y0, S.x1, S.y0 + 0.06, H_LANTAI_2, H_DINDING_DALAM_L2), SKALA_UV.plester), POLOS);
  k.tambah(m.dindingDalam, uvDunia(kotak(S.x0, S.y0, S.x0 + 0.06, S.y1, H_LANTAI_2, H_DINDING_DALAM_L2), SKALA_UV.plester), POLOS);
  k.tambah(m.kacaDinding, persegiTegak([S.x1, S.y0], [S.x0, S.y0], H_DINDING_DALAM_L2, H_DINDING_L2, PENUH, 0), KACA);
  k.tambah(m.kacaDinding, persegiTegak([S.x0, S.y1], [S.x1, S.y1], H_LANTAI_2, H_DINDING_L2, PENUH, 0), KACA);
  k.tambah(m.kacaDinding, persegiTegak([S.x0, S.y0], [S.x0, S.y1], H_DINDING_DALAM_L2, hBarat, PENUH, 0), KACA);
  // Muka timur terbuka di pintu teras.
  k.tambah(m.kacaDinding, persegiTegak([S.x1, S.y1], [S.x1, PINTU_TERAS.y1], H_LANTAI_2, hTimur, PENUH, 0), KACA);
  k.tambah(m.kacaDinding, persegiTegak([S.x1, PINTU_TERAS.y0], [S.x1, S.y0], H_LANTAI_2, hTimur, PENUH, 0), KACA);
  k.tambah(m.kacaDinding, persegiTegak([S.x1, PINTU_TERAS.y1], [S.x1, PINTU_TERAS.y0], PINTU_TERAS.h, hTimur, PENUH, 0), KACA);
  for (const y of [PINTU_TERAS.y0, PINTU_TERAS.y1]) k.tambah(m.panel, kotak(S.x1 - 0.02, y - 0.02, S.x1 + 0.02, y + 0.02, H_LANTAI_2, PINTU_TERAS.h));
  k.tambah(m.panel, kotak(S.x1 - 0.02, PINTU_TERAS.y0, S.x1 + 0.02, PINTU_TERAS.y1, PINTU_TERAS.h - 0.04, PINTU_TERAS.h));
  for (const y of [S.y0, S.y1]) k.tambah(m.panel, kotak(S.x0, y - 0.02, S.x1, y + 0.02, H_DINDING_L2 - 0.05, H_DINDING_L2));

  atapA1(k, m);
}

function atapA1(k: Kumpulan, m: PustakaMaterial): void {
  const S = SAYAP_DUA.a1;
  const B = BUSUR_A1;
  const [a0, a1] = [ATAP_SAYAP2.y0, ATAP_SAYAP2.y1];
  const tA = B.tDari(S.x0);
  const tB = B.tDari(S.x1);
  const logam = { segmen: 3, skalaU: SKALA_UV.logamU, skalaV: SKALA_UV.logamV };
  k.tambah(m.atapLogam, atapLengkung('y', a0, a1, B, { ...logam, t1: tA }));
  k.tambah(m.atapLogam, atapLengkung('y', a0, a1, B, { ...logam, t0: tB }));
  k.tambah(m.kacaAtap, atapLengkung('y', a0, a1, B, { t0: tA, t1: tB, segmen: 14 }), KACA_ATAP);
  for (const t of [tA, tB]) {
    const [b, h] = B.titik(t);
    k.tambah(m.panel, kotak(b - 0.03, a0, b + 0.03, a1, h - 0.02, h + 0.035));
  }
  for (let a = S.y0 + 0.5; a < S.y1; a += 1) k.tambah(m.kanopiRangka, rusukBusur('y', a, B, 0.05, -0.085, 0.012, 8, tA, tB));
  for (const t of [0.25, 0.375, 0.5, 0.625, 0.75]) {
    const [b, h] = B.titik(t, -0.035);
    k.tambah(m.kanopiRangka, kotak(b - 0.016, a0, b + 0.016, a1, h - 0.028, h + 0.006));
  }
  for (const a of [a0 + 0.03, a1 - 0.03]) k.tambah(m.panel, rusukBusur('y', a, B, 0.06, -0.09, 0.02, 8));
  k.tambah(m.kacaDinding, dindingBusur('y', S.y1, S.x0, S.x1, H_DINDING_L2, B, 1), KACA);
  k.tambah(m.kacaDinding, dindingBusur('y', S.y0, S.x0, S.x1, H_DINDING_L2, B, -1), KACA);
}

function terasA2(k: Kumpulan, m: PustakaMaterial): void {
  const A = SAYAP_DUA.a2a;
  const B = SAYAP_DUA.a2b;
  for (const R of [A, B]) {
    k.tambah(m.batu, uvDunia(kotak(R.x0, R.y0, R.x1, R.y1, 0, ALAS), SKALA_UV.beton));
    k.tambah(m.lantaiGranit, uvDunia(bidang(R.x0, R.y0, R.x1, R.y1, ALAS + 0.002), SKALA_UV.granit), POLOS);
    k.tambah(m.batu, uvDunia(kotak(R.x0, R.y0, R.x1, R.y1, H_BADAN_TERAS, H_LANTAI_2), SKALA_UV.beton));
    k.tambah(m.paving, uvDunia(bidang(R.x0, R.y0, R.x1, R.y1, H_LANTAI_2 + 0.002), SKALA_UV.paving), POLOS);
    k.tambah(m.kontak, bayanganKontak(R.x0, R.y0, R.x1, R.y1, 0.4, 0.3), TANPA_BAYANGAN);
  }
  // Muka selatan & timur: plester rendah, kaca, tiang tiap 1,0.
  k.tambah(m.plester, uvDunia(kotak(B.x0, B.y1 - 0.06, B.x1, B.y1, ALAS, H_PLESTER_TERAS), SKALA_UV.plester));
  k.tambah(m.plester, uvDunia(kotak(A.x1 - 0.06, A.y0, A.x1, B.y1, ALAS, H_PLESTER_TERAS), SKALA_UV.plester));
  k.tambah(m.kacaDinding, persegiTegak([B.x0, B.y1], [B.x1, B.y1], H_PLESTER_TERAS, H_BADAN_TERAS, PENUH, 0), KACA);
  k.tambah(m.kacaDinding, persegiTegak([A.x1, B.y1], [A.x1, A.y0], H_PLESTER_TERAS, H_BADAN_TERAS, PENUH, 0), KACA);
  for (let x = B.x0; x <= B.x1 + 1e-6; x += 1) k.tambah(m.panel, kotak(x - 0.03, B.y1 - 0.03, x + 0.03, B.y1 + 0.03, ALAS, H_BADAN_TERAS));
  for (let y = A.y0; y <= B.y1 + 1e-6; y += 1) k.tambah(m.panel, kotak(A.x1 - 0.03, y - 0.03, A.x1 + 0.03, y + 0.03, ALAS, H_BADAN_TERAS));
  // Sisi utara teras timur & barat teras selatan membelakangi kamera: plester penuh.
  k.tambah(m.plester, uvDunia(kotak(A.x0, A.y0, A.x1, A.y0 + 0.06, ALAS, H_BADAN_TERAS), SKALA_UV.plester));
  k.tambah(m.plester, uvDunia(kotak(B.x0, B.y0, B.x0 + 0.06, B.y1, ALAS, H_BADAN_TERAS), SKALA_UV.plester));
  // Tepi pelat.
  k.tambah(m.panel, kotak(B.x0 - 0.02, B.y1, B.x1 + 0.02, B.y1 + 0.03, H_BADAN_TERAS, H_LANTAI_2));
  k.tambah(m.panel, kotak(A.x1, A.y0, A.x1 + 0.03, B.y1 + 0.02, H_BADAN_TERAS, H_LANTAI_2));
  // Pagar kaca di selatan, timur (dengan bukaan ke tangga), dan barat teras selatan.
  k.tambah(m.kacaDinding, persegiTegak([B.x0, B.y1], [B.x1, B.y1], H_LANTAI_2, H_PAGAR_TERAS, PENUH, 0), KACA);
  k.tambah(m.kacaDinding, persegiTegak([A.x1, B.y1], [A.x1, Y_UJUNG_BUKAAN_TANGGA], H_LANTAI_2, H_PAGAR_TERAS, PENUH, 0), KACA);
  k.tambah(m.kacaDinding, persegiTegak([B.x0, B.y0], [B.x0, B.y1], H_LANTAI_2, H_PAGAR_TERAS, PENUH, 0), KACA);
  k.tambah(m.panel, kotak(B.x0, B.y1 - 0.015, B.x1, B.y1 + 0.015, H_PAGAR_TERAS - 0.02, H_PAGAR_TERAS + 0.01));
  k.tambah(m.panel, kotak(A.x1 - 0.015, Y_UJUNG_BUKAAN_TANGGA, A.x1 + 0.015, B.y1, H_PAGAR_TERAS - 0.02, H_PAGAR_TERAS + 0.01));
  k.tambah(m.panel, kotak(B.x0 - 0.015, B.y0, B.x0 + 0.015, B.y1, H_PAGAR_TERAS - 0.02, H_PAGAR_TERAS + 0.01));
  // Badan kios teras (pintu gulung & papannya ikut IsiSayap2).
  KIOS_TERAS.forEach((f, i) => {
    k.tambah(m.kios[(i + 1) % m.kios.length]!, uvDunia(kotak(f.x0, f.y0, f.x1, f.y1, H_LANTAI_2, f.hAtap), SKALA_UV.plester));
    k.tambah(m.kayu, kotak(f.x0 - 0.04, f.y0 - 0.04, f.x1 + 0.04, f.y1 + 0.08, f.hAtap, f.hAtap + 0.04));
    k.tambah(m.kaca, persegiTegak([f.x0 + 0.12, f.y1], [f.x1 - 0.12, f.y1], H_LANTAI_2 + 0.08, 1.68, PENUH, 0.003), POLOS);
  });
  // Payung meja teras.
  MEJA_TERAS.forEach(([x, y], i) => {
    const g = new THREE.ConeGeometry(0.4, 0.15, 8);
    g.translate(x, 1.975, y);
    warnai(g, WARNA_PAYUNG_TERAS[i % WARNA_PAYUNG_TERAS.length]!, true);
    k.tambah(m.daun, g);
  });
}

/** Baji padat: alas di tanah, tepi atas miring dari hS di selatan (y1) ke hN di utara (y0). */
function baji(x0: number, y0: number, x1: number, y1: number, hS: number, hN: number): THREE.BufferGeometry {
  const g = kotak(x0, y0, x1, y1, 0, 1);
  const p = g.getAttribute('position');
  const tengah = (y0 + y1) / 2;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0.5 ? (p.getZ(i) > tengah ? hS : hN) : 0);
  g.computeVertexNormals();
  return g;
}

/** Tangga & eskalator dua lajur, naik ke utara, dengan bordes setinggi lantai 2 di ujung atas. */
function tanggaA3(k: Kumpulan, m: PustakaMaterial): void {
  const T = TANGGA_L2;
  const ANAK_TANGGA = 12;
  for (const [xa, xb] of [T.naik, T.turun]) {
    for (let i = 0; i < ANAK_TANGGA; i++) {
      const ya = T.yBordes + ((T.y1 - T.yBordes) * i) / ANAK_TANGGA;
      const yb = T.yBordes + ((T.y1 - T.yBordes) * (i + 1)) / ANAK_TANGGA;
      k.tambah(m.besiGelap, kotak(xa + 0.05, ya, xb - 0.05, yb, 0, tinggiTanggaL2(ya)));
    }
    for (const [xs0, xs1] of [[xa, xa + 0.05], [xb - 0.05, xb]] as const) {
      k.tambah(m.biruPos, baji(xs0, T.yBordes, xs1, T.y1, T.hBawah + 0.16, H_LANTAI_2 + 0.16));
    }
  }
  // Bordes menyambung ke bukaan pagar teras.
  k.tambah(m.batu, uvDunia(kotak(SAYAP_DUA.a2a.x1, T.y0, T.turun[1], T.yBordes, H_BADAN_TERAS, H_LANTAI_2), SKALA_UV.beton));
  k.tambah(m.paving, uvDunia(bidang(SAYAP_DUA.a2a.x1, T.y0, T.turun[1], T.yBordes, H_LANTAI_2 + 0.002), SKALA_UV.paving), POLOS);
}

/** Badan & kaki papan LANTAI 2 di atas talang timur A1, menghadap timur (tulisannya di IsiSayap2). */
function papanLantai2(k: Kumpulan, m: PustakaMaterial): void {
  const P = PAPAN_L2;
  k.tambah(m.panel, kotak(P.x0, P.y0, P.x1, P.y1, P.h0, P.h1));
  for (const y of P.kakiY) k.tambah(m.besiGelap, kotak(P.x0, y - 0.03, P.x1, y + 0.03, P.hKaki, P.h0));
}

// ---------------------------------------------------------------------------
// Isi per unit

/** Warna vertex satu warna; uv dibuang kecuali diminta (bahan vertex color tidak memakainya). */
function warnai(g: THREE.BufferGeometry, hex: number, simpanUv = false): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const warna = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) warna.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(warna, 3));
  if (!simpanUv) g.deleteAttribute('uv');
  return g;
}

/** Balok tanpa sisi bawah (tidak pernah terlihat): 10 segitiga, bukan 12. */
function balok(x0: number, y0: number, x1: number, y1: number, h0: number, h1: number, hex: number): THREE.BufferGeometry {
  const g = kotak(x0, y0, x1, y1, h0, h1);
  const indeks = Array.from(g.index!.array);
  // Urutan sisi BoxGeometry: +x, −x, +y, −y, +z, −z (6 indeks per sisi).
  indeks.splice(18, 6);
  g.setIndex(indeks);
  return warnai(g, hex);
}

const HEX = { panel: 0xeef1f4, besiGelap: 0x3b4149, besi: 0x9aa3ad, granit: 0x3c424b, kursi: [0x1f5fd0, 0x0e8f8a], layar: 0x1a2027 } as const;

/** Blok unit: nomor unit tiap benda yang muncul per unit (lihat KumpulanUnit). */
const UNIT = { tetap: 0, jendela: 100, pintu: 200, papanSewa: 300, papanKosong: 400, tutup: 500, kursi: 600, pintuKios: 700, petugas: 800, pembeli: 900, duduk: 1000, makan: 1100, penjagaKios: 1200 } as const;

/** Baris & kolom kursi yang diduduki tiap blok lantai 2. */
const DUDUK_BLOK: readonly (readonly [number, number])[] = [
  [0, 2],
  [1, 7],
  [2, 4],
  [3, 0],
  [4, 8],
  [5, 3],
];
/** Orang duduk menghadap utara (ke arah loket & gerbang). */
const HADAP_UTARA = -Math.PI / 2;
/** Id sementara saat membakar: orangnya tidak pernah masuk kerumunan adegan. */
const ID_BAKAR = 1;

const penampilanSipil = (benih: number): Penampilan => buatPenampilan(1, 1200 + benih)[0]!;

const seragamLoket = (i: number): Penampilan => {
  const warna = (c: number): THREE.Color => new THREE.Color(c);
  return { kulit: warna(0xc68642), baju: warna(i % 2 ? 0xe9a23b : 0xf5f5f4), celana: warna(0x1f2937), rambut: warna(0x1c1410), jilbab: null, ransel: null, koper: null, topi: false, skala: 1 };
};

/** Geometri jendela lantai 2 dipetakan dari (u sepanjang dinding, d dari muka meja ke arah pembeli) ke denah. */
const kotakJendela = (j: JendelaL2, u0: number, u1: number, d0: number, d1: number, h0: number, h1: number, hex: number): THREE.BufferGeometry =>
  j.menghadap === 'selatan' ? balok(j.x + u0, j.y + d0, j.x + u1, j.y + d1, h0, h1, hex) : balok(j.x + d0, j.y + u0, j.x + d1, j.y + u1, h0, h1, hex);

const tegakJendela = (j: JendelaL2, u0: number, u1: number, d: number, h0: number, h1: number, uv: typeof PENUH | { u0: number; v0: number; u1: number; v1: number }, geser: number): THREE.BufferGeometry =>
  j.menghadap === 'selatan' ? persegiTegak([j.x + u0, j.y + d], [j.x + u1, j.y + d], h0, h1, uv, geser) : persegiTegak([j.x + d, j.y + u1], [j.x + d, j.y + u0], h0, h1, uv, geser);

/** Pintu gulung: empat lembar bergradasi, kesan seng bergelombang dari vertex color. */
function tambahPintuGulung(k: KumpulanUnit, unit: number, bahan: THREE.Material, buat: (h0: number, h1: number) => THREE.BufferGeometry, h0: number, h1: number): void {
  const LEMBAR = 4;
  for (let i = 0; i < LEMBAR; i++) {
    const g = buat(h0 + ((h1 - h0) * i) / LEMBAR, h0 + ((h1 - h0) * (i + 1)) / LEMBAR);
    const [bawah, atas] = [new THREE.Color(0x8d949c), new THREE.Color(0xc9ced4)];
    const warna = new Float32Array(12);
    // Urutan verteks persegiTegak: a bawah, b bawah, b atas, a atas.
    warna.set([bawah.r, bawah.g, bawah.b, bawah.r, bawah.g, bawah.b, atas.r, atas.g, atas.b, atas.r, atas.g, atas.b]);
    g.setAttribute('color', new THREE.BufferAttribute(warna, 3));
    g.deleteAttribute('uv');
    k.tambah(unit, bahan, g, POLOS);
  }
}

function mejaBundar(k: KumpulanUnit, bahan: THREE.Material, x: number, y: number, h0: number, bangku: readonly (readonly [number, number])[]): void {
  k.tambah(UNIT.tetap, bahan, warnai(silinder(x, y, h0 + 0.16, h0 + 0.175, 0.13, 0.13, 8), HEX.panel), POLOS);
  k.tambah(UNIT.tetap, bahan, warnai(silinder(x, y, h0, h0 + 0.16, 0.015, 0.015, 4), HEX.besiGelap), POLOS);
  for (const [dx, dy] of bangku) k.tambah(UNIT.tetap, bahan, warnai(silinder(x + dx, y + dy, h0, h0 + 0.095, 0.05, 0.05, 6), HEX.kursi[1]), POLOS);
}

const BANGKU_MEJA: readonly (readonly [number, number])[] = [
  [-0.2, 0],
  [0.2, 0],
  [0, -0.2],
];

/** Orang makan di meja: unitnya, keramaian minimalnya, dan apakah di teras terbuka. */
interface OrangMakan {
  readonly unit: number;
  readonly ambang: number;
  readonly teras: boolean;
}

/**
 * Isi Sayap 2 Lantai yang muncul per unit. Dua draw call berapa pun unit yang
 * terlihat: bahan kendaraan (vertex color) tanpa bayangan dan atlas papan, lewat
 * index buffer yang hanya ditulis ulang saat keadaannya berubah.
 *
 * Orang yang diam (petugas, pembeli, pengunjung duduk & makan, penjaga kios) tidak
 * beranimasi, jadi dibakar menjadi geometri, bukan dihitung ulang tiap frame di
 * Kerumunan3D. Satu-satunya yang bergerak adalah pengunjung di tangga (terminal3d.ts).
 */
export class IsiSayap2 {
  readonly objek = new THREE.Group();
  private readonly unit = new KumpulanUnit();
  private readonly makan: OrangMakan[] = [];
  private lalu: IsiLantai2 | null = null;
  private tingkatLalu = -1;
  private berteduhLalu = false;

  constructor(m: PustakaMaterial) {
    const k = this.unit;
    const warna = m.kendaraan;
    for (const [x, y] of MEJA_L2) mejaBundar(k, warna, x, y, H_LANTAI_2, BANGKU_MEJA);
    for (const [x, y] of MEJA_TERAS) {
      mejaBundar(k, warna, x, y, H_LANTAI_2, BANGKU_MEJA);
      k.tambah(UNIT.tetap, warna, warnai(silinder(x, y, H_LANTAI_2 + 0.175, 1.92, 0.012, 0.012, 4), HEX.besiGelap), POLOS);
    }
    for (const [x, y] of MEJA_DASAR) mejaBundar(k, warna, x, y, ALAS, BANGKU_MEJA);
    LOKET_L2.forEach((j, i) => this.jendela(j, i, m));
    BLOK_KURSI_L2.forEach((b, i) => this.blokKursi(b, i, warna));
    this.orangDiam(warna);
    this.papan(m);
    k.bangun(this.objek);
  }

  /** Bakar satu orang jadi geometri di unitnya, memakai bagian tubuh Kerumunan3D supaya rupanya sama dengan orang lain. */
  private bakar(pembakar: Kerumunan3D, unit: number, bahan: THREE.Material, orang: DataOrang): void {
    pembakar.mulai();
    pembakar.tambah(orang, 0);
    pembakar.selesai();
    const matriks = new THREE.Matrix4();
    const warna = new THREE.Color();
    for (const anak of pembakar.objek.children as THREE.InstancedMesh[]) {
      for (let i = 0; i < anak.count; i++) {
        anak.getMatrixAt(i, matriks);
        anak.getColorAt(i, warna);
        const g = anak.geometry.clone().applyMatrix4(matriks);
        const c = g.getAttribute('color');
        for (let v = 0; v < c.count; v++) c.setXYZ(v, c.getX(v) * warna.r, c.getY(v) * warna.g, c.getZ(v) * warna.b);
        this.unit.tambah(unit, bahan, g, POLOS);
      }
    }
  }

  private orangDiam(bahan: THREE.Material): void {
    const pembakar = new Kerumunan3D(1);
    const bakar = (unit: number, x: number, y: number, h: number, penampilan: Penampilan, hadap: number, duduk: boolean): void => {
      const dasar = { id: ID_BAKAR, x, y, h: duduk ? h + 0.005 : h, penampilan, hadap };
      this.bakar(pembakar, unit, bahan, duduk ? { ...dasar, pose: 'duduk' } : dasar);
    };
    LOKET_L2.forEach((j, i) => {
      const selatan = j.menghadap === 'selatan';
      bakar(UNIT.petugas + i, j.petugas[0], j.petugas[1], H_LANTAI_2, seragamLoket(i), selatan ? Math.PI / 2 : 0, false);
      bakar(UNIT.pembeli + i, j.pembeli[0], j.pembeli[1], H_LANTAI_2, penampilanSipil(i), selatan ? HADAP_UTARA : Math.PI, false);
    });
    BLOK_KURSI_L2.forEach((b, i) => {
      DUDUK_BLOK.forEach(([r, c], n) => bakar(UNIT.duduk + i * 10 + n, b.x0 + KURSI.jarak * (c + 0.5), b.yBaris0 + r * KURSI.jarakBaris, H_LANTAI_2, penampilanSipil(40 + i * 10 + n), HADAP_UTARA, true));
    });
    const diMeja = (x: number, y: number, h: number, hadap: number, teras: boolean): void => {
      const i = this.makan.length;
      const unit = UNIT.makan + i;
      this.makan.push({ unit, ambang: ambangOrangL2(i + 40), teras });
      bakar(unit, x, y, h, penampilanSipil(80 + i), hadap, true);
    };
    // Bangku sisi lorong dipakai pengunjung yang bergerak (bentuk-adegan.ts), orang diam di sisi seberangnya.
    for (const [x, y] of MEJA_L2) {
      if (x > 4.85) diMeja(x + 0.2, y, H_LANTAI_2, Math.PI, false);
      else diMeja(x - 0.2, y, H_LANTAI_2, 0, false);
    }
    for (const [x, y] of MEJA_TERAS) diMeja(x - 0.2, y, H_LANTAI_2, 0, true);
    MEJA_DASAR.forEach(([x, y], i) => {
      if (i % 2 === 0) diMeja(x - 0.2, y, ALAS, 0, false);
    });
    KIOS_TERAS.forEach((f, i) => {
      bakar(UNIT.penjagaKios + i, (f.x0 + f.x1) / 2, f.y1 + 0.15, H_LANTAI_2, { ...penampilanSipil(120 + i), ransel: null, koper: null }, Math.PI / 2, false);
    });
  }

  private jendela(j: JendelaL2, i: number, m: PustakaMaterial): void {
    const k = this.unit;
    const bahan = m.kendaraan;
    const h0 = H_LANTAI_2;
    const w = LOKET.setengahLebar;
    const hMeja = h0 + 0.2;
    const unit = UNIT.jendela + i;
    const warnaLoket = WARNA_TAHAP.loket;
    k.tambah(unit, bahan, kotakJendela(j, -w, w, -0.16, 0, h0, hMeja, warnaLoket), POLOS);
    k.tambah(unit, bahan, kotakJendela(j, -w - 0.02, w + 0.02, -0.2, 0.03, hMeja, hMeja + 0.025, HEX.granit), POLOS);
    // Sekat antarjendela & ambang atas kaca; kaca loketnya tidak digambar, terlalu kecil untuk terlihat.
    k.tambah(unit, bahan, kotakJendela(j, -w - 0.018, -w + 0.018, -0.54, 0.01, h0, h0 + 0.5, HEX.panel), POLOS);
    k.tambah(unit, bahan, kotakJendela(j, w - 0.018, w + 0.018, -0.54, 0.01, h0, h0 + 0.5, HEX.panel), POLOS);
    k.tambah(unit, bahan, kotakJendela(j, -w, w, -0.115, -0.085, h0 + 0.45, h0 + 0.47, HEX.panel), POLOS);
    k.tambah(unit, bahan, kotakJendela(j, 0.12, 0.28, -0.2, -0.17, hMeja + 0.025, hMeja + 0.13, HEX.layar), POLOS);

    tambahPintuGulung(k, UNIT.pintu + i, bahan, (a, b) => tegakJendela(j, -w + 0.03, w - 0.03, -0.085, a, b, PENUH, 0), hMeja + 0.025, h0 + 0.45);
    const tutup = m.teks('TUTUP', { lebar: 128, tinggi: 48, latar: '#b91c1c', warna: '#ffffff', ukuranHuruf: 32 });
    k.tambah(UNIT.tutup + i, tutup.material, tegakJendela(j, -0.12, 0.12, -0.081, hMeja + 0.1, hMeja + 0.19, tutup.uv, 0), POLOS);

    const nomor = `LOKET ${i + 9}`;
    const menyala = m.teks(nomor, { lebar: 256, tinggi: 60, latar: keHexCss(WARNA_TAHAP.loket), warna: '#1d232b', ukuranHuruf: 40 });
    const redup = m.teks(nomor, { lebar: 256, tinggi: 60, latar: '#64748b', warna: '#e2e8f0', ukuranHuruf: 40 });
    k.tambah(UNIT.papanSewa + i, menyala.material, tegakJendela(j, -0.26, 0.26, -0.54, h0 + 0.58, h0 + 0.7, menyala.uv, 0.004), POLOS);
    k.tambah(UNIT.papanKosong + i, redup.material, tegakJendela(j, -0.26, 0.26, -0.54, h0 + 0.58, h0 + 0.7, redup.uv, 0.004), POLOS);
  }

  private blokKursi(b: BlokKursiL2, i: number, bahan: THREE.Material): void {
    const k = this.unit;
    const h0 = H_LANTAI_2;
    const unit = UNIT.kursi + i;
    const warna = HEX.kursi[i % HEX.kursi.length]!;
    for (let r = 0; r < KURSI.jumlahBaris; r++) {
      const y = b.yBaris0 + r * KURSI.jarakBaris;
      k.tambah(unit, bahan, balok(b.x0 + 0.02, y - 0.012, b.x1 - 0.02, y + 0.012, h0, h0 + 0.068, HEX.besiGelap), POLOS);
      for (let c = 0; c < KURSI.perBaris; c++) {
        const x = b.x0 + KURSI.jarak * (c + 0.5);
        k.tambah(unit, bahan, balok(x - 0.072, y - 0.065, x + 0.072, y + 0.045, h0 + 0.075, h0 + 0.095, warna), POLOS);
        k.tambah(unit, bahan, balok(x - 0.072, y + 0.05, x + 0.072, y + 0.072, h0 + 0.1, h0 + 0.235, warna), POLOS);
      }
    }
  }

  /** Semua tulisan sayap ada di atlas papan: hanya perlu satu mesh, dan atlasnya baru bertambah saat isi ini dibangun. */
  private papan(m: PustakaMaterial): void {
    const k = this.unit;
    const P = PAPAN_L2;
    const lantai2 = m.teks('LANTAI 2', { lebar: 512, tinggi: 140, latar: '#1d4ed8', warna: '#ffffff', ukuranHuruf: 104 });
    k.tambah(UNIT.tetap, lantai2.material, persegiTegak([P.x1, P.y1], [P.x1, P.y0], P.h0, P.h1, lantai2.uv, 0.006), POLOS);
    const foodCourt = m.teks('FOOD COURT', { lebar: 1024, tinggi: 70, latar: '#7c2d12', warna: '#ffffff', ukuranHuruf: 52 });
    k.tambah(UNIT.tetap, foodCourt.material, persegiTegak([3.6, SAYAP_DUA.a2b.y1 + 0.03], [8.8, SAYAP_DUA.a2b.y1 + 0.03], 0.8, 1.15, foodCourt.uv, 0.006), POLOS);
    const tutup = m.teks('TUTUP', { lebar: 128, tinggi: 48, latar: '#b91c1c', warna: '#ffffff', ukuranHuruf: 32 });
    KIOS_TERAS.forEach((f, i) => {
      const nama = m.teks(f.nama, { lebar: 320, tinggi: 56, latar: '#7c2d12', warna: '#ffffff', ukuranHuruf: 34 });
      k.tambah(UNIT.tetap, nama.material, persegiTegak([f.x0 + 0.05, f.y1], [f.x1 - 0.05, f.y1], 1.7, 1.93, nama.uv, 0.006), POLOS);
      const yPintu = f.y1 + 0.008;
      tambahPintuGulung(k, UNIT.pintuKios + i, m.kendaraan, (a, b) => persegiTegak([f.x0 + 0.08, yPintu], [f.x1 - 0.08, yPintu], a, b, PENUH, 0), H_LANTAI_2, 1.68);
      const cx = (f.x0 + f.x1) / 2;
      k.tambah(UNIT.pintuKios + i, tutup.material, persegiTegak([cx - 0.15, yPintu + 0.004], [cx + 0.15, yPintu + 0.004], H_LANTAI_2 + 0.12, H_LANTAI_2 + 0.23, tutup.uv, 0), POLOS);
    });
  }

  /**
   * Dipanggil tiap frame; index buffer hanya ditulis ulang saat isinya berganti
   * (isiLantai2 mengembalikan objek yang sama bila tidak berubah).
   * @param berteduh hujan cukup deras: pengunjung meja teras pergi
   */
  perbarui(isi: IsiLantai2, keramaian: number, berteduh: boolean): void {
    const tingkat = tingkatKeramaian(keramaian);
    if (isi === this.lalu && tingkat === this.tingkatLalu && berteduh === this.berteduhLalu) return;
    this.lalu = isi;
    this.tingkatLalu = tingkat;
    this.berteduhLalu = berteduh;
    const terlihat = new Set<number>([UNIT.tetap]);
    for (const i of isi.buka) {
      terlihat.add(UNIT.petugas + i);
      if (tingkat >= ambangOrangL2(i)) terlihat.add(UNIT.pembeli + i);
    }
    isi.blokKursi.forEach((ada, b) => {
      if (!ada) return;
      DUDUK_BLOK.forEach((_, n) => {
        if (tingkat >= ambangOrangL2(b * 6 + n)) terlihat.add(UNIT.duduk + b * 10 + n);
      });
    });
    for (const o of this.makan) if (tingkat >= o.ambang && !(berteduh && o.teras)) terlihat.add(o.unit);
    for (let i = 0; i < isi.kiosBuka; i++) terlihat.add(UNIT.penjagaKios + i);
    LOKET_L2.forEach((_, i) => {
      const keadaan = keadaanJendelaL2(i, isi);
      if (keadaan === 'belum') return;
      terlihat.add(UNIT.jendela + i);
      terlihat.add((keadaan === 'kosong' ? UNIT.papanKosong : UNIT.papanSewa) + i);
      if (keadaan !== 'buka') {
        terlihat.add(UNIT.pintu + i);
        terlihat.add(UNIT.tutup + i);
      }
    });
    isi.blokKursi.forEach((ada, i) => {
      if (ada) terlihat.add(UNIT.kursi + i);
    });
    KIOS_TERAS.forEach((_, i) => {
      if (i >= isi.kiosBuka) terlihat.add(UNIT.pintuKios + i);
    });
    this.unit.tampilkan((u) => terlihat.has(u));
  }
}
