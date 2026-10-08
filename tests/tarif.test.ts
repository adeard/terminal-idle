import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { bagianPemakai, faktorLayanan, jepitTarif, okupansiKios, skorHargaPenumpang, skorTarif, skorTarifMitra, tarifBawaan } from '../src/sim/tarif';

const T = EKONOMI.tycoon;

describe('tarif terminal', () => {
  it('dijepit ke rentang & kelipatan langkahnya; nilai tak sah = bawaan', () => {
    expect(jepitTarif('layanan', 12.4)).toBe(12);
    expect(jepitTarif('layanan', 99)).toBe(T.tarif.layanan.maks);
    expect(jepitTarif('parkir', -5)).toBe(0);
    expect(jepitTarif('parkir', 6_400)).toBe(6_000);
    expect(jepitTarif('toilet', Number.NaN)).toBe(T.tarif.toilet.bawaan);
  });

  it('biaya layanan: bawaan tidak mengubah permintaan; lebih mahal menurunkannya, ekonomi lebih peka dari eksekutif', () => {
    const b = T.tarif.layanan.bawaan;
    expect(faktorLayanan(b, 1.9)).toBeCloseTo(1, 10);
    expect(faktorLayanan(1.5 * b, 1.9)).toBeLessThan(faktorLayanan(1.5 * b, 1.2));
    expect(faktorLayanan(0, 1.5)).toBeCloseTo(1 + T.pasar.kepekaanLayanan, 10);
    expect(faktorLayanan(T.tarif.layanan.maks, 1.9)).toBeGreaterThanOrEqual(0);
    // Ada tarif terbaik di bawah maksimum saat permintaan yang membatasi (pendapatan = tarif × faktor).
    const pendapatan = (l: number): number => l * faktorLayanan(l, 1.9);
    const terbaik = Array.from({ length: T.tarif.layanan.maks + 1 }, (_, l) => l).reduce((a, l) => (pendapatan(l) > pendapatan(a) ? l : a), 0);
    expect(terbaik).toBeGreaterThan(b);
    expect(terbaik).toBeLessThan(T.tarif.layanan.maks);
  });

  it('pemakai parkir & toilet: bagiannya di tarif bawaan, naik saat murah, habis jauh di atas bawaan', () => {
    const p = T.pengantar;
    expect(bagianPemakai(T.tarif.parkir.bawaan, T.tarif.parkir.bawaan, p.bagian, p.kepekaan)).toBeCloseTo(p.bagian, 10);
    expect(bagianPemakai(0, T.tarif.parkir.bawaan, p.bagian, p.kepekaan)).toBeCloseTo(p.bagian * (1 + p.kepekaan), 10);
    expect(bagianPemakai(T.tarif.parkir.bawaan * (1 + 1 / p.kepekaan), T.tarif.parkir.bawaan, p.bagian, p.kepekaan)).toBeCloseTo(0, 10);
  });

  it('okupansi kios mengikuti keramaian: terminal sepi tidak laku disewakan mahal', () => {
    const sewa = T.tarif.sewaKios.bawaan;
    const wajar = sewa / T.kios.nilaiPerArus;
    expect(okupansiKios(sewa, wajar)).toBeCloseTo(1, 10);
    expect(okupansiKios(sewa, wajar / 5)).toBe(0);
    expect(okupansiKios(sewa / 5, wajar / 5)).toBeCloseTo(1, 10);
    expect(okupansiKios(0, 0)).toBe(1);
  });

  it('skor tarif: bawaan = skorBawaan, lebih mahal turun, lebih murah naik (dijepit 0–1)', () => {
    const k = T.kepuasan.harga;
    expect(skorTarif(1, k)).toBeCloseTo(k.skorBawaan, 10);
    expect(skorTarif(2, k)).toBeCloseTo(k.skorBawaan - k.turunPerRasio, 10);
    expect(skorTarif(0, k)).toBeLessThanOrEqual(1);
    const t = tarifBawaan();
    expect(skorHargaPenumpang(t, { parkir: true, toilet: true })).toBeCloseTo(k.skorBawaan, 10);
    expect(skorHargaPenumpang({ ...t, parkir: 3 * t.parkir }, { parkir: true, toilet: false })).toBeLessThan(skorHargaPenumpang(t, { parkir: true, toilet: false }));
    // Parkir mahal tidak terasa bila lahan parkirnya belum ada.
    expect(skorHargaPenumpang({ ...t, parkir: 3 * t.parkir }, { parkir: false, toilet: false })).toBeCloseTo(k.skorBawaan, 10);
    // Mitra: retribusi mahal hanya terasa bila dipungut.
    expect(skorTarifMitra({ ...t, retribusiBus: 3 * t.retribusiBus }, true)).toBeLessThan(skorTarifMitra(t, true));
    expect(skorTarifMitra({ ...t, retribusiBus: 3 * t.retribusiBus }, false)).toBeCloseTo(skorTarifMitra(t, false), 10);
  });
});
