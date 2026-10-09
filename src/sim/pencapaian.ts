/**
 * Syarat tiap pencapaian (penghargaan terminal). Murni: hanya membaca data
 * GameState, dicek tiap tick (lihat `perbaruiPencapaian` di state.ts). Tidak
 * meng-import fungsi state.ts (state.ts yang memakai modul ini), jadi turunan
 * diambil dari modul murni mitra.ts, level-terminal.ts, & bangunan.ts.
 */
import type { KonfigEkonomi } from '../config/economy.config';
import { menurutTahap } from './bangunan';
import { KELAS_BUS_IDS, TEKNOLOGI_IDS, type BangunanId, type PencapaianId } from './fitur';
import { kelasDariLevel, levelTerminalDariXp } from './level-terminal';
import { jurusanDilayaniPo, kelasBusDioperasikan } from './mitra';
import type { GameState } from './state';
import { waktuTerminal } from './waktu';

const kelas = (s: GameState, cfg: KonfigEkonomi): number => kelasDariLevel(levelTerminalDariXp(s.perkembangan.xpTerminal, cfg), cfg);
const dilayani = (s: GameState, cfg: KonfigEkonomi): boolean[] => jurusanDilayaniPo(s.mitra.terdaftar, kelas(s, cfg), cfg);
const loketDisewa = (s: GameState): number => s.mitra.terdaftar.reduce((a, p) => a + p.loket, 0);
/** Slot paling banyak sebuah bangunan (setelah semua perluasan). */
const slotMaks = (cfg: KonfigEkonomi, id: BangunanId): number => menurutTahap(cfg.tycoon.bangunan[id].slot, Number.MAX_SAFE_INTEGER);

export const SYARAT_PENCAPAIAN: Readonly<Record<PencapaianId, (s: GameState, cfg: KonfigEkonomi) => boolean>> = {
  petugasPertama: (s) => s.terminal.petugas.length > 0,
  fasilitasPertama: (s) => {
    const b = s.terminal.bangunan;
    return b.kios + b.toko + b.toilet + b.lahanParkir + b.posRetribusi > 0;
  },
  targetPertama: (s) => s.harian.jumlahSelesai >= 1,
  manajerOperasional: (s) => s.terminal.petugas.includes('manajerOperasional'),
  sepekan: (s) => waktuTerminal(s.statistik.waktuMainDetik).hariKe >= 7,
  jalurLima: (s) => s.terminal.bangunan.jalur >= 5,
  // Semua jurusan Jawa–Bali dilayani PO terdaftar sekaligus.
  jurusanSemua: (s, cfg) => {
    const d = dilayani(s, cfg);
    return cfg.jurusan.every((j, i) => j.feri !== undefined || d[i]);
  },
  kelasB: (s, cfg) => kelas(s, cfg) >= 1,
  tanpaRugi: (s) => s.keuangan.hariTanpaRugi >= 7,
  penumpang100rb: (s) => s.statistik.totalPenumpang >= 100_000,
  antarpulau: (s, cfg) => dilayani(s, cfg).some((ada, i) => ada && cfg.jurusan[i]!.feri !== undefined),
  // Kios, minimarket & apotek, toilet, lahan parkir, dan pos retribusi semuanya ada.
  fasilitasLengkap: (s) => {
    const b = s.terminal.bangunan;
    return b.kios >= 3 && b.toko >= 2 && b.toilet >= 1 && b.lahanParkir >= 1 && b.posRetribusi >= 1;
  },
  modernLengkap: (s) => TEKNOLOGI_IDS.every((id) => s.terminal.teknologi[id]),
  kasMiliar: (s) => s.kas >= 1_000_000_000,
  kelasA: (s, cfg) => kelas(s, cfg) >= 2,
  armadaLengkap: (s, cfg) => kelasBusDioperasikan(s.mitra.terdaftar, kelas(s, cfg), cfg).length === KELAS_BUS_IDS.length,
  // Semua slot jendela loket (setelah semua perluasan) dibangun & disewa PO.
  loketPenuh: (s, cfg) => loketDisewa(s) >= slotMaks(cfg, 'jendela'),
  terpadu: (s, cfg) => kelas(s, cfg) >= 3,
  penumpangSejuta: (s) => s.statistik.totalPenumpang >= 1_000_000,
  lintasNusantara: (s, cfg) => dilayani(s, cfg).every(Boolean),
};
