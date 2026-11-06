/**
 * Tambah lantai per gedung (murni; documents/18, rancangan docs/design/20261105-tambah-lantai bagian 4 & 8.2):
 * syarat & harga lantai berikutnya, petugas yang ikut direkrut, lantai yang menambah slot suatu unit
 * (teks "Slot penuh"), lantai yang terbuka saat naik level, dan navigasi mode lihat per lantai.
 * Aksinya (tambahLantai) di sim/state.ts; angka di EKONOMI.tycoon.lantai.
 *
 * Penomoran: `TerminalState.lantai[g]` = lantai tambahan (0 = hanya lantai dasar); "nomor lantai" =
 * 1 + lantai tambahan (lantai dasar = Lantai 1), dipakai teks, chip, dan LantaiDilihat.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import type { JumlahBangunan, JumlahLantai } from './bangunan';
import { GEDUNG_LANTAI_IDS, type BangunanId, type GedungLantaiId, type LantaiDilihat, type PetugasId } from './fitur';
import { hitungPetugas } from './petugas';

/** Kenapa lantai berikutnya gedung ini belum bisa dibangun (null = boleh, tinggal kasnya). */
export type SyaratLantai = { readonly jenis: 'tahap'; readonly tahap: number } | { readonly jenis: 'level'; readonly level: number } | { readonly jenis: 'maks' };

/** Lantai tambahan paling banyak gedung ini. */
export function lantaiMaks(gedung: GedungLantaiId, cfg: KonfigEkonomi = EKONOMI): number {
  return cfg.tycoon.lantai[gedung].level.length;
}

/**
 * Syarat lantai berikutnya bila gedung ini sudah punya `lantai` lantai tambahan: sudah maksimal, tahap
 * perluasan belum cukup, atau level terminal belum cukup. Null = boleh dibangun (kas diperiksa pemanggil).
 */
export function syaratLantai(gedung: GedungLantaiId, lantai: number, perluasan: number, level: number, cfg: KonfigEkonomi = EKONOMI): SyaratLantai | null {
  const k = cfg.tycoon.lantai[gedung];
  if (lantai >= k.level.length) return { jenis: 'maks' };
  if (perluasan < k.tahap) return { jenis: 'tahap', tahap: k.tahap };
  const butuh = k.level[lantai]!;
  return level < butuh ? { jenis: 'level', level: butuh } : null;
}

/** Harga lantai berikutnya (Rp) bila gedung ini sudah punya `lantai` lantai tambahan; null = sudah maksimal. */
export function biayaLantai(gedung: GedungLantaiId, lantai: number, cfg: KonfigEkonomi = EKONOMI): number | null {
  return cfg.tycoon.lantai[gedung].biaya[lantai] ?? null;
}

/** Petugas yang wajib untuk tiap unit isi lantai (keputusan owner 4). */
const PETUGAS_UNIT: Readonly<Partial<Record<BangunanId, PetugasId>>> = { toilet: 'petugasToilet', lahanParkir: 'juruParkir' };

/**
 * Petugas yang ikut direkrut saat lantai gedung ini dibeli: untuk tiap unit isi yang butuh petugas (toilet,
 * lahan parkir), satu per unit baru, hanya bila semua unit sejenis yang sudah ada dijaga petugasnya.
 * Belum ada unit sejenis = belum ada pilihan pemain, jadi ikut direkrut (toilet tanpa petugas mengotori).
 */
export function petugasIkutLantai(t: { readonly bangunan: JumlahBangunan; readonly petugas: readonly PetugasId[] }, gedung: GedungLantaiId, cfg: KonfigEkonomi = EKONOMI): PetugasId[] {
  const n = hitungPetugas(t.petugas);
  const hasil: PetugasId[] = [];
  for (const [id, jumlah] of Object.entries(cfg.tycoon.lantai[gedung].isi) as [BangunanId, number][]) {
    const p = PETUGAS_UNIT[id];
    if (p && n[p] >= t.bangunan[id]) for (let i = 0; i < jumlah; i++) hasil.push(p);
  }
  return hasil;
}

/** Lantai berikutnya satu gedung: nomor lantainya (2 = lantai tambahan pertama) dan level terminal yang membukanya. */
export interface LantaiBerikut {
  readonly gedung: GedungLantaiId;
  readonly lantai: number;
  readonly level: number;
}

/**
 * Lantai yang menambah slot unit ini berikutnya (teks "Slot penuh"): lantai belum dibangun yang isinya memuat
 * unit ini, levelnya paling rendah (seri: urutan GEDUNG_LANTAI_IDS); `terbuka` = level terminal sudah cukup.
 * Null bila tidak ada, atau tahap perluasan belum membuka lantai (sumber slotnya perluasan itu).
 */
export function lantaiUntukUnit(id: BangunanId, lantai: JumlahLantai, perluasan: number, level: number, cfg: KonfigEkonomi = EKONOMI): (LantaiBerikut & { readonly terbuka: boolean }) | null {
  let pilih: LantaiBerikut | null = null;
  for (const g of GEDUNG_LANTAI_IDS) {
    const k = cfg.tycoon.lantai[g];
    const n = lantai[g];
    if (!k.isi[id] || n >= k.level.length || perluasan < k.tahap) continue;
    const lv = k.level[n]!;
    if (!pilih || lv < pilih.level) pilih = { gedung: g, lantai: n + 2, level: lv };
  }
  return pilih && { ...pilih, terbuka: level >= pilih.level };
}

/**
 * Lantai yang terbuka saat level terminal naik dari `dari` ke `ke` dengan tahap perluasan ini (toast naik level,
 * popup offline). Dengan `lantai`: hanya lantai yang tepat berikutnya untuk gedungnya (Gedung parkir 3 tidak
 * disebut selama lantai 2 belum dibangun).
 */
export function lantaiTerbukaAntara(dari: number, ke: number, perluasan: number, cfg: KonfigEkonomi = EKONOMI, lantai?: JumlahLantai): LantaiBerikut[] {
  const hasil: LantaiBerikut[] = [];
  for (const g of GEDUNG_LANTAI_IDS) {
    const k = cfg.tycoon.lantai[g];
    if (perluasan < k.tahap) continue;
    k.level.forEach((lv, i) => {
      if (lv > dari && lv <= ke && (lantai === undefined || lantai[g] === i)) hasil.push({ gedung: g, lantai: i + 2, level: lv });
    });
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Mode lihat per lantai (rancangan 6.4): hanya UI, tidak disimpan

/** Nomor lantai tertinggi yang sudah dibangun gedung ini (1 = hanya lantai dasar). */
export function lantaiTertinggi(lantai: JumlahLantai, gedung: GedungLantaiId): number {
  return 1 + Math.max(0, lantai[gedung]);
}

/** Masuk mode lantai lewat "👁 Lihat": lantai tertinggi yang sudah dibangun; null bila gedung itu belum punya lantai tambahan. */
export function lantaiDilihatAwal(lantai: JumlahLantai, gedung: GedungLantaiId): LantaiDilihat | null {
  return lantai[gedung] > 0 ? { gedung, lantai: lantaiTertinggi(lantai, gedung) } : null;
}

/** ‹ (arah −1) dan › (arah +1): pindah lantai di gedung yang sama, dijepit Lantai 1 … lantai tertinggi. */
export function geserLantaiDilihat(v: LantaiDilihat, arah: -1 | 1, lantai: JumlahLantai): LantaiDilihat {
  const ke = Math.min(lantaiTertinggi(lantai, v.gedung), Math.max(1, v.lantai + arah));
  return ke === v.lantai ? v : { gedung: v.gedung, lantai: ke };
}
