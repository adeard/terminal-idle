/**
 * Tantangan mingguan (murni): minggu mengikuti kalender nyata (Senin 00.00 WIB),
 * dan tiga jenis tantangan tiap minggu diundi dari kunci minggunya, jadi sama
 * untuk semua pemain tanpa server. Targetnya disesuaikan besar terminal
 * masing-masing (lihat perbaruiTantangan di state.ts).
 */

/**
 * - penumpang: berangkatkan N penumpang;
 * - laba: kumpulkan laba bersih Rp N dari operasi terminal (turun lagi saat rugi);
 * - bangun: bangun N unit atau modernisasi;
 * - kepuasan: jaga kepuasan ≥ batas selama N detik main.
 */
export const JENIS_TANTANGAN = ['penumpang', 'laba', 'bangun', 'kepuasan'] as const;
export type JenisTantangan = (typeof JENIS_TANTANGAN)[number];

export function isJenisTantangan(nilai: unknown): nilai is JenisTantangan {
  return typeof nilai === 'string' && (JENIS_TANTANGAN as readonly string[]).includes(nilai);
}

/** Banyaknya tantangan tiap minggu. */
export const JUMLAH_TANTANGAN = 3;

const HARI_MS = 86_400_000;
const WIB_MS = 7 * 3_600_000;

/** Minggu (Senin 00.00 – Senin berikutnya, WIB) yang memuat saat ini: kunci "YYYY-MM-DD" hari Seninnya & rentangnya. */
export function mingguWib(ms: number): { readonly kunci: string; readonly mulaiMs: number; readonly selesaiMs: number } {
  const hari = Math.floor((ms + WIB_MS) / HARI_MS);
  // 1 Januari 1970 hari Kamis: dengan Senin = 0, Kamis = 3.
  const senin = hari - ((((hari + 3) % 7) + 7) % 7);
  const mulaiMs = senin * HARI_MS - WIB_MS;
  return { kunci: new Date(senin * HARI_MS).toISOString().slice(0, 10), mulaiMs, selesaiMs: mulaiMs + 7 * HARI_MS };
}

/** Jenis tantangan minggu ini (berbeda-beda, urutan tetap), diundi dari kunci minggu. */
export function jenisTantanganMinggu(kunci: string): JenisTantangan[] {
  let h = 2166136261;
  for (let i = 0; i < kunci.length; i++) h = Math.imul(h ^ kunci.charCodeAt(i), 16777619);
  const sisa: JenisTantangan[] = [...JENIS_TANTANGAN];
  const hasil: JenisTantangan[] = [];
  for (let i = 0; i < JUMLAH_TANTANGAN; i++) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    hasil.push(sisa.splice(h % sisa.length, 1)[0]!);
  }
  return hasil;
}
