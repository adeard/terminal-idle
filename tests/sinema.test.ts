import { describe, expect, it } from 'vitest';
import { ELEVASI_MAKS, ELEVASI_MIN } from '../src/game/kamera';
import { DETIK_PUTARAN, poseSinema, type PoseSinema } from '../src/game/sinema';
import { teksJam } from '../src/ui/sinema';

const PHI_MIN = Math.PI / 2 - ELEVASI_MAKS;
const PHI_MAKS = Math.PI / 2 - ELEVASI_MIN;
const awal: PoseSinema = { x: 12, z: 6, jarak: 50, theta: 0.8, phi: 0.7 };

describe('kamera mode sinema', () => {
  it('mulai tepat dari pose awal tanpa lompatan', () => {
    const p = poseSinema(0, awal, PHI_MIN, PHI_MAKS);
    for (const k of ['x', 'z', 'jarak', 'theta', 'phi'] as const) expect(p[k]).toBeCloseTo(awal[k], 12);
    // Sepersepuluh detik kemudian hampir tidak bergerak (putaran dipercepat halus).
    const q = poseSinema(0.1, awal, PHI_MIN, PHI_MAKS);
    expect(Math.abs(q.theta - awal.theta)).toBeLessThan(1e-3);
    expect(Math.abs(q.jarak - awal.jarak)).toBeLessThan(0.2);
  });

  it('satu putaran penuh tiap DETIK_PUTARAN (setelah awalan), searah terus', () => {
    const satu = poseSinema(DETIK_PUTARAN + 1, awal, PHI_MIN, PHI_MAKS);
    expect(satu.theta - awal.theta).toBeCloseTo(2 * Math.PI, 9);
    let lalu = awal.theta;
    for (let t = 0.5; t < 400; t += 0.5) {
      const th = poseSinema(t, awal, PHI_MIN, PHI_MAKS).theta;
      expect(th).toBeGreaterThan(lalu);
      lalu = th;
    }
  });

  it('zoom, miring, dan geser bernapas dalam batas; kemiringan tidak melewati batas kamera', () => {
    for (let t = 0; t < 900; t += 0.7) {
      const p = poseSinema(t, awal, PHI_MIN, PHI_MAKS);
      expect(p.jarak).toBeGreaterThanOrEqual(awal.jarak * 0.9 - 1e-9);
      expect(p.jarak).toBeLessThanOrEqual(awal.jarak * 1.1 + 1e-9);
      expect(Math.abs(p.x - awal.x)).toBeLessThanOrEqual(0.12 * awal.jarak + 1e-9);
      expect(p.z).toBe(awal.z);
      expect(p.phi).toBeGreaterThanOrEqual(PHI_MIN);
      expect(p.phi).toBeLessThanOrEqual(PHI_MAKS);
    }
    const diBatas = poseSinema(17.75, { ...awal, phi: PHI_MAKS }, PHI_MIN, PHI_MAKS);
    expect(diBatas.phi).toBeLessThanOrEqual(PHI_MAKS);
  });

  it('jam di tanda pojok', () => {
    expect(teksJam(0)).toBe('00:00');
    expect(teksJam(6.5)).toBe('06:30');
    expect(teksJam(23.999)).toBe('23:59');
    expect(teksJam(25.25)).toBe('01:15');
  });
});
