/**
 * Kalender event musiman menurut tanggal nyata di Indonesia (WIB). Murni:
 * waktu selalu jadi parameter; sesi (app/sesi.ts) yang memanggil
 * perbaruiEvent (state.ts) dengan jam dinding.
 *
 *   - Mudik Lebaran: H−10 sampai H+7 Idul Fitri (tanggalnya perkiraan);
 *   - HUT RI: 10–20 Agustus;
 *   - Libur Natal & Tahun Baru (Nataru): 20 Desember – 5 Januari.
 */
import type { EventId } from './fitur';

export interface JadwalEvent {
  readonly id: EventId;
  /** Kunci edisi, mis. "mudikLebaran-2027": progres & hadiah dicatat per edisi. */
  readonly edisi: string;
  readonly tahun: number;
  /** Mulai (inklusif) & selesai (eksklusif), ms epoch. */
  readonly mulaiMs: number;
  readonly selesaiMs: number;
}

const WIB_MS = 7 * 3_600_000;
const HARI_MS = 86_400_000;

/** 00:00 WIB tanggal itu (bulan 1–12). */
export const tengahMalamWib = (tahun: number, bulan: number, tanggal: number): number => Date.UTC(tahun, bulan - 1, tanggal) - WIB_MS;

const tahunWib = (ms: number): number => new Date(ms + WIB_MS).getUTCFullYear();
/** Bulatkan ke 00:00 WIB terdekat. */
const bulatkanHariWib = (ms: number): number => Math.round((ms + WIB_MS) / HARI_MS) * HARI_MS - WIB_MS;

/**
 * Perkiraan 1 Syawal (Idul Fitri) di Indonesia [bulan, tanggal]. Tahun di luar
 * tabel diperkirakan dengan melangkah per tahun hijriah (±354,37 hari).
 */
const IDUL_FITRI: Readonly<Record<number, readonly [number, number]>> = {
  2025: [3, 31],
  2026: [3, 20],
  2027: [3, 10],
  2028: [2, 27],
  2029: [2, 15],
  2030: [2, 5],
};
const TAHUN_HIJRIAH_MS = 354.367 * HARI_MS;
const TAHUN_TABEL = Object.keys(IDUL_FITRI).map(Number);

export function idulFitri(tahun: number): number {
  const d = IDUL_FITRI[tahun];
  if (d) return tengahMalamWib(tahun, d[0], d[1]);
  const acuan = tahun > Math.max(...TAHUN_TABEL) ? Math.max(...TAHUN_TABEL) : Math.min(...TAHUN_TABEL);
  const [b, t] = IDUL_FITRI[acuan]!;
  let ms = tengahMalamWib(acuan, b, t);
  if (tahun > acuan) while (tahunWib(ms) < tahun) ms += TAHUN_HIJRIAH_MS;
  else while (tahunWib(ms) > tahun) ms -= TAHUN_HIJRIAH_MS;
  return bulatkanHariWib(ms);
}

/** Jadwal ketiga event yang dimulai pada tahun itu. */
export function jadwalTahun(tahun: number): JadwalEvent[] {
  const lebaran = idulFitri(tahun);
  return [
    { id: 'mudikLebaran', edisi: `mudikLebaran-${tahun}`, tahun, mulaiMs: lebaran - 10 * HARI_MS, selesaiMs: lebaran + 8 * HARI_MS },
    { id: 'hutRi', edisi: `hutRi-${tahun}`, tahun, mulaiMs: tengahMalamWib(tahun, 8, 10), selesaiMs: tengahMalamWib(tahun, 8, 21) },
    { id: 'nataru', edisi: `nataru-${tahun}`, tahun, mulaiMs: tengahMalamWib(tahun, 12, 20), selesaiMs: tengahMalamWib(tahun + 1, 1, 6) },
  ];
}

/** Event yang berlangsung pada waktu itu, atau null. */
export function eventPada(ms: number): JadwalEvent | null {
  const tahun = tahunWib(ms);
  for (const t of [tahun - 1, tahun]) for (const j of jadwalTahun(t)) if (ms >= j.mulaiMs && ms < j.selesaiMs) return j;
  return null;
}

/** Event berikutnya yang dimulai setelah waktu itu (untuk "event berikutnya"). */
export function eventBerikutnya(ms: number): JadwalEvent {
  const tahun = tahunWib(ms);
  const semua = [...jadwalTahun(tahun), ...jadwalTahun(tahun + 1)].filter((j) => j.mulaiMs > ms);
  return semua.reduce((a, b) => (b.mulaiMs < a.mulaiMs ? b : a));
}

/** Edisi uji (server dev, ?event=…): mulai sejam lalu, berlangsung seminggu. */
export function jadwalUji(id: EventId, ms: number): JadwalEvent {
  return { id, edisi: `${id}-uji`, tahun: tahunWib(ms), mulaiMs: ms - 3_600_000, selesaiMs: ms + 7 * HARI_MS };
}
