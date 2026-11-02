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
  versiMinimal: '0.4.0',
  /** Catatan singkat "Yang baru" di versi ini, ditampilkan di popup (±4 butir). */
  catatan: [
    'Baris "tujuan berikutnya" di HUD menunjukkan langkah paling berguna; ketuk untuk membukanya.',
    'Naik level kini membuka slot jendela loket dan jalur baru (mulai Perluasan 3).',
    'Target, tantangan, dan Bus Emas kini juga memberi armada PO, dan proyek perluasan bisa dipercepat.',
  ] as readonly string[],
} as const;
