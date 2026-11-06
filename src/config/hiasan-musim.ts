/**
 * Hiasan Musim Terminal di adegan (documents/17 bagian 4.1–4.2, ADR 009): spanduk gapura, seragam petugas,
 * dan papan gapura per id hiasan (`{slot}-{tema}`, lihat idHiasan di sim/musim.ts). Logika kapan tampil ada di
 * game/musim-adegan.ts. Bingkai foto adalah UI (ui/foto.ts), jadi tidak di sini. Tema baru: satu baris per tabel.
 */
import type { PetugasId } from '../sim/fitur';

/** Spanduk di antara pilar gapura; letak & ukurannya sama dengan spanduk event (event3d.ts). */
export interface SpandukMusim {
  readonly teks: string;
  readonly latar: string;
  readonly warna: string;
}

/** Seragam musim: warna baju untuk peran-peran ini; celana & topi tetap. */
export interface SeragamMusim {
  readonly baju: number;
  readonly peran: readonly PetugasId[];
}

/** Papan gapura musim: warna latar & tulisan papan kelas dan papan bernama; tulisannya tetap. */
export interface PapanMusim {
  readonly latar: string;
  readonly warna: string;
}

/** Petugas yang berseragam musim (dokumen 17 bagian 4.1: petugas peron & gerbang). */
const PERAN_SERAGAM: readonly PetugasId[] = ['peron', 'gerbang'];

export const SPANDUK_MUSIM: Readonly<Record<string, SpandukMusim>> = {
  // Kuning rambu peringatan di bawah papan gapura, terbaca sebagai pita kuning walau kabur.
  'spanduk-hujan': { teks: 'SELAMAT DATANG · HATI-HATI JALAN LICIN', latar: '#facc15', warna: '#1e293b' },
  // Emas di bawah papan Imlek yang merah, supaya keduanya tidak menjadi satu blok merah.
  'spanduk-imlek': { teks: 'SELAMAT IMLEK · GONG XI FA CAI', latar: '#f59e0b', warna: '#7f1d1d' },
  // Beda warna dari spanduk event Mudik Lebaran (hijau tua), yang menang selama event berlangsung.
  'spanduk-mudik': { teks: 'MUDIK AMAN · SELAMAT SAMPAI TUJUAN', latar: '#0f766e', warna: '#fef3c7' },
};

export const SERAGAM_MUSIM: Readonly<Record<string, SeragamMusim>> = {
  'seragam-hujan': { baju: 0xfacc15, peran: PERAN_SERAGAM },
  'seragam-imlek': { baju: 0xdc2626, peran: PERAN_SERAGAM },
  'seragam-mudik': { baju: 0x15803d, peran: PERAN_SERAGAM },
};

export const PAPAN_MUSIM: Readonly<Record<string, PapanMusim>> = {
  // Biru langit, lebih muda dari papan Tipe B (biru tua) supaya tetap terbedakan.
  'papan-hujan': { latar: '#0284c7', warna: '#ffffff' },
  'papan-imlek': { latar: '#b91c1c', warna: '#fde047' },
  // Putih bertulisan hijau tua (kontras 9,1 : 1): kuning lama mirip papan Terpadu bawaan di siang hari, dan hijau
  // tua menyatu dengan spanduk event Mudik Lebaran (#166534) yang menang di bawahnya selama event berlangsung.
  'papan-mudik': { latar: '#ffffff', warna: '#14532d' },
};
