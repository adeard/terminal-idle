/**
 * Fixed timestep: ubah waktu frame (variabel) menjadi sejumlah tick
 * berukuran tetap, supaya hasil simulasi tidak bergantung pada frame rate.
 */
import { EKONOMI, SIMULASI, type KonfigEkonomi, type KonfigSimulasi } from '../config/economy.config';
import { tick, type GameState } from './state';

/** Meredam drift floating point saat akumulator dikurangi berulang kali. */
const EPSILON_AKUMULATOR = 1e-9;

export interface HasilLangkah {
  readonly state: GameState;
  /** Sisa waktu yang belum cukup untuk satu tick; bawa ke frame berikutnya. */
  readonly akumulatorDetik: number;
  readonly jumlahTick: number;
}

export function majukanWaktu(
  state: GameState,
  akumulatorDetik: number,
  dtFrameDetik: number,
  cfgSim: KonfigSimulasi = SIMULASI,
  cfg: KonfigEkonomi = EKONOMI,
): HasilLangkah {
  const dtTick = 1 / cfgSim.tickPerDetik;
  const dtFrame = Number.isFinite(dtFrameDetik) ? Math.min(Math.max(dtFrameDetik, 0), cfgSim.maksKejarDetik) : 0;

  let akumulator = akumulatorDetik + dtFrame;
  let s = state;
  let jumlahTick = 0;
  while (akumulator + EPSILON_AKUMULATOR >= dtTick) {
    s = tick(s, dtTick, cfg);
    akumulator -= dtTick;
    jumlahTick++;
  }
  return { state: s, akumulatorDetik: Math.max(0, akumulator), jumlahTick };
}
