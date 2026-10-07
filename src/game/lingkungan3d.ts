/**
 * Lingkungan statis 3D: tanah, jalan, median, jalan dalam, pangkalan, peron
 * kedatangan, taman, kota di seberang jalan, pepohonan, lampu, gapura, pos
 * retribusi, dan perabot jalan. Gedung terminal & ruang tunggu ada di gedung3d.ts. Semua geometri digabung per material.
 *
 * Lapisan ketinggian permukaan (unit) supaya tidak z-fighting:
 * rumput 0 · lantai kompleks 0.012 · taman 0.016 · aspal 0.02 · marka 0.026.
 */
import * as THREE from 'three';
import type { TitikCahaya } from './cahaya3d';
import { acakBerbenih } from './dunia-visual';
import { bayanganKontak, bidang, bidangPutar, kotak, persegiTegak, pita, silinder, uvDunia, v3, type Kumpulan, type Titik2 } from './geometri';
import { lintasanS } from './jalur';
import { PAPAN_JURUSAN } from './papan-jurusan3d';
import { SKALA_UV, type PustakaMaterial } from './material3d';
import {
  BUKAAN_MEDIAN,
  SAYAP_BARAT,
  HALTE_BERANGKAT_X,
  HALTE_DATANG_X,
  JALAN,
  JALAN_DALAM,
  KELOMPOK_PARKIR,
  KELUAR,
  LAJUR,
  MASUK,
  MEDIAN,
  PANGKALAN,
  PARKIR_SERONG,
  PERON,
  PERON_BERANGKAT,
  PINTU_MASUK,
  PULAU_JURUSAN,
  POS_CUCI,
  POS_RETRIBUSI,
  RUANG_TUNGGU,
  TINGGI_PERON,
  X_JALUR_KAKI,
  Y_LUAPAN,
  Y_PAGAR,
} from './tata-letak';

const H = { lantai: 0.012, taman: 0.016, aspal: 0.02, setapak: 0.022, marka: 0.026 } as const;

export function bangunLingkungan(k: Kumpulan, m: PustakaMaterial): { bendera: THREE.Mesh } {
  tanah(k, m);
  jalanRaya(k, m);
  kompleks(k, m);
  peron(k, m);
  taman(k, m);
  kota(k, m);
  palem(k, m);
  pepohonan(k, m);
  lampu(k, m);
  gapura(k, m);
  posRetribusi(k, m);
  perabot(k, m);
  pencucian(k, m);
  kelompokJurusan(k, m);
  return { bendera: bendera(k, m) };
}

const datar = (k: Kumpulan, mat: THREE.Material, x0: number, y0: number, x1: number, y1: number, h: number, skala: number): void => {
  k.tambah(mat, uvDunia(bidang(x0, y0, x1, y1, h), skala), { bayangan: false });
};

// ---------------------------------------------------------------------------

function tanah(k: Kumpulan, m: PustakaMaterial): void {
  datar(k, m.rumput, -200, -200, 240, 220, 0, SKALA_UV.rumput);
}

function jalanRaya(k: Kumpulan, m: PustakaMaterial): void {
  const x0 = JALAN.x0 - 60;
  const x1 = JALAN.x1 + 60;
  // Trotoar seberang (dengan kerb) dan jalan raya.
  k.tambah(m.beton, uvDunia(kotak(x0, -1.0, x1, 0, 0, 0.035), SKALA_UV.beton), { bayangan: false });
  datar(k, m.aspal, x0, JALAN.y0, x1, JALAN.y1, H.aspal, SKALA_UV.aspal);
  // Marka tepi & garis putus-putus tengah.
  datar(k, m.marka, x0, 0.1, x1, 0.15, H.marka, 1);
  datar(k, m.marka, x0, JALAN.y1 - 0.15, x1, JALAN.y1 - 0.1, H.marka, 1);
  for (let x = x0; x < x1; x += 1.4) datar(k, m.marka, x, 1.275, x + 0.7, 1.325, H.marka, 1);

  // Median berkerb dengan rumput & semak, bukaan untuk kurva masuk/keluar.
  const potongan: [number, number][] = [];
  let mulai = x0;
  for (const [a, b] of BUKAAN_MEDIAN) {
    potongan.push([mulai, a]);
    mulai = b;
  }
  potongan.push([mulai, x1]);
  for (const [a, b] of potongan) {
    k.tambah(m.beton, uvDunia(kotak(a, MEDIAN.y0, b, MEDIAN.y1, 0, 0.07), SKALA_UV.beton));
    datar(k, m.rumputTaman, a + 0.05, MEDIAN.y0 + 0.06, b - 0.05, MEDIAN.y1 - 0.06, 0.072, SKALA_UV.rumput);
  }
  for (const [a, b] of BUKAAN_MEDIAN) datar(k, m.aspal, a, MEDIAN.y0, b, MEDIAN.y1, H.aspal, SKALA_UV.aspal);
  const acak = acakBerbenih(41);
  for (let x = JALAN.x0 + 1; x < JALAN.x1; x += 1.1) {
    if (BUKAAN_MEDIAN.some(([a, b]) => x > a - 0.5 && x < b + 0.5)) continue;
    const g = new THREE.IcosahedronGeometry(0.16 + acak() * 0.05, 1);
    g.scale(1.4, 0.7, 1);
    g.translate(x, 0.14, (MEDIAN.y0 + MEDIAN.y1) / 2);
    k.tambah(m.semak, g);
  }
}

function panah(k: Kumpulan, m: PustakaMaterial, x: number, y: number): void {
  const s = new THREE.Shape();
  s.moveTo(-0.5, -0.07);
  s.lineTo(0.1, -0.07);
  s.lineTo(0.1, -0.2);
  s.lineTo(0.5, 0);
  s.lineTo(0.1, 0.2);
  s.lineTo(0.1, 0.07);
  s.lineTo(-0.5, 0.07);
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2); // bentuk simetris, jadi pencerminan sumbu y tidak masalah
  g.translate(x, H.marka, y);
  k.tambah(m.marka, g, { bayangan: false });
}

function kompleks(k: Kumpulan, m: PustakaMaterial): void {
  // Lantai paving kompleks terminal.
  datar(k, m.paving, JALAN_DALAM.x0 - 0.4, MEDIAN.y1, JALAN_DALAM.x1 + 0.4, 17.6, H.lantai, SKALA_UV.paving);
  // Jalan dalam (sirkulasi + halte) dan jalur belok masuk/keluar ke jalan raya.
  datar(k, m.aspal, JALAN_DALAM.x0, JALAN_DALAM.y0, JALAN_DALAM.x1, JALAN_DALAM.y1, H.aspal, SKALA_UV.aspal);
  jalurBelok(k, m);
  for (let x = JALAN_DALAM.x0; x < JALAN_DALAM.x1; x += 1.2) datar(k, m.marka, x, 4.475, x + 0.6, 4.525, H.marka, 1);
  for (let x = JALAN_DALAM.x0 + 5; x < JALAN_DALAM.x1 - 3; x += 12) panah(k, m, x, LAJUR.sirkulasi);
  // Kotak halte kuning.
  for (const x of [...HALTE_DATANG_X, ...HALTE_BERANGKAT_X]) {
    const [a, b, c, d] = [x - 1.3, 4.58, x + 1.3, 5.5];
    datar(k, m.markaKuning, a, b, c, b + 0.05, H.marka, 1);
    datar(k, m.markaKuning, a, d - 0.05, c, d, H.marka, 1);
    datar(k, m.markaKuning, a, b, a + 0.05, d, H.marka, 1);
    datar(k, m.markaKuning, c - 0.05, b, c, d, H.marka, 1);
  }

  // Pangkalan: aspal, garis petak serong, panah lorong, pulau hijau.
  datar(k, m.aspalPangkalan, PANGKALAN.x0, PANGKALAN.y0, PANGKALAN.x1, PANGKALAN.y1, H.aspal, SKALA_UV.aspal);
  datar(k, m.aspalPangkalan, PANGKALAN.x1, PERON_BERANGKAT.y0, PERON_BERANGKAT.x0, PANGKALAN.y1, H.aspal, SKALA_UV.aspal);
  // Garis batas di kedua sisi tiap petak (pulau papan jurusan ikut terbingkai garis petak sebelahnya).
  const jarak = (PARKIR_SERONG.pusatX[1]! - PARKIR_SERONG.pusatX[0]!) / 2;
  const batas = [...new Set(PARKIR_SERONG.pusatX.flatMap((x) => [x - jarak, x + jarak]).map((x) => Math.round(x * 1000) / 1000))];
  for (const bx of batas) k.tambah(m.marka, bidangPutar(bx, PARKIR_SERONG.pusatY, 2.5, 0.05, PARKIR_SERONG.sudut, H.marka), { bayangan: false });
  for (let x = PARKIR_SERONG.pusatX[2]!; x < PANGKALAN.x1 - 3; x += 6) panah(k, m, x, LAJUR.lorong);
  k.tambah(m.beton, uvDunia(kotak(PANGKALAN.x0, 8.6, PANGKALAN.x0 + 1.4, PANGKALAN.y1, 0, 0.07), SKALA_UV.beton));
  datar(k, m.rumputTaman, PANGKALAN.x0 + 0.05, 8.65, PANGKALAN.x0 + 1.35, PANGKALAN.y1 - 0.05, 0.072, SKALA_UV.rumput);

  // Jalur pejalan kaki (zebra) dari peron kedatangan ke gerbang keluar pagar.
  for (let y = PERON.y1 + 0.2; y < Y_PAGAR - 0.3; y += 0.45) datar(k, m.marka, X_JALUR_KAKI - 0.34, y, X_JALUR_KAKI + 0.34, y + 0.2, H.marka, 1);
  // Lajur paving di depan fasad tempat antrean loket meluap keluar pintu masuk
  // (labirin antrean & loketnya ada di dalam aula, lihat gedung3d.ts).
  datar(k, m.pavingAntrean, 15.0, Y_LUAPAN - 0.28, PINTU_MASUK[0] + 0.7, Y_LUAPAN + 0.28, H.taman, SKALA_UV.paving);
}

/** Lebar aspal jalur belok masuk/keluar (bus 0,56 + ruang kiri-kanan). */
const LEBAR_JALUR_BELOK = 1.3;

/** Titik-titik sejajar lintasan, bergeser sejauh `jarak` ke samping (tanda menentukan sisi). */
function geserSisi(titik: readonly Titik2[], jarak: number): Titik2[] {
  return titik.map((p, i) => {
    const a = titik[Math.max(0, i - 1)]!;
    const b = titik[Math.min(titik.length - 1, i + 1)]!;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] - ((b[1] - a[1]) / d) * jarak, p[1] + ((b[0] - a[0]) / d) * jarak];
  });
}

/**
 * Jalur belok dari jalan raya ke jalan dalam (masuk, barat) dan dari jalan
 * dalam ke jalan raya (keluar, timur): aspal mengikuti lintasan bus lewat
 * bukaan median, berkerb di bagian yang keluar dari jalan dalam, dan ujung
 * lajur halte ditutup kerb. Bus tidak lagi melintas di atas paving/rumput.
 */
function jalurBelok(k: Kumpulan, m: PustakaMaterial): void {
  const setengah = LEBAR_JALUR_BELOK / 2;
  // Di luar jalan raya & jalan dalam (tempat kerb dipasang).
  const diLuar = (x: number, y: number): boolean => y > MEDIAN.y1 - 0.02 && (x < JALAN_DALAM.x0 || x > JALAN_DALAM.x1);
  for (const [dari, ke] of [
    [MASUK.dari, MASUK.ke],
    [KELUAR.dari, KELUAR.ke],
  ] as const) {
    // Sedikit diperpanjang lurus di kedua ujung supaya menyatu dengan lajurnya.
    const inti = lintasanS(dari, ke);
    const titik: Titik2[] = [[dari[0] - 0.6, dari[1]], ...inti, [ke[0] + 0.6, ke[1]]];
    k.tambah(m.aspal, uvDunia(pita(titik, LEBAR_JALUR_BELOK, H.aspal + 0.001), SKALA_UV.aspal), { bayangan: false });
    for (const sisi of [-1, 1]) {
      const tepi = geserSisi(titik, sisi * (setengah + 0.04));
      // Kerb hanya di ruas yang berada di luar jalan (di kompleks terminal).
      let ruas: Titik2[] = [];
      const tutup = (): void => {
        if (ruas.length >= 2) k.tambah(m.beton, uvDunia(pita(ruas, 0.08, 0.04), SKALA_UV.beton), { bayangan: false });
        ruas = [];
      };
      for (const t of tepi) {
        if (diLuar(t[0], t[1])) ruas.push(t);
        else tutup();
      }
      tutup();
    }
  }
  // Ujung lajur halte (di luar lintasan belok) ditutup kerb.
  for (const x of [JALAN_DALAM.x0, JALAN_DALAM.x1]) {
    k.tambah(m.beton, uvDunia(kotak(x - 0.04, LAJUR.halte - 0.35, x + 0.04, JALAN_DALAM.y1, 0, 0.05), SKALA_UV.beton), { bayangan: false });
  }
}

/** Peron kedatangan (peron keberangkatan menyatu dengan lantai ruang tunggu di gedung3d.ts). */
function peron(k: Kumpulan, m: PustakaMaterial): void {
  const p = PERON;
  k.tambah(m.peron, uvDunia(kotak(p.x0, p.y0, p.x1, p.y1, 0, TINGGI_PERON), SKALA_UV.peron));
  k.tambah(m.kontak, bayanganKontak(p.x0, p.y0, p.x1, p.y1, 0.2, 0.3), { bayangan: false, terimaBayangan: false });
  datar(k, m.taktil, p.x0, p.y0 + 0.03, p.x1, p.y0 + 0.16, TINGGI_PERON + 0.003, 1);
}

/** Taman kota: di belakang peron kedatangan dan di barat gedung utama (utara pangkalan). */
export const TAMAN: readonly { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }[] = [
  { x0: JALAN_DALAM.x0 + 0.4, y0: PERON.y1 + 0.9, x1: X_JALUR_KAKI - 0.5, y1: 17.2 },
  { x0: X_JALUR_KAKI + 0.5, y0: PANGKALAN.y1 + 0.35, x1: 10.2, y1: 17.2 },
];
/** Setapak berkelok di taman kedatangan: y di x tertentu. */
const ySetapak = (x: number): number => {
  const t = TAMAN[0]!;
  const u = (x - t.x0) / (t.x1 - t.x0);
  return (t.y0 + t.y1) / 2 + Math.sin(u * Math.PI * 2.4) * 2.4;
};

function taman(k: Kumpulan, m: PustakaMaterial): void {
  for (const t of TAMAN) datar(k, m.rumputTaman, t.x0, t.y0, t.x1, t.y1, H.taman, SKALA_UV.rumput);
  const t = TAMAN[0]!;
  const titik: Titik2[] = [];
  for (let x = t.x0 + 0.6; x <= t.x1 - 0.5; x += 0.2) titik.push([x, ySetapak(x)]);
  k.tambah(m.pavingMerah, pita(titik, 0.45, H.setapak, SKALA_UV.paving), { bayangan: false });
}

// ---------------------------------------------------------------------------
// Kota di seberang jalan

interface Bangunan {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly tinggi: number;
  readonly jenis: number;
}

const KOTA: readonly Bangunan[] = [
  { x0: -12, y0: -4.4, x1: -9.2, y1: -1.6, tinggi: 3.2, jenis: 0 },
  { x0: -8.4, y0: -3.6, x1: -5.8, y1: -1.5, tinggi: 2.3, jenis: 1 },
  { x0: -5.0, y0: -5.0, x1: -1.6, y1: -1.6, tinggi: 5.0, jenis: 2 },
  { x0: -0.8, y0: -3.4, x1: 2.2, y1: -1.4, tinggi: 1.9, jenis: 1 },
  { x0: 2.8, y0: -4.4, x1: 5.8, y1: -1.5, tinggi: 3.7, jenis: 0 },
  { x0: 13.4, y0: -3.6, x1: 16.2, y1: -1.5, tinggi: 2.8, jenis: 1 },
  { x0: 17.0, y0: -5.4, x1: 20.6, y1: -1.6, tinggi: 5.9, jenis: 2 },
  { x0: 21.4, y0: -3.8, x1: 24.0, y1: -1.5, tinggi: 2.5, jenis: 1 },
  { x0: 24.8, y0: -4.6, x1: 28.0, y1: -1.6, tinggi: 4.4, jenis: 0 },
  { x0: 28.8, y0: -3.4, x1: 31.4, y1: -1.4, tinggi: 2.1, jenis: 1 },
  { x0: 32.2, y0: -4.2, x1: 35.4, y1: -1.5, tinggi: 3.5, jenis: 0 },
  { x0: 36.2, y0: -3.6, x1: 39.0, y1: -1.5, tinggi: 2.9, jenis: 1 },
  { x0: 39.8, y0: -5.0, x1: 43.0, y1: -1.6, tinggi: 5.3, jenis: 2 },
  { x0: -18.5, y0: -4.0, x1: -13.2, y1: -1.5, tinggi: 2.6, jenis: 1 },
  { x0: 44.0, y0: -4.2, x1: 48.0, y1: -1.5, tinggi: 3.3, jenis: 0 },
  { x0: -24.0, y0: -4.6, x1: -20.4, y1: -1.6, tinggi: 4.1, jenis: 2 },
  { x0: -29.8, y0: -3.8, x1: -26.6, y1: -1.5, tinggi: 2.4, jenis: 1 },
  { x0: -35.0, y0: -4.4, x1: -31.2, y1: -1.6, tinggi: 3.6, jenis: 0 },
  { x0: 49.0, y0: -3.6, x1: 52.4, y1: -1.5, tinggi: 2.2, jenis: 1 },
  { x0: 53.4, y0: -5.2, x1: 57.2, y1: -1.6, tinggi: 5.6, jenis: 2 },
  { x0: 58.2, y0: -3.8, x1: 61.4, y1: -1.5, tinggi: 2.8, jenis: 0 },
];

/** Blok kota di belakang deretan tepi jalan (acak berbenih, tinggi bervariasi). */
function kotaBelakang(): Bangunan[] {
  const acak = acakBerbenih(83);
  const hasil: Bangunan[] = [];
  for (const [ya, yb, tMin, tMaks] of [
    [-8.6, -6.0, 1.6, 4.2],
    [-12.8, -9.8, 2.2, 7.5],
    [-17.5, -14.0, 1.8, 5.5],
  ] as const) {
    for (let x = -46; x < 72; ) {
      const w = 2.2 + acak() * 2.4;
      const d = (yb - ya) * (0.7 + acak() * 0.3);
      if (acak() > 0.12) hasil.push({ x0: x, y0: yb - d, x1: x + w, y1: yb, tinggi: tMin + acak() * (tMaks - tMin), jenis: Math.floor(acak() * 3) });
      x += w + 0.6 + acak() * 0.8;
    }
  }
  return hasil;
}

function kota(k: Kumpulan, m: PustakaMaterial): void {
  const acak = acakBerbenih(29);
  for (const b of [...KOTA, ...kotaBelakang()]) {
    // Badan gedung: sisi bertekstur jendela, atap beton + kotak mesin/tandon.
    const badan = uvDunia(kotak(b.x0, b.y0, b.x1, b.y1, 0, b.tinggi), SKALA_UV.kota);
    k.tambah(m.kontak, bayanganKontak(b.x0, b.y0, b.x1, b.y1, 0.45, 0.35), { bayangan: false, terimaBayangan: false });
    k.tambah(m.kotaFasad[b.jenis]!, badan);
    k.tambah(m.atapKota, uvDunia(kotak(b.x0 - 0.05, b.y0 - 0.05, b.x1 + 0.05, b.y1 + 0.05, b.tinggi, b.tinggi + 0.08), SKALA_UV.beton));
    for (let n = 0; n < 2; n++) {
      const x = b.x0 + 0.4 + acak() * (b.x1 - b.x0 - 1.0);
      const y = b.y0 + 0.4 + acak() * (b.y1 - b.y0 - 1.0);
      k.tambah(m.besiGelap, kotak(x, y, x + 0.4, y + 0.35, b.tinggi + 0.08, b.tinggi + 0.3));
    }
    // Lantai dasar: kanopi toko di sisi jalan.
    k.tambah(m.hijauGelap, kotak(b.x0 + 0.1, b.y1, b.x1 - 0.1, b.y1 + 0.35, 0.55, 0.6));
  }
  masjid(k, m, 7.2);
}

function masjid(k: Kumpulan, m: PustakaMaterial, x0: number): void {
  const x1 = x0 + 3.4;
  const [y0, y1] = [-4.6, -1.5];
  k.tambah(m.masjid, uvDunia(kotak(x0, y0, x1, y1, 0, 1.25), SKALA_UV.plester));
  k.tambah(m.kontak, bayanganKontak(x0, y0, x1, y1, 0.4, 0.33), { bayangan: false, terimaBayangan: false });
  k.tambah(m.masjid, uvDunia(kotak(x0 - 0.08, y0 - 0.08, x1 + 0.08, y1 + 0.08, 1.25, 1.35), SKALA_UV.plester));
  for (let i = 0; i < 4; i++) {
    const xa = x0 + 0.35 + i * 0.8;
    k.tambah(m.kaca, persegiTegak([xa, y1], [xa + 0.4, y1], 0.25, 0.95, { u0: 0, v0: 0, u1: 1, v1: 1 }));
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  k.tambah(m.masjid, silinder(cx, cy, 1.35, 1.6, 1.0, 1.0, 20));
  const kubah = new THREE.SphereGeometry(1.0, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  kubah.scale(1, 0.95, 1);
  kubah.translate(cx, 1.6, cy);
  k.tambah(m.kubah, kubah);
  k.tambah(m.emas, silinder(cx, cy, 2.55, 2.85, 0.03, 0.03, 6));
  const bulan = new THREE.SphereGeometry(0.07, 8, 6);
  bulan.translate(cx, 2.92, cy);
  k.tambah(m.emas, bulan);
  // Menara.
  const mx = x1 + 0.75;
  const my = -2.15;
  k.tambah(m.masjid, silinder(mx, my, 0, 5.0, 0.24, 0.2, 12));
  k.tambah(m.masjid, silinder(mx, my, 3.7, 3.85, 0.34, 0.34, 12));
  const puncak = new THREE.ConeGeometry(0.26, 0.8, 12);
  puncak.translate(mx, 5.4, my);
  k.tambah(m.kubah, puncak);
}

function palem(k: Kumpulan, m: PustakaMaterial): void {
  const acak = acakBerbenih(37);
  for (let x = -38; x < 62; x += 2.6) {
    const y = -0.5;
    const tinggi = 2.0 + acak() * 0.5;
    const miring = (acak() - 0.5) * 0.12;
    const batang = new THREE.CylinderGeometry(0.045, 0.07, tinggi, 7);
    batang.translate(0, tinggi / 2, 0);
    batang.rotateZ(miring);
    batang.translate(x, 0, y);
    k.tambah(m.batang, batang);
    const puncak = new THREE.Vector3(-Math.sin(miring) * tinggi, Math.cos(miring) * tinggi, 0).add(v3(x, y));
    const jumlah = 8;
    for (let i = 0; i < jumlah; i++) {
      const a = (i / jumlah) * Math.PI * 2 + acak() * 0.4;
      const pelepah = new THREE.PlaneGeometry(0.34, 1.3, 1, 3);
      // Lengkungkan pelepah: ujung melorot ke bawah.
      const pos = pelepah.getAttribute('position');
      for (let j = 0; j < pos.count; j++) {
        const t = (pos.getY(j) + 0.65) / 1.3;
        pos.setZ(j, -t * t * 0.55);
      }
      pelepah.computeVertexNormals();
      pelepah.translate(0, 0.65, 0);
      pelepah.rotateX(-Math.PI / 2 + 0.55); // condong ke luar
      pelepah.rotateY(a);
      pelepah.translate(puncak.x, puncak.y, puncak.z);
      k.tambah(m.pelepah, pelepah, { materialKedalaman: m.pelepahKedalaman });
    }
  }
}

/** Bilangan semu 0..1 dari posisi: verteks yang berimpit (geometri non-indexed) mendapat nilai sama. */
function hashPosisi(x: number, y: number, z: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

/** Pohon rindang: batang + 2–3 bola daun bergerigi dengan variasi hijau (vertex color). */
function pohon(k: Kumpulan, m: PustakaMaterial, x: number, y: number, skala: number, acak: () => number): void {
  k.tambah(m.batang, silinder(x, y, 0, 0.55 * skala, 0.06 * skala, 0.045 * skala, 6));
  const hijau = new THREE.Color().setHSL(0.26 + acak() * 0.06, 0.45 + acak() * 0.15, 0.26 + acak() * 0.08);
  const jumlah = 2 + Math.floor(acak() * 2);
  for (let i = 0; i < jumlah; i++) {
    const r = (0.36 + acak() * 0.16) * skala;
    const g = new THREE.IcosahedronGeometry(r, 1);
    const pos = g.getAttribute('position');
    const benih = acak() * 10;
    for (let j = 0; j < pos.count; j++) {
      // Gerigi dari hash posisi (bukan acak per verteks) supaya permukaan tidak retak.
      const f = 1 + (hashPosisi(pos.getX(j) + benih, pos.getY(j), pos.getZ(j)) - 0.5) * 0.3;
      pos.setXYZ(j, pos.getX(j) * f, pos.getY(j) * f * 0.85, pos.getZ(j) * f);
    }
    g.computeVertexNormals();
    const ox = (acak() - 0.5) * 0.35 * skala;
    const oy = (acak() - 0.5) * 0.35 * skala;
    g.translate(x + ox, (0.75 + i * 0.18 + acak() * 0.1) * skala, y + oy);
    const warna = new Float32Array(pos.count * 3);
    for (let j = 0; j < pos.count; j++) {
      // Lebih terang di atas (cahaya langit), gelap di bawah.
      const p = g.getAttribute('position');
      const t = 0.8 + (p.getY(j) - 0.75 * skala) * 0.5 + (hashPosisi(p.getX(j), p.getY(j) * 3, p.getZ(j)) - 0.5) * 0.14;
      warna[j * 3] = hijau.r * t;
      warna[j * 3 + 1] = hijau.g * t;
      warna[j * 3 + 2] = hijau.b * t;
    }
    g.setAttribute('color', new THREE.BufferAttribute(warna, 3));
    k.tambah(m.daun, g);
  }
}

function pepohonan(k: Kumpulan, m: PustakaMaterial): void {
  const acak = acakBerbenih(5);
  // Taman rimbun (hindari setapak di taman kedatangan dan tepi taman).
  TAMAN.forEach((t, i) => {
    for (let x = t.x0 + 0.6; x < t.x1 - 0.4; x += 1.35) {
      for (let y = t.y0 + 0.7; y < t.y1 - 0.3; y += 1.5) {
        const px = x + (acak() - 0.5) * 0.6;
        const py = y + (acak() - 0.5) * 0.6;
        if (i === 0 && Math.abs(py - ySetapak(px)) < 0.8) continue;
        // Tidak di atas/menempel sayap barat gedung utama (toilet & musholla).
        const S = SAYAP_BARAT;
        if (px > S.x0 - 0.7 && py > S.y0 - 0.7 && py < S.y1 + 0.5) continue;
        pohon(k, m, px, py, 0.85 + acak() * 0.35, acak);
      }
    }
  });
  const tunggal: readonly Titik2[] = [
    [RUANG_TUNGGU.x1 + 1.6, 8.2],
    [RUANG_TUNGGU.x1 + 1.5, 11.0],
    [22.0, 16.8],
    [RUANG_TUNGGU.x1 + 2.4, 13.8],
  ];
  for (const [x, y] of tunggal) pohon(k, m, x, y, 1.0 + acak() * 0.3, acak);
  // Semak rendah di depan dinding kaca ruang tunggu (pohon tinggi akan menutupi isinya).
  for (let x = RUANG_TUNGGU.x0 + 0.46; x < RUANG_TUNGGU.x1 - 0.1; x += 0.62) {
    const g = new THREE.IcosahedronGeometry(0.13 + acak() * 0.04, 1);
    g.scale(1.3, 0.75, 1);
    g.translate(x + (acak() - 0.5) * 0.15, 0.1, 13.35);
    k.tambah(m.semak, g);
  }
}

// ---------------------------------------------------------------------------
// Lampu, gapura, pos, warung, perabot

function lampuJalan(k: Kumpulan, m: PustakaMaterial, x: number, y: number, arah: number): void {
  k.tambah(m.besiGelap, silinder(x, y, 0, 1.8, 0.035, 0.025, 8));
  const lengan = new THREE.BoxGeometry(0.03, 0.03, 0.55);
  lengan.translate(x, 1.78, y + (arah * 0.55) / 2);
  k.tambah(m.besiGelap, lengan);
  k.tambah(m.besiGelap, kotak(x - 0.06, y + arah * 0.45, x + 0.06, y + arah * 0.62, 1.74, 1.8));
  k.tambah(m.lampuMenyala, kotak(x - 0.05, y + arah * 0.46, x + 0.05, y + arah * 0.61, 1.73, 1.74), { bayangan: false });
}

function lampuTaman(k: Kumpulan, m: PustakaMaterial, x: number, y: number): void {
  k.tambah(m.besiGelap, silinder(x, y, 0, 0.85, 0.025, 0.02, 8));
  k.tambah(m.lampuMenyala, kotak(x - 0.05, y - 0.05, x + 0.05, y + 0.05, 0.85, 0.98), { bayangan: false });
  const topi = new THREE.ConeGeometry(0.09, 0.07, 4);
  topi.rotateY(Math.PI / 4);
  topi.translate(x, 1.015, y);
  k.tambah(m.besiGelap, topi);
}

/** Lampu jalan di tepi median (tidak di bukaan masuk/keluar). */
export const LAMPU_JALAN_X: readonly number[] = [-40, -34, -22, -14, -6, 2, 10, 18, 26, 34, 42, 48, 60, 66];
const Y_LAMPU_JALAN = 3.3;
const LAMPU_TAMAN: readonly Titik2[] = [
  [SAYAP_BARAT.x0 - 0.45, 11.0],
  [20.45, 16.95],
  [28.6, 10.3],
  [RUANG_TUNGGU.x1 + 0.6, 9.6],
  [12.9, 17.2],
  [25.6, 16.9],
  // Taman kedatangan, di tepi setapak.
  [-22.5, 9.0],
  [-16.5, 16.6],
  [-10.5, 9.0],
];
/** Lampu sorot di atap pos cuci, menerangi pangkalan di malam hari. */
const LAMPU_POS_CUCI: Titik2 = [(POS_CUCI.x0 + POS_CUCI.x1) / 2, POS_CUCI.y1 + 0.02];

/** Titik genangan cahaya malam di tanah (x, y, jari-jari) di bawah tiap lampu. */
export const TITIK_LAMPU: readonly TitikCahaya[] = [
  // Kepala lampu jalan menjorok 0,535 ke arah jalan dalam.
  ...LAMPU_JALAN_X.map((x): TitikCahaya => ({ x, y: Y_LAMPU_JALAN + 0.535, r: 1.7 })),
  ...LAMPU_TAMAN.map(([x, y]): TitikCahaya => ({ x, y, r: 0.85 })),
  { x: LAMPU_POS_CUCI[0] - 1.2, y: LAMPU_POS_CUCI[1] + 0.9, r: 2.2 },
];

function lampu(k: Kumpulan, m: PustakaMaterial): void {
  for (const x of LAMPU_JALAN_X) lampuJalan(k, m, x, Y_LAMPU_JALAN, 1);
  for (const [x, y] of LAMPU_TAMAN) lampuTaman(k, m, x, y);
}


/**
 * Kelompok jurusan di pangkalan: tanda lantai berwarna di ujung belakang tiap
 * petak, dan di awal tiap kelompok sebuah pulau taman bertiang dengan papan
 * jurusan bersilang (empat muka: terbaca dari arah kamera mana pun),
 * menjulang di atas atap bus sehingga tidak tertutup bus maupun gedung.
 */
function kelompokJurusan(k: Kumpulan, m: PustakaMaterial): void {
  const { pusatY, sudut } = PARKIR_SERONG;
  const c = Math.cos(sudut);
  const sn = Math.sin(sudut);
  KELOMPOK_PARKIR.forEach((g, i) => {
    const warna = m.kelompokParkir[i]!;
    for (const petak of g.petak) {
      const sx = PARKIR_SERONG.pusatX[petak]!;
      // Pita berwarna di ujung belakang petak (sisi lajur halte).
      k.tambah(warna, bidangPutar(sx - 1.0 * c, pusatY - 1.0 * sn, 0.3, 0.6, sudut, H.marka + 0.001), { bayangan: false });
    }
    const px = PULAU_JURUSAN[i]!;
    // Pulau taman berkerb sejajar petak.
    const kerb = new THREE.BoxGeometry(2.1, 0.08, 0.5);
    kerb.rotateY(-sudut);
    kerb.translate(px, 0.04, pusatY);
    k.tambah(m.beton, uvDunia(kerb, SKALA_UV.beton));
    k.tambah(m.rumputTaman, bidangPutar(px, pusatY, 1.98, 0.4, sudut, 0.082), { bayangan: false });
    for (const u of [-0.7, 0.7]) {
      const semak = new THREE.IcosahedronGeometry(0.14, 1);
      semak.scale(1.2, 0.8, 1.2);
      semak.translate(px + u * c, 0.17, pusatY + u * sn);
      k.tambah(m.semak, semak);
    }
    // Tiang & papan bersilang serong 45°: satu sejajar petak, satu tegak lurus petak (menghadap
    // kamera awal). Tiap papan bertulisan di kedua muka, jadi terbaca dari arah kamera mana pun.
    const { bawah, atas, lebar } = PAPAN_JURUSAN;
    k.tambah(m.besiGelap, silinder(px, pusatY, 0.08, atas + 0.06, 0.05, 0.045, 8));
    // Tulisan (nama jurusan / SEGERA DIBUKA) di papan-jurusan3d.ts, mengikuti jurusan yang dibuka.
    for (const putar of [-sudut, sudut]) {
      const badan = new THREE.BoxGeometry(lebar, atas - bawah + 0.06, 0.05);
      badan.rotateY(putar);
      badan.translate(px, (atas + bawah) / 2, pusatY);
      k.tambah(warna, badan);
    }
  });
}

/**
 * Pencucian bus di pangkalan: saluran air di bawah tiap petak parkir, dan pos
 * cuci (gudang sabun berpapan "CUCI BUS", tandon air di atap, gulungan selang,
 * lampu sorot) di ujung timur pangkalan.
 */
function pencucian(k: Kumpulan, m: PustakaMaterial): void {
  // Saluran air (kisi gelap) di sepanjang sumbu tiap petak.
  for (const sx of PARKIR_SERONG.pusatX) k.tambah(m.besiGelap, bidangPutar(sx, PARKIR_SERONG.pusatY, 1.9, 0.07, PARKIR_SERONG.sudut, H.marka + 0.002), { bayangan: false });
  const P = POS_CUCI;
  const h = 0.62;
  k.tambah(m.plester, uvDunia(kotak(P.x0, P.y0, P.x1, P.y1, 0, h), SKALA_UV.plester));
  k.tambah(m.kontak, bayanganKontak(P.x0, P.y0, P.x1, P.y1, 0.25, 0.35), { bayangan: false, terimaBayangan: false });
  k.tambah(m.biruPos, kotak(P.x0 - 0.08, P.y0 - 0.08, P.x1 + 0.08, P.y1 + 0.08, h, h + 0.06));
  // Pintu gulung & papan nama menghadap selatan (ke kamera).
  k.tambah(m.besiGelap, persegiTegak([P.x0 + 0.15, P.y1], [P.x0 + 0.55, P.y1], 0, 0.42, { u0: 0, v0: 0, u1: 1, v1: 1 }));
  const papan = m.teks('CUCI BUS', { lebar: 256, tinggi: 72, latar: '#0e7490', warna: '#ffffff', ukuranHuruf: 44 });
  k.tambah(papan.material, persegiTegak([P.x0 + 0.1, P.y1], [P.x1 - 0.1, P.y1], h - 0.2, h - 0.02, papan.uv, 0.006), { bayangan: false });
  // Tandon air di atap.
  const cx = (P.x0 + P.x1) / 2 + 0.15;
  const cy = (P.y0 + P.y1) / 2 - 0.1;
  for (const [dx, dy] of [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ] as const) {
    k.tambah(m.besi, silinder(cx + dx, cy + dy, h + 0.06, h + 0.24, 0.012, 0.012, 5));
  }
  k.tambah(m.biruPos, silinder(cx, cy, h + 0.24, h + 0.56, 0.26, 0.26, 16));
  // Gulungan selang di dinding timur, keran di sampingnya.
  const selang = new THREE.TorusGeometry(0.1, 0.028, 6, 14);
  selang.rotateY(Math.PI / 2);
  selang.translate(P.x1 + 0.04, 0.32, (P.y0 + P.y1) / 2);
  k.tambah(m.hijauGelap, selang);
  k.tambah(m.besi, silinder(P.x1 + 0.06, P.y0 + 0.2, 0, 0.28, 0.02, 0.02, 6));
  // Lampu sorot di tepi atap, menghadap pangkalan.
  const [lx, ly] = LAMPU_POS_CUCI;
  k.tambah(m.besiGelap, kotak(lx - 0.1, ly - 0.02, lx + 0.1, ly + 0.08, h - 0.02, h + 0.06));
  k.tambah(m.lampuMenyala, kotak(lx - 0.08, ly + 0.08, lx + 0.08, ly + 0.09, h - 0.01, h + 0.05), { bayangan: false });
}

function gapura(k: Kumpulan, m: PustakaMaterial): void {
  const y = (MEDIAN.y0 + MEDIAN.y1) / 2;
  const pasang = (xKiri: number, xKanan: number, tulisan: string): void => {
    for (const x of [xKiri, xKanan]) {
      k.tambah(m.bata, uvDunia(kotak(x - 0.25, y - 0.25, x + 0.25, y + 0.25, 0, 2.5), SKALA_UV.bata));
      k.tambah(m.plester, uvDunia(kotak(x - 0.32, y - 0.32, x + 0.32, y + 0.32, 2.5, 2.62), SKALA_UV.plester));
    }
    k.tambah(m.hijauGelap, kotak(xKiri + 0.25, y - 0.16, xKanan - 0.25, y + 0.16, 2.02, 2.46));
    const mat = m.teks(tulisan, { lebar: 1024, tinggi: 96, latar: '#2f5d50', warna: '#fef3c7', ukuranHuruf: 58 });
    k.tambah(mat.material, persegiTegak([xKiri + 0.3, y + 0.16], [xKanan - 0.3, y + 0.16], 2.04, 2.44, mat.uv), { bayangan: false });
  };
  pasang(BUKAAN_MEDIAN[0]![0] - 0.3, BUKAAN_MEDIAN[0]![1] + 0.3, 'SELAMAT DATANG · TERMINAL');
  pasang(BUKAAN_MEDIAN[1]![0] - 0.3, BUKAAN_MEDIAN[1]![1] + 0.3, 'HATI-HATI DI JALAN');
}

function posRetribusi(k: Kumpulan, m: PustakaMaterial): void {
  const P = POS_RETRIBUSI;
  k.tambah(m.plester, uvDunia(kotak(P.x0, P.y0, P.x1, P.y1, 0, 0.72), SKALA_UV.plester));
  k.tambah(m.kontak, bayanganKontak(P.x0, P.y0, P.x1, P.y1, 0.25, 0.32), { bayangan: false, terimaBayangan: false });
  const penuh = { u0: 0, v0: 0, u1: 1, v1: 1 };
  k.tambah(m.kaca, persegiTegak([P.x0 + 0.1, P.y1], [P.x1 - 0.1, P.y1], 0.34, 0.62, penuh));
  k.tambah(m.kaca, persegiTegak([P.x1, P.y1 - 0.1], [P.x1, P.y0 + 0.1], 0.34, 0.62, penuh));
  k.tambah(m.biruPos, kotak(P.x0 - 0.14, P.y0 - 0.14, P.x1 + 0.14, P.y1 + 0.14, 0.72, 0.8));
  const tulisan = m.teks('POS', { lebar: 128, tinggi: 48, latar: '#1d4ed8', warna: '#ffffff', ukuranHuruf: 34 });
  k.tambah(tulisan.material, persegiTegak([P.x1 + 0.14, P.y1], [P.x1 + 0.14, P.y0], 0.72, 0.8, tulisan.uv, 0.003), { bayangan: false });
  k.tambah(m.marka, kotak(P.x0 - 0.02, P.y1, P.x0 + 0.6, P.y1 + 0.06, 0.4, 0.44)); // palang
}

function bangku(k: Kumpulan, m: PustakaMaterial, x: number, y: number): void {
  k.tambah(m.kayu, kotak(x - 0.24, y - 0.05, x + 0.24, y + 0.06, 0.085, 0.1));
  k.tambah(m.kayu, kotak(x - 0.24, y - 0.07, x + 0.24, y - 0.055, 0.12, 0.2));
  for (const dx of [-0.2, 0.2]) k.tambah(m.besiGelap, kotak(x + dx - 0.012, y - 0.06, x + dx + 0.012, y + 0.05, 0, 0.2));
}

function tong(k: Kumpulan, m: PustakaMaterial, x: number, y: number, h0 = 0, warna: THREE.Material = m.besiGelap): void {
  k.tambah(warna, silinder(x, y, h0, h0 + 0.17, 0.05, 0.055, 10));
}

/** Mesin tiket mandiri: badan, layar gelap menghadap +y, atap kecil (dipasang lewat modernisasi). */
export function mesinTiket(k: Kumpulan, m: PustakaMaterial, x: number, y: number, badan: THREE.Material): void {
  k.tambah(badan, kotak(x - 0.07, y - 0.05, x + 0.07, y + 0.05, 0.012, 0.3));
  k.tambah(m.kaca, persegiTegak([x - 0.05, y + 0.05], [x + 0.05, y + 0.05], 0.17, 0.26, { u0: 0, v0: 0, u1: 1, v1: 1 }));
  k.tambah(m.besiGelap, kotak(x - 0.035, y + 0.05, x + 0.035, y + 0.07, 0.1, 0.13));
  k.tambah(m.besiGelap, kotak(x - 0.08, y - 0.06, x + 0.08, y + 0.08, 0.3, 0.32));
}

/** Papan jadwal di dua tiang. */
function papanInfo(k: Kumpulan, m: PustakaMaterial, x: number, y: number): void {
  for (const dx of [-0.2, 0.2]) k.tambah(m.besiGelap, silinder(x + dx, y, 0.012, 0.42, 0.012, 0.012, 6));
  k.tambah(m.biruPos, kotak(x - 0.24, y - 0.02, x + 0.24, y + 0.015, 0.16, 0.44));
  const papan = m.teks('JADWAL BUS', { lebar: 256, tinggi: 144, latar: '#0f172a', warna: '#fbbf24', ukuranHuruf: 40, garisTepi: '#1d4ed8' });
  k.tambah(papan.material, persegiTegak([x - 0.22, y + 0.016], [x + 0.22, y + 0.016], 0.18, 0.42, papan.uv), { bayangan: false });
}

/** Mobil golf petugas: bak, jok, atap di empat tiang, roda. */
function mobilGolf(k: Kumpulan, m: PustakaMaterial, x: number, y: number, badan: THREE.Material): void {
  k.tambah(badan, kotak(x - 0.24, y - 0.12, x + 0.24, y + 0.12, 0.05, 0.14));
  k.tambah(m.besiGelap, kotak(x - 0.12, y - 0.1, x + 0.02, y + 0.1, 0.14, 0.2));
  k.tambah(m.besiGelap, kotak(x - 0.14, y - 0.1, x - 0.1, y + 0.1, 0.2, 0.3));
  for (const dx of [-0.2, 0.18]) for (const dy of [-0.1, 0.1]) k.tambah(m.besi, silinder(x + dx, y + dy, 0.14, 0.44, 0.008, 0.008, 5));
  k.tambah(m.plester, kotak(x - 0.26, y - 0.13, x + 0.22, y + 0.13, 0.44, 0.47));
  for (const dx of [-0.16, 0.16]) {
    for (const dy of [-0.125, 0.125]) {
      const roda = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10);
      roda.rotateX(Math.PI / 2);
      roda.translate(x + dx, 0.057, y + dy);
      k.tambah(m.besiGelap, roda);
    }
  }
}

/** Anjing kecil cokelat: badan, kepala, telinga, kaki, ekor. */
function anjing(k: Kumpulan, m: PustakaMaterial, x: number, y: number): void {
  k.tambah(m.bulu, kotak(x - 0.06, y - 0.022, x + 0.05, y + 0.022, 0.05, 0.095));
  k.tambah(m.bulu, kotak(x + 0.04, y - 0.02, x + 0.085, y + 0.02, 0.08, 0.12));
  k.tambah(m.kayu, kotak(x + 0.075, y - 0.012, x + 0.1, y + 0.012, 0.085, 0.105));
  for (const dx of [-0.045, 0.035]) for (const dy of [-0.014, 0.014]) k.tambah(m.bulu, kotak(x + dx - 0.007, y + dy - 0.007, x + dx + 0.007, y + dy + 0.007, 0.012, 0.055));
  k.tambah(m.bulu, kotak(x - 0.085, y - 0.006, x - 0.055, y + 0.006, 0.085, 0.1));
}

function perabot(k: Kumpulan, m: PustakaMaterial): void {
  bangku(k, m, 23.6, 16.7);
  bangku(k, m, 21.0, 16.7);
  // Mesin tiket mandiri tampil setelah modernisasi (modernisasi3d.ts).
  papanInfo(k, m, 12.55, 15.62);
  mobilGolf(k, m, 27.4, 15.95, m.plester);
  mobilGolf(k, m, 28.9, 15.7, m.biruPos);
  anjing(k, m, 9.7, 14.6);
  airMancur(k, m, 24.9, 16.45);
  tong(k, m, 22.3, 16.9);
  tong(k, m, 26.0, 15.6, 0, m.hijauGelap);
  tong(k, m, PERON.x0 + 0.3, PERON.y1 - 0.2, TINGGI_PERON);
  tong(k, m, PERON_BERANGKAT.x0 + 0.45, PERON_BERANGKAT.y1 - 0.18, TINGGI_PERON);
  // Rambu halte di ujung depan peron kedatangan.
  for (const p of [PERON]) {
    const x = p.x1 - 0.3;
    const y = p.y0 + 0.2;
    k.tambah(m.besiGelap, silinder(x, y, TINGGI_PERON, TINGGI_PERON + 0.75, 0.018, 0.018, 6));
    const tulisan = m.teks('BUS', { lebar: 128, tinggi: 128, latar: '#1d4ed8', warna: '#ffffff', ukuranHuruf: 52, garisTepi: '#ffffff' });
    k.tambah(tulisan.material, persegiTegak([x - 0.12, y + 0.02], [x + 0.12, y + 0.02], TINGGI_PERON + 0.55, TINGGI_PERON + 0.79, tulisan.uv), { bayangan: false });
  }
  // Papan nama pangkalan.
  const [px, py] = [PANGKALAN.x0 + 0.7, 9.4];
  k.tambah(m.besiGelap, silinder(px, py, 0.07, 1.0, 0.025, 0.025, 6));
  k.tambah(m.biruPos, kotak(px - 0.7, py - 0.03, px + 0.7, py + 0.03, 1.0, 1.4));
  const tulisan = m.teks('PANGKALAN BUS', { lebar: 512, tinggi: 144, latar: '#1d4ed8', warna: '#ffffff', ukuranHuruf: 66 });
  k.tambah(tulisan.material, persegiTegak([px - 0.68, py + 0.03], [px + 0.68, py + 0.03], 1.02, 1.38, tulisan.uv), { bayangan: false });
}

/** Air mancur bundar di plaza: kolam berbibir batu, air, tiang tengah bertingkat, semburan. */
function airMancur(k: Kumpulan, m: PustakaMaterial, x: number, y: number): void {
  k.tambah(m.batu, silinder(x, y, 0, 0.13, 0.62, 0.62, 28));
  k.tambah(m.kontak, bayanganKontak(x - 0.62, y - 0.62, x + 0.62, y + 0.62, 0.2, 0.3), { bayangan: false, terimaBayangan: false });
  k.tambah(m.air, silinder(x, y, 0.13, 0.135, 0.55, 0.55, 28), { bayangan: false });
  k.tambah(m.batu, silinder(x, y, 0.13, 0.42, 0.07, 0.09, 12));
  k.tambah(m.batu, silinder(x, y, 0.42, 0.45, 0.22, 0.22, 16));
  k.tambah(m.air, silinder(x, y, 0.45, 0.452, 0.19, 0.19, 16), { bayangan: false });
  k.tambah(m.batu, silinder(x, y, 0.45, 0.6, 0.03, 0.04, 8));
  const semburan = new THREE.ConeGeometry(0.1, 0.34, 10, 1, true);
  semburan.rotateX(Math.PI);
  semburan.translate(x, 0.72, y);
  k.tambah(m.percikan, semburan, { bayangan: false, terimaBayangan: false, urutan: 2 });
}

/** Tiang bendera merah putih; kain dikembalikan supaya bisa dikibarkan tiap frame. */
function bendera(k: Kumpulan, m: PustakaMaterial): THREE.Mesh {
  const [fx, fy] = [12.2, 16.8];
  k.tambah(m.batu, uvDunia(kotak(fx - 0.2, fy - 0.2, fx + 0.2, fy + 0.2, 0, 0.1), SKALA_UV.beton));
  k.tambah(m.besi, silinder(fx, fy, 0.1, 2.5, 0.02, 0.014, 8));
  const kain = new THREE.PlaneGeometry(0.6, 0.4, 10, 1);
  kain.translate(0.3, 0, 0);
  const mesh = new THREE.Mesh(kain, m.bendera);
  mesh.position.set(fx + 0.015, 2.28, fy);
  mesh.rotation.y = -Math.PI / 4;
  mesh.castShadow = true;
  return mesh;
}

/** Kibaran bendera: gelombang sinus sepanjang kain, makin besar ke ujung. */
export function kibarkan(bendera: THREE.Mesh, waktu: number): void {
  const pos = (bendera.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, Math.sin(x * 9 - waktu * 5) * 0.05 * (x / 0.6));
  }
  pos.needsUpdate = true;
}

