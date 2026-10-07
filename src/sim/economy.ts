/**
 * Formula ekonomi murni. Tidak boleh import Phaser atau DOM.
 *
 * Semua formula di sini harus identik dengan spreadsheet model.
 * Setiap fungsi menerima `cfg` (default: EKONOMI) supaya bisa dites
 * dengan angka tuning lain tanpa mengubah file config.
 */
import Decimal from 'break_infinity.js';
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { TAHAP_IDS, type TahapId } from './tahap';

export type KapasitasPerTahap = Readonly<Record<TahapId, number>>;

/**
 * Toleransi relatif untuk menganggap dua kapasitas "seri" saat mencari
 * bottleneck. Bukan angka tuning: hanya meredam noise floating point
 * (mis. 3.5 vs 3.5000000000000004).
 */
const TOLERANSI_SERI = 1e-9;

/** biaya_upgrade(s, L) = biayaAwal[s] × r[s]^(L − 1) */
export function biayaUpgrade(tahap: TahapId, level: number, cfg: KonfigEkonomi = EKONOMI): Decimal {
  const t = cfg.tahap[tahap];
  return Decimal.pow(t.r, level - 1).times(t.biayaAwal);
}

/** Banyaknya milestone m dengan level ≥ m. */
export function jumlahMilestone(level: number, cfg: KonfigEkonomi = EKONOMI): number {
  let n = 0;
  for (const m of cfg.milestone) {
    if (level >= m) n++;
  }
  return n;
}

/** kapasitas(s, L) = (kapAwal[s] + tambahKap[s] × (L − 1)) × multMilestone^jumlahMilestone(L), dalam pnp/dtk. */
export function kapasitas(tahap: TahapId, level: number, cfg: KonfigEkonomi = EKONOMI): number {
  const t = cfg.tahap[tahap];
  return (t.kapAwal + t.tambahKap * (level - 1)) * Math.pow(cfg.multMilestone, jumlahMilestone(level, cfg));
}

export interface ProgresMilestone {
  /** Milestone terakhir yang sudah tercapai, atau 1 kalau belum ada. */
  readonly dari: number;
  /** Milestone berikutnya, atau null kalau semua sudah tercapai. */
  readonly ke: number | null;
  /** 0–1, untuk progress bar. Bernilai 1 kalau semua milestone tercapai. */
  readonly rasio: number;
}

export function progresMilestone(level: number, cfg: KonfigEkonomi = EKONOMI): ProgresMilestone {
  let dari = 1;
  for (const m of cfg.milestone) {
    if (level < m) {
      return { dari, ke: m, rasio: (level - dari) / (m - dari) };
    }
    dari = m;
  }
  return { dari, ke: null, rasio: 1 };
}

/** throughput = min(kapasitas peron, loket, keberangkatan), dalam pnp/dtk. */
export function throughput(kap: KapasitasPerTahap): number {
  return Math.min(...TAHAP_IDS.map((id) => kap[id]));
}

/**
 * Semua tahap yang kapasitasnya sama dengan throughput (dalam toleransi),
 * urut sesuai rantai. Elemen pertama dipakai sebagai "the" bottleneck.
 */
export function daftarBottleneck(kap: KapasitasPerTahap): TahapId[] {
  const min = throughput(kap);
  return TAHAP_IDS.filter((id) => kap[id] - min <= Math.abs(min) * TOLERANSI_SERI);
}

/** 1 + poinPrestige × bonusPrestige */
export function multiplierPrestige(poinPrestige: Decimal, cfg: KonfigEkonomi = EKONOMI): Decimal {
  return poinPrestige.times(cfg.bonusPrestige).add(1);
}

/** pendapatan/detik = throughput × nilaiPerPenumpang × (1 + poinPrestige × bonusPrestige) */
export function pendapatanPerDetik(
  throughputPnp: number,
  poinPrestige: Decimal,
  cfg: KonfigEkonomi = EKONOMI,
): Decimal {
  return multiplierPrestige(poinPrestige, cfg).times(throughputPnp * cfg.nilaiPerPenumpang);
}

export function biayaKepala(tahap: TahapId, cfg: KonfigEkonomi = EKONOMI): Decimal {
  return new Decimal(cfg.tahap[tahap].biayaKepala);
}

/**
 * detikOffline = min(sekarang − terakhir, batasOffline).
 * Selisih negatif (jam HP dimundurkan) atau tidak valid menghasilkan 0.
 */
export function detikOffline(sekarangMs: number, terakhirMs: number, cfg: KonfigEkonomi = EKONOMI): number {
  const selisih = (sekarangMs - terakhirMs) / 1000;
  if (!Number.isFinite(selisih) || selisih <= 0) return 0;
  return Math.min(selisih, cfg.batasOfflineDetik);
}

/** Penghasilan offline = pendapatan/detik saat keluar × detikOffline × efisiensiOffline. */
export function pendapatanOffline(
  pendapatanPerDetikSaatKeluar: Decimal,
  detik: number,
  cfg: KonfigEkonomi = EKONOMI,
): Decimal {
  return pendapatanPerDetikSaatKeluar.times(detik * cfg.efisiensiOffline);
}

/**
 * Poin prestige dari total pendapatan satu run. 0 di bawah ambangPrestige.
 * Formula PLACEHOLDER (lihat eksponenPrestige di config); belum dari spreadsheet.
 */
export function poinPrestigeDidapat(totalPendapatanRun: Decimal, cfg: KonfigEkonomi = EKONOMI): Decimal {
  if (totalPendapatanRun.lt(cfg.ambangPrestige)) return new Decimal(0);
  return totalPendapatanRun.div(cfg.ambangPrestige).pow(cfg.eksponenPrestige).floor();
}

/** Pendapatan satu run paling sedikit supaya mendapat `poin` poin prestige (kebalikan poinPrestigeDidapat). */
export function pendapatanUntukPoin(poin: number, cfg: KonfigEkonomi = EKONOMI): Decimal {
  return Decimal.max(cfg.ambangPrestige, new Decimal(cfg.ambangPrestige).times(Decimal.pow(Math.max(0, poin), 1 / cfg.eksponenPrestige)));
}
