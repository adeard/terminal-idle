/**
 * Petugas bergaji (murni): batas tiap peran menurut bangunan, gaji
 * harian, dan siapa yang berhenti lebih dulu bila kas habis. Petugas
 * menggantikan Kepala. State menyimpan urutan rekrut (bukan jumlah), supaya
 * "yang terakhir direkrut berhenti lebih dulu" tidak butuh data tambahan.
 * Rancangan: bagian 5 & 6.3 documents/13-rancangan-tycoon.md.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import type { JumlahBangunan } from './bangunan';
import { PETUGAS_IDS, type PetugasId } from './fitur';

export type JumlahPetugas = Readonly<Record<PetugasId, number>>;

/** Jumlah tiap peran dari urutan rekrut. */
export function hitungPetugas(urutan: readonly PetugasId[]): JumlahPetugas {
  const n = Object.fromEntries(PETUGAS_IDS.map((id) => [id, 0])) as Record<PetugasId, number>;
  for (const id of urutan) n[id]++;
  return n;
}

/** Petugas paling banyak untuk peran ini menurut bangunan yang ada. */
export function maksPetugas(id: PetugasId, b: JumlahBangunan): number {
  switch (id) {
    // Satu per halte kedatangan / gerbang keberangkatan.
    case 'peron':
    case 'gerbang':
      return b.jalur;
    case 'kebersihan':
      return 2 * b.jalur + 2;
    case 'satpam':
      return 2 * b.jalur;
    case 'juruParkir':
      return b.lahanParkir;
    case 'petugasToilet':
      return b.toilet;
    case 'petugasRetribusi':
      return b.posRetribusi;
    case 'manajerOperasional':
    case 'manajerKemitraan':
      return 1;
  }
}

export function bisaRekrut(id: PetugasId, urutan: readonly PetugasId[], b: JumlahBangunan): boolean {
  return hitungPetugas(urutan)[id] < maksPetugas(id, b);
}

/** Urutan setelah merekrut satu petugas (tanpa memeriksa batas; lihat bisaRekrut). */
export function rekrut(urutan: readonly PetugasId[], id: PetugasId): PetugasId[] {
  return [...urutan, id];
}

/** Urutan setelah memberhentikan satu petugas peran ini: yang paling akhir direkrut. */
export function berhentikan(urutan: readonly PetugasId[], id: PetugasId): PetugasId[] {
  const i = urutan.lastIndexOf(id);
  return i < 0 ? [...urutan] : [...urutan.slice(0, i), ...urutan.slice(i + 1)];
}

export function adalahManajer(id: PetugasId): boolean {
  return id === 'manajerOperasional' || id === 'manajerKemitraan';
}

/**
 * Urutan setelah satu petugas berhenti karena gajinya tak terbayar (kas habis):
 * yang terakhir direkrut, manajer paling akhir. Tanpa petugas: tidak berubah.
 */
export function berhentiKasHabis(urutan: readonly PetugasId[]): PetugasId[] {
  for (let i = urutan.length - 1; i >= 0; i--) if (!adalahManajer(urutan[i]!)) return [...urutan.slice(0, i), ...urutan.slice(i + 1)];
  return urutan.slice(0, -1);
}

/** Urutan tanpa petugas yang melebihi batasnya (mis. toilet dibongkar): yang terakhir direkrut keluar lebih dulu. */
export function rapikanPetugas(urutan: readonly PetugasId[], b: JumlahBangunan): PetugasId[] {
  const sisa = Object.fromEntries(PETUGAS_IDS.map((id) => [id, maksPetugas(id, b)])) as Record<PetugasId, number>;
  const hasil: PetugasId[] = [];
  // Dari yang paling awal direkrut: yang lama tetap, kelebihan yang baru dibuang.
  for (const id of urutan) {
    if (sisa[id] <= 0) continue;
    sisa[id]--;
    hasil.push(id);
  }
  return hasil;
}

/** Gaji semua petugas per hari (Rp), sebelum pengali kelas terminal. */
export function gajiHarian(urutan: readonly PetugasId[], cfg: KonfigEkonomi = EKONOMI): number {
  return urutan.reduce((a, id) => a + cfg.tycoon.gaji[id], 0);
}
