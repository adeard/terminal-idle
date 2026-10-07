import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { EKONOMI, type KonfigEkonomi } from '../src/config/economy.config';
import {
  biayaKepala,
  biayaUpgrade,
  daftarBottleneck,
  detikOffline,
  jumlahMilestone,
  kapasitas,
  multiplierPrestige,
  pendapatanOffline,
  pendapatanPerDetik,
  poinPrestigeDidapat,
  progresMilestone,
  throughput,
} from '../src/sim/economy';

describe('biaya upgrade: biayaAwal × r^(L − 1)', () => {
  it('level 1 sama dengan biayaAwal', () => {
    expect(biayaUpgrade('peron', 1).toNumber()).toBe(15);
    expect(biayaUpgrade('loket', 1).toNumber()).toBe(22);
    expect(biayaUpgrade('keberangkatan', 1).toNumber()).toBe(30);
  });

  it('naik dengan rasio r per level', () => {
    expect(biayaUpgrade('peron', 2).toNumber()).toBeCloseTo(15 * 1.08, 10);
    expect(biayaUpgrade('loket', 2).toNumber()).toBeCloseTo(22 * 1.085, 10);
    expect(biayaUpgrade('keberangkatan', 2).toNumber()).toBeCloseTo(30 * 1.09, 10);
  });

  it('cocok dengan formula untuk level tinggi', () => {
    for (const L of [10, 43, 49, 100]) {
      expect(biayaUpgrade('peron', L).toNumber()).toBeCloseTo(15 * Math.pow(1.08, L - 1), 6);
      expect(biayaUpgrade('keberangkatan', L).toNumber() / (30 * Math.pow(1.09, L - 1))).toBeCloseTo(1, 12);
    }
  });

  it('tetap valid melewati batas presisi Number (break_infinity)', () => {
    const b = biayaUpgrade('keberangkatan', 5000);
    // log10(30 × 1.09^4999) ≈ 188.57
    expect(b.log10()).toBeCloseTo(Math.log10(30) + 4999 * Math.log10(1.09), 6);
    expect(biayaUpgrade('keberangkatan', 20000).exponent).toBeGreaterThan(308);
  });

  it('biaya rekrut Kepala diambil dari config', () => {
    expect(biayaKepala('peron').toNumber()).toBe(50);
    expect(biayaKepala('loket').toNumber()).toBe(150);
    expect(biayaKepala('keberangkatan').toNumber()).toBe(400);
  });
});

describe('milestone & kapasitas', () => {
  it('menghitung milestone yang tercapai (L ≥ m)', () => {
    const kasus: Array<[number, number]> = [
      [1, 0], [24, 0], [25, 1], [49, 1], [50, 2], [99, 2], [100, 3], [199, 3], [200, 4], [5000, 4],
    ];
    for (const [L, n] of kasus) expect(jumlahMilestone(L), `L=${L}`).toBe(n);
  });

  it('kapasitas level 1 = kapAwal', () => {
    expect(kapasitas('peron', 1)).toBe(1.0);
    expect(kapasitas('loket', 1)).toBe(0.8);
    expect(kapasitas('keberangkatan', 1)).toBe(0.9);
  });

  it('kapasitas linear di antara milestone, lalu ×2 tiap milestone', () => {
    expect(kapasitas('peron', 24)).toBeCloseTo(1 + 0.5 * 23, 10); // 12.5
    expect(kapasitas('peron', 25)).toBeCloseTo((1 + 0.5 * 24) * 2, 10); // 26
    expect(kapasitas('peron', 50)).toBeCloseTo((1 + 0.5 * 49) * 4, 10); // 102
    expect(kapasitas('peron', 100)).toBeCloseTo((1 + 0.5 * 99) * 8, 10); // 404
    expect(kapasitas('peron', 200)).toBeCloseTo((1 + 0.5 * 199) * 16, 10); // 1608
    expect(kapasitas('loket', 49)).toBeCloseTo((0.8 + 0.45 * 48) * 2, 10); // 44.8
    expect(kapasitas('keberangkatan', 44)).toBeCloseTo((0.9 + 0.5 * 43) * 2, 10); // 44.8
  });

  it('progres menuju milestone berikutnya', () => {
    expect(progresMilestone(1)).toEqual({ dari: 1, ke: 25, rasio: 0 });
    expect(progresMilestone(13).rasio).toBeCloseTo(0.5, 10);
    expect(progresMilestone(25)).toEqual({ dari: 25, ke: 50, rasio: 0 });
    expect(progresMilestone(75)).toEqual({ dari: 50, ke: 100, rasio: 0.5 });
    expect(progresMilestone(200)).toEqual({ dari: 200, ke: null, rasio: 1 });
    expect(progresMilestone(999)).toEqual({ dari: 200, ke: null, rasio: 1 });
  });
});

describe('throughput = min(kapasitas)', () => {
  it('mengambil kapasitas terkecil', () => {
    expect(throughput({ peron: 10, loket: 3, keberangkatan: 7 })).toBe(3);
    expect(throughput({ peron: 2, loket: 3, keberangkatan: 7 })).toBe(2);
    expect(throughput({ peron: 10, loket: 30, keberangkatan: 7 })).toBe(7);
  });

  it('bottleneck di awal game adalah loket (0.8)', () => {
    const kap = { peron: kapasitas('peron', 1), loket: kapasitas('loket', 1), keberangkatan: kapasitas('keberangkatan', 1) };
    expect(throughput(kap)).toBe(0.8);
    expect(daftarBottleneck(kap)).toEqual(['loket']);
  });

  it('kapasitas seri (termasuk noise floating point) → semua ditandai, urut rantai', () => {
    // peron L6 = 3.5, loket L7 = 0.8 + 0.45×6 = 3.5000000000000004
    const kap = { peron: kapasitas('peron', 6), loket: kapasitas('loket', 7), keberangkatan: 100 };
    expect(daftarBottleneck(kap)).toEqual(['peron', 'loket']);
    expect(daftarBottleneck({ peron: 5, loket: 9, keberangkatan: 5 })).toEqual(['peron', 'keberangkatan']);
  });
});

describe('pendapatan per detik', () => {
  it('throughput × nilaiPerPenumpang tanpa prestige', () => {
    expect(pendapatanPerDetik(0.8, new Decimal(0)).toNumber()).toBeCloseTo(4, 12);
    expect(pendapatanPerDetik(44, new Decimal(0)).toNumber()).toBeCloseTo(220, 12);
  });

  it('dikali (1 + poinPrestige × bonusPrestige)', () => {
    expect(multiplierPrestige(new Decimal(5)).toNumber()).toBeCloseTo(1.5, 12);
    expect(pendapatanPerDetik(0.8, new Decimal(5)).toNumber()).toBeCloseTo(6, 12);
  });
});

describe('offline', () => {
  const t0 = 1_000_000;
  const JAM = 3600 * 1000;

  it('menghitung detik offline', () => {
    expect(detikOffline(t0 + 90_000, t0)).toBe(90);
    expect(detikOffline(t0 + JAM, t0)).toBe(3600);
  });

  it('dibatasi batasOffline (4 jam)', () => {
    expect(detikOffline(t0 + 4 * JAM, t0)).toBe(14400);
    expect(detikOffline(t0 + 10 * JAM, t0)).toBe(14400);
    expect(detikOffline(t0 + 1000 * JAM, t0)).toBe(14400);
  });

  it('selisih negatif (jam dimundurkan) → 0', () => {
    expect(detikOffline(t0 - 5000, t0)).toBe(0);
    expect(detikOffline(t0 - 10 * JAM, t0)).toBe(0);
  });

  it('selisih nol atau tidak valid → 0', () => {
    expect(detikOffline(t0, t0)).toBe(0);
    expect(detikOffline(Number.NaN, t0)).toBe(0);
    expect(detikOffline(t0, Number.NaN)).toBe(0);
    expect(detikOffline(Number.POSITIVE_INFINITY, t0)).toBe(0);
  });

  it('penghasilan = pendapatan/detik × detik × efisiensiOffline', () => {
    expect(pendapatanOffline(new Decimal(4), 3600).toNumber()).toBeCloseTo(4 * 3600 * 0.5, 8);
    expect(pendapatanOffline(new Decimal(4), 0).toNumber()).toBe(0);
  });
});

describe('prestige (logika saja)', () => {
  it('0 poin di bawah ambang', () => {
    expect(poinPrestigeDidapat(new Decimal(0)).toNumber()).toBe(0);
    expect(poinPrestigeDidapat(new Decimal(99_999)).toNumber()).toBe(0);
  });

  it('floor((total / ambang)^eksponen)', () => {
    expect(poinPrestigeDidapat(new Decimal(100_000)).toNumber()).toBe(1);
    expect(poinPrestigeDidapat(new Decimal(399_999)).toNumber()).toBe(1);
    expect(poinPrestigeDidapat(new Decimal(400_000)).toNumber()).toBe(2);
    expect(poinPrestigeDidapat(new Decimal(1e7)).toNumber()).toBe(10);
    expect(poinPrestigeDidapat(new Decimal('1e105')).log10()).toBeCloseTo(50, 6);
  });
});

describe('semua formula membaca angka dari config', () => {
  it('config lain menghasilkan angka lain', () => {
    const cfg: KonfigEkonomi = {
      ...EKONOMI,
      nilaiPerPenumpang: 10,
      multMilestone: 3,
      milestone: [10],
      batasOfflineDetik: 60,
      tahap: { ...EKONOMI.tahap, peron: { ...EKONOMI.tahap.peron, biayaAwal: 100, r: 2 } },
    };
    expect(biayaUpgrade('peron', 3, cfg).toNumber()).toBe(400);
    expect(kapasitas('peron', 10, cfg)).toBeCloseTo((1 + 0.5 * 9) * 3, 10);
    expect(pendapatanPerDetik(1, new Decimal(0), cfg).toNumber()).toBe(10);
    expect(detikOffline(3_600_000, 0, cfg)).toBe(60);
  });
});
