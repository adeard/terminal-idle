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
  // 0.3.0: format save berubah ke skema 3 (ekonomi tycoon); versi lama tidak bisa membacanya,
  // dan batas skor papan peringkat di server ikut berubah.
  versiMinimal: '0.3.0',
  /** Catatan singkat "Yang baru" di versi ini, ditampilkan di popup (±4 butir). */
  catatan: [
    'Kini tycoon: bangun jalur, jendela loket, kursi, kios, toilet, & parkir di slot terminal, lalu rekrut petugas bergaji.',
    'Kejar laba bersih: atur tarif terminal (biaya layanan, sewa loket, retribusi, parkir, toilet, sewa kios) & pantau laporan keuangan.',
    'Terminal tetap jalan saat game ditutup (paling lama 8 jam) bila ada Manajer Operasional. Ketuk label area di peta untuk langsung membangun.',
    'Ekonomi dimulai dari awal: progres versi lama tidak dibawa, kecuali nama terminal.',
  ] as readonly string[],
} as const;
