/**
 * Informasi rilis. Saat build, vite.config.ts menulisnya ke `versi.json` (bersama
 * `version` dari package.json). Game yang sedang berjalan di perangkat pemain
 * membaca versi.json milik rilis BARU untuk isi popup pembaruan.
 *
 * Cara merilis versi baru: naikkan `version` di package.json, isi `catatan`,
 * lalu build & deploy folder dist/.
 */
export const RILIS = {
  /**
   * Versi di bawah ini wajib diperbarui: popup muncul tanpa tombol "Nanti"
   * (mis. bila format save berubah dan versi lama tidak boleh dipakai lagi).
   */
  // 0.3.1: ekonomi kontrak PO. Versi lama yang membuka save baru memungut biaya layanan lagi dan
  // menyimpan ulang PO tanpa data kontraknya, jadi tidak boleh dipakai lagi.
  versiMinimal: '0.3.1',
  /** Catatan singkat "Yang baru" di versi ini, ditampilkan di popup (±4 butir). */
  catatan: [
    'Penumpang kini hanya membayar tiket PO: biaya layanan & tarif toilet dihapus, toilet & musholla gratis.',
    'Penghasilan utama terminal: kontrak PO yang dibayar di muka. Panjangnya ditawarkan PO, nilainya naik bersama armada PO & kelas terminal, dan mendaftarkan PO gratis.',
    'Slot PO terus bertambah seiring level terminal, sampai 20 PO.',
    'Loket menampilkan jumlah tiket yang terjual, HUD menampilkan penumpang di terminal, dan panel pengaturan bisa dibuka layar penuh.',
  ] as readonly string[],
} as const;
