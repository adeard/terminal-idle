/**
 * Iklan berhadiah: pemain SENDIRI memilih menonton iklan untuk hadiah (boost
 * pendapatan, Bus Emas, hadiah 2×). Penyedianya (iklan contoh, Google H5 Games
 * Ads, CrazyGames, AdMob) diimplementasikan di platform/iklan.ts; UI hanya
 * memakai kontrak ini, jadi penyedia bisa diganti tanpa menyentuh mekaniknya.
 */

/** Tempat tombol iklan (untuk laporan penyedia & membedakan hadiah). */
export type TempatIklan = 'offline2x' | 'boost' | 'busEmas' | 'target2x' | 'penghargaan2x';

/** ditonton = hadiah boleh diberikan; dilewati = pemain menutup sebelum selesai; gagal = iklan tidak tersedia/galat. */
export type HasilIklan = 'ditonton' | 'dilewati' | 'gagal';

export interface PenyediaIklan {
  readonly nama: string;
  /** Tombol hadiah hanya ditampilkan kalau iklan berhadiah bisa diputar sekarang. */
  siap(): boolean;
  tonton(tempat: TempatIklan): Promise<HasilIklan>;
}

/** Tanpa penyedia (mis. belum disetujui): semua tombol hadiah disembunyikan. */
export const TANPA_IKLAN: PenyediaIklan = {
  nama: 'nonaktif',
  siap: () => false,
  tonton: async () => 'gagal',
};
