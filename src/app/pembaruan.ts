/**
 * Logika pembaruan versi (murni, tanpa DOM): membaca versi.json rilis baru,
 * membandingkan versi, dan menentukan apakah pembaruan wajib. Platform
 * (service worker PWA, nanti APK) ada di src/platform/pembaruan.ts, tampilan di
 * src/ui/popup-pembaruan.ts.
 */

export interface InfoRilis {
  readonly versi: string;
  /** Versi di bawah ini wajib diperbarui. */
  readonly versiMinimal: string;
  /** Butir "Yang baru" (boleh kosong). */
  readonly catatan: readonly string[];
}

/** Paling banyak sekian butir catatan yang ditampilkan di popup. */
export const MAKS_CATATAN = 5;

/**
 * Bandingkan dua versi "mayor.minor.patch" (akhiran seperti "-beta" diabaikan):
 * negatif bila a < b, 0 bila sama, positif bila a > b. Bagian yang tidak ada = 0.
 */
export function bandingkanVersi(a: string, b: string): number {
  const angka = (v: string): number[] =>
    v
      .trim()
      .replace(/^v/i, '')
      .split(/[-+]/)[0]!
      .split('.')
      .map((x) => Number.parseInt(x, 10) || 0);
  const pa = angka(a);
  const pb = angka(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Validasi isi versi.json; null bila bentuknya tidak dikenali (popup tetap muncul tanpa detail). */
export function bacaInfoRilis(data: unknown): InfoRilis | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.versi !== 'string' || d.versi.trim() === '') return null;
  const versiMinimal = typeof d.versiMinimal === 'string' ? d.versiMinimal : '0.0.0';
  const catatan = Array.isArray(d.catatan) ? d.catatan.filter((c): c is string => typeof c === 'string' && c.trim() !== '').slice(0, MAKS_CATATAN) : [];
  return { versi: d.versi.trim(), versiMinimal, catatan };
}

/** Pembaruan wajib bila versi yang sedang berjalan di bawah versi minimal rilis baru. */
export function pembaruanWajib(versiSekarang: string, info: InfoRilis | null): boolean {
  return info !== null && bandingkanVersi(versiSekarang, info.versiMinimal) < 0;
}

/** Teks "0.1.0 → 0.2.0"; null bila versi baru tidak diketahui atau sama (mis. perbaikan tanpa naik versi). */
export function teksPerubahanVersi(versiSekarang: string, info: InfoRilis | null): string | null {
  if (!info || bandingkanVersi(info.versi, versiSekarang) === 0) return null;
  return `${versiSekarang} → ${info.versi}`;
}
