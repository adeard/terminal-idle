/**
 * Iklan berhadiah Google H5 Games Ads (AdSense untuk game H5, Ad Placement API).
 * Kosong = nonaktif: pemain biasa tidak melihat tombol hadiah (lihat platform/iklan.ts).
 *
 * Mengaktifkan:
 *   1. daftar Google AdSense, lalu isi ID penerbit di sini (mis. 'ca-pub-1234567890123456').
 *      Build berikutnya otomatis memasang meta verifikasi AdSense & /ads.txt (vite.config.ts);
 *   2. deploy, tunggu situs disetujui AdSense, lalu ajukan H5 Games Ads untuk bustation.games;
 *   3. di AdSense → Privasi & pesan, aktifkan pesan persetujuan untuk Eropa (kebijakan privasi
 *      menjanjikannya, lihat public/privasi.html bagian 2f);
 *   4. coba di situs dengan ?iklan=uji (iklan uji Google, tanpa pendapatan).
 * Selama Google belum memberi iklan (belum disetujui, stok kosong), tombol hadiah tetap
 * tersembunyi dengan sendirinya, jadi ID boleh diisi sebelum H5 Games Ads disetujui.
 */
export const ID_PENERBIT_ADSENSE = '';

/** ID penerbit sah: "ca-pub-" lalu 16 angka. */
export function idPenerbitSah(id: string): boolean {
  return /^ca-pub-\d{16}$/.test(id);
}
