/**
 * Iklan berhadiah: pemain SENDIRI memilih menonton iklan untuk hadiah (boost
 * pendapatan, Bus Emas, hadiah 2×, percepat proyek). Penyedianya (iklan contoh, Google H5 Games
 * Ads, CrazyGames, AdMob) diimplementasikan di platform/iklan.ts; UI hanya
 * memakai kontrak ini, jadi penyedia bisa diganti tanpa menyentuh mekaniknya.
 */

/** Tempat tombol iklan (untuk laporan penyedia & membedakan hadiah). */
export type TempatIklan = 'offline2x' | 'boost' | 'busEmas' | 'target2x' | 'penghargaan2x' | 'percepatProyek';

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

/**
 * Putar iklan berhadiah di `tempat` dan laporkan hasilnya (analitik); galat penyedia dihitung 'gagal'.
 * @returns true hanya bila iklan selesai ditonton (hadiah boleh diberikan).
 */
export async function tontonBerhadiah(penyedia: Pick<PenyediaIklan, 'tonton'>, tempat: TempatIklan, lapor: (hasil: HasilIklan) => void): Promise<boolean> {
  const hasil = await penyedia.tonton(tempat).catch((): HasilIklan => 'gagal');
  lapor(hasil);
  return hasil === 'ditonton';
}

/**
 * Satu-satunya jalan hadiah iklan ke aksi (klaim 2×, Bus Emas, offline 2×, boost, percepat proyek):
 * `beri` (kirim aksinya) dijalankan hanya setelah iklan selesai ditonton; dilewati, gagal, atau galat
 * tidak memberi apa pun. `tonton` dipanggil seketika (sinkron), jadi penyedia seperti H5 Games Ads
 * tetap memutarnya di dalam ketukan pemain.
 * @returns true bila hadiah diberikan.
 */
export async function hadiahSetelahIklan(tonton: () => Promise<boolean>, beri: () => void): Promise<boolean> {
  const ok = await tonton().catch(() => false);
  if (ok) beri();
  return ok;
}
