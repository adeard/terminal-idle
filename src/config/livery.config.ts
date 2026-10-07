/**
 * Livery bus mitra PO: warna cat, pola, dan tulisan nama di badan. Murni data
 * tampilan (tidak memengaruhi ekonomi); digambar oleh kendaraan3d.ts ke lembar
 * livery dan dipakai ikon kecil di tab Armada. Nama PO lengkapnya di ui/teks.ts.
 * Semua nama fiktif.
 */
import type { PoId } from '../sim/fitur';

/**
 * - polos: satu warna;
 * - garis: garis aksen tepat di atas jendela + garis tipis di badan bawah;
 * - dua: badan bawah berwarna aksen (dua warna);
 * - sapuan: sapuan aksen miring dari badan bawah belakang ke atas depan.
 */
export type PolaLivery = 'polos' | 'garis' | 'dua' | 'sapuan';

export interface Livery {
  /** Warna badan (menggantikan cat gambar dasar; bayangan & sorotan dipertahankan). */
  readonly warna: number;
  /** Warna pola & tulisan nama. */
  readonly aksen: number;
  readonly pola: PolaLivery;
  /** Gambar samping dasar: 1 atau 2 (letak pintu & jendela berbeda). */
  readonly varian: 1 | 2;
  /** Tulisan di badan & papan tujuan depan (kapital, pendek). */
  readonly papan: string;
  /** Warna tulisan bila berbeda dari aksen. */
  readonly teks?: number;
}

export const LIVERY_PO: Readonly<Record<PoId, Livery>> = {
  lumpiaKilat: { warna: 0x0d9488, aksen: 0xf8fafc, pola: 'garis', varian: 1, papan: 'LUMPIA KILAT' },
  bakpiaRasa: { warna: 0x9f1239, aksen: 0xfde68a, pola: 'dua', varian: 2, papan: 'BAKPIA RASA' },
  wayangLestari: { warna: 0x6d28d9, aksen: 0xfbbf24, pola: 'sapuan', varian: 1, papan: 'WAYANG LESTARI' },
  arekEkspres: { warna: 0x1e3a8a, aksen: 0xef4444, pola: 'garis', varian: 2, papan: 'AREK EKSPRES', teks: 0xf8fafc },
  apelBatu: { warna: 0xdc2626, aksen: 0xa3e635, pola: 'sapuan', varian: 2, papan: 'APEL BATU', teks: 0xf8fafc },
  kecakLaju: { warna: 0xf1f5f9, aksen: 0x0284c7, pola: 'dua', varian: 1, papan: 'KECAK LAJU' },
  // Antarpulau: merah-emas siger Lampung, hijau Rinjani, marun-emas rumah gadang, biru Danau Toba, cokelat kopi Gayo.
  sigerSakti: { warna: 0xb91c1c, aksen: 0xfacc15, pola: 'garis', varian: 2, papan: 'SIGER SAKTI' },
  rinjaniIndah: { warna: 0x047857, aksen: 0xf8fafc, pola: 'sapuan', varian: 1, papan: 'RINJANI INDAH' },
  rumahGadang: { warna: 0x7f1d1d, aksen: 0xeab308, pola: 'dua', varian: 1, papan: 'RUMAH GADANG', teks: 0xfde68a },
  danauToba: { warna: 0x0369a1, aksen: 0xe0f2fe, pola: 'sapuan', varian: 2, papan: 'DANAU TOBA' },
  kopiGayo: { warna: 0x78350f, aksen: 0xfef3c7, pola: 'garis', varian: 1, papan: 'KOPI GAYO' },
  ondelOndel: { warna: 0xdb2777, aksen: 0xfacc15, pola: 'garis', varian: 1, papan: 'ONDEL-ONDEL' },
  peuyeumKilat: { warna: 0x166534, aksen: 0xfacc15, pola: 'dua', varian: 2, papan: 'PEUYEUM KILAT' },
  teloletJaya: { warna: 0x1f2937, aksen: 0xfacc15, pola: 'sapuan', varian: 1, papan: 'TELOLET JAYA' },
  sultanGarasi: { warna: 0xe2e8f0, aksen: 0xca8a04, pola: 'garis', varian: 2, papan: 'SULTAN GARASI' },
  juaraKelas: { warna: 0x0ea5e9, aksen: 0xf8fafc, pola: 'sapuan', varian: 2, papan: 'JUARA KELAS' },
  juaraUmum: { warna: 0xb45309, aksen: 0xfde047, pola: 'garis', varian: 1, papan: 'JUARA UMUM', teks: 0xfef9c3 },
  // Hadiah eksklusif event: hijau-emas ketupat, merah-putih bendera, biru malam kembang api.
  mudikCeria: { warna: 0x15803d, aksen: 0xfacc15, pola: 'sapuan', varian: 1, papan: 'MUDIK CERIA' },
  merahPutih: { warna: 0xdc2626, aksen: 0xf8fafc, pola: 'dua', varian: 1, papan: 'MERAH PUTIH', teks: 0xf8fafc },
  kembangApi: { warna: 0x1e1b4b, aksen: 0xf472b6, pola: 'garis', varian: 2, papan: 'KEMBANG API', teks: 0xfde68a },
};

/** Cat badan tanpa bentuk dasar & tulisan: untuk kelas bus yang dilukis (lihat game/kelas-bus.ts). */
export type CatLivery = Pick<Livery, 'warna' | 'aksen' | 'pola' | 'teks'>;

/**
 * Cat bus kelas lukis (eksekutif, sleeper, double decker) yang bukan milik
 * mitra PO, sejajar urutan bus terminal bawaan (hijau, biru, oranye, kuning,
 * lalu varian keduanya). Bus ini bertuliskan nama kelasnya.
 */
export const CAT_BAWAAN_KELAS: readonly CatLivery[] = [
  { warna: 0x3f9142, aksen: 0xf8fafc, pola: 'garis' },
  { warna: 0x2f6fb0, aksen: 0xf8fafc, pola: 'sapuan' },
  { warna: 0xe46f2e, aksen: 0x1f2937, pola: 'dua', teks: 0xf8fafc },
  { warna: 0xf2c230, aksen: 0x1e3a8a, pola: 'garis' },
  { warna: 0xf1f5f9, aksen: 0x3f9142, pola: 'sapuan' },
  { warna: 0xf1f5f9, aksen: 0x2f6fb0, pola: 'dua' },
  { warna: 0x1f2937, aksen: 0xe46f2e, pola: 'garis' },
  { warna: 0xf2c230, aksen: 0xb91c1c, pola: 'sapuan' },
];
