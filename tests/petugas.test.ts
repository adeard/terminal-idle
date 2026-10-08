import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { bangunanAwal } from '../src/sim/bangunan';
import type { PetugasId } from '../src/sim/fitur';
import { berhentikan, berhentiKasHabis, bisaRekrut, gajiHarian, hitungPetugas, maksPetugas, rapikanPetugas, rekrut } from '../src/sim/petugas';

describe('petugas tycoon', () => {
  it('batas tiap peran mengikuti bangunan: satu per halte/gerbang, per lahan parkir, per toilet; manajer satu', () => {
    const b = { ...bangunanAwal(), jalur: 3, lahanParkir: 2, toilet: 1 };
    expect(maksPetugas('peron', b)).toBe(3);
    expect(maksPetugas('gerbang', b)).toBe(3);
    expect(maksPetugas('juruParkir', b)).toBe(2);
    expect(maksPetugas('petugasToilet', b)).toBe(1);
    expect(maksPetugas('petugasRetribusi', b)).toBe(0);
    expect(maksPetugas('manajerOperasional', b)).toBe(1);
    expect(bisaRekrut('peron', ['peron', 'peron', 'peron'], b)).toBe(false);
    expect(bisaRekrut('petugasToilet', [], b)).toBe(true);
  });

  it('urutan rekrut: berhentikan mengeluarkan petugas peran itu yang paling akhir direkrut', () => {
    let u: PetugasId[] = [];
    for (const id of ['peron', 'kebersihan', 'satpam', 'kebersihan'] as const) u = rekrut(u, id);
    expect(hitungPetugas(u)).toMatchObject({ peron: 1, kebersihan: 2, satpam: 1, gerbang: 0 });
    expect(berhentikan(u, 'kebersihan')).toEqual(['peron', 'kebersihan', 'satpam']);
    expect(berhentikan(u, 'gerbang')).toEqual(u);
  });

  it('kas habis: yang terakhir direkrut berhenti lebih dulu, manajer paling akhir', () => {
    const u: PetugasId[] = ['manajerOperasional', 'peron', 'satpam', 'manajerKemitraan'];
    const a = berhentiKasHabis(u);
    expect(a).toEqual(['manajerOperasional', 'peron', 'manajerKemitraan']);
    const b = berhentiKasHabis(berhentiKasHabis(a));
    expect(b).toEqual(['manajerOperasional']);
    expect(berhentiKasHabis(b)).toEqual([]);
    expect(berhentiKasHabis([])).toEqual([]);
  });

  it('bangunan dibongkar: kelebihan petugas keluar, yang paling baru direkrut lebih dulu', () => {
    const u: PetugasId[] = ['petugasToilet', 'peron', 'petugasToilet', 'juruParkir'];
    expect(rapikanPetugas(u, { ...bangunanAwal(), toilet: 1, lahanParkir: 0 })).toEqual(['petugasToilet', 'peron']);
  });

  it('gaji per hari dari semua posisi', () => {
    const g = EKONOMI.tycoon.gaji;
    expect(gajiHarian(['peron', 'peron', 'manajerOperasional'])).toBe(2 * g.peron + g.manajerOperasional);
    expect(gajiHarian([])).toBe(0);
  });
});
