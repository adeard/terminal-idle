import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { EKONOMI } from '../src/config/economy.config';
import { terapkanAksi } from '../src/sim/aksi';
import { multiplierPrestige, pendapatanUntukPoin, poinPrestigeDidapat } from '../src/sim/economy';
import { levelMinimalKelas, pengaliLevelTerminal, xpKumulatifTerminal } from '../src/sim/level-terminal';
import { jatahLoket, tingkatPo } from '../src/sim/mitra';
import {
  aturHargaPo,
  bisaMulaiPerluasan,
  bisaRenovasi,
  buatStateBaru,
  cariPo,
  daftarPo,
  jatahLoketPo,
  kelasTerminal,
  levelPo,
  levelTerminal,
  loketTerisi,
  mulaiPerluasan,
  pendapatanPerDetikState,
  renovasi,
  slotPoState,
  terapkanOffline,
  throughputState,
  tick,
  type GameState,
} from '../src/sim/state';
import { TAHAP_IDS } from '../src/sim/tahap';
import { namaKelas } from '../src/ui/teks';
import { denganLevelTerminal, jalankan, kaya, stateOtomatis, T0 } from './helpers';

const M = EKONOMI.mitra;
const denganRun = (s: GameState, run: number | Decimal): GameState => ({ ...s, statistik: { ...s.statistik, totalPendapatanRun: new Decimal(run) } });

describe('level & kelas terminal', () => {
  it('XP terminal = penumpang yang diberangkatkan; level & kelas mengikutinya', () => {
    const s = jalankan(stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 }), 60);
    expect(s.perkembangan.xpTerminal).toBeGreaterThan(0);
    expect(s.perkembangan.xpTerminal).toBeCloseTo(s.statistik.totalPenumpang, 6);
    expect(kelasTerminal(buatStateBaru(T0))).toBe(0);
    for (const [level, kelas] of [[1, 0], [9, 0], [10, 1], [20, 2], [30, 3], [45, 4]] as const) {
      const t = denganLevelTerminal(stateOtomatis(), level);
      expect(levelTerminal(t)).toBe(level);
      expect(kelasTerminal(t)).toBe(kelas);
    }
    expect([0, 1, 2, 3, 6].map(namaKelas)).toEqual(['Tipe C', 'Tipe B', 'Tipe A', 'Terpadu ★1', 'Terpadu ★4']);
  });

  it('level menaikkan semua pendapatan & slot PO; penghargaan kelas dari levelnya', () => {
    const s = stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 });
    const lv11 = denganLevelTerminal(s, 11);
    expect(pendapatanPerDetikState(lv11).div(pendapatanPerDetikState(s)).toNumber()).toBeCloseTo(pengaliLevelTerminal(11), 9);
    expect(pengaliLevelTerminal(11)).toBeCloseTo(1 + 10 * M.terminal.bonusPerLevel, 12);
    expect(slotPoState(lv11)).toBeGreaterThan(slotPoState(s));
    expect(tick(denganLevelTerminal(s, levelMinimalKelas(1)), 0.1).pencapaian.tercapai).toContain('kelasB');
    expect(tick(denganLevelTerminal(s, levelMinimalKelas(2)), 0.1).pencapaian.tercapai).toContain('kelasA');
  });

  it('XP terminal juga bertambah saat game ditutup (efisiensi offline), bila semua tahap punya Kepala', () => {
    const s = stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 });
    const { state } = terapkanOffline(s, T0 + 3600 * 1000);
    expect(state.perkembangan.xpTerminal).toBeGreaterThan(0);
    expect(state.perkembangan.xpTerminal).toBeLessThanOrEqual(throughputState(s, 'potensial') * 3600 * EKONOMI.efisiensiOffline + 1e-6);
  });
});

describe('perluasan terminal', () => {
  it('butuh level terminal & uang; proyek sehari terminal; jatah loket semua PO bertambah setelah diresmikan', () => {
    const s = kaya(stateOtomatis());
    const t1 = M.perluasan[0]!;
    expect(bisaMulaiPerluasan(s)).toBe(false); // level kurang
    expect(mulaiPerluasan(s)).toBe(s);
    const siap = denganLevelTerminal(s, t1.level);
    expect(bisaMulaiPerluasan({ ...siap, uang: new Decimal(t1.biaya - 1) })).toBe(false);
    const p = mulaiPerluasan(siap);
    expect(p.uang.toNumber()).toBeCloseTo(siap.uang.toNumber() - t1.biaya, 0);
    expect(p.perkembangan).toMatchObject({ perluasan: 0, proyekDetik: M.detikProyek });
    expect(mulaiPerluasan(p)).toBe(p); // satu proyek pada satu waktu
    const ondel = cariPo(p, 'ondelOndel')!;
    expect(jatahLoketPo(p, ondel)).toBe(jatahLoket(1));
    const selesai = jalankan(p, M.detikProyek);
    expect(selesai.perkembangan).toMatchObject({ perluasan: 1, proyekDetik: 0 });
    // PO ikut naik level selama proyek berjalan (bus tetap datang): bonus perluasan di atas jatah levelnya.
    const ondelSelesai = cariPo(selesai, 'ondelOndel')!;
    expect(jatahLoketPo(selesai, ondelSelesai)).toBe(jatahLoket(levelPo(ondelSelesai)) + t1.jatah);
    // Tahap berikutnya butuh level lebih tinggi.
    expect(bisaMulaiPerluasan(selesai)).toBe(levelTerminal(selesai) >= M.perluasan[1]!.level);
  });

  it('proyek tetap berjalan saat game ditutup, walau belum semua tahap punya Kepala', () => {
    const s = mulaiPerluasan(denganLevelTerminal(kaya(buatStateBaru(T0)), M.perluasan[0]!.level));
    const { state } = terapkanOffline(s, s.waktuTerakhirMs + M.detikProyek * 1000);
    expect(state.perkembangan).toMatchObject({ perluasan: 1, proyekDetik: 0 });
  });

  it('aksi & analitik', () => {
    const s = denganLevelTerminal(kaya(stateOtomatis()), M.perluasan[0]!.level);
    const baru = terapkanAksi(s, { jenis: 'mulaiPerluasan' });
    expect(baru.perkembangan.proyekDetik).toBe(M.detikProyek);
    expect(peristiwaAksi({ jenis: 'mulaiPerluasan' }, s, baru)).toEqual([{ nama: 'mulai_perluasan', data: { tahap: 1 } }]);
  });
});

describe('Renovasi (pengganti prestige)', () => {
  it('pendapatan yang dibutuhkan = kebalikan rumus poin', () => {
    for (const poin of [1, 3, 8, 15, 40]) {
      const perlu = pendapatanUntukPoin(poin);
      expect(poinPrestigeDidapat(perlu).toNumber()).toBe(poin);
      expect(poinPrestigeDidapat(perlu.times(0.999)).toNumber()).toBe(poin - 1);
    }
  });

  it('baru bisa setelah pendapatan sejak renovasi terakhir cukup untuk poin minimal', () => {
    const perlu = pendapatanUntukPoin(M.poinMinRenovasi);
    const s = stateOtomatis({ peron: 40, loket: 40, keberangkatan: 40 });
    const kurang = denganRun(s, perlu.times(0.99));
    expect(bisaRenovasi(kurang)).toBe(false);
    expect(renovasi(kurang)).toBe(kurang);
    expect(bisaRenovasi(denganRun(s, perlu))).toBe(true);
  });

  it('kapasitas diulang & poin bertambah; level, kelas, perluasan, jalur, dan mitra PO tetap', () => {
    let s = kaya(stateOtomatis({ peron: 60, loket: 20, keberangkatan: 60 }));
    s = aturHargaPo(daftarPo(s, 'lumpiaKilat'), 'lumpiaKilat', 2, 110);
    s = {
      ...denganLevelTerminal(s, 12),
      perkembangan: { xpTerminal: xpKumulatifTerminal(12), perluasan: 2, proyekDetik: 0 },
      terminal: { ...s.terminal, jalur: 3, fasilitas: { ...s.terminal.fasilitas, kios: 5 }, teknologi: { ...s.terminal.teknologi, rambuHalte: true } },
    };
    const sebelum = denganRun(s, pendapatanUntukPoin(5));
    const p = renovasi(sebelum);
    expect(p.renovasi).toEqual({ poin: new Decimal(5), jumlah: 1 });
    expect(multiplierPrestige(p.renovasi.poin).toNumber()).toBeCloseTo(1 + 5 * EKONOMI.bonusPrestige, 12);
    expect(p.uang.toNumber()).toBe(EKONOMI.uangAwal);
    for (const id of TAHAP_IDS) expect(p.terminal.tahap[id].kepala.direkrut).toBe(false);
    expect(p.terminal.tahap.peron.level).toBe(1);
    expect(p.terminal.tahap.keberangkatan.level).toBe(1);
    expect(p.terminal.fasilitas.kios).toBe(0);
    expect(p.terminal.teknologi.rambuHalte).toBe(false);
    // Loket: tiap PO kembali ke loket bawaannya; tidak ada loket kosong.
    for (const po of p.mitra.terdaftar) expect(po.loket).toBe(tingkatPo(po.id).loketBawaan);
    expect(p.terminal.loketKosong).toBe(0);
    expect(p.terminal.tahap.loket.level).toBe(loketTerisi(p));
    // Tetap.
    expect(p.terminal.jalur).toBe(3);
    expect(p.perkembangan).toEqual(sebelum.perkembangan);
    expect(levelTerminal(p)).toBe(12);
    expect(kelasTerminal(p)).toBe(1);
    expect(p.mitra.terdaftar.map((x) => ({ id: x.id, xp: x.xp, reputasi: x.reputasi, harga: x.harga, kontrakDetik: x.kontrakDetik }))).toEqual(
      sebelum.mitra.terdaftar.map((x) => ({ id: x.id, xp: x.xp, reputasi: x.reputasi, harga: x.harga, kontrakDetik: x.kontrakDetik })),
    );
    expect(p.statistik.totalPendapatanRun.toNumber()).toBe(0);
    expect(p.statistik.totalPendapatanSepanjangMasa.eq(sebelum.statistik.totalPendapatanSepanjangMasa)).toBe(true);
    // Penghargaan tidak hilang (yang baru tercapai, mis. kelas dari level, ikut dicatat).
    expect(p.pencapaian.tercapai).toEqual(expect.arrayContaining([...sebelum.pencapaian.tercapai]));
    expect(p.pencapaian.diklaim).toEqual(sebelum.pencapaian.diklaim);
  });

  it('target harian penumpang yang belum selesai dihitung ulang untuk kapasitas baru; target upgrade tidak', () => {
    const s0 = stateOtomatis({ peron: 80, loket: 80, keberangkatan: 80 });
    const s = denganRun({ ...s0, harian: { ...s0.harian, hariKe: 1, jenis: 'penumpang', target: 5_000_000, progres: 10, diklaim: false } }, pendapatanUntukPoin(3));
    const p = renovasi(s);
    expect(p.harian.jenis).toBe('penumpang');
    expect(p.harian.target).toBeLessThan(s.harian.target);
    const u = denganRun({ ...s0, harian: { ...s0.harian, jenis: 'upgrade', target: 10, progres: 4 } }, pendapatanUntukPoin(3));
    expect(renovasi(u).harian.progres).toBe(4);
  });

  it('aksi & analitik', () => {
    const s = denganRun(stateOtomatis(), pendapatanUntukPoin(4));
    const baru = terapkanAksi(s, { jenis: 'renovasi' });
    expect(baru.renovasi.jumlah).toBe(1);
    expect(peristiwaAksi({ jenis: 'renovasi' }, s, baru)).toEqual([{ nama: 'renovasi', data: { jumlah: 1, poin: 4 } }]);
  });
});
