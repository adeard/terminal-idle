/**
 * Sayap 2 Lantai di adegan (murni, tanpa three.js; lihat documents/16 bagian 4,
 * 5, 9): keadaan bangunan menurut tahap perluasan, fase proyeknya, unit lantai 2
 * yang terlihat (jendela ke-9…24, blok kursi ke-5…8, kios teras), dan rute putar
 * pengunjung yang naik & turun lewat tangga. Pengunjung ini bukan penumpang
 * DuniaVisual: rutenya tetap dan hanya tampilan, arus keramaian tetap dari
 * jendela 1–8 di aula.
 */
import type { JumlahBangunan } from '../sim/bangunan';
import { dalamRentang, JAM_LOKET_MALAM, tokoBuka } from './kehidupan-malam';
import { BLOK_KURSI, H_LANTAI_2, H_PLAZA, KECEPATAN_JALAN, LOKET_L2, MEJA_L2, MEJA_TERAS, BLOK_KURSI_L2, KIOS_TERAS, TANGGA, TOKO_AULA, X_LOKET } from './tata-letak';

/** Tahap perluasan yang membangun Sayap 2 Lantai (1-based). */
export const TAHAP_SAYAP = 3;

export type KeadaanSayap = 'lahan' | 'proyek' | 'berdiri';

/** Lahan masih taman & ruko; proyek sedang berjalan; atau gedungnya berdiri (termasuk tahap 4–5). */
export function keadaanSayap(perluasan: number, proyekDetik: number): KeadaanSayap {
  if (perluasan >= TAHAP_SAYAP) return 'berdiri';
  return perluasan === TAHAP_SAYAP - 1 && proyekDetik > 0 ? 'proyek' : 'lahan';
}

/** Fase bangunan selama proyek: sisa > 2/3 fondasi, sisa > 1/3 rangka lantai dasar & pelat, sisanya rangka lantai 2. Percepat proyek cukup melompati fasenya. */
export function faseProyekSayap(proyekDetik: number, detikProyek: number): 0 | 1 | 2 {
  const sisa = detikProyek > 0 ? proyekDetik / detikProyek : 0;
  if (sisa > 2 / 3) return 0;
  return sisa > 1 / 3 ? 1 : 2;
}

// ---------------------------------------------------------------------------
// Unit lantai 2

/** Urutan blok kursi lantai 2 dipasang (indeks BLOK_KURSI_L2): dari yang paling terlihat kamera, B8, B6, B7, B5. */
const URUTAN_BLOK_L2: readonly number[] = [3, 1, 2, 0];

export interface IsiLantai2 {
  /** Jendela lantai 2 yang sudah dibangun: indeks LOKET_L2 0 … jendela − 1. */
  readonly jendela: number;
  /** Jendela lantai 2 yang disewa mitra PO: indeks 0 … disewa − 1. */
  readonly disewa: number;
  /** Indeks LOKET_L2 yang melayani sekarang (malam hari separuhnya tutup, seperti loketBuka). */
  readonly buka: readonly number[];
  /** Blok kursi lantai 2 yang terpasang, per indeks BLOK_KURSI_L2. */
  readonly blokKursi: readonly boolean[];
  /** Kios teras yang sudah dibangun: indeks KIOS_TERAS 0 … kios − 1. */
  readonly kios: number;
  /** Kios teras yang buka sekarang (malam hari tutup, seperti kios ruang tunggu). */
  readonly kiosBuka: number;
}

/** Di malam hari tetap buka paling sedikit sekian jendela (kalau jendelanya ada), sama dengan loketBuka. */
const MIN_LOKET_MALAM = 2;

const jepit = (n: number, maks: number): number => Math.max(0, Math.min(maks, Math.floor(n)));

/** Hasil isiLantai2 yang sudah pernah dihitung: dipanggil tiap frame tanpa alokasi, dan hasil yang sama adalah objek yang sama. */
const CACHE_ISI = new Map<number, IsiLantai2>();

/**
 * Unit lantai 2 yang terlihat menurut bangunan yang dibangun, loket yang disewa,
 * dan jam. Jendela 1–8 tetap di aula, jadi jendela lantai 2 baru mulai dari unit
 * ke-9; blok kursi 1–4 tetap di ruang tunggu, toko 1–2 tetap di aula.
 */
export function isiLantai2(b: Pick<JumlahBangunan, 'jendela' | 'kursi' | 'toko'>, loketTerisi: number, jam: number): IsiLantai2 {
  const jendela = jepit(b.jendela - X_LOKET.length, LOKET_L2.length);
  const disewa = Math.min(jendela, jepit(loketTerisi - X_LOKET.length, LOKET_L2.length));
  const kursi = jepit(b.kursi - BLOK_KURSI.length, BLOK_KURSI_L2.length);
  const kios = jepit(b.toko - TOKO_AULA.length, KIOS_TERAS.length);
  const malam = dalamRentang(jam, JAM_LOKET_MALAM) ? 1 : 0;
  const kiosBuka = tokoBuka('kios', jam) ? kios : 0;
  const kunci = jendela + 17 * (disewa + 17 * (kursi + 5 * (kios + 3 * (kiosBuka + 3 * malam))));
  let isi = CACHE_ISI.get(kunci);
  if (!isi) {
    const n = malam === 1 ? Math.min(disewa, Math.max(MIN_LOKET_MALAM, Math.ceil(disewa / 2))) : disewa;
    const blokKursi = BLOK_KURSI_L2.map(() => false);
    for (const i of URUTAN_BLOK_L2.slice(0, kursi)) blokKursi[i] = true;
    isi = { jendela, disewa, buka: Array.from({ length: n }, (_, i) => i), blokKursi, kios, kiosBuka };
    CACHE_ISI.set(kunci, isi);
  }
  return isi;
}

/**
 * Keadaan jendela lantai 2 (bagian 5):
 * - belum: dinding polos;
 * - kosong: dibangun tapi belum disewa, papan redup, pintu gulung TUTUP;
 * - tutupMalam: disewa tapi tutup malam ini, papan menyala, pintu gulung TUTUP;
 * - buka: papan menyala, petugas & pembeli.
 */
export type KeadaanJendelaL2 = 'belum' | 'kosong' | 'tutupMalam' | 'buka';

export function keadaanJendelaL2(i: number, isi: IsiLantai2): KeadaanJendelaL2 {
  if (i >= isi.jendela) return 'belum';
  if (i >= isi.disewa) return 'kosong';
  return isi.buka.includes(i) ? 'buka' : 'tutupMalam';
}

/** Keramaian minimal orang diam ke-i di lantai 2 terlihat: menyebar 0,12–0,82, jadi saat sepi tinggal sebagian kecil. */
export const ambangOrangL2 = (i: number): number => 0.12 + 0.7 * ((i * 0.6180339887 + 0.3) % 1);

/** Keramaian dibulatkan ke 1/20: orang diam lantai 2 hanya ditukar saat tingkat ini berganti, bukan tiap frame. */
export const tingkatKeramaian = (keramaian: number): number => Math.round(keramaian * 20) / 20;

// ---------------------------------------------------------------------------
// Pengunjung lantai 2 (rute putar)

/** Banyaknya pengunjung paling banyak; rute & tempat duduknya sudah disiapkan untuk sebanyak ini. */
export const MAKS_PENGUNJUNG = 12;

/** Pengunjung yang terlihat: makin banyak unit terbuka makin ramai, ikut ritme keramaian terminal. */
export function jumlahPengunjung(isi: IsiLantai2, keramaian: number): number {
  const kursi = isi.blokKursi.reduce((n, ya) => (ya ? n + 1 : n), 0);
  return Math.round(Math.min(MAKS_PENGUNJUNG, 4 + 2 * isi.kios + kursi) * Math.max(0, Math.min(1, keramaian)));
}

type Titik3 = readonly [number, number, number];

/** Gang gerbang MASUK → plaza → dekat kaki tangga. */
const RUTE_DARI_GANG: readonly Titik3[] = [
  [18.3, 18.6, 0.016],
  [18.3, 17.5, H_PLAZA],
  [TANGGA.dariGang[0], TANGGA.dariGang[1], H_PLAZA],
];
/** Naik dan turun tangga A3 (lajur & bordes di TANGGA, tata-letak.ts), dari dan ke plaza; ujung atasnya di teras. */
const RUTE_NAIK: readonly Titik3[] = TANGGA.naik;
const RUTE_TURUN: readonly Titik3[] = TANGGA.turun;
/** Selasar teras di selatan deret kios. */
const Y_SELASAR = 16.7;
/** Lorong barat–timur teras, di utara baris meja pertama. */
const Y_LORONG_TERAS = 17.45;
/** Lorong utara–selatan lantai 2, di antara dua kolom meja. */
const X_LORONG_L2 = 4.85;
/** Bangku meja di sisi utara (dx, dy dari pusat meja), lihat gedung3d & sayap2-3d. */
const BANGKU_UTARA = 0.2;

interface TempatDuduk {
  /** Titik di teras/lantai 2 dari selasar sampai bangku; bangku di titik terakhir. */
  readonly jalan: readonly Titik3[];
  readonly hadap: number;
  readonly teras: boolean;
}

const lantai = (x: number, y: number): Titik3 => [x, y, H_LANTAI_2];

/** Enam tempat di teras (bangku sisi utara meja) lalu enam di lantai 2 (bangku yang menghadap lorong). */
const TEMPAT: readonly TempatDuduk[] = [
  ...MEJA_TERAS.slice(0, 6).map(([x, y]): TempatDuduk => ({ jalan: [lantai(10.05, Y_LORONG_TERAS), lantai(x, Y_LORONG_TERAS), lantai(x, y - BANGKU_UTARA)], hadap: Math.PI / 2, teras: true })),
  ...MEJA_L2.map(([x, y]): TempatDuduk => {
    // Meja kolom timur: bangku di sisi barat, kolom barat: di sisi timur; keduanya menghadap meja dari lorong.
    const kolomTimur = x > X_LORONG_L2;
    return { jalan: [lantai(6.65, Y_SELASAR), lantai(6.2, 16.45), lantai(X_LORONG_L2, 16.2), lantai(X_LORONG_L2, y), lantai(x + (kolomTimur ? -0.2 : 0.2), y)], hadap: kolomTimur ? 0 : Math.PI, teras: false };
  }),
];

interface RutePengunjung {
  /** Rute satu putaran: naik, duduk di titik `iDuduk`, lalu turun. */
  readonly titik: readonly Titik3[];
  /** Jarak kumulatif (2D + tinggi) sampai tiap titik. */
  readonly jarak: readonly number[];
  readonly iDuduk: number;
  readonly lamaDuduk: number;
  /** Lama satu putaran (detik main). */
  readonly putaran: number;
  readonly hadap: number;
  readonly teras: boolean;
}

/** Lama duduk 20–40 detik main, berbeda per orang. */
const lamaDuduk = (i: number): number => 20 + 20 * ((i * 0.6180339887 + 0.3) % 1);

const RUTE: readonly RutePengunjung[] = TEMPAT.map((t, i): RutePengunjung => {
  const berangkat = [...RUTE_DARI_GANG, ...RUTE_NAIK, lantai(10.05, Y_SELASAR), ...t.jalan];
  const pulang = [...t.jalan].reverse().slice(1);
  const titik = [...berangkat, ...pulang, lantai(10.05, Y_SELASAR), ...RUTE_TURUN, ...[...RUTE_DARI_GANG].reverse()];
  const jarak: number[] = [0];
  for (let k = 1; k < titik.length; k++) {
    const a = titik[k - 1]!;
    const b = titik[k]!;
    jarak.push(jarak[k - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const duduk = lamaDuduk(i);
  return { titik, jarak, iDuduk: berangkat.length - 1, lamaDuduk: duduk, putaran: jarak[jarak.length - 1]! / KECEPATAN_JALAN + duduk, hadap: t.hadap, teras: t.teras };
});

export interface PosisiPengunjung {
  x: number;
  y: number;
  h: number;
  duduk: boolean;
  /** Arah hadap saat duduk (radian); saat berjalan arah mengikuti langkah. */
  hadap: number;
}

/** Pengunjung ke-i duduk di teras terbuka (saat hujan ia pergi, seperti pengunjung luar). */
export const pengunjungDiTeras = (i: number): boolean => RUTE[i % RUTE.length]!.teras;

/**
 * Posisi pengunjung ke-i pada detik ke-t (berulang tiap putaran): naik lewat
 * lajur naik, duduk, turun lewat lajur turun. Tinggi berubah halus sepanjang
 * rute, jadi orangnya tidak pernah menembus pelat.
 * @param keluar objek hasil yang dipakai ulang (lingkaran frame tidak mengalokasi)
 */
export function posisiPengunjung(i: number, t: number, keluar: PosisiPengunjung = { x: 0, y: 0, h: 0, duduk: false, hadap: 0 }): PosisiPengunjung {
  const r = RUTE[i % RUTE.length]!;
  // Fase digeser per orang supaya tidak beriringan.
  let s = (((t + i * 37.3) % r.putaran) + r.putaran) % r.putaran;
  const dJalanDuduk = r.jarak[r.iDuduk]! / KECEPATAN_JALAN;
  keluar.duduk = false;
  keluar.hadap = r.hadap;
  if (s >= dJalanDuduk && s < dJalanDuduk + r.lamaDuduk) {
    const p = r.titik[r.iDuduk]!;
    keluar.x = p[0];
    keluar.y = p[1];
    keluar.h = p[2];
    keluar.duduk = true;
    return keluar;
  }
  if (s >= dJalanDuduk + r.lamaDuduk) s -= r.lamaDuduk;
  const d = s * KECEPATAN_JALAN;
  let k = 1;
  while (k < r.jarak.length - 1 && r.jarak[k]! < d) k++;
  const a = r.titik[k - 1]!;
  const b = r.titik[k]!;
  const u = (d - r.jarak[k - 1]!) / Math.max(1e-6, r.jarak[k]! - r.jarak[k - 1]!);
  keluar.x = a[0] + (b[0] - a[0]) * u;
  keluar.y = a[1] + (b[1] - a[1]) * u;
  keluar.h = a[2] + (b[2] - a[2]) * u;
  return keluar;
}
