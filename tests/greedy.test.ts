import { describe, expect, it } from 'vitest';
import { beliUpgrade, bisaUpgrade, tahapBottleneck, tick, type GameState } from '../src/sim/state';
import { DT, levelSemua, stateOtomatis } from './helpers';

/**
 * Strategi greedy dari spreadsheet model: semua tahap otomatis sejak awal,
 * selalu upgrade bottleneck begitu uang cukup. Dijalankan dengan tick
 * fixed timestep 10 Hz yang sama dengan game; pembelian dicek di awal tiap tick.
 */
function jalankanGreedy(targetPembelian: number): { state: GameState; detik: number } {
  let s = stateOtomatis();
  let pembelian = 0;
  let langkah = 0;
  for (;;) {
    for (;;) {
      const b = tahapBottleneck(s);
      if (!bisaUpgrade(s, b)) break;
      s = beliUpgrade(s, b);
      if (++pembelian === targetPembelian) return { state: s, detik: langkah * DT };
    }
    s = tick(s, DT);
    langkah++;
  }
}

describe('strategi greedy vs spreadsheet model', () => {
  it('setelah 134 pembelian: Peron 43 / Loket 49 / Keberangkatan 44 (±1), sekitar 5 menit', () => {
    const { state, detik } = jalankanGreedy(134);
    const level = levelSemua(state);
    console.info(`greedy 134 pembelian → ${JSON.stringify(level)} dalam ${detik.toFixed(1)} detik`);

    expect(Math.abs(level.peron - 43)).toBeLessThanOrEqual(1);
    expect(Math.abs(level.loket - 49)).toBeLessThanOrEqual(1);
    expect(Math.abs(level.keberangkatan - 44)).toBeLessThanOrEqual(1);
    expect(detik).toBeGreaterThan(270);
    expect(detik).toBeLessThan(330);
  });
});
