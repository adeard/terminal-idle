/**
 * Bangunan di slot denah (murni): berapa slot tiap jenis bangunan setelah
 * tahap perluasan, biaya membangun unit berikutnya, pengembalian saat
 * dibongkar, petak parkir bus, dan biaya perawatan harian. Rancangan: bagian 4
 * documents/13-rancangan-tycoon.md; angka di EKONOMI.tycoon.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { BANGUNAN_IDS, TEKNOLOGI_IDS, type BangunanId, type TeknologiId } from './fitur';

/** Jumlah unit tiap jenis bangunan. */
export type JumlahBangunan = Readonly<Record<BangunanId, number>>;

/** Nilai tabel per tahap perluasan (indeks 0 = terminal awal); tahap di luar daftar memakai nilai terakhir. */
export function menurutTahap(tabel: readonly number[], perluasan: number): number {
  if (tabel.length === 0) return 0;
  return tabel[Math.min(tabel.length - 1, Math.max(0, Math.floor(perluasan)))]!;
}

export function bangunanAwal(cfg: KonfigEkonomi = EKONOMI): JumlahBangunan {
  const b = cfg.tycoon.bangunan;
  return Object.fromEntries(BANGUNAN_IDS.map((id) => [id, b[id].awal])) as Record<BangunanId, number>;
}

/** Slot jenis bangunan ini setelah sekian tahap perluasan selesai. */
export function slotBangunan(id: BangunanId, perluasan: number, cfg: KonfigEkonomi = EKONOMI): number {
  return menurutTahap(cfg.tycoon.bangunan[id].slot, perluasan);
}

/**
 * Biaya unit berikutnya bila sudah ada `jumlah` unit, tanpa memeriksa slot.
 * Unit di bawah `awal` (mis. setelah dibongkar) dihargai seperti unit tambahan pertama.
 */
export function biayaUnitBerikutnya(id: BangunanId, jumlah: number, cfg: KonfigEkonomi = EKONOMI): number {
  const b = cfg.tycoon.bangunan[id];
  const ke = Math.max(0, Math.floor(jumlah) - b.awal);
  if (b.biaya.length === 0) return 0;
  if (ke < b.biaya.length) return b.biaya[ke]!;
  return b.biaya[b.biaya.length - 1]! * Math.pow(b.pertumbuhan, ke - b.biaya.length + 1);
}

/** Biaya membangun satu unit lagi, atau null bila slotnya sudah penuh. */
export function biayaBangun(id: BangunanId, bangunan: JumlahBangunan, perluasan: number, cfg: KonfigEkonomi = EKONOMI): number | null {
  return bangunan[id] < slotBangunan(id, perluasan, cfg) ? biayaUnitBerikutnya(id, bangunan[id], cfg) : null;
}

/** Paling sedikit setelah dibongkar: jendela loket satu, supaya tiket tetap terjual. */
const MINIMAL_BONGKAR: Readonly<Partial<Record<BangunanId, number>>> = { jendela: 1 };

/**
 * Uang yang kembali saat membongkar satu unit (bagian dari harga unit itu), atau
 * null bila tidak bisa dibongkar. Jalur permanen (keputusan 5 dokumen 12).
 * Jendela yang masih disewa PO diperiksa pemanggil.
 */
export function pengembalianBongkar(id: BangunanId, bangunan: JumlahBangunan, cfg: KonfigEkonomi = EKONOMI): number | null {
  if (id === 'jalur' || bangunan[id] <= (MINIMAL_BONGKAR[id] ?? 0)) return null;
  return Math.floor(biayaUnitBerikutnya(id, bangunan[id] - 1, cfg) * cfg.tycoon.bongkar);
}

/** Petak parkir bus setelah sekian tahap perluasan (dibangun lewat perluasan, bukan dibeli satu-satu). */
export function petakBus(perluasan: number, cfg: KonfigEkonomi = EKONOMI): number {
  return menurutTahap(cfg.tycoon.petakBus, perluasan);
}

/** Perawatan per hari (Rp) sebelum pengali kelas terminal: semua unit dan modernisasi yang terpasang. */
export function perawatanHarian(bangunan: JumlahBangunan, teknologi: Readonly<Record<TeknologiId, boolean>>, cfg: KonfigEkonomi = EKONOMI): number {
  const t = cfg.tycoon;
  let total = 0;
  for (const id of BANGUNAN_IDS) total += Math.max(0, bangunan[id]) * t.bangunan[id].perawatan;
  for (const id of TEKNOLOGI_IDS) if (teknologi[id]) total += cfg.teknologi[id].perawatan;
  return total;
}

/**
 * Biaya operasional gedung perluasan per hari (Rp) setelah sekian tahap selesai.
 * Tidak ikut pengali kelas terminal: angkanya sudah menurut ukuran gedungnya.
 */
export function operasionalGedung(perluasan: number, cfg: KonfigEkonomi = EKONOMI): number {
  return cfg.mitra.perluasan.slice(0, Math.max(0, Math.floor(perluasan))).reduce((a, p) => a + p.operasional, 0);
}

/** Pengali gaji, perawatan & listrik menurut kelas terminal. */
export function pengaliBiayaKelas(kelasTerminal: number, cfg: KonfigEkonomi = EKONOMI): number {
  return menurutTahap(cfg.tycoon.pengaliBiayaKelas, kelasTerminal);
}
