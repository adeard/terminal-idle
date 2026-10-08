/**
 * Perluasan terminal di adegan (murni, tanpa DOM & three.js; lihat
 * documents/12-rancangan-ekonomi-po.md bagian 8): jendela loket & kelompok
 * parkir yang sudah dibangun tiap tahap perluasan, keadaan tiap kelompok
 * parkir (belum dibangun, berjurusan, atau parkir tambahan), pembagian jendela
 * loket ke mitra PO, dan lokasi proyek pembangunan (pagar seng, crane,
 * material, pekerja, tempat peresmian). Tahap 3–5 (bangunan bertingkat) belum
 * punya bentuk akhir di adegan, tapi proyeknya sudah terlihat.
 */
import type { PoId } from '../sim/fitur';
import { jurusanDiMask, KELOMPOK_PARKIR, LOKET, PARKIR_SERONG, SAYAP_BARAT, URUTAN_LOKET, X_LOKET, type Persegi, type Titik } from './tata-letak';

/** Jendela loket yang sudah dibangun setelah tahap perluasan ke-i selesai (tahap 0 = terminal awal). */
const JENDELA_PER_TAHAP: readonly number[] = [4, 6, 8];
/** Kelompok parkir (urut KELOMPOK_PARKIR, barat → timur) yang sudah dibangun setelah tahap ke-i. */
const KELOMPOK_PER_TAHAP: readonly number[] = [2, 2, 4];
/** Baris kedua parkir mobil pengunjung terisi mulai tahap ini (pangkalan diperluas, pengunjung makin banyak). */
export const TAHAP_PARKIR_MOBIL_PENUH = 2;

const menurutTahap = (tabel: readonly number[], perluasan: number): number => tabel[Math.min(tabel.length - 1, Math.max(0, Math.floor(perluasan)))]!;

/** Jendela loket yang sudah dibangun: 4 di terminal awal, 6 setelah tahap 1, 8 setelah tahap 2. */
export function jendelaTersedia(perluasan: number): number {
  return Math.min(X_LOKET.length, menurutTahap(JENDELA_PER_TAHAP, perluasan));
}

/** Kelompok parkir yang sudah dibangun: 2 kelompok (10 petak) di awal, 4 (20 petak) setelah tahap 2. */
export function kelompokParkirDibangun(perluasan: number): number {
  return Math.min(KELOMPOK_PARKIR.length, menurutTahap(KELOMPOK_PER_TAHAP, perluasan));
}

/**
 * Jendela loket yang dipakai mitra PO di siang hari: satu per loket yang disewa,
 * paling sedikit satu, paling banyak yang sudah dibangun (malam hari separuhnya
 * tutup, lihat loketBuka di kehidupan-malam.ts).
 */
export function jendelaDipakai(perluasan: number, loketTerisi: number): number {
  return Math.max(1, Math.min(jendelaTersedia(perluasan), Math.floor(loketTerisi)));
}

/** Jendela (indeks X_LOKET) yang baru dibangun pada tahap perluasan ini (1-based); kosong bila tahap itu tidak menambah jendela. */
export function jendelaTahap(tahap: number): number[] {
  return URUTAN_LOKET.slice(jendelaTersedia(tahap - 1), jendelaTersedia(tahap));
}

/** Kelompok parkir (indeks KELOMPOK_PARKIR) yang baru dibangun pada tahap perluasan ini (1-based). */
export function kelompokTahap(tahap: number): number[] {
  const a = kelompokParkirDibangun(tahap - 1);
  const b = kelompokParkirDibangun(tahap);
  return Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);
}

/**
 * Pemilik tiap jendela loket (indeks X_LOKET; null = tidak dipakai). Jendela
 * yang dipakai (terdekat ke kepala antrean, URUTAN_LOKET) dibagi ke PO menurut
 * loketnya: tiap PO yang punya loket mendapat satu dulu, lalu jendela
 * berikutnya selalu untuk PO dengan loket per jendela terbanyak (seri: urutan
 * terdaftar). Bila jendelanya kurang dari banyaknya PO, PO dengan loket
 * terbanyak yang kebagian. Jendela tiap PO berderet dari barat ke timur.
 */
export function jendelaPo(dipakai: number, po: readonly { readonly id: PoId; readonly loket: number }[]): (PoId | null)[] {
  const hasil: (PoId | null)[] = X_LOKET.map(() => null);
  const n = Math.max(0, Math.min(X_LOKET.length, Math.floor(dipakai)));
  const aktif = po.map((p, i) => ({ id: p.id, loket: p.loket, i })).filter((p) => p.loket > 0);
  if (n === 0 || aktif.length === 0) return hasil;
  const kebagian = aktif.length <= n ? aktif : [...aktif].sort((a, b) => b.loket - a.loket || a.i - b.i).slice(0, n).sort((a, b) => a.i - b.i);
  const kursi = kebagian.map(() => 1);
  for (let sisa = n - kebagian.length; sisa > 0; sisa--) {
    let pilih = 0;
    for (let k = 1; k < kebagian.length; k++) if (kebagian[k]!.loket / kursi[k]! > kebagian[pilih]!.loket / kursi[pilih]! + 1e-12) pilih = k;
    kursi[pilih]!++;
  }
  const jendela = URUTAN_LOKET.slice(0, n).sort((a, b) => a - b);
  let j = 0;
  kebagian.forEach((p, k) => {
    for (let c = 0; c < kursi[k]!; c++) hasil[jendela[j++]!] = p.id;
  });
  return hasil;
}

/**
 * Keadaan kelompok parkir di adegan:
 * - belum: belum dibangun (tahap perluasan); mulut petaknya dibarikade, papannya "SEGERA DIBUKA".
 * - jurusan: ada jurusannya yang dilayani mitra PO; papannya nama jurusan.
 * - tambahan: sudah dibangun tapi jurusannya belum dilayani; jadi parkir
 *   tambahan bagi bus yang kelompok jurusannya penuh, papannya "PARKIR TAMBAHAN".
 */
export type KeadaanKelompokParkir = 'belum' | 'jurusan' | 'tambahan';

/** Keadaan tiap kelompok parkir (urut KELOMPOK_PARKIR) menurut jurusan yang dilayani & kelompok yang sudah dibangun. */
export function keadaanKelompokParkir(mask: number, dibangun: number): KeadaanKelompokParkir[] {
  return KELOMPOK_PARKIR.map((k, i) => (i >= dibangun ? 'belum' : k.tujuan.some((t) => jurusanDiMask(mask, t)) ? 'jurusan' : 'tambahan'));
}

// ---------------------------------------------------------------------------
// Proyek perluasan

/** Crane menara: kaki (x, y) di tanah, tinggi tiang, panjang lengan, dan arah awal lengan (radian). */
export interface CraneProyek {
  readonly x: number;
  readonly y: number;
  readonly tinggi: number;
  readonly lengan: number;
  readonly arah: number;
}

/** Pekerja proyek mondar-mandir di antara dua titik. */
export interface RutePekerja {
  readonly dari: Titik;
  readonly ke: Titik;
}

export interface LokasiProyek {
  /** Pagar seng keliling (persegi; boleh kosong). */
  readonly pagar: readonly Persegi[];
  /** Perancah (scaffolding) keliling bangunan yang ditinggikan: persegi denah & tinggi puncaknya. */
  readonly perancah: { readonly area: Persegi; readonly tinggi: number } | null;
  readonly crane: CraneProyek | null;
  /** Jendela loket (indeks X_LOKET) yang ditutup papan proyek. */
  readonly jendela: readonly number[];
  /** Tumpukan material (bata, pasir, besi). */
  readonly material: readonly Titik[];
  readonly pekerja: readonly RutePekerja[];
  /** Pusat peresmian (kembang api) & tinggi ledakannya. */
  readonly pusat: Titik;
  readonly tinggiKembangApi: number;
}

/**
 * Petak parkir kelompok tahap 2 (kelompok 3–4): area di antara lajur halte & lorong belakang.
 * Sisi baratnya di timur pulau kelompok 3, supaya bus yang keluar dari petak terakhir
 * kelompok 2 (berbelok ke lorong) tidak menembus pagar (dicek di tests/perluasan-adegan.test.ts).
 */
const PETAK_TIMUR: Persegi = { x0: 9.95, y0: 6.15, x1: 23.65, y1: 8.25 };
/** Lapangan rumput di timur ruang tunggu (di barat SPBU, di timur pohon tepi kompleks). */
const LAPANGAN_TIMUR: Persegi = { x0: 53.4, y0: 6.0, x1: 57.7, y1: 14.8 };
const yJendela = LOKET.yPembeli + 0.08;

/** Lokasi proyek tiap tahap perluasan (indeks = tahap − 1; lihat NAMA_PERLUASAN di ui/teks.ts). */
export const LOKASI_PROYEK: readonly LokasiProyek[] = [
  // 1 · Aula loket diperluas: jendela loket di kedua ujung deretan.
  {
    pagar: [],
    perancah: null,
    crane: null,
    jendela: jendelaTahap(1),
    material: [],
    pekerja: jendelaTahap(1).map((i): RutePekerja => ({ dari: [X_LOKET[i]! - 0.2, yJendela], ke: [X_LOKET[i]! + 0.2, yJendela] })),
    pusat: [(X_LOKET[0]! + X_LOKET[X_LOKET.length - 1]!) / 2, LOKET.yMeja],
    tinggiKembangApi: 6.5,
  },
  // 2 · Pangkalan diperluas: kelompok parkir 3–4 dan jendela loket paling ujung.
  {
    pagar: [PETAK_TIMUR],
    perancah: null,
    crane: { x: PARKIR_SERONG.pusatX[13]!, y: PARKIR_SERONG.pusatY, tinggi: 4.4, lengan: 4.6, arah: 0.6 },
    jendela: jendelaTahap(2),
    material: [
      [PARKIR_SERONG.pusatX[11]!, 7.0],
      [PARKIR_SERONG.pusatX[17]!, 7.4],
    ],
    pekerja: [
      { dari: [PARKIR_SERONG.pusatX[11]! + 0.45, 6.75], ke: [PARKIR_SERONG.pusatX[13]! - 0.5, 7.5] },
      { dari: [PARKIR_SERONG.pusatX[15]!, 7.5], ke: [PARKIR_SERONG.pusatX[17]! - 0.6, 6.9] },
      ...jendelaTahap(2).map((i): RutePekerja => ({ dari: [X_LOKET[i]! - 0.2, yJendela], ke: [X_LOKET[i]! + 0.2, yJendela] })),
    ],
    pusat: [(PETAK_TIMUR.x0 + PETAK_TIMUR.x1) / 2, PARKIR_SERONG.pusatY],
    tinggiKembangApi: 6.5,
  },
  // 3 · Lantai 2 gedung utama: perancah keliling sayap barat, crane di sela taman & dinding sayap.
  {
    pagar: [],
    perancah: { area: SAYAP_BARAT, tinggi: 2.0 },
    crane: { x: SAYAP_BARAT.x0 - 0.45, y: 12.4, tinggi: 4.2, lengan: 4.0, arah: 0 },
    jendela: [],
    material: [[SAYAP_BARAT.x0 - 0.42, 14.7]],
    pekerja: [{ dari: [SAYAP_BARAT.x0 - 0.38, 13.3], ke: [SAYAP_BARAT.x0 - 0.38, 14.3] }],
    pusat: [(SAYAP_BARAT.x0 + SAYAP_BARAT.x1) / 2, (SAYAP_BARAT.y0 + SAYAP_BARAT.y1) / 2],
    tinggiKembangApi: 6.5,
  },
  // 4 · Gedung parkir bus & Gedung Antarpulau: lapangan timur (calon Gedung Antarpulau).
  {
    pagar: [LAPANGAN_TIMUR],
    perancah: null,
    crane: { x: 55.6, y: 10.4, tinggi: 5.2, lengan: 5.0, arah: 2.4 },
    jendela: [],
    material: [
      [54.2, 7.2],
      [56.9, 13.6],
    ],
    pekerja: [
      { dari: [54.4, 8.8], ke: [56.8, 9.0] },
      { dari: [54.6, 12.4], ke: [56.6, 12.0] },
    ],
    pusat: [55.6, 10.4],
    tinggiKembangApi: 7,
  },
  // 5 · Terminal Terpadu: lapangan timur lagi (gedung parkir mobil & jembatan menyusul).
  {
    pagar: [LAPANGAN_TIMUR],
    perancah: null,
    crane: { x: 55.4, y: 8.4, tinggi: 6.0, lengan: 5.4, arah: 3.6 },
    jendela: [],
    material: [
      [54.1, 13.4],
      [56.9, 7.0],
    ],
    pekerja: [
      { dari: [54.3, 10.6], ke: [56.9, 11.0] },
      { dari: [54.6, 13.0], ke: [56.5, 14.0] },
    ],
    pusat: [55.6, 10.4],
    tinggiKembangApi: 7.5,
  },
];

/** Lokasi proyek tahap ini (1-based), atau null bila tidak ada. */
export function lokasiProyek(tahap: number): LokasiProyek | null {
  return LOKASI_PROYEK[tahap - 1] ?? null;
}

/** Lama satu kali jalan pekerja dari ujung ke ujung, dan jeda kerja di tiap ujung (detik main). */
const DETIK_JALAN_PEKERJA = 5;
const DETIK_KERJA = 3;

/**
 * Posisi pekerja ke-i saat detik ke-t: berjalan bolak-balik di rutenya dengan
 * jeda kerja di tiap ujung (fasenya digeser per pekerja supaya tidak serempak).
 */
export function posisiPekerja(rute: RutePekerja, i: number, t: number): Titik {
  const siklus = 2 * (DETIK_JALAN_PEKERJA + DETIK_KERJA);
  const u = (((t + i * 3.7) % siklus) + siklus) % siklus;
  let s: number;
  if (u < DETIK_KERJA) s = 0;
  else if (u < DETIK_KERJA + DETIK_JALAN_PEKERJA) s = (u - DETIK_KERJA) / DETIK_JALAN_PEKERJA;
  else if (u < 2 * DETIK_KERJA + DETIK_JALAN_PEKERJA) s = 1;
  else s = 1 - (u - 2 * DETIK_KERJA - DETIK_JALAN_PEKERJA) / DETIK_JALAN_PEKERJA;
  return [rute.dari[0] + (rute.ke[0] - rute.dari[0]) * s, rute.dari[1] + (rute.ke[1] - rute.dari[1]) * s];
}
