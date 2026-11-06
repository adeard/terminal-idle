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
  // 0.5.0: Musim Terminal. Save tetap skema 3, tetapi 0.5.0 menambah blok `musim`. Dijalankan 0.4.1 pada save
  // 0.5.0 dengan Musim aktif: save termuat tanpa galat dan semua kolom lain utuh, tetapi 0.4.1 tidak mengenal blok
  // itu dan menulis save berikutnya TANPA blok `musim` (juga ke cloud save): poin dan Rapor Musim, tugas harian,
  // hiasan yang dimiliki dan dipakai, tiket ganti, Surat Armada yang belum dipakai, riwayat musim, lencana, dan
  // sambutan hilang diam-diam dan permanen; 0.5.0 lalu membuka Musim dari nol. Karena itu versi lama dipaksa.
  // 0.6.0: Tambah lantai. Save tetap skema 3, tetapi 0.6.0 menambah `terminal.lantai` (lantai tambahan per gedung).
  // Dijalankan 0.5.0 pada save 0.6.0 berlantai (Gedung parkir 2, Ruang tunggu 1, Gedung toilet 1, Aula loket 1):
  // `bacaBangunan` 0.5.0 menjepit unit ke slot tanpa lantai dan 0.5.0 menulis save berikutnya TANPA `lantai`
  // (juga ke cloud save, jalurnya sama: deserialisasi). Hilang diam-diam dan permanen: kursi 14 → 8, kios 4 → 3,
  // toko 6 → 4, toilet 3 → 2, lahan parkir 6 → 2, petugas toilet 3 → 2 dan juru parkir 6 → 2, semua lantai, tanpa
  // pengembalian uang (4,1 miliar Rp untuk kelima lantai). Karena itu versi lama dipaksa.
  versiMinimal: '0.6.0',
  /** Catatan singkat "Yang baru" di versi ini, ditampilkan di popup (maks 3 butir pendek). */
  catatan: [
    'Tambah lantai di Gedung parkir, Ruang tunggu, Gedung toilet, dan Aula loket, terbuka mulai Perluasan 3.',
    'Tombol Lihat menampilkan tiap lantai; mobil naik-turun ramp di Gedung parkir.',
    'Sayap 2 Lantai punya tangga baru. Beli lantai saat kas tipis minta ketuk dua kali.',
  ] as readonly string[],
} as const;
