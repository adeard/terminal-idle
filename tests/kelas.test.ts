import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { EKONOMI } from '../src/config/economy.config';
import { terapkanAksi } from '../src/sim/aksi';
import { slotBangunan } from '../src/sim/bangunan';
import { levelMinimalKelas } from '../src/sim/level-terminal';
import {
  acuanHarian,
  bisaMulaiPerluasan,
  buatStateBaru,
  kelasTerminal,
  keuanganSekarang,
  levelTerminal,
  mulaiPerluasan,
  operasiState,
  slotPoState,
  terapkanOffline,
  tick,
} from '../src/sim/state';
import { namaKelas } from '../src/ui/teks';
import { denganLevelTerminal, denganPetugas, denganPo, jalankan, kaya, stateOtomatis, T0 } from './helpers';

const M = EKONOMI.mitra;

describe('level & kelas terminal', () => {
  it('XP terminal = penumpang yang diberangkatkan; level & kelas mengikutinya', () => {
    const s = jalankan(stateOtomatis({ jalur: 2, jendela: 3 }), 60);
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

  it('level membuka slot PO & kelas, bukan bonus pendapatan; naik kelas memperbesar pasar tapi menaikkan biaya', () => {
    const s = denganPo(stateOtomatis({ jalur: 3, jendela: 6 }), 'ondelOndel', { loket: 6 });
    const lv9 = denganLevelTerminal(s, 9);
    expect(keuanganSekarang(lv9).totalPendapatan).toBeCloseTo(keuanganSekarang(s).totalPendapatan, 6);
    expect(slotPoState(denganLevelTerminal(s, 11))).toBeGreaterThan(slotPoState(s));
    const tipeB = denganLevelTerminal(s, levelMinimalKelas(1));
    expect(operasiState(tipeB).permintaanPuncak).toBeGreaterThan(operasiState(lv9).permintaanPuncak);
    expect(keuanganSekarang(tipeB).biaya.perawatan).toBeCloseTo(keuanganSekarang(lv9).biaya.perawatan * EKONOMI.tycoon.pengaliBiayaKelas[1]!, 6);
    expect(tick(tipeB, 0.1).pencapaian.tercapai).toContain('kelasB');
    expect(tick(denganLevelTerminal(s, levelMinimalKelas(2)), 0.1).pencapaian.tercapai).toContain('kelasA');
    expect(tick(denganLevelTerminal(s, levelMinimalKelas(3)), 0.1).pencapaian.tercapai).toContain('terpadu');
  });

  it('XP terminal juga bertambah saat game ditutup (efisiensi offline), bila ada Manajer Operasional', () => {
    const s = denganPetugas(stateOtomatis(), ['manajerOperasional']);
    const { state } = terapkanOffline(s, T0 + 3600 * 1000);
    expect(state.perkembangan.xpTerminal).toBeCloseTo(acuanHarian(s, EKONOMI, s.terminal.tarif).arus * 60 * EKONOMI.tycoon.offline.efisiensi, 3);
    expect(terapkanOffline(stateOtomatis(), T0 + 3600 * 1000).state.perkembangan.xpTerminal).toBe(0);
  });
});

describe('perluasan terminal', () => {
  it('butuh level terminal & kas; proyek sehari terminal; slot bertambah setelah diresmikan', () => {
    const s = kaya(stateOtomatis());
    const t1 = M.perluasan[0]!;
    expect(bisaMulaiPerluasan(s)).toBe(false); // level kurang
    expect(mulaiPerluasan(s)).toBe(s);
    const siap = denganLevelTerminal(s, t1.level);
    expect(bisaMulaiPerluasan({ ...siap, kas: t1.biaya - 1 })).toBe(false);
    const p = mulaiPerluasan(siap);
    expect(p.kas).toBe(siap.kas - t1.biaya);
    expect(p.perkembangan).toMatchObject({ perluasan: 0, proyekDetik: M.detikProyek });
    expect(mulaiPerluasan(p)).toBe(p); // satu proyek pada satu waktu
    const selesai = jalankan(p, M.detikProyek);
    expect(selesai.perkembangan).toMatchObject({ perluasan: 1, proyekDetik: 0 });
    expect(slotBangunan('jendela', 1)).toBeGreaterThan(slotBangunan('jendela', 0));
    // Tahap berikutnya butuh level lebih tinggi.
    expect(bisaMulaiPerluasan(selesai)).toBe(levelTerminal(selesai) >= M.perluasan[1]!.level);
  });

  it('biaya & level tiap tahap naik; gedungnya punya biaya operasional yang menumpuk', () => {
    for (let i = 1; i < M.perluasan.length; i++) {
      expect(M.perluasan[i]!.level).toBeGreaterThan(M.perluasan[i - 1]!.level);
      expect(M.perluasan[i]!.biaya).toBeGreaterThan(M.perluasan[i - 1]!.biaya);
      expect(M.perluasan[i]!.operasional).toBeGreaterThan(M.perluasan[i - 1]!.operasional);
    }
  });

  it('proyek tetap berjalan saat game ditutup, walau tanpa Manajer Operasional', () => {
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
