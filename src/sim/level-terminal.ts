/**
 * Ekonomi v2, level terminal (murni): XP = penumpang yang diberangkatkan,
 * kelas terminal (Tipe C → B → A → Terpadu ★n) mengikuti level tanpa reset,
 * slot PO, dan bonus pendapatan per level. Rancangan:
 * documents/12-rancangan-ekonomi-po.md. Belum dipakai game.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';

/** XP kumulatif (penumpang) untuk mencapai level T (level 1 = 0). */
export function xpKumulatifTerminal(level: number, cfg: KonfigEkonomi = EKONOMI): number {
  const t = cfg.mitra.terminal;
  return t.xpA * Math.pow(Math.max(0, level - 1), t.xpK);
}

/** Level terminal dari XP kumulatifnya. Level hanya disimpan sebagai XP, jadi tidak pernah turun. */
export function levelTerminalDariXp(xp: number, cfg: KonfigEkonomi = EKONOMI): number {
  if (!(xp > 0)) return 1;
  const t = cfg.mitra.terminal;
  let level = 1 + Math.floor(Math.pow(xp / t.xpA, 1 / t.xpK));
  // Pembulatan floating point: pastikan xpKumulatif(level) ≤ xp < xpKumulatif(level + 1).
  while (level > 1 && xpKumulatifTerminal(level, cfg) > xp) level--;
  while (xpKumulatifTerminal(level + 1, cfg) <= xp) level++;
  return level;
}

/** Kelas terminal dari level: 0 = Tipe C, 1 = Tipe B, 2 = Tipe A, 3+ = Terpadu (★ = kelas − 2). */
export function kelasDariLevel(level: number, cfg: KonfigEkonomi = EKONOMI): number {
  const [b, a, terpadu] = cfg.mitra.terminal.levelKelas;
  if (level < b) return 0;
  if (level < a) return 1;
  if (level < terpadu) return 2;
  return 3 + Math.floor((level - terpadu) / cfg.mitra.terminal.levelPerBintang);
}

/** Level terminal paling rendah dengan kelas ini (kebalikan kelasDariLevel; dipakai migrasi save v1). */
export function levelMinimalKelas(kelas: number, cfg: KonfigEkonomi = EKONOMI): number {
  const [b, a, terpadu] = cfg.mitra.terminal.levelKelas;
  if (kelas <= 0) return 1;
  if (kelas === 1) return b;
  if (kelas === 2) return a;
  return terpadu + (kelas - 3) * cfg.mitra.terminal.levelPerBintang;
}

/**
 * Slot PO di level ini. Aula loket sekarang hanya punya 8 jendela, jadi slot
 * di atas `slotTanpaAulaKedua` baru bisa dipakai setelah tahap perluasan aula
 * kedua selesai.
 * @param tahapPerluasan banyaknya tahap perluasan yang sudah selesai dibangun
 */
export function slotPo(level: number, tahapPerluasan: number, cfg: KonfigEkonomi = EKONOMI): number {
  const t = cfg.mitra.terminal;
  let slot = 0;
  for (const [lv, n] of t.slot) if (level >= lv) slot = n;
  return tahapPerluasan >= t.tahapAulaKedua ? slot : Math.min(slot, t.slotTanpaAulaKedua);
}

/** Pengali semua pendapatan dari level terminal (menggantikan sebagian bonus prestige v1). */
export function pengaliLevelTerminal(level: number, cfg: KonfigEkonomi = EKONOMI): number {
  return 1 + cfg.mitra.terminal.bonusPerLevel * (Math.max(1, level) - 1);
}
