/**
 * Hiasan Musim Terminal yang tampil di adegan (documents/17 bagian 4.2, murni, tanpa three.js): dari hiasan
 * yang dipakai (hiasanAktif di sim/musim.ts) dan event yang berlangsung. Hanya id yang punya data di
 * config/hiasan-musim.ts yang tampil; null = tampilan bawaan. Dipanggil tiap frame, jadi tanpa alokasi.
 */
import { PAPAN_MUSIM, SERAGAM_MUSIM, SPANDUK_MUSIM } from '../config/hiasan-musim';
import type { SlotHiasan } from '../config/musim.config';
import type { EventId, PetugasId } from '../sim/fitur';

type Pakai = Readonly<Record<SlotHiasan, string | null>>;

/** Spanduk musim di gapura: spanduk event selalu menang, karena tempatnya sama. */
export function spandukMusim(pakai: Pakai, event: EventId | null): string | null {
  const id = pakai.spanduk;
  return event === null && id !== null && SPANDUK_MUSIM[id] ? id : null;
}

/** Papan gapura musim (null = warna papan kelas bawaan). */
export function papanMusim(pakai: Pakai): string | null {
  const id = pakai.papan;
  return id !== null && PAPAN_MUSIM[id] ? id : null;
}

/** Seragam musim yang dipakai (null = seragam bawaan). */
export function seragamMusim(pakai: Pakai): string | null {
  const id = pakai.seragam;
  return id !== null && SERAGAM_MUSIM[id] ? id : null;
}

/** Warna baju petugas peran ini dengan seragam musim; null = seragam bawaan (peran lain, atau tanpa seragam musim). */
export function bajuMusim(peran: PetugasId, seragam: string | null): number | null {
  const s = seragam === null ? undefined : SERAGAM_MUSIM[seragam];
  return s && s.peran.includes(peran) ? s.baju : null;
}
