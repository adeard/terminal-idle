/**
 * Syarat tiap pencapaian (penghargaan terminal). Murni: hanya membaca data
 * GameState, dicek tiap tick (lihat `perbaruiPencapaian` di state.ts).
 */
import type { KonfigEkonomi } from '../config/economy.config';
import { FASILITAS_IDS, KELAS_BUS_IDS, TEKNOLOGI_IDS, type PencapaianId } from './fitur';
import type { GameState } from './state';
import { TAHAP_IDS } from './tahap';
import { waktuTerminal } from './waktu';

const semuaLevel = (s: GameState, min: number): boolean => TAHAP_IDS.every((id) => s.terminal.tahap[id].level >= min);

export const SYARAT_PENCAPAIAN: Readonly<Record<PencapaianId, (s: GameState, cfg: KonfigEkonomi) => boolean>> = {
  kepalaPertama: (s) => TAHAP_IDS.some((id) => s.terminal.tahap[id].kepala.direkrut),
  fasilitasPertama: (s) => FASILITAS_IDS.some((id) => s.terminal.fasilitas[id] > 0),
  semuaOtomatis: (s) => TAHAP_IDS.every((id) => s.terminal.tahap[id].kepala.direkrut),
  targetPertama: (s) => s.harian.jumlahSelesai >= 1,
  level25: (s) => semuaLevel(s, 25),
  penumpang100rb: (s) => s.statistik.totalPenumpang >= 100_000,
  sepekan: (s) => waktuTerminal(s.statistik.waktuMainDetik).hariKe >= 7,
  fasilitasLengkap: (s) => FASILITAS_IDS.every((id) => s.terminal.fasilitas[id] >= 10),
  jalurLengkap: (s, cfg) => s.terminal.jalur >= 1 + cfg.jalur.biaya.length,
  // Jurusan Jawa–Bali (urut lebih dulu dari rute antarpulau).
  jurusanSemua: (s, cfg) => s.terminal.jurusanBuka >= cfg.jurusan.filter((j) => j.feri === undefined).length,
  antarpulau: (s, cfg) => cfg.jurusan.slice(0, s.terminal.jurusanBuka).some((j) => j.feri !== undefined),
  kelasB: (s) => s.prestige.jumlahReset >= 1,
  modernLengkap: (s) => TEKNOLOGI_IDS.every((id) => s.terminal.teknologi[id]),
  level100: (s) => semuaLevel(s, 100),
  kelasA: (s) => s.prestige.jumlahReset >= 2,
  armadaLengkap: (s) => KELAS_BUS_IDS.every((id) => s.terminal.kelasBus[id]),
  penumpang10jt: (s) => s.statistik.totalPenumpang >= 10_000_000,
  lintasNusantara: (s, cfg) => s.terminal.jurusanBuka >= cfg.jurusan.length,
};
