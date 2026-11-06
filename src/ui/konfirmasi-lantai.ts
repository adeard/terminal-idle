/**
 * Konfirmasi ketuk kedua tombol "Tambah lantai" (temuan playtest T-1; murni, tanpa DOM, dipasang menu.ts).
 * Bila kas sesudah membeli di bawah cadangan B (`ModelLantai.peringatanKas`, aturan aman baris tujuan), ketukan
 * pertama hanya meminta konfirmasi; ketukan kedua pada gedung yang sama sebelum batas waktunya (sama dengan tombol
 * Bongkar) membeli. Aksi lain membatalkan konfirmasi. Bila kas aman, sekali ketuk langsung membeli.
 */
import type { Aksi } from '../sim/aksi';
import type { GedungLantaiId } from '../sim/fitur';

/** Konfirmasi yang menunggu ketukan kedua: gedungnya dan sampai kapan (ms, `performance.now()`). */
export interface KonfirmasiLantai {
  readonly gedung: GedungLantaiId;
  readonly sampaiMs: number;
}

/** Ketukan tombol beli lantai: `beli` = kirim aksinya sekarang; `konfirmasi` = keadaan konfirmasi sesudahnya. */
export function ketukBeliLantai(
  k: KonfirmasiLantai | null,
  gedung: GedungLantaiId,
  perluYakin: boolean,
  sekarangMs: number,
  msYakin: number,
): { readonly beli: boolean; readonly konfirmasi: KonfirmasiLantai | null } {
  if (!perluYakin || menungguKonfirmasi(k, gedung, sekarangMs)) return { beli: true, konfirmasi: null };
  return { beli: false, konfirmasi: { gedung, sampaiMs: sekarangMs + msYakin } };
}

/** Gedung ini sedang menunggu ketukan kedua. */
export function menungguKonfirmasi(k: KonfirmasiLantai | null, gedung: GedungLantaiId, sekarangMs: number): boolean {
  return k !== null && k.gedung === gedung && sekarangMs < k.sampaiMs;
}

/** Aksi lain yang dikirim pemain membatalkan konfirmasi (membeli lantai yang sama tidak). */
export function konfirmasiSesudahAksi(k: KonfirmasiLantai | null, aksi: Aksi): KonfirmasiLantai | null {
  return k !== null && aksi.jenis === 'tambahLantai' && aksi.gedung === k.gedung ? k : null;
}
