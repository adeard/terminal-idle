/**
 * Ekonomi v2, perluasan terminal (murni): tahap bangunan permanen yang
 * membuat terminal makin luas dan bertingkat (aula, pangkalan, gedung parkir
 * bus, Gedung Antarpulau, Terminal Terpadu). Tiap tahap dibuka level terminal,
 * dibangun sekali sebagai proyek, lalu tidak pernah di-reset, termasuk saat
 * Renovasi. Rancangan: bagian 8 documents/12-rancangan-ekonomi-po.md.
 */
import Decimal from 'break_infinity.js';
import { EKONOMI, type KonfigEkonomi, type KonfigPerluasan } from '../config/economy.config';

/**
 * Tahap berikutnya yang bisa dibangun, null bila semua sudah dibangun.
 * @param tahapSelesai banyaknya tahap yang sudah selesai (tahap dibangun berurutan)
 */
export function tahapPerluasanBerikutnya(tahapSelesai: number, cfg: KonfigEkonomi = EKONOMI): KonfigPerluasan | null {
  return cfg.mitra.perluasan[Math.max(0, tahapSelesai)] ?? null;
}

/** Biaya tahap berikutnya, null bila semua sudah dibangun. */
export function biayaPerluasan(tahapSelesai: number, cfg: KonfigEkonomi = EKONOMI): Decimal | null {
  const t = tahapPerluasanBerikutnya(tahapSelesai, cfg);
  return t ? new Decimal(t.biaya) : null;
}

/** Level terminal sudah cukup untuk memulai tahap berikutnya (uang & proyek yang sedang berjalan dicek pemanggil). */
export function levelCukupPerluasan(tahapSelesai: number, levelTerminal: number, cfg: KonfigEkonomi = EKONOMI): boolean {
  const t = tahapPerluasanBerikutnya(tahapSelesai, cfg);
  return t !== null && levelTerminal >= t.level;
}

/** Tambahan jatah loket semua PO dari tahap yang sudah selesai. */
export function bonusJatahPerluasan(tahapSelesai: number, cfg: KonfigEkonomi = EKONOMI): number {
  let bonus = 0;
  for (const t of cfg.mitra.perluasan.slice(0, Math.max(0, tahapSelesai))) bonus += t.jatah;
  return bonus;
}
