/**
 * Aset hasil potongan assets/master.jpg (lihat tools/aset/). Posisi & ukuran
 * frame atlas ada di aset-data.ts (dibuat otomatis oleh `npm run aset`).
 * Tidak import three.js supaya bisa dites.
 */
import { FRAME_ASET, UKURAN_ATLAS, type InfoFrame, type NamaFrame } from './aset-data';
import { RODA_BUS } from './kelas-bus';
import { BUS } from './tata-letak';

/** Relatif terhadap index.html (Vite menyalin public/ ke akar dist/). */
export const URL_ATLAS = 'aset/atlas.png';

export function infoFrame(nama: NamaFrame): InfoFrame {
  return FRAME_ASET[nama];
}

/** Persegi UV (konvensi three.js: flipY, v = 0 di bawah gambar). */
export interface PersegiUv {
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

/**
 * UV sebuah frame: u0/u1 = tepi kiri/kanan, v0 = tepi bawah, v1 = tepi atas.
 * Masuk setengah piksel supaya filter tekstur tidak mengambil tetangga di atlas.
 */
export function uvFrame(nama: NamaFrame): PersegiUv {
  const f = FRAME_ASET[nama];
  const W = UKURAN_ATLAS.w;
  const H = UKURAN_ATLAS.h;
  return { u0: (f.x + 0.5) / W, u1: (f.x + f.w - 0.5) / W, v0: 1 - (f.y + f.h - 0.5) / H, v1: 1 - (f.y + 0.5) / H };
}

// ---------------------------------------------------------------------------
// Kendaraan: gambar tampak samping (depan di kanan) ditempel ke sisi balok bus

export interface TipeKendaraan {
  readonly frame: NamaFrame;
  /** Dimensi badan (unit; 1 unit ≈ 5 m). */
  readonly panjang: number;
  readonly lebar: number;
  readonly tinggi: number;
  /** Warna atap & muka depan/belakang (dari pita atas gambar). */
  readonly warna: number;
  /**
   * Roda 3D menutupi roda yang tergambar: posisi pusat roda sepanjang badan
   * (0 = belakang, 1 = depan) dan jari-jari (unit), diukur dari gambar samping.
   */
  readonly roda: { readonly u: readonly [number, number]; readonly r: number };
  /** Punya pintu depan yang bisa terbuka di halte (bus terminal). */
  readonly pintu: boolean;
  /** Tinggi lubang pintu depan (unit); bawaan 0,7 × tinggi badan. */
  readonly tinggiPintu?: number;
}

const kendaraan = (
  frame: NamaFrame,
  panjang: number,
  tinggi: number,
  lebar: number,
  opsi: { warna?: number; roda?: TipeKendaraan['roda']; pintu?: boolean } = {},
): TipeKendaraan => ({
  frame,
  panjang,
  lebar,
  tinggi,
  warna: opsi.warna ?? infoFrame(frame).warna,
  roda: opsi.roda ?? RODA_BUS,
  pintu: opsi.pintu ?? false,
});

/** Bus yang singgah di terminal (panjang harus sama dengan BUS.panjang di tata-letak). */
export const BUS_TERMINAL: readonly TipeKendaraan[] = (
  ['bus/hijau-1', 'bus/biru-1', 'bus/oranye-1', 'bus/kuning-1', 'bus/hijau-2', 'bus/biru-2', 'bus/oranye-2', 'bus/kuning-2'] as const
).map((frame) => kendaraan(frame, BUS.panjang, 0.8, BUS.lebar, { pintu: true }));

/** Kendaraan yang hanya lewat di jalan raya. */
export const KENDARAAN_LEWAT: readonly TipeKendaraan[] = [
  kendaraan('bus/tingkat-oranye', BUS.panjang, 0.96, BUS.lebar, { roda: { u: [0.28, 0.72], r: 0.1 } }),
  kendaraan('bus/van-putih', 1.25, 0.48, 0.42, { warna: 0xe5e7eb, roda: { u: [0.2, 0.78], r: 0.075 } }),
  kendaraan('bus/minibus-kuning', 1.55, 0.56, 0.45, { roda: { u: [0.25, 0.8], r: 0.08 } }),
  kendaraan('bus/biru-2', BUS.panjang, 0.8, BUS.lebar),
  kendaraan('bus/hijau-1', BUS.panjang, 0.8, BUS.lebar),
];
