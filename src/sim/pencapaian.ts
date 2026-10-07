/**
 * Syarat tiap pencapaian (penghargaan terminal). Murni: hanya membaca data
 * GameState, dicek tiap tick (lihat `perbaruiPencapaian` di state.ts). Tidak
 * meng-import state.ts (state.ts yang memakai modul ini), jadi turunan ekonomi
 * v2 diambil dari modul murni mitra.ts & level-terminal.ts.
 */
import type { KonfigEkonomi } from '../config/economy.config';
import { FASILITAS_IDS, KELAS_BUS_IDS, TEKNOLOGI_IDS, type PencapaianId } from './fitur';
import { kelasDariLevel, levelTerminalDariXp } from './level-terminal';
import { jurusanDilayaniPo, kelasBusDioperasikan } from './mitra';
import type { GameState } from './state';
import { TAHAP_IDS } from './tahap';
import { waktuTerminal } from './waktu';

const semuaLevel = (s: GameState, min: number): boolean => TAHAP_IDS.every((id) => s.terminal.tahap[id].level >= min);
const kelas = (s: GameState, cfg: KonfigEkonomi): number => kelasDariLevel(levelTerminalDariXp(s.perkembangan.xpTerminal, cfg), cfg);
const dilayani = (s: GameState, cfg: KonfigEkonomi): boolean[] => jurusanDilayaniPo(s.mitra.terdaftar, kelas(s, cfg), cfg);

export const SYARAT_PENCAPAIAN: Readonly<Record<PencapaianId, (s: GameState, cfg: KonfigEkonomi) => boolean>> = {
  kepalaPertama: (s) => TAHAP_IDS.some((id) => s.terminal.tahap[id].kepala.direkrut),
  fasilitasPertama: (s) => FASILITAS_IDS.some((id) => s.terminal.fasilitas[id] > 0),
  semuaOtomatis: (s) => TAHAP_IDS.every((id) => s.terminal.tahap[id].kepala.direkrut),
  targetPertama: (s) => s.harian.jumlahSelesai >= 1,
  // Level tahap Loket = banyaknya loket milik terminal.
  level25: (s) => semuaLevel(s, 25),
  penumpang100rb: (s) => s.statistik.totalPenumpang >= 100_000,
  sepekan: (s) => waktuTerminal(s.statistik.waktuMainDetik).hariKe >= 7,
  fasilitasLengkap: (s) => FASILITAS_IDS.every((id) => s.terminal.fasilitas[id] >= 10),
  jalurLengkap: (s, cfg) => s.terminal.jalur >= 1 + cfg.jalur.biaya.length,
  // Semua jurusan Jawa–Bali dilayani PO terdaftar sekaligus.
  jurusanSemua: (s, cfg) => {
    const d = dilayani(s, cfg);
    return cfg.jurusan.every((j, i) => j.feri !== undefined || d[i]);
  },
  antarpulau: (s, cfg) => dilayani(s, cfg).some((ada, i) => ada && cfg.jurusan[i]!.feri !== undefined),
  kelasB: (s, cfg) => kelas(s, cfg) >= 1,
  modernLengkap: (s) => TEKNOLOGI_IDS.every((id) => s.terminal.teknologi[id]),
  level100: (s) => semuaLevel(s, 100),
  kelasA: (s, cfg) => kelas(s, cfg) >= 2,
  armadaLengkap: (s, cfg) => kelasBusDioperasikan(s.mitra.terdaftar, kelas(s, cfg), cfg).length === KELAS_BUS_IDS.length,
  penumpang10jt: (s) => s.statistik.totalPenumpang >= 10_000_000,
  lintasNusantara: (s, cfg) => dilayani(s, cfg).every(Boolean),
};
