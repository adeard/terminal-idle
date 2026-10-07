import { describe, expect, it } from 'vitest';
import atlasMentah from '../public/aset/atlas.json?raw';
import { BUS_TERMINAL, KENDARAAN_LEWAT, uvFrame } from '../src/game/aset';
import { FRAME_ASET, UKURAN_ATLAS, type NamaFrame } from '../src/game/aset-data';
import { BUS, PINTU_BUS } from '../src/game/tata-letak';

interface KotakFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const atlas = JSON.parse(atlasMentah) as {
  frames: Record<string, { frame: KotakFrame }>;
  meta: { size: { w: number; h: number } };
};
const NAMA = Object.keys(FRAME_ASET) as NamaFrame[];
const pangkatDua = (n: number): boolean => n > 0 && (n & (n - 1)) === 0;

describe('atlas (hasil npm run aset)', () => {
  it('ukurannya pangkat dua (syarat mipmap) dan sama dengan aset-data.ts', () => {
    expect(atlas.meta.size).toEqual(UKURAN_ATLAS);
    expect(pangkatDua(UKURAN_ATLAS.w) && pangkatDua(UKURAN_ATLAS.h)).toBe(true);
  });

  it('posisi & ukuran frame di atlas.json persis sama dengan aset-data.ts', () => {
    expect(Object.keys(atlas.frames).sort()).toEqual([...NAMA].sort());
    for (const nama of NAMA) {
      const f = atlas.frames[nama]!.frame;
      const d = FRAME_ASET[nama];
      expect([f.x, f.y, f.w, f.h], nama).toEqual([d.x, d.y, d.w, d.h]);
    }
  });

  it('frame di dalam atlas dan tidak saling tumpang tindih', () => {
    const kotak = NAMA.map((n) => FRAME_ASET[n]);
    for (const k of kotak) {
      expect(k.x >= 0 && k.y >= 0 && k.x + k.w <= UKURAN_ATLAS.w && k.y + k.h <= UKURAN_ATLAS.h).toBe(true);
    }
    for (let i = 0; i < kotak.length; i++) {
      for (let j = i + 1; j < kotak.length; j++) {
        const a = kotak[i]!;
        const b = kotak[j]!;
        const tumpang = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(tumpang, `${NAMA[i]} vs ${NAMA[j]}`).toBe(false);
      }
    }
  });

  it('titik kaki (origin sprite) berada di dalam frame', () => {
    for (const nama of NAMA) {
      const f = FRAME_ASET[nama];
      expect(f.kakiX > 0 && f.kakiX < f.w && f.kakiY > 0 && f.kakiY <= f.h, nama).toBe(true);
    }
  });

  it('uvFrame: di dalam [0,1], tepi atas di v lebih besar (konvensi flipY three.js)', () => {
    for (const nama of NAMA) {
      const uv = uvFrame(nama);
      expect(uv.u0).toBeGreaterThan(0);
      expect(uv.u1).toBeLessThan(1);
      expect(uv.u0).toBeLessThan(uv.u1);
      expect(uv.v0).toBeLessThan(uv.v1);
      expect(uv.v0).toBeGreaterThan(0);
      expect(uv.v1).toBeLessThan(1);
    }
    const f = FRAME_ASET['bus/hijau-1'];
    expect(uvFrame('bus/hijau-1').v1).toBeCloseTo(1 - (f.y + 0.5) / UKURAN_ATLAS.h, 9);
  });
});

describe('aset game', () => {
  it('bus terminal sepanjang BUS.panjang dan selebar BUS.lebar, proporsinya bus sungguhan', () => {
    for (const t of BUS_TERMINAL) {
      expect(t.panjang).toBe(BUS.panjang);
      expect(t.lebar).toBe(BUS.lebar);
      expect(t.tinggi / t.panjang).toBeGreaterThan(0.25);
      expect(t.tinggi / t.panjang).toBeLessThan(0.45);
    }
    for (const t of KENDARAAN_LEWAT) expect(t.panjang).toBeLessThanOrEqual(BUS.panjang);
  });

  it('jumlah livery DuniaVisual (8 × 5) terbagi rata ke bus terminal & kendaraan lewat', () => {
    const jumlah = BUS_TERMINAL.length * KENDARAAN_LEWAT.length;
    expect(jumlah).toBe(40);
    expect(jumlah % BUS_TERMINAL.length).toBe(0);
    expect(jumlah % KENDARAAN_LEWAT.length).toBe(0);
  });

  it('atlas hanya berisi yang dipakai adegan 3D: sisi bus (gedung terminal prosedural)', () => {
    for (const n of NAMA) expect(n.startsWith('bus/'), n).toBe(true);
    for (const t of [...BUS_TERMINAL, ...KENDARAAN_LEWAT]) expect(NAMA).toContain(t.frame);
  });

  it('roda 3D berada di dalam badan dan menapak; pintu depan di dalam panjang bus', () => {
    for (const t of [...BUS_TERMINAL, ...KENDARAAN_LEWAT]) {
      const [belakang, depan] = t.roda.u;
      expect(belakang).toBeGreaterThan(0.1);
      expect(depan).toBeLessThan(0.9);
      expect(belakang).toBeLessThan(depan);
      expect(t.roda.r).toBeLessThan(t.tinggi * 0.2);
    }
    for (const t of BUS_TERMINAL) expect(t.pintu).toBe(true);
    for (const t of KENDARAAN_LEWAT) expect(t.pintu).toBe(false);
    expect(PINTU_BUS + 0.1).toBeLessThan(BUS.panjang / 2);
  });
});
