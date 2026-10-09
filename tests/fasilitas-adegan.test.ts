import { describe, expect, it } from 'vitest';
import {
  BARIS_PARKIR,
  blokKursiDi,
  blokKursiTerpasang,
  fasilitasAdegan,
  indeksToko,
  stafAdegan,
  tokoDibangun,
  URUTAN_BLOK_KURSI,
} from '../src/game/fasilitas-adegan';
import { RUTE_SAPU } from '../src/game/kehidupan-malam';
import {
  BLOK_KURSI,
  GERBANG_X,
  HALTE_DATANG_X,
  KOLOM_KANOPI_DATANG,
  KURSI_TUNGGU,
  PERON,
  PERON_BERANGKAT,
  PINTU_BUS,
  POS_PETUGAS_PERON,
  POS_SATPAM,
  RUANG_TUNGGU,
  TOKO_AULA,
  ZONA,
} from '../src/game/tata-letak';
import { bangunanAwal } from '../src/sim/bangunan';
import { hitungPetugas } from '../src/sim/petugas';
import type { PetugasId } from '../src/sim/fitur';

const di = ([x, y]: readonly [number, number], r: { x0: number; y0: number; x1: number; y1: number }): boolean => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1;

describe('blok kursi ruang tunggu', () => {
  it('dipasang mulai dari yang terdekat ke gerbang Jalur 1, lalu menjauh', () => {
    expect([...URUTAN_BLOK_KURSI].sort()).toEqual(BLOK_KURSI.map((_, i) => i));
    const jarak = URUTAN_BLOK_KURSI.map((i) => Math.abs((BLOK_KURSI[i]!.x0 + BLOK_KURSI[i]!.x1) / 2 - GERBANG_X[0]!));
    for (let i = 1; i < jarak.length; i++) expect(jarak[i]!).toBeGreaterThan(jarak[i - 1]!);
  });

  it('terpasang sebanyak unit kursi yang dibangun; unit di luar adegan (lantai 2) tidak menambah blok', () => {
    expect(blokKursiTerpasang(0).every((b) => !b)).toBe(true);
    const satu = blokKursiTerpasang(1);
    expect(satu.filter(Boolean)).toHaveLength(1);
    expect(satu[URUTAN_BLOK_KURSI[0]!]).toBe(true);
    expect(blokKursiTerpasang(BLOK_KURSI.length).every(Boolean)).toBe(true);
    expect(blokKursiTerpasang(8).every(Boolean)).toBe(true);
    expect(blokKursiTerpasang(-2).some(Boolean)).toBe(false);
  });

  it('blok di titik kursi = blok kursinya; di luar blok −1', () => {
    for (const k of KURSI_TUNGGU) expect(blokKursiDi(k.x, k.y)).toBe(k.blok);
    expect(blokKursiDi(RUANG_TUNGGU.x0 + 0.2, KURSI_TUNGGU[0]!.y)).toBe(-1);
    expect(blokKursiDi(KURSI_TUNGGU[0]!.x, RUANG_TUNGGU.y1 - 0.2)).toBe(-1);
  });
});

describe('fasilitas di adegan dari bangunan', () => {
  it('game baru: satu blok kursi; belum ada kios, toko, toilet, lahan parkir, maupun pos retribusi', () => {
    const f = fasilitasAdegan(bangunanAwal());
    expect(f.blokKursi.filter(Boolean)).toHaveLength(1);
    expect([f.kios, f.toko, f.toilet, f.barisParkir, f.posRetribusi]).toEqual([0, 0, false, 0, false]);
  });

  it('per unit, dibatasi yang ada di adegan', () => {
    const b = { ...bangunanAwal(), kios: 5, toko: 1, toilet: 2, lahanParkir: 3, posRetribusi: 1 };
    const f = fasilitasAdegan(b);
    expect(f.kios).toBe(3);
    expect(f.toko).toBe(1);
    expect(f.toilet).toBe(true);
    expect(f.barisParkir).toBe(BARIS_PARKIR);
    expect(f.posRetribusi).toBe(true);
    expect(fasilitasAdegan({ ...b, lahanParkir: 1 }).barisParkir).toBe(1);
  });

  it('toko aula urut TOKO_AULA: unit pertama minimarket, kedua apotek', () => {
    expect(TOKO_AULA[indeksToko('minimarket')]!.nama).toBe('MINIMARKET');
    expect(TOKO_AULA[indeksToko('apotek')]!.nama).toBe('APOTEK');
    expect(tokoDibangun({ kios: 0, toko: 1 }, 'minimarket')).toBe(true);
    expect(tokoDibangun({ kios: 0, toko: 1 }, 'apotek')).toBe(false);
    expect(tokoDibangun({ kios: 0, toko: 2 }, 'apotek')).toBe(true);
    expect(tokoDibangun({ kios: 0, toko: 2 }, 'kios')).toBe(false);
    expect(tokoDibangun({ kios: 1, toko: 0 }, 'kios')).toBe(true);
  });
});

describe('petugas di adegan', () => {
  const urutan = (n: Partial<Record<PetugasId, number>>): PetugasId[] => Object.entries(n).flatMap(([id, k]) => Array.from({ length: k }, () => id as PetugasId));

  it('sebanyak yang direkrut, paling banyak pos/halte/gerbang/rute yang ada di adegan', () => {
    expect(stafAdegan(hitungPetugas([]))).toEqual({ peron: 0, gerbang: 0, satpam: 0, kebersihan: 0 });
    expect(stafAdegan(hitungPetugas(urutan({ peron: 2, gerbang: 1, satpam: 3, kebersihan: 2 })))).toEqual({ peron: 2, gerbang: 1, satpam: 3, kebersihan: 2 });
    expect(stafAdegan(hitungPetugas(urutan({ peron: 9, gerbang: 9, satpam: 18, kebersihan: 20 })))).toEqual({
      peron: HALTE_DATANG_X.length,
      gerbang: GERBANG_X.length,
      satpam: POS_SATPAM.length,
      kebersihan: RUTE_SAPU.length,
    });
  });

  it('petugas peron di tepi peron tiap halte, di luar lintasan penumpang turun, tiang kanopi, dan rambu BUS', () => {
    expect(POS_PETUGAS_PERON).toHaveLength(HALTE_DATANG_X.length);
    POS_PETUGAS_PERON.forEach(([x, y], i) => {
      expect(di([x, y], PERON)).toBe(true);
      const pintu = HALTE_DATANG_X[i]! + PINTU_BUS;
      // Penumpang turun lurus dari pintu (±0,1), digeser ±0,35 bila dekat tiang kanopi.
      let xTurun = pintu;
      for (const k of KOLOM_KANOPI_DATANG) if (Math.abs(xTurun - k) < 0.3) xTurun = k + (xTurun < k ? -0.35 : 0.35);
      expect(Math.abs(x - pintu)).toBeGreaterThan(0.35);
      expect(Math.abs(x - xTurun)).toBeGreaterThan(0.25);
      for (const k of KOLOM_KANOPI_DATANG) for (const yk of [5.72, 7.1]) expect(Math.hypot(x - k, y - yk)).toBeGreaterThan(0.25);
      expect(Math.hypot(x - (PERON.x1 - 0.3), y - (PERON.y0 + 0.2))).toBeGreaterThan(0.4);
    });
  });

  it('pos satpam di peron & aula ada di lantainya, jauh dari gerbang & pintu bus', () => {
    expect(POS_SATPAM).toHaveLength(4);
    const [, , berangkat, datang] = POS_SATPAM;
    expect(di(berangkat!, PERON_BERANGKAT)).toBe(true);
    for (const g of GERBANG_X) expect(Math.abs(berangkat![0] - g)).toBeGreaterThan(1.5);
    expect(di(datang!, PERON)).toBe(true);
    for (const x of HALTE_DATANG_X) expect(Math.abs(datang![0] - (x + PINTU_BUS))).toBeGreaterThan(0.5);
  });
});

describe('zona pangkalan', () => {
  it('label melayang di atas atap bus yang parkir, di dalam pangkalan', () => {
    const [x, y, h] = ZONA.pangkalan.label;
    const b = ZONA.pangkalan.balok[0]!;
    expect(x).toBeGreaterThan(b.x0);
    expect(x).toBeLessThan(b.x1);
    expect(y).toBeGreaterThan(b.y0);
    expect(y).toBeLessThan(b.y1);
    expect(h).toBeGreaterThan(1);
  });
});
