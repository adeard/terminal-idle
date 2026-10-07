/**
 * DIBUAT OTOMATIS oleh `npm run aset` (tools/aset/potong.mjs). Jangan diedit manual.
 * Posisi & ukuran frame di atlas public/aset/atlas.png (piksel); kakiX/kakiY = titik
 * pijak (origin sprite); warna = warna dominan pita atas (atap bus).
 */
export type ArahHadap = 'kanan' | 'kiri' | 'depan' | 'belakang';

export interface InfoFrame {
  /** Posisi kiri-atas frame di atlas (px). */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly kakiX: number;
  readonly kakiY: number;
  readonly warna: number;
  readonly hadap?: ArahHadap;
}

export const UKURAN_ATLAS = { w: 512, h: 512 } as const;

export const FRAME_ASET = {
  'bus/hijau-1': { x: 185, y: 263, w: 166, h: 66, kakiX: 82.5, kakiY: 65, warna: 0x64b651 },
  'bus/biru-1': { x: 6, y: 263, w: 167, h: 66, kakiX: 83.5, kakiY: 65, warna: 0x5396ca },
  'bus/oranye-1': { x: 166, y: 6, w: 171, h: 66, kakiX: 84.5, kakiY: 65, warna: 0xe9793b },
  'bus/kuning-1': { x: 189, y: 107, w: 169, h: 66, kakiX: 83, kakiY: 65, warna: 0xf2cd3f },
  'bus/hijau-2': { x: 6, y: 341, w: 166, h: 66, kakiX: 83, kakiY: 65, warna: 0x64b552 },
  'bus/biru-2': { x: 187, y: 185, w: 168, h: 66, kakiX: 84, kakiY: 65, warna: 0x5495c7 },
  'bus/oranye-2': { x: 6, y: 107, w: 171, h: 66, kakiX: 84.5, kakiY: 65, warna: 0xe8793b },
  'bus/kuning-2': { x: 6, y: 185, w: 169, h: 66, kakiX: 82.5, kakiY: 65, warna: 0xf1cd41 },
  'bus/van-putih': { x: 304, y: 341, w: 90, h: 58, kakiX: 44.5, kakiY: 57, warna: 0xbdc2bf },
  'bus/minibus-kuning': { x: 184, y: 341, w: 108, h: 62, kakiX: 55.5, kakiY: 61, warna: 0xf3cb47 },
  'bus/tingkat-oranye': { x: 6, y: 6, w: 148, h: 89, kakiX: 73, kakiY: 88, warna: 0xe9793b },
} as const satisfies Record<string, InfoFrame>;

export type NamaFrame = keyof typeof FRAME_ASET;
