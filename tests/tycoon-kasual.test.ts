import { describe, expect, it } from 'vitest';
import { JADWAL_KASUAL, jalankanKasual, type HasilKasual, type JadwalKasual } from './tycoon-sim';

/**
 * Patokan tempo pemain kasual (documents/15 bagian 2, batas "Ronde 2" bagian 2.3, disetujui owner
 * 31 Oktober 2026): pemain serakah tests/tycoon-sim.ts bermain sesi pendek di jam dinding, offline
 * dengan Manajer Operasional di antaranya, 14 hari nyata. Batas ini penjaga, bukan sasaran: perubahan
 * angka yang menggeser hari nyata pemain kasual terlihat di sini.
 */
const HARI = 14;
const TERPADU = 3;

const hasil = new Map<string, HasilKasual>();
const simulasi = (j: JadwalKasual): HasilKasual => {
  let h = hasil.get(j.nama);
  if (!h) {
    h = jalankanKasual(j, HARI);
    hasil.set(j.nama, h);
  }
  return h;
};

/** Porsi sesi berisi keputusan (aksi berbayar atau PO baru) di hari nyata a–b. */
const porsiKeputusan = (h: HasilKasual, a: number, b: number): number => {
  const sesi = h.sesi.filter((x) => x.hari >= a && x.hari <= b);
  return sesi.filter((x) => x.keputusan > 0).length / sesi.length;
};
const hariKeputusanTerakhir = (h: HasilKasual): number => [...h.sesi].reverse().find((x) => x.keputusan > 0)?.hari ?? 0;

describe('tempo pemain kasual (dengan Manajer Operasional, 14 hari nyata)', () => {
  it('K3 (3 sesi/hari): Terpadu di hari 2–4, XP offline 85–98 %, ≥ 20 % sesi hari 4–7 berisi keputusan, keputusan sampai paling tidak hari 10, tanpa petugas berhenti', { timeout: 30_000 }, () => {
    const h = simulasi(JADWAL_KASUAL.K3);
    expect(h.hariManajer).not.toBeNull();
    const terpadu = h.hariKelas.get(TERPADU) ?? Number.POSITIVE_INFINITY;
    expect(terpadu).toBeGreaterThanOrEqual(2);
    expect(terpadu).toBeLessThanOrEqual(4);
    // Berubah = aturan offline (Manajer, 8 jam, 60 %) tersentuh.
    expect(h.porsiXpOffline).toBeGreaterThanOrEqual(0.85);
    expect(h.porsiXpOffline).toBeLessThanOrEqual(0.98);
    expect(hariKeputusanTerakhir(h)).toBeGreaterThanOrEqual(10);
    expect(porsiKeputusan(h, 4, 7)).toBeGreaterThanOrEqual(0.2);
    expect(h.akhir.berhenti).toBe(0);
  });

  it('K2 (2 sesi/hari): Terpadu di hari 3–5, ≥ 50 % sesi hari 4–7 berisi keputusan, tanpa petugas berhenti', { timeout: 30_000 }, () => {
    const h = simulasi(JADWAL_KASUAL.K2);
    expect(h.hariManajer).not.toBeNull();
    const terpadu = h.hariKelas.get(TERPADU) ?? Number.POSITIVE_INFINITY;
    expect(terpadu).toBeGreaterThanOrEqual(3);
    expect(terpadu).toBeLessThanOrEqual(5);
    expect(porsiKeputusan(h, 4, 7)).toBeGreaterThanOrEqual(0.5);
    expect(h.akhir.berhenti).toBe(0);
  });
});
