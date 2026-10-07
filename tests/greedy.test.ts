import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { PO_IDS, type PoId } from '../src/sim/fitur';
import {
  beliUpgrade,
  bisaDaftarPo,
  bisaUpgrade,
  daftarPo,
  jatahLoketPo,
  levelPo,
  levelTerminal,
  poTujuanLoket,
  tahapBottleneck,
  tick,
  type GameState,
} from '../src/sim/state';
import { DT, levelSemua, stateOtomatis } from './helpers';

/**
 * Strategi greedy sederhana untuk ekonomi mitra PO: semua tahap otomatis sejak
 * awal, selalu upgrade tahap paling lambat begitu uang cukup; bila yang paling
 * lambat Loket tapi jatah loket semua PO penuh, daftarkan PO termurah yang bisa
 * (slot & uang). Tanpa jalur, fasilitas, perluasan, maupun Renovasi. Dijalankan
 * dengan tick fixed timestep 10 Hz yang sama dengan game; pembelian dicek di awal tiap tick.
 */
function jalankanGreedy(detik: number): { state: GameState; pembelian: number; daftar: { po: PoId; detik: number }[] } {
  let s = stateOtomatis();
  let pembelian = 0;
  const daftar: { po: PoId; detik: number }[] = [];
  const langkah = Math.round(detik / DT);
  for (let i = 0; i < langkah; i++) {
    for (;;) {
      const b = tahapBottleneck(s);
      if (b === 'loket' && poTujuanLoket(s) === null) {
        const po = PO_IDS.filter((id) => bisaDaftarPo(s, id)).sort((a, c) => EKONOMI.mitra.po[a].biayaDaftar - EKONOMI.mitra.po[c].biayaDaftar)[0];
        if (!po) break;
        s = daftarPo(s, po);
        daftar.push({ po, detik: i * DT });
        continue;
      }
      if (!bisaUpgrade(s, b)) break;
      s = beliUpgrade(s, b);
      pembelian++;
    }
    s = tick(s, DT);
  }
  return { state: s, pembelian, daftar };
}

describe('strategi greedy (tempo awal ekonomi mitra PO)', () => {
  /**
   * Patokan tempo (documents/12, bagian 15: tempo "lebih lambat" dari v1 yang
   * mencapai 134 pembelian dalam 5 menit). Mengubah angka ini = mengubah tempo
   * awal game; sengaja dibuat ketat supaya perubahan config terlihat.
   */
  it('10 menit pertama: Peron 25 / Loket 28 / Keberangkatan 26 (±1), PO kedua di menit pertama, Loket mentok di jatah', { timeout: 60_000 }, () => {
    const { state, pembelian, daftar } = jalankanGreedy(600);
    const level = levelSemua(state);
    expect(Math.abs(level.peron - 25)).toBeLessThanOrEqual(1);
    expect(Math.abs(level.loket - 28)).toBeLessThanOrEqual(1);
    expect(Math.abs(level.keberangkatan - 26)).toBeLessThanOrEqual(1);
    expect(pembelian).toBeGreaterThanOrEqual(70);
    expect(pembelian).toBeLessThanOrEqual(78);
    expect(levelTerminal(state)).toBe(2);
    // PO termurah langsung didaftarkan begitu jatah PO awal penuh; slot ketiga baru di Terminal Lv 3.
    expect(daftar.map((d) => d.po)).toEqual(['peuyeumKilat']);
    expect(daftar[0]!.detik).toBeLessThan(60);
    expect(state.mitra.terdaftar.map((p) => levelPo(p))).toEqual([3, 3]);
    // Loket menunggu PO naik level (bus yang datang): jatah semua PO terpakai penuh.
    for (const p of state.mitra.terdaftar) expect(p.loket).toBe(jatahLoketPo(state, p));
    expect(poTujuanLoket(state)).toBeNull();
  });
});
