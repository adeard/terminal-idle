import { describe, expect, it } from 'vitest';
import { LaluLintas, Trotoar } from '../src/game/lalu-lintas';

const OPSI = { x0: -40, x1: 80, lajurTimur: 20.75, lajurBarat: 21.45, jumlahPerLajur: 18, benih: 5 } as const;

describe('lalu lintas jalan belakang', () => {
  it('tiap lajur searah dan tetap di lajurnya', () => {
    const l = new LaluLintas(OPSI);
    expect(l.kendaraan).toHaveLength(36);
    for (let t = 0; t < 600; t++) l.perbarui(0.05);
    for (const k of l.kendaraan) {
      expect(k.y).toBe(k.arah === 1 ? OPSI.lajurTimur : OPSI.lajurBarat);
      expect(k.x).toBeGreaterThanOrEqual(OPSI.x0);
      expect(k.x).toBeLessThanOrEqual(OPSI.x1);
    }
  });

  it('kendaraan tidak saling tumpang tindih dan tidak berhenti total (jalan tetap mengalir)', () => {
    const l = new LaluLintas(OPSI);
    for (let t = 0; t < 1200; t++) {
      l.perbarui(1 / 30);
      if (t < 300) continue; // biarkan jarak awal acak menyesuaikan diri
      for (const arah of [1, -1] as const) {
        const lajur = l.kendaraan.filter((k) => k.arah === arah).sort((a, b) => a.x - b.x);
        for (let i = 1; i < lajur.length; i++) {
          const celah = lajur[i]!.x - lajur[i - 1]!.x - (lajur[i]!.panjang + lajur[i - 1]!.panjang) / 2;
          expect(celah).toBeGreaterThan(-0.05);
        }
      }
    }
    const rata = l.kendaraan.reduce((s, k) => s + k.v, 0) / l.kendaraan.length;
    expect(rata).toBeGreaterThan(1.2);
  });

  it('motor lebih banyak dari angkot, ada campuran jenis', () => {
    const l = new LaluLintas({ ...OPSI, jumlahPerLajur: 60 });
    const hitung = (j: string): number => l.kendaraan.filter((k) => k.jenis === j).length;
    expect(hitung('motor')).toBeGreaterThan(hitung('angkot'));
    expect(hitung('mobil')).toBeGreaterThan(0);
  });
});

describe('pejalan kaki trotoar', () => {
  it('berjalan pelan sesuai arah dan membungkus di ujung', () => {
    const t = new Trotoar({ x0: -24, x1: 62, jalur: [-0.5, 20.15], jumlahPerJalur: 10, jumlahVarian: 23, benih: 3 });
    const awal = t.orang.map((p) => p.x);
    t.perbarui(1);
    t.orang.forEach((p, i) => {
      const d = p.x - awal[i]!;
      if (Math.abs(d) < 10) expect(Math.sign(d)).toBe(p.arah); // bukan yang baru membungkus
      expect(p.v).toBeLessThan(0.7);
    });
    for (let k = 0; k < 400; k++) t.perbarui(1);
    for (const p of t.orang) expect(p.x >= -24 && p.x <= 62).toBe(true);
  });
});

describe('kepadatan mengikuti ritme harian', () => {
  it('lalu lintas & pejalan kaki berkurang saat sepi; hanya berganti di ujung jalan (di luar layar)', () => {
    const l = new LaluLintas(OPSI);
    const t = new Trotoar({ x0: -24, x1: 62, jalur: [-0.5, 20.15], jumlahPerJalur: 20, jumlahVarian: 23, benih: 3 });
    l.kepadatan = 0.3;
    t.kepadatan = 0.3;
    const galat: string[] = [];
    const dekatUjung = (x: number, x0: number, x1: number): boolean => x - x0 < 0.6 || x1 - x < 0.6;
    for (let n = 0; n < 30 * 400; n++) {
      const aktifL = l.kendaraan.map((k) => k.aktif);
      const aktifT = t.orang.map((p) => p.aktif);
      l.perbarui(1 / 30);
      t.perbarui(1 / 30);
      l.kendaraan.forEach((k, i) => {
        if (k.aktif !== aktifL[i] && !dekatUjung(k.x, OPSI.x0, OPSI.x1)) galat.push(`kendaraan ${k.id} berganti di x=${k.x.toFixed(1)}`);
      });
      t.orang.forEach((p, i) => {
        if (p.aktif !== aktifT[i] && !dekatUjung(p.x, -24, 62)) galat.push(`pejalan ${p.id} berganti di x=${p.x.toFixed(1)}`);
      });
    }
    expect(galat.slice(0, 5)).toEqual([]);
    const porsi = <T extends { aktif: boolean }>(d: readonly T[]): number => d.filter((x) => x.aktif).length / d.length;
    expect(porsi(l.kendaraan)).toBeGreaterThan(0.2);
    expect(porsi(l.kendaraan)).toBeLessThan(0.4);
    expect(porsi(t.orang)).toBeGreaterThan(0.2);
    expect(porsi(t.orang)).toBeLessThan(0.4);
    // Ramai lagi: langsung (saat adegan dibuat) semua ikut.
    l.aturKepadatanSegera(1);
    t.aturKepadatanSegera(1);
    expect(porsi(l.kendaraan)).toBe(1);
    expect(porsi(t.orang)).toBe(1);
  });
});
