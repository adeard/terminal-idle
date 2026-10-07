import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { EKONOMI } from '../src/config/economy.config';
import { terapkanAksi } from '../src/sim/aksi';
import { multiplierPrestige, pendapatanUntukPoin, poinPrestigeDidapat } from '../src/sim/economy';
import {
  bisaNaikKelas,
  buatStateBaru,
  bukaJurusan,
  kelasTerminal,
  kontrakPo,
  naikKelas,
  poinMinimalNaikKelas,
  type GameState,
} from '../src/sim/state';
import { namaKelas } from '../src/ui/teks';
import { stateOtomatis, T0 } from './helpers';

const denganRun = (s: GameState, run: number): GameState => ({ ...s, statistik: { ...s.statistik, totalPendapatanRun: new Decimal(run) } });

describe('naik kelas terminal (prestige)', () => {
  it('kelas mulai dari Tipe C; poin minimal naik tiap kelas, lalu bertambah tetap setelah daftar habis', () => {
    expect(kelasTerminal(buatStateBaru(T0))).toBe(0);
    const d = EKONOMI.kelas.poinMinimal;
    for (let k = 0; k < d.length; k++) expect(poinMinimalNaikKelas(k)).toBe(d[k]);
    expect(poinMinimalNaikKelas(d.length)).toBe(d[d.length - 1]! + EKONOMI.kelas.tambahPoinMinimal);
    expect(poinMinimalNaikKelas(d.length + 1)).toBe(d[d.length - 1]! + 2 * EKONOMI.kelas.tambahPoinMinimal);
    expect(['Tipe C', 'Tipe B', 'Tipe A', 'Terpadu ★1', 'Terpadu ★4'].map((_, i) => namaKelas(i === 4 ? 6 : i))).toEqual(['Tipe C', 'Tipe B', 'Tipe A', 'Terpadu ★1', 'Terpadu ★4']);
  });

  it('pendapatan run yang dibutuhkan = kebalikan rumus poin prestige', () => {
    for (const poin of [1, 3, 8, 15, 40]) {
      const perlu = pendapatanUntukPoin(poin);
      expect(poinPrestigeDidapat(perlu).toNumber()).toBe(poin);
      expect(poinPrestigeDidapat(perlu.times(0.999)).toNumber()).toBe(poin - 1);
    }
  });

  it('baru bisa naik kelas setelah pendapatan run cukup untuk poin minimal', () => {
    const perlu = pendapatanUntukPoin(poinMinimalNaikKelas(0)).toNumber();
    const s = stateOtomatis({ peron: 40, loket: 40, keberangkatan: 40 });
    const kurang = denganRun(s, perlu * 0.99);
    expect(bisaNaikKelas(kurang)).toBe(false);
    expect(naikKelas(kurang)).toBe(kurang);
    expect(bisaNaikKelas(denganRun(s, perlu))).toBe(true);
  });

  it('naik kelas: terminal diulang, poin & bonus bertambah, PO hadiah & penghargaan langsung didapat, mitra PO lama tetap', () => {
    let s = kontrakPo({ ...bukaJurusan({ ...stateOtomatis({ peron: 60, loket: 60, keberangkatan: 60 }), uang: new Decimal(1e9) }) }, 'ondelOndel');
    s = denganRun(s, pendapatanUntukPoin(5).toNumber());
    const p = naikKelas(s);
    expect(kelasTerminal(p)).toBe(1);
    expect(p.prestige.poin.toNumber()).toBe(5);
    expect(multiplierPrestige(p.prestige.poin).toNumber()).toBeCloseTo(1 + 5 * EKONOMI.bonusPrestige, 12);
    expect(p.uang.toNumber()).toBe(EKONOMI.uangAwal);
    expect(p.terminal.jurusanBuka).toBe(EKONOMI.jurusanAwal);
    expect(p.terminal.tahap.loket.level).toBe(1);
    expect(p.terminal.tahap.loket.kepala.direkrut).toBe(false);
    expect(p.statistik.totalPendapatanRun.toNumber()).toBe(0);
    expect(p.armada.po).toContain('ondelOndel');
    expect(p.armada.po).toContain('juaraKelas');
    expect(p.armada.po).not.toContain('juaraUmum');
    expect(p.pencapaian.tercapai).toContain('kelasB');
    // Naik lagi ke Tipe A: PO hadiah berikutnya.
    const a = naikKelas(denganRun(p, pendapatanUntukPoin(poinMinimalNaikKelas(1)).toNumber()));
    expect(kelasTerminal(a)).toBe(2);
    expect(a.armada.po).toContain('juaraUmum');
    expect(a.pencapaian.tercapai).toContain('kelasA');
  });

  it('target harian penumpang yang belum selesai dihitung ulang untuk terminal baru', () => {
    const s0 = stateOtomatis({ peron: 80, loket: 80, keberangkatan: 80 });
    const s = denganRun({ ...s0, harian: { ...s0.harian, hariKe: 1, jenis: 'penumpang', target: 5_000_000, progres: 10, diklaim: false } }, pendapatanUntukPoin(3).toNumber());
    const p = naikKelas(s);
    expect(p.harian.jenis).toBe('penumpang');
    expect(p.harian.target).toBeLessThan(s.harian.target);
    // Target upgrade tidak diubah.
    const u = denganRun({ ...s0, harian: { ...s0.harian, jenis: 'upgrade', target: 10, progres: 4 } }, pendapatanUntukPoin(3).toNumber());
    expect(naikKelas(u).harian.progres).toBe(4);
  });

  it('aksi & analitik', () => {
    const s = denganRun(stateOtomatis(), pendapatanUntukPoin(4).toNumber());
    const baru = terapkanAksi(s, { jenis: 'naikKelas' });
    expect(kelasTerminal(baru)).toBe(1);
    expect(peristiwaAksi({ jenis: 'naikKelas' }, s, baru)).toEqual([{ nama: 'naik_kelas', data: { kelas: 1, poin: 4 } }]);
  });
});
