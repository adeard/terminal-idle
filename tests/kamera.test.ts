import { describe, expect, it } from 'vitest';
import { AMBANG_PELINTIR, PelacakPelintir, selisihSudut } from '../src/game/kamera';

/** Dua jari berseberangan di sekitar (cx, cy) dengan jarak r dan sudut a (layar, y ke bawah). */
function jari(p: PelacakPelintir, a: number, r: number, cx = 200, cy = 300): number {
  const dx = Math.cos(a) * r;
  const dy = Math.sin(a) * r;
  return p.gerak(1, cx - dx, cy - dy) + p.gerak(2, cx + dx, cy + dy);
}

describe('rotasi kamera (pelintir dua jari)', () => {
  it('selisih sudut dibungkus ke (−π, π]', () => {
    expect(selisihSudut(0.1, 0.3)).toBeCloseTo(0.2, 12);
    expect(selisihSudut(3.1, -3.1)).toBeCloseTo(2 * Math.PI - 6.2, 12);
    expect(selisihSudut(-3.1, 3.1)).toBeCloseTo(-(2 * Math.PI - 6.2), 12);
  });

  it('cubit zoom (jari menjauh segaris) tidak memutar', () => {
    const p = new PelacakPelintir();
    p.turun(1, 150, 300);
    p.turun(2, 250, 300);
    let total = 0;
    for (let r = 50; r < 150; r += 5) total += jari(p, 0, r);
    expect(total).toBe(0);
  });

  it('pelintir kecil di bawah ambang diabaikan; lewat ambang mengikuti jari searah jarum jam', () => {
    const p = new PelacakPelintir();
    p.turun(1, 150, 300);
    p.turun(2, 250, 300);
    let total = 0;
    for (let a = 0; a <= AMBANG_PELINTIR * 0.8; a += 0.01) total += jari(p, a, 50);
    expect(total).toBe(0);
    // Terus dipelintir searah jarum jam (sudut layar naik) sampai 60°.
    for (let a = AMBANG_PELINTIR * 0.8; a <= Math.PI / 3; a += 0.01) total += jari(p, a, 50);
    expect(total).toBeGreaterThan(Math.PI / 3 - 0.03);
    expect(total).toBeLessThan(Math.PI / 3 + 0.03);
    // Berbalik arah: ikut berbalik tanpa ambang lagi.
    const balik = jari(p, Math.PI / 3 - 0.2, 50);
    expect(balik).toBeLessThan(0);
  });

  it('mengangkat satu jari mengulang pelacakan (tidak ada lompatan saat jari turun lagi)', () => {
    const p = new PelacakPelintir();
    p.turun(1, 150, 300);
    p.turun(2, 250, 300);
    for (let a = 0; a <= 0.6; a += 0.02) jari(p, a, 50);
    p.angkat(2);
    p.turun(2, 200, 400); // posisi berbeda jauh
    expect(p.gerak(2, 201, 400)).toBe(0);
    expect(p.gerak(1, 150, 300)).toBe(0);
  });
});
