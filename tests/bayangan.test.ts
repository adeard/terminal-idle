import { describe, expect, it } from 'vitest';
import { bingkaiBayangan, sumbuCahaya, type OpsiBingkaiBayangan } from '../src/game/bayangan';
import { arahMatahari, type Vektor3 } from '../src/game/langit';

const OPSI: OpsiBingkaiBayangan = { ukuranPeta: 2048, min: 12, maks: 64, langkah: 4, margin: 3 };
const titik = (a: Vektor3, b: Vektor3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Jejak persegi panjang di tanah (y = 0) di sekitar (x, z). */
function jejak(x: number, z: number, lebar: number, dalam: number): Vektor3[] {
  return [
    [x - lebar / 2, 0, z - dalam / 2],
    [x + lebar / 2, 0, z - dalam / 2],
    [x + lebar / 2, 0, z + dalam / 2],
    [x - lebar / 2, 0, z + dalam / 2],
  ];
}

describe('bingkai peta bayangan', () => {
  it('sumbu u, v, w saling tegak lurus dan u mendatar', () => {
    for (const jam of [7, 12, 17]) {
      const w = arahMatahari(jam);
      const { u, v } = sumbuCahaya(w);
      expect(u[1]).toBe(0);
      expect(titik(u, v)).toBeCloseTo(0, 9);
      expect(titik(u, w)).toBeCloseTo(0, 9);
      expect(titik(v, w)).toBeCloseTo(0, 9);
      expect(Math.hypot(...v)).toBeCloseTo(1, 9);
    }
  });

  it('seluruh jejak pandangan masuk ke dalam peta bayangan', () => {
    const w = arahMatahari(16.8); // matahari rendah: jejak di tanah memanjang di bidang cahaya
    for (const [x, z, lebar, dalam] of [
      [-15, 6, 18, 12],
      [20, 7, 60, 30],
      [40, 12, 8, 6],
    ] as const) {
      const titikJejak = jejak(x, z, lebar, dalam);
      const b = bingkaiBayangan(titikJejak, w, [x, 0, z], OPSI);
      const { u, v } = sumbuCahaya(w);
      for (const p of titikJejak) {
        expect(Math.abs(titik(p, u) - titik(b.pusat, u))).toBeLessThanOrEqual(b.setengah);
        expect(Math.abs(titik(p, v) - titik(b.pusat, v))).toBeLessThanOrEqual(b.setengah);
      }
    }
  });

  it('zoom dekat lebih tajam, zoom jauh dibatasi; ukuran dibulatkan per langkah', () => {
    const w = arahMatahari(12);
    const dekat = bingkaiBayangan(jejak(0, 0, 6, 4), w, [0, 0, 0], OPSI);
    const jauh = bingkaiBayangan(jejak(0, 0, 400, 300), w, [0, 0, 0], OPSI);
    expect(dekat.setengah).toBe(OPSI.min);
    expect(jauh.setengah).toBe(OPSI.maks);
    expect(dekat.texel).toBeLessThan(jauh.texel);
    const sedang = bingkaiBayangan(jejak(0, 0, 40, 20), w, [0, 0, 0], OPSI);
    expect(sedang.setengah % OPSI.langkah).toBe(0);
  });

  it('geseran kamera di bawah satu texel tidak menggeser peta (tepi bayangan tidak berkilau)', () => {
    const w = arahMatahari(10);
    const a = bingkaiBayangan(jejak(10, 5, 30, 20), w, [10, 0, 5], OPSI);
    const b = bingkaiBayangan(jejak(10.001, 5.001, 30, 20), w, [10.001, 0, 5.001], OPSI);
    expect(b.pusat).toEqual(a.pusat);
    // Geseran jauh memindahkan pusat tepat kelipatan texel di bidang cahaya.
    const c = bingkaiBayangan(jejak(13, 5, 30, 20), w, [13, 0, 5], OPSI);
    const { u, v } = sumbuCahaya(w);
    for (const sumbu of [u, v]) {
      const langkah = (titik(c.pusat, sumbu) - titik(a.pusat, sumbu)) / a.texel;
      expect(langkah).toBeCloseTo(Math.round(langkah), 6);
    }
  });
});
