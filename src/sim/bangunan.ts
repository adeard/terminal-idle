/**
 * Bangunan di slot denah (murni): berapa slot tiap jenis bangunan setelah
 * tahap perluasan dan izin level, biaya membangun unit berikutnya, pengembalian saat
 * dibongkar, petak parkir bus, dan biaya perawatan harian. Rancangan: bagian 4
 * documents/13-rancangan-tycoon.md; angka di EKONOMI.tycoon.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { BANGUNAN_IDS, TEKNOLOGI_IDS, type BangunanId, type TeknologiId } from './fitur';
import { slotPo } from './level-terminal';

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

/**
 * Slot tambahan dari izin level (documents/15 bagian 3): sejak tahap perluasan `izinLevel.tahapMinimal`,
 * tiap level izin jenis ini (jendela loket, jalur) yang sudah dicapai menambah satu slot. Izin yang
 * levelnya lewat sebelum tahap itu selesai aktif sekaligus saat tahapnya diresmikan.
 */
export function bonusIzin(id: BangunanId, level: number, perluasan: number, cfg: KonfigEkonomi = EKONOMI): number {
  const iz = cfg.tycoon.izinLevel;
  if (perluasan < iz.tahapMinimal || (id !== 'jendela' && id !== 'jalur')) return 0;
  return iz[id].filter((l) => level >= l).length;
}

/** Level berikutnya (di atas `level`) yang menambah slot jenis ini lewat izin level dengan tahap perluasan sekarang; null = tidak ada. */
export function levelIzinBerikut(id: BangunanId, level: number, perluasan: number, cfg: KonfigEkonomi = EKONOMI): number | null {
  const iz = cfg.tycoon.izinLevel;
  if (perluasan < iz.tahapMinimal || (id !== 'jendela' && id !== 'jalur')) return null;
  return iz[id].find((l) => l > level) ?? null;
}

/** Slot jenis bangunan ini setelah sekian tahap perluasan selesai, di level terminal ini (tabel tahap + izin level). */
export function slotBangunan(id: BangunanId, perluasan: number, level: number, cfg: KonfigEkonomi = EKONOMI): number {
  return menurutTahap(cfg.tycoon.bangunan[id].slot, perluasan) + bonusIzin(id, level, perluasan, cfg);
}

/** Slot yang terbuka dari naik level: jendela loket & jalur (izin level), dan slot PO ke-n (0 = tidak ada). */
export interface Izin {
  readonly jendela: number;
  readonly jalur: number;
  readonly slotPo: number;
}

/** Izin yang terbuka saat naik dari level `dari` ke `ke` dengan sekian tahap perluasan selesai. */
export function izinAntara(dari: number, ke: number, perluasan: number, cfg: KonfigEkonomi = EKONOMI): Izin {
  const po = slotPo(ke, perluasan, cfg);
  return {
    jendela: bonusIzin('jendela', ke, perluasan, cfg) - bonusIzin('jendela', dari, perluasan, cfg),
    jalur: bonusIzin('jalur', ke, perluasan, cfg) - bonusIzin('jalur', dari, perluasan, cfg),
    slotPo: po > slotPo(dari, perluasan, cfg) ? po : 0,
  };
}

export function adaIzin(izin: Izin): boolean {
  return izin.jendela > 0 || izin.jalur > 0 || izin.slotPo > 0;
}

/** Izin yang terbuka tepat di level ini. */
export function izinPadaLevel(level: number, perluasan: number, cfg: KonfigEkonomi = EKONOMI): Izin {
  return izinAntara(level - 1, level, perluasan, cfg);
}

/** Level berikutnya (di atas `level`) yang membuka izin dengan tahap perluasan sekarang; null = tidak ada lagi. */
export function izinBerikut(level: number, perluasan: number, cfg: KonfigEkonomi = EKONOMI): { readonly level: number; readonly izin: Izin } | null {
  const iz = cfg.tycoon.izinLevel;
  const maks = Math.max(...iz.jendela, ...iz.jalur, ...cfg.mitra.terminal.slot.map(([l]) => l));
  for (let l = Math.floor(level) + 1; l <= maks; l++) {
    const izin = izinPadaLevel(l, perluasan, cfg);
    if (adaIzin(izin)) return { level: l, izin };
  }
  return null;
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
export function biayaBangun(id: BangunanId, bangunan: JumlahBangunan, perluasan: number, level: number, cfg: KonfigEkonomi = EKONOMI): number | null {
  return bangunan[id] < slotBangunan(id, perluasan, level, cfg) ? biayaUnitBerikutnya(id, bangunan[id], cfg) : null;
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
