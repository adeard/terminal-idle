/**
 * Daftar tahap dalam rantai penumpang, urut sesuai alur:
 * Peron → Loket → Keberangkatan.
 *
 * Urutan array ini juga dipakai sebagai tie-breaker bottleneck
 * (kalau kapasitas sama, tahap yang lebih awal dianggap bottleneck).
 */
export const TAHAP_IDS = ['peron', 'loket', 'keberangkatan'] as const;

export type TahapId = (typeof TAHAP_IDS)[number];

export function isTahapId(nilai: unknown): nilai is TahapId {
  return typeof nilai === 'string' && (TAHAP_IDS as readonly string[]).includes(nilai);
}
