/**
 * Jam terminal (24 jam, Senin–Minggu) yang diturunkan dari waktu main aktif.
 * TypeScript murni: tidak membaca jam sistem, tidak menyimpan state sendiri.
 */
import { RITME, WAKTU, type KonfigRitme, type KonfigWaktu } from '../config/waktu.config';
import type { GameState } from './state';

export const JUMLAH_HARI_SEPEKAN = 7;

export interface WaktuTerminal {
  /** Hari ke-berapa sejak game dimulai (0 = hari pertama). */
  readonly hariKe: number;
  /** 0 = Senin … 6 = Minggu. */
  readonly indeksHari: number;
  /** 0–23. */
  readonly jam: number;
  /** 0–59. */
  readonly menit: number;
  /** Jam dengan pecahan, 0 ≤ jamDesimal < 24 (untuk pencahayaan yang halus). */
  readonly jamDesimal: number;
  /** Matahari di atas cakrawala (jamTerbit ≤ jam < jamTerbenam). */
  readonly siang: boolean;
}

export function waktuTerminal(detikMain: number, cfg: KonfigWaktu = WAKTU): WaktuTerminal {
  const totalJam = cfg.jamAwal + Math.max(0, detikMain) / cfg.detikPerJam;
  const hariKe = Math.floor(totalJam / 24);
  const jamDesimal = totalJam - hariKe * 24;
  const jam = Math.min(23, Math.floor(jamDesimal));
  const menit = Math.min(59, Math.floor((jamDesimal - jam) * 60 + 1e-9));
  return {
    hariKe,
    indeksHari: hariKe % JUMLAH_HARI_SEPEKAN,
    jam,
    menit,
    jamDesimal,
    siang: jamDesimal >= cfg.jamTerbit && jamDesimal < cfg.jamTerbenam,
  };
}

export function waktuTerminalState(state: GameState, cfg: KonfigWaktu = WAKTU): WaktuTerminal {
  return waktuTerminal(state.statistik.waktuMainDetik, cfg);
}

const langkahHalus = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Lebar landai di tepi rentang penyesuaian hari (jam). */
const LANDAI_HARI = 1.5;

/**
 * Keramaian penumpang (0–1) pada jam & hari tertentu: kurva hari biasa
 * ditambah penyesuaian hari itu (mis. Jumat sore, Minggu sore). Kontinu
 * sepanjang pekan, termasuk saat berganti hari di tengah malam.
 */
export function keramaianTerminal(w: Pick<WaktuTerminal, 'jamDesimal' | 'indeksHari'>, cfg: KonfigRitme = RITME): number {
  const j = Math.min(24, Math.max(0, w.jamDesimal));
  let dasar = cfg.jam[cfg.jam.length - 1]![1];
  for (let i = 1; i < cfg.jam.length; i++) {
    const [ja, ka] = cfg.jam[i - 1]!;
    const [jb, kb] = cfg.jam[i]!;
    if (j <= jb) {
      dasar = ka + (kb - ka) * langkahHalus(ja, jb, j);
      break;
    }
  }
  let tambahan = 0;
  for (const [mulai, selesai, nilai] of cfg.hari[w.indeksHari] ?? []) {
    tambahan += nilai * langkahHalus(mulai, mulai + LANDAI_HARI, j) * (1 - langkahHalus(selesai - LANDAI_HARI, selesai, j));
  }
  return Math.min(1, Math.max(0, dasar + tambahan));
}

export type TingkatKeramaian = 'sibuk' | 'ramai' | 'sedang' | 'sepi';

export function tingkatKeramaian(keramaian: number, cfg: KonfigRitme = RITME): TingkatKeramaian {
  const { sibuk, ramai, sedang } = cfg.ambangLabel;
  return keramaian >= sibuk ? 'sibuk' : keramaian >= ramai ? 'ramai' : keramaian >= sedang ? 'sedang' : 'sepi';
}
