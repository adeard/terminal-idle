/**
 * Hiasan per level terminal (documents/16 bagian 6, versi ronde 2 di rancangan
 * bentuk terminal ronde 2 bagian 5; murni, tanpa three.js): dua belas perubahan
 * kecil yang muncul saat terminal naik level. Diturunkan hanya dari level terminal
 * dan tahap perluasan, jadi save lama langsung lengkap dan tidak ada field save.
 *
 * hiasan-level3d.ts menggambar benda plaza & baliho; gedung kota yang meninggi
 * ada di mesh gabungan utama (lingkungan3d.ts, GEDUNG_KOTA_NAIK). Kembang api kecil
 * hanya saat naik satu level di sesi aktif, bukan saat memuat atau sesudah offline.
 */
import type { PoId } from '../sim/fitur';
import { GEDUNG_KOTA_NAIK, type Persegi, type Titik } from './tata-letak';

export type IdHiasan = 'pohonPlaza' | 'kanopi' | 'baliho1' | 'kotaK13' | 'kotaK12' | 'baliho2' | 'kotaK07' | 'pohonAtap' | 'menaraJam' | 'kotaK09' | 'monumen' | 'kotaK11';

/** Batas benda: jejak denah dan rentang tinggi. */
export interface KotakHiasan extends Persegi {
  readonly h0: number;
  readonly h1: number;
}

export interface HiasanLevel {
  readonly id: IdHiasan;
  readonly level: number;
  /** Tahap perluasan paling rendah (pohon atap berdiri di teras Sayap 2 Lantai). */
  readonly tahap: number;
  readonly kotak: KotakHiasan;
  /** Pusat kembang api kecil saat benda ini muncul: di atas puncaknya. */
  readonly kembangApi: readonly [number, number, number];
}

/** Pohon peneduh tepi selatan plaza (Lv 5): di selatan rute patroli satpam (y 17,55), di utara pagar. */
export const POHON_PLAZA: readonly Titik[] = [13.6, 15.6, 20.6, 23.4, 26.4, 29.0].map((x): Titik => [x, 17.72]);
/** Pohon dalam pot di tepi timur teras selatan Sayap 2 Lantai (Lv 24). */
export const POHON_ATAP: readonly Titik[] = [17.7, 18.6, 19.5].map((y): Titik => [10.0, y]);
/** Tinggi pijakan pohon atap: lantai teras. */
export const H_TERAS = 1.35;

/** Tahap perluasan yang membangun teras Sayap 2 Lantai. */
const TAHAP_TERAS = 3;
/** Kembang api kecil meletus sekian di atas puncak bendanya. */
const DI_ATAS_PUNCAK = 1.5;

const hiasan = (id: IdHiasan, level: number, kotak: KotakHiasan, tahap = 0): HiasanLevel => ({
  id,
  level,
  tahap,
  kotak,
  kembangApi: [(kotak.x0 + kotak.x1) / 2, (kotak.y0 + kotak.y1) / 2, kotak.h1 + DI_ATAS_PUNCAK],
});

const kota = (lot: string): HiasanLevel => {
  const g = GEDUNG_KOTA_NAIK.find((x) => x.lot === lot)!;
  // Atap baru dan kotak mesin di atasnya.
  return hiasan(`kota${lot}` as IdHiasan, g.level, { x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1, h0: g.tinggiLama, h1: g.tinggiBaru + 0.3 });
};

/** Dua belas hiasan, urut level. */
export const HIASAN_LEVEL: readonly HiasanLevel[] = [
  hiasan('pohonPlaza', 5, { x0: 13.0, y0: 17.15, x1: 29.6, y1: 18.25, h0: 0, h1: 1.7 }),
  hiasan('kanopi', 8, { x0: 26.6, y0: 15.55, x1: 29.3, y1: 16.3, h0: 0, h1: 1.1 }),
  // Baliho di tepi selatan atap ruang tunggu, di depan muka lantai 2-nya (y ≥ 13,05) dan di luar CADANGAN_ANTARPULAU (y < 13,2).
  hiasan('baliho1', 13, { x0: 32.0, y0: 13.08, x1: 36.0, y1: 13.2, h0: 1.3, h1: 3.2 }),
  kota('K13'),
  kota('K12'),
  hiasan('baliho2', 22, { x0: 42.5, y0: 13.08, x1: 46.5, y1: 13.2, h0: 1.3, h1: 3.2 }),
  kota('K07'),
  hiasan('pohonAtap', 24, { x0: 9.55, y0: 17.25, x1: 10.45, y1: 19.95, h0: H_TERAS, h1: 2.7 }, TAHAP_TERAS),
  hiasan('menaraJam', 25, { x0: 28.6, y0: 16.4, x1: 29.3, y1: 17.1, h0: 0, h1: 4.6 }),
  kota('K09'),
  hiasan('monumen', 27, { x0: 26.0, y0: 16.5, x1: 28.4, y1: 17.0, h0: 0, h1: 1.2 }),
  kota('K11'),
];

/** Hiasan yang tampil pada level & tahap perluasan ini. */
export function hiasanLevel(level: number, perluasan: number): ReadonlySet<IdHiasan> {
  return new Set(HIASAN_LEVEL.filter((h) => level >= h.level && perluasan >= h.tahap).map((h) => h.id));
}

/**
 * Hiasan yang baru muncul karena naik level ini: hanya bila naik tepat satu level
 * (di sesi aktif, lihat jamBersambung). Saat memuat dan saat lompatan beberapa level
 * sekaligus bendanya langsung ada, tanpa kembang api.
 */
export function hiasanBaru(levelLalu: number, levelSekarang: number, perluasan: number): HiasanLevel[] {
  if (levelSekarang !== levelLalu + 1) return [];
  return HIASAN_LEVEL.filter((h) => h.level === levelSekarang && perluasan >= h.tahap);
}

/** Banyaknya gedung kota yang sudah meninggi pada level ini (GEDUNG_KOTA_NAIK urut level). */
export function kotaNaik(level: number): number {
  // Dipanggil tiap frame: dihitung tanpa membuat larik.
  let n = 0;
  for (const g of GEDUNG_KOTA_NAIK) if (level >= g.level) n++;
  return n;
}

/** PO yang warnanya dipasang di baliho ke-1 dan ke-2: PO terdaftar menurut urutan daftar; null = warna terminal. */
export function poBaliho(daftar: readonly { readonly id: PoId }[]): readonly [PoId | null, PoId | null] {
  return [daftar[0]?.id ?? null, daftar[1]?.id ?? null];
}

/** Kecepatan main tertinggi (tombol 3×) dengan kelonggaran. */
const MAKS_LAJU_MAIN = 4;
/** Kelonggaran detik untuk tick simulasi dan frame yang tersendat. */
const LONGGAR_DETIK = 1;

/**
 * Jam main berjalan bersama jam nyata sejak frame adegan sebelumnya, jadi naik level
 * yang terlihat sekarang terjadi di sesi aktif. Selama app dijeda jam main diam dan
 * hasil offline (XP) diterapkan tanpa memajukannya: frame pertama sesudahnya melihat
 * jeda nyata panjang dengan jam main yang hampir diam. Save yang diganti melompatkan
 * jam main ke mana saja. Panel layar penuh menghentikan gambar, tapi jam main tetap jalan.
 * @param majuMain detik main sejak frame lalu
 * @param jedaNyata detik nyata sejak frame lalu
 */
export function jamBersambung(majuMain: number, jedaNyata: number): boolean {
  return majuMain >= 0 && majuMain + LONGGAR_DETIK >= jedaNyata * 0.5 && majuMain <= jedaNyata * MAKS_LAJU_MAIN + LONGGAR_DETIK;
}
