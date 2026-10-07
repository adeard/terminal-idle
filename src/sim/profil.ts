/**
 * Profil pemain (murni): nama terminal yang dipilih pemain. Tetap walau naik
 * kelas terminal (terminalnya dibangun ulang, namanya tidak berubah). Tampil
 * di papan gapura adegan, kartu kelas, dan foto yang dibagikan; tidak pernah
 * dikirim ke analitik.
 */

/** Panjang nama paling banyak (muat di papan gapura setelah kata TERMINAL). */
export const MAKS_NAMA_TERMINAL = 18;

/**
 * Rapikan nama ketikan pemain: hanya huruf, angka, spasi, titik, tanda hubung,
 * & apostrof; spasi berlebih dirapatkan; awalan "Terminal" dibuang (papan sudah
 * menuliskannya); dipotong ke MAKS_NAMA_TERMINAL. String kosong = nama bawaan.
 */
export function rapikanNamaTerminal(teks: string): string {
  const bersih = teks
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} .'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^terminal(\s+|$)/i, '');
  return bersih.slice(0, MAKS_NAMA_TERMINAL).trim();
}
