import { describe, expect, it } from 'vitest';
import { KembangApi, MAKS_PARTIKEL, WARNA_KEMBANG_API } from '../src/game/kembang-api';

describe('kembang api peresmian', () => {
  it('ledakan berurutan di sekitar titik peresmian, partikel jatuh pelan lalu habis', () => {
    const k = new KembangApi();
    expect(k.aktif).toBe(false);
    k.rayakan(10, 5, 4, 3);
    expect(k.aktif).toBe(true);
    // Belum ada yang meledak sebelum waktunya.
    expect(k.partikel).toHaveLength(0);
    let maks = 0;
    for (let t = 0; t < 10; t += 1 / 30) {
      k.perbarui(1 / 30);
      maks = Math.max(maks, k.partikel.length);
      for (const p of k.partikel) {
        expect(p.h).toBeGreaterThanOrEqual(0.05);
        expect(p.umur).toBeLessThan(p.lama);
        expect(Math.hypot(p.x - 10, p.y - 5)).toBeLessThan(10);
        expect(WARNA_KEMBANG_API[p.warna]).toBeDefined();
      }
    }
    // Beberapa ledakan menyala bersamaan, tapi tidak melebihi ukuran InstancedMesh.
    expect(maks).toBeGreaterThan(56);
    expect(maks).toBeLessThanOrEqual(MAKS_PARTIKEL);
    expect(k.aktif).toBe(false);
  });

  it('deterministik per benih; dt nol atau tidak sah tidak memajukan waktu', () => {
    const a = new KembangApi();
    const b = new KembangApi();
    a.rayakan(0, 0, 4, 9);
    b.rayakan(0, 0, 4, 9);
    for (let i = 0; i < 60; i++) {
      a.perbarui(1 / 30);
      b.perbarui(1 / 30);
    }
    expect(a.partikel.length).toBeGreaterThan(0);
    expect(a.partikel).toEqual(b.partikel);
    const c = new KembangApi();
    c.rayakan(0, 0, 4);
    for (let i = 0; i < 100; i++) {
      c.perbarui(0);
      c.perbarui(Number.NaN);
    }
    expect(c.partikel).toHaveLength(0);
    expect(c.aktif).toBe(true);
  });
});
