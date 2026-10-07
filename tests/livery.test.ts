import { describe, expect, it } from 'vitest';
import { LIVERY_PO } from '../src/config/livery.config';
import { FRAME_ASET } from '../src/game/aset-data';
import { AREA_TULISAN, BOBOT_PO, keHsl, pikselCatBadan, pilihLivery, polaMenutup, rgbDariHex, warnaiUlang } from '../src/game/livery';
import { PO_IDS } from '../src/sim/fitur';

const rona = (hex: number): number => keHsl(...rgbDariHex(hex))[0];

describe('livery PO: pewarnaan ulang gambar samping', () => {
  it('cat badan gambar dasar dikenali; kaca gelap, rok abu-abu, dan tulisan putih tidak', () => {
    for (const nama of ['bus/oranye-1', 'bus/kuning-2'] as const) {
      const w = FRAME_ASET[nama].warna;
      expect(pikselCatBadan(...rgbDariHex(w), rona(w))).toBe(true);
      expect(pikselCatBadan(28, 36, 48, rona(w))).toBe(false); // kaca
      expect(pikselCatBadan(128, 130, 134, rona(w))).toBe(false); // rok abu-abu
      expect(pikselCatBadan(245, 245, 240, rona(w))).toBe(false); // tulisan putih
      expect(pikselCatBadan(40, 90, 200, rona(w))).toBe(false); // warna lain (biru)
    }
  });

  it('warna baru mengikuti warna PO, bayangan tetap lebih gelap dan sorotan lebih terang', () => {
    const dasar = FRAME_ASET['bus/oranye-1'].warna;
    const [r, g, b] = rgbDariHex(dasar);
    const [, , terang] = keHsl(r, g, b);
    const target = 0x0d9488;
    const sama = warnaiUlang(r, g, b, terang, target);
    const [ht] = keHsl(...rgbDariHex(target));
    expect(Math.abs(keHsl(...sama)[0] - ht)).toBeLessThan(3);
    const tt = keHsl(...rgbDariHex(target))[2];
    expect(Math.abs(keHsl(...sama)[2] - tt)).toBeLessThan(0.02);
    const gelap = warnaiUlang(r * 0.6, g * 0.6, b * 0.6, terang, target);
    const cerah = warnaiUlang(Math.min(255, r + 30), Math.min(255, g + 30), Math.min(255, b + 30), terang, target);
    expect(keHsl(...gelap)[2]).toBeLessThan(keHsl(...sama)[2]);
    expect(keHsl(...cerah)[2]).toBeGreaterThan(keHsl(...sama)[2]);
  });

  it('pola: dua warna di badan bawah, garis di atas jendela, sapuan miring, polos tanpa pola', () => {
    expect(polaMenutup('dua', 0.5, 0.7)).toBe(true);
    expect(polaMenutup('dua', 0.5, 0.2)).toBe(false);
    expect(polaMenutup('garis', 0.3, 0.3)).toBe(true);
    expect(polaMenutup('garis', 0.3, 0.2)).toBe(false);
    // Sapuan: di badan bawah bagian belakang, di pita atas bagian depan.
    expect(polaMenutup('sapuan', 0.05, 0.77)).toBe(true);
    expect(polaMenutup('sapuan', 0.95, 0.23)).toBe(true);
    expect(polaMenutup('sapuan', 0.05, 0.2)).toBe(false);
    for (let u = 0; u <= 1; u += 0.1) for (let v = 0; v <= 1; v += 0.1) expect(polaMenutup('polos', u, v)).toBe(false);
  });

  it('pola tidak pernah menutupi area tulisan nama PO', () => {
    for (const pola of ['polos', 'garis', 'dua', 'sapuan'] as const) {
      for (let u = AREA_TULISAN.u0; u <= AREA_TULISAN.u1; u += 0.01) {
        for (let v = AREA_TULISAN.v0; v <= AREA_TULISAN.v1; v += 0.01) expect(polaMenutup(pola, u, v)).toBe(false);
      }
    }
  });

  it('tiap PO punya livery lengkap dengan warna badan & aksen yang berbeda', () => {
    for (const id of PO_IDS) {
      const l = LIVERY_PO[id];
      expect(l.warna).not.toBe(l.aksen);
      expect(l.papan).toBe(l.papan.toUpperCase());
    }
  });
});

describe('livery PO: bus terminal memakai livery mitra yang bergabung', () => {
  it('tanpa PO: selalu livery bawaan; dengan PO: campuran, PO berbobot lebih besar', () => {
    for (let id = 0; id < 200; id++) {
      const p = pilihLivery(id, id % 40, 8, []);
      expect(p.jenis).toBe('bawaan');
      if (p.jenis === 'bawaan') expect(p.indeks).toBeLessThan(8);
    }
    const po = ['a', 'b', 'c', 'd'] as const;
    let jumlahPo = 0;
    const terlihat = new Set<string>();
    const n = 4000;
    for (let id = 0; id < n; id++) {
      const p = pilihLivery(id, (id * 7) % 40, 8, po);
      if (p.jenis === 'po') {
        jumlahPo++;
        terlihat.add(p.po);
      }
    }
    expect(terlihat.size).toBe(po.length);
    const harapan = (BOBOT_PO * po.length) / (8 + BOBOT_PO * po.length);
    expect(Math.abs(jumlahPo / n - harapan)).toBeLessThan(0.05);
  });

  it('bus yang sama selalu mendapat livery yang sama', () => {
    expect(pilihLivery(17, 3, 8, ['x', 'y'])).toEqual(pilihLivery(17, 3, 8, ['x', 'y']));
  });
});
