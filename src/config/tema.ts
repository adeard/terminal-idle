/**
 * Warna bersama untuk scene Phaser (angka 0xRRGGBB) dan overlay DOM (CSS).
 * Murni visual; angka ekonomi ada di economy.config.ts.
 */
import type { AreaId } from '../sim/operasi';
import type { TahapId } from '../sim/tahap';

export const WARNA_TAHAP: Readonly<Record<TahapId, number>> = {
  peron: 0x2a9d8f,
  loket: 0xe9a23b,
  keberangkatan: 0x5b6ee1,
};

/** Warna tiap area (label di peta & kartu kapasitas): rantai penumpang mengikuti WARNA_TAHAP, pangkalan ungu. */
export const WARNA_AREA: Readonly<Record<AreaId, number>> = {
  ...WARNA_TAHAP,
  pangkalan: 0xa78bfa,
};

export const WARNA = {
  bottleneck: 0xe63946,
  tanah: 0x4a6b4f,
  jalan: 0x3b3f47,
  markaJalan: 0xe8e2cf,
  trotoar: 0x9aa0a6,
  beton: 0xcfc8b8,
  garisLajur: 0xffffff,
  dindingLoket: 0xf1e3c8,
  jalanKaki: 0xd9d2c0,
  teksGelap: 0x1d232b,
} as const;

export const WARNA_BUS: readonly number[] = [
  0xe63946, 0xf4a261, 0x2a9d8f, 0x457b9d, 0x9b5de5, 0xf15bb5, 0x00bbf9, 0xfee440, 0x06d6a0,
];

export function keHexCss(warna: number): string {
  return `#${warna.toString(16).padStart(6, '0')}`;
}
