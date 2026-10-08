import { describe, expect, it } from 'vitest';
import { jalankanSerakah, type HasilSimulasi } from './tycoon-sim';

/**
 * Patokan tempo ekonomi tycoon (documents/13 bagian 14) untuk pemain aktif yang
 * bermain optimal: pemain serakah di tests/tycoon-sim.ts. Mengubah angka
 * EKONOMI.tycoon yang menggeser tempo ini = mengubah pacing game; perbarui
 * patokannya (dan dokumen 13) bila memang disengaja.
 */
const MENIT = 60;
const JAM = 3600;

let hasil: HasilSimulasi | null = null;
const simulasi = (): HasilSimulasi => (hasil ??= jalankanSerakah(17.5 * JAM));

const pertama = (h: HasilSimulasi, awalan: string): number => h.catatan.find((c) => c.aksi.startsWith(awalan))?.detik ?? Number.POSITIVE_INFINITY;

describe('tempo tycoon (pemain serakah)', () => {
  it('awal: PO kedua & Jalur 2 di menit-menit pertama, perluasan 1 dimulai sebelum menit 45', { timeout: 60_000 }, () => {
    const h = simulasi();
    expect(pertama(h, 'po:')).toBeLessThan(3 * MENIT);
    expect(pertama(h, 'bangun:jalur')).toBeLessThan(12 * MENIT);
    expect(pertama(h, 'perluasan')).toBeLessThan(45 * MENIT);
    // Keputusan bermakna sering di jam pertama: paling lama 25 menit tanpa membeli apa pun.
    const jamPertama = h.catatan.filter((c) => c.detik < JAM && c.biaya > 0).map((c) => c.detik);
    const jeda = jamPertama.slice(1).map((d, i) => d - jamPertama[i]!);
    expect(Math.max(...jeda)).toBeLessThanOrEqual(25 * MENIT);
  });

  it('kelas terminal: Tipe B ±1,5 jam, Tipe A ±6 jam, Terpadu ±12–17 jam; semua perluasan selesai', { timeout: 60_000 }, () => {
    const h = simulasi();
    const lv = (l: number): number => h.level.get(l) ?? Number.POSITIVE_INFINITY;
    expect(lv(6)).toBeGreaterThan(15 * MENIT);
    expect(lv(6)).toBeLessThan(45 * MENIT);
    expect(lv(10)).toBeGreaterThan(75 * MENIT);
    expect(lv(10)).toBeLessThan(130 * MENIT);
    expect(lv(20)).toBeGreaterThan(5 * JAM);
    expect(lv(20)).toBeLessThan(8.5 * JAM);
    expect(lv(30)).toBeGreaterThan(12 * JAM);
    expect(lv(30)).toBeLessThan(17.5 * JAM);
    expect(h.perluasan).toHaveLength(5);
  });

  it('laba tumbuh, biaya terasa tapi tidak mencekik, dan strategi wajar tidak pernah kehabisan kas', { timeout: 60_000 }, () => {
    const h = simulasi();
    const hari = (n: number) => h.labaHarian[n - 1]!;
    expect(hari(10).laba).toBeGreaterThan(2 * hari(1).laba);
    expect(hari(40).laba).toBeGreaterThan(2 * hari(10).laba);
    const pendapatan = h.labaHarian.reduce((a, d) => a + d.pendapatan, 0);
    const biaya = h.labaHarian.reduce((a, d) => a + d.biaya, 0);
    expect(biaya / pendapatan).toBeGreaterThan(0.1);
    expect(biaya / pendapatan).toBeLessThan(0.4);
    for (const d of h.labaHarian) expect(d.laba).toBeGreaterThan(0);
    expect(h.akhir.berhenti).toBe(0);
  });
});
