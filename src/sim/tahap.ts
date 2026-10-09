/**
 * Tiga area rantai penumpang, urut sesuai alur: Peron (halte kedatangan) →
 * Loket (jendela loket) → Keberangkatan (gerbang). Dipakai untuk zona & warna
 * di adegan dan area modernisasi. Kapasitasnya dari bangunan & petugas (lihat
 * sim/operasi.ts); area keempat, pangkalan bus, tidak punya zona sendiri.
 */
export const TAHAP_IDS = ['peron', 'loket', 'keberangkatan'] as const;

export type TahapId = (typeof TAHAP_IDS)[number];

export function isTahapId(nilai: unknown): nilai is TahapId {
  return typeof nilai === 'string' && (TAHAP_IDS as readonly string[]).includes(nilai);
}
