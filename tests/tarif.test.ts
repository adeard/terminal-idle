import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { TARIF_IDS } from '../src/sim/fitur';
import { bagianPemakai, jepitTarif, okupansiKios, skorHargaPenumpang, skorTarif, skorTarifMitra, tarifBawaan } from '../src/sim/tarif';

const T = EKONOMI.tycoon;

describe('tarif terminal', () => {
  it('dijepit ke rentang & kelipatan langkahnya; nilai tak sah = bawaan', () => {
    expect(jepitTarif('retribusiBus', 24_400)).toBe(25_000);
    expect(jepitTarif('retribusiBus', 999_999)).toBe(T.tarif.retribusiBus.maks);
    expect(jepitTarif('parkir', -5)).toBe(0);
    expect(jepitTarif('parkir', 6_400)).toBe(6_000);
    expect(jepitTarif('sewaKios', Number.NaN)).toBe(T.tarif.sewaKios.bawaan);
  });

  it('penumpang tidak membayar terminal: tidak ada biaya layanan maupun tarif toilet', () => {
    expect(TARIF_IDS).toEqual(['sewaLoket', 'retribusiBus', 'parkir', 'sewaKios']);
  });

  it('pemakai parkir: bagiannya di tarif bawaan, naik saat murah, habis jauh di atas bawaan', () => {
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
    expect(skorHargaPenumpang(t, { parkir: true })).toBeCloseTo(k.skorBawaan, 10);
    expect(skorHargaPenumpang({ ...t, parkir: 3 * t.parkir }, { parkir: true })).toBeLessThan(skorHargaPenumpang(t, { parkir: true }));
    // Tanpa lahan parkir penumpang tidak membayar apa pun: komponen harga penuh.
    expect(skorHargaPenumpang({ ...t, parkir: 3 * t.parkir }, { parkir: false })).toBe(1);
    // Mitra: retribusi mahal hanya terasa bila dipungut.
    expect(skorTarifMitra({ ...t, retribusiBus: 3 * t.retribusiBus }, true)).toBeLessThan(skorTarifMitra(t, true));
    expect(skorTarifMitra({ ...t, retribusiBus: 3 * t.retribusiBus }, false)).toBeCloseTo(skorTarifMitra(t, false), 10);
  });
});
