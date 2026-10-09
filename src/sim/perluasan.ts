/**
 * Perluasan terminal (murni): tahap bangunan permanen yang membuat terminal
 * makin luas dan bertingkat (aula, pangkalan, lantai 2, gedung parkir bus &
 * Gedung Antarpulau, Terminal Terpadu). Tiap tahap dibuka level terminal,
 * dibangun sekali sebagai proyek (tetap berjalan saat game ditutup), lalu
 * menambah slot bangunan (sim/bangunan.ts) dan biaya operasional gedungnya.
 * Rancangan: bagian 8 documents/12 & documents/13.
 */
import { EKONOMI, type KonfigEkonomi, type KonfigPerluasan } from '../config/economy.config';

/**
 * Tahap berikutnya yang bisa dibangun, null bila semua sudah dibangun.
 * @param tahapSelesai banyaknya tahap yang sudah selesai (tahap dibangun berurutan)
 */
export function tahapPerluasanBerikutnya(tahapSelesai: number, cfg: KonfigEkonomi = EKONOMI): KonfigPerluasan | null {
  return cfg.mitra.perluasan[Math.max(0, tahapSelesai)] ?? null;
}

/** Biaya tahap berikutnya (Rp), null bila semua sudah dibangun. */
export function biayaPerluasan(tahapSelesai: number, cfg: KonfigEkonomi = EKONOMI): number | null {
  return tahapPerluasanBerikutnya(tahapSelesai, cfg)?.biaya ?? null;
}

/** Level terminal sudah cukup untuk memulai tahap berikutnya (kas & proyek yang sedang berjalan dicek pemanggil). */
export function levelCukupPerluasan(tahapSelesai: number, levelTerminal: number, cfg: KonfigEkonomi = EKONOMI): boolean {
  const t = tahapPerluasanBerikutnya(tahapSelesai, cfg);
  return t !== null && levelTerminal >= t.level;
}
