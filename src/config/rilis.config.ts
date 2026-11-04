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
  // 0.4.0: izin level. Slot jendela loket & jalur kini ikut level terminal (sejak Perluasan 3). Versi lama
  // yang membuka save baru memotong jendela & jalur itu ke tabel tahap perluasan (mis. 32 → 12 jendela di
  // Lv 30, 95 → 20 di Lv 140) tanpa pengembalian uang, dan menghapus ambang tantangan kepuasan; kerugiannya
  // tersimpan permanen, jadi versi lama tidak boleh dipakai lagi.
  // 0.4.1: tetap 0.4.0. Sayap 2 Lantai hanya gambar adegan; save tetap skema 3 tanpa kolom baru, dan tanda
  // peresmian ada di localStorage terpisah. Dijalankan 0.4.0 pada save 0.4.1 (Perluasan 3, 4, 5): bangunan,
  // level, perluasan, kas, dan semua kolom save terbaca & tertulis utuh; yang hilang hanya gedung barunya
  // (kebun barat tampak lama) dan peresmian susulan. Tidak ada data rusak, jadi tidak perlu memaksa pembaruan.
  versiMinimal: '0.4.0',
  /** Catatan singkat "Yang baru" di versi ini, ditampilkan di popup (maks 3 butir pendek). */
  catatan: [
    'Perluasan 3 kini membangun gedung sungguhan: Sayap 2 lantai di sisi barat terminal.',
    'Jendela loket, kursi, dan kios tambahan yang kamu bangun muncul di dalamnya.',
    'Yang sudah melewati Perluasan 3 mendapat peresmian susulan, sekali saja.',
  ] as readonly string[],
} as const;
