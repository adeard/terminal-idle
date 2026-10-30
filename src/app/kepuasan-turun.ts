/**
 * Toast "kepuasan turun" (murni; documents/14 bagian 4.2): kepuasan penumpang yang
 * turun tajam diberi tahu beserta sebabnya, supaya penurunan (mis. tepat setelah PO
 * baru bergabung) tidak terasa tanpa alasan. Overlay mencatat satu sampel per detik
 * nyata di memori sesi (tidak disimpan) dan memanggil `periksaKepuasanTurun`.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import type { AreaId, KepuasanTycoon } from '../sim/operasi';

/**
 * Aturan toast (waktu nyata): turun ≥ `poin` poin persen dari nilai tertinggi dalam
 * `jendelaMs` terakhir, paling sering sekali per `jedaMs`. Angka dari simulasi
 * documents/14 bagian 4.2 (0–3 toast per jam).
 */
export const KEPUASAN_TURUN = { poin: 10, jendelaMs: 300_000, jedaMs: 120_000 } as const;

/** Komponen kepuasan penumpang (urut popup kepuasan). */
export const KOMPONEN_KEPUASAN = ['kelancaran', 'kenyamanan', 'kebersihan', 'keamanan', 'fasilitas', 'harga'] as const;
export type KomponenKepuasan = (typeof KOMPONEN_KEPUASAN)[number];

/** Satu sampel: kepuasan & komponennya, dan area paling lambat jam sibuk saat itu. */
export interface SampelKepuasan {
  /** Waktu nyata (ms). */
  readonly ms: number;
  readonly kepuasan: KepuasanTycoon;
  readonly bottleneck: AreaId | null;
}

export interface KepuasanTurun {
  /** Kepuasan acuan (tertinggi dalam jendela) & sekarang, 0–1. */
  readonly dari: number;
  readonly ke: number;
  /** Komponen yang turun paling banyak (berbobot); `area` = area paling lambat sekarang (untuk kelancaran). */
  readonly sebab: { readonly komponen: KomponenKepuasan; readonly area: AreaId | null };
}

/**
 * Toast masih benar: kepuasan sekarang (0–1) masih ≥ `poin` poin di bawah acuannya. Toast yang
 * menunggu di antrean (atau sedang tampil) dibuang bila kepuasan sudah pulih, supaya "44% → 28%"
 * tidak tampil saat pil HUD sudah 44%.
 */
export function kepuasanTurunBerlaku(t: KepuasanTurun, kepuasanSekarang: number): boolean {
  return (t.dari - kepuasanSekarang) * 100 >= KEPUASAN_TURUN.poin - 1e-9;
}

/**
 * @param riwayat sampel sebelumnya (sejak toast terakhir; yang lebih tua dari jendela diabaikan).
 *   Setelah toast, pemanggil mengosongkan riwayat (acuan direset ke nilai sekarang).
 * @param toastTerakhirMs waktu nyata toast kepuasan terakhir (null = belum pernah).
 * @returns null bila tidak perlu toast.
 */
export function periksaKepuasanTurun(
  riwayat: readonly SampelKepuasan[],
  sekarang: SampelKepuasan,
  toastTerakhirMs: number | null,
  cfg: KonfigEkonomi = EKONOMI,
): KepuasanTurun | null {
  const a = KEPUASAN_TURUN;
  if (toastTerakhirMs !== null && sekarang.ms - toastTerakhirMs < a.jedaMs) return null;
  let acuan = sekarang;
  for (const x of riwayat) if (x.ms >= sekarang.ms - a.jendelaMs && x.kepuasan.nilai > acuan.kepuasan.nilai) acuan = x;
  if ((acuan.kepuasan.nilai - sekarang.kepuasan.nilai) * 100 < a.poin - 1e-9) return null;
  const bobot = cfg.tycoon.kepuasan.bobot;
  let komponen: KomponenKepuasan = KOMPONEN_KEPUASAN[0];
  let turun = Number.NEGATIVE_INFINITY;
  for (const k of KOMPONEN_KEPUASAN) {
    const d = bobot[k] * (acuan.kepuasan[k] - sekarang.kepuasan[k]);
    if (d > turun + 1e-12) {
      turun = d;
      komponen = k;
    }
  }
  return { dari: acuan.kepuasan.nilai, ke: sekarang.kepuasan.nilai, sebab: { komponen, area: sekarang.bottleneck } };
}
