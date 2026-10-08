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
  // 0.2.0: format save berubah ke skema 2 (ekonomi mitra PO); versi lama tidak bisa membacanya.
  versiMinimal: '0.2.0',
  /** Catatan singkat "Yang baru" di versi ini, ditampilkan di popup (±4 butir). */
  catatan: [
    'Mitra PO: daftarkan PO dengan jurusan & busnya sendiri, bangun loket untuk mereka, dan atur harga tiketnya.',
    'Level & kelas terminal, plus 5 tahap perluasan yang dibangun sebagai proyek (tetap berjalan saat game ditutup).',
    'Renovasi menggantikan prestige: mulai ulang kapasitas tahap demi bonus pendapatan permanen.',
    'Terminal makin hidup: jendela loket & bus milik PO, parkir tambahan, crane proyek, dan kembang api peresmian.',
  ] as readonly string[],
} as const;
