import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { EKONOMI } from '../src/config/economy.config';
import { DuniaVisual } from '../src/game/dunia-visual';
import { hitungLajuVisual } from '../src/game/laju';
import { GERBANG_X, HALTE_BERANGKAT_X, HALTE_DATANG_X } from '../src/game/tata-letak';
import { terapkanAksi } from '../src/sim/aksi';
import { deserialisasi, serialisasi } from '../src/sim/save';
import {
  biayaJalurBerikutnya,
  bisaBukaJalur,
  bukaJalur,
  jumlahJalurMaks,
  kapasitasTahap,
  multJalur,
  renovasi,
  tick,
  type GameState,
} from '../src/sim/state';
import { buatModel } from '../src/ui/model';
import { denganPo, stateOtomatis, T0 } from './helpers';

const kaya = (s: GameState, uang = 1e12): GameState => ({ ...s, uang: new Decimal(uang) });

describe('jalur bus (sim)', () => {
  it('game baru: satu jalur, tanpa bonus; jumlah jalur = jumlah halte di adegan', () => {
    const s = stateOtomatis();
    expect(s.terminal.jalur).toBe(1);
    expect(multJalur(s, 'peron')).toBe(1);
    expect(jumlahJalurMaks()).toBe(HALTE_DATANG_X.length);
    expect(jumlahJalurMaks()).toBe(HALTE_BERANGKAT_X.length);
    expect(jumlahJalurMaks()).toBe(GERBANG_X.length);
  });

  it('dibangun berurutan: uang dipotong, Peron & Keberangkatan naik, Loket tetap', () => {
    let s = kaya(stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 }));
    const kap = { peron: kapasitasTahap(s, 'peron'), loket: kapasitasTahap(s, 'loket'), keberangkatan: kapasitasTahap(s, 'keberangkatan') };
    const uang = s.uang.toNumber();
    s = bukaJalur(s);
    expect(s.terminal.jalur).toBe(2);
    expect(s.uang.toNumber()).toBeCloseTo(uang - EKONOMI.jalur.biaya[0]!, 0);
    const bonus = 1 + EKONOMI.jalur.bonusKapasitas;
    expect(kapasitasTahap(s, 'peron')).toBeCloseTo(kap.peron * bonus, 9);
    expect(kapasitasTahap(s, 'keberangkatan')).toBeCloseTo(kap.keberangkatan * bonus, 9);
    expect(kapasitasTahap(s, 'loket')).toBeCloseTo(kap.loket, 9);
    for (let i = 0; i < 10; i++) s = bukaJalur(s);
    expect(s.terminal.jalur).toBe(jumlahJalurMaks());
    expect(biayaJalurBerikutnya(s)).toBeNull();
    expect(bisaBukaJalur(s)).toBe(false);
    expect(bukaJalur(s)).toBe(s);
    expect(tick(s, 0.1).pencapaian.tercapai).toContain('jalurLengkap');
  });

  it('uang kurang: tidak terjadi apa-apa; biaya naik tiap jalur', () => {
    const s = stateOtomatis({}, EKONOMI.jalur.biaya[0]! - 1);
    expect(bukaJalur(s)).toBe(s);
    for (let i = 1; i < EKONOMI.jalur.biaya.length; i++) expect(EKONOMI.jalur.biaya[i]!).toBeGreaterThan(EKONOMI.jalur.biaya[i - 1]!);
  });

  it('jalur bus permanen: tidak dibongkar saat Renovasi', () => {
    let s = bukaJalur(bukaJalur(kaya(stateOtomatis())));
    s = { ...s, statistik: { ...s.statistik, totalPendapatanRun: new Decimal(1e9) } };
    const r = renovasi(s);
    expect(r.renovasi.jumlah).toBe(1);
    expect(r.terminal.jalur).toBe(3);
  });

  it('tersimpan; save lama tanpa jalur mendapat jalur sesuai tonggak level (terminal tidak menyusut)', () => {
    const s = bukaJalur(kaya(stateOtomatis()));
    expect(deserialisasi(serialisasi(s), T0).terminal.jalur).toBe(2);
    const lama = (level: number): number => {
      const mentah = JSON.parse(serialisasi(stateOtomatis({ peron: level, loket: level, keberangkatan: level }))) as { terminal: Record<string, unknown> };
      delete mentah.terminal['jalur'];
      return deserialisasi(JSON.stringify(mentah), T0).terminal.jalur;
    };
    expect(lama(1)).toBe(1);
    expect(lama(30)).toBe(2);
    expect(lama(120)).toBe(4);
    expect(lama(250)).toBe(5);
    const mentah = JSON.parse(serialisasi(s)) as { terminal: Record<string, unknown> };
    mentah.terminal['jalur'] = 99;
    expect(deserialisasi(JSON.stringify(mentah), T0).terminal.jalur).toBe(jumlahJalurMaks());
  });

  it('aksi, analitik, dan model tab Fasilitas', () => {
    const s = kaya(stateOtomatis());
    const baru = terapkanAksi(s, { jenis: 'bukaJalur' });
    expect(peristiwaAksi({ jenis: 'bukaJalur' }, s, baru)).toEqual([{ nama: 'buka_jalur', data: { jalur: 2 } }]);
    const m = buatModel(baru).jalur;
    expect(m).toMatchObject({ jumlah: 2, maks: jumlahJalurMaks(), bisa: true });
    expect(m.mult).toBeCloseTo(1 + EKONOMI.jalur.bonusKapasitas, 9);
    expect(m.multBerikut).toBeCloseTo(1 + 2 * EKONOMI.jalur.bonusKapasitas, 9);
    expect(m.biaya?.toNumber()).toBe(EKONOMI.jalur.biaya[1]);
  });
});

describe('jalur bus di adegan', () => {
  const acakBerbenih = (benih: number): (() => number) => {
    let x = benih >>> 0 || 1;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };
  };

  it('bus hanya memakai halte & jalur keberangkatan yang sudah dibangun; bus lain menunggu', () => {
    for (const jalur of [1, 2, 3]) {
      // Semua jurusan Jawa-Bali dilayani (empat PO di Lv 12), jadi semua kelompok parkir terbuka.
      let dasar = stateOtomatis({ peron: 40, loket: 40, keberangkatan: 40 });
      for (const id of ['ondelOndel', 'peuyeumKilat', 'lumpiaKilat', 'bakpiaRasa'] as const) dasar = denganPo(dasar, id, { level: 12 });
      const s = { ...dasar, terminal: { ...dasar.terminal, jalur } };
      const laju = hitungLajuVisual(s);
      expect(laju.jalur).toBe(jalur);
      const dunia = new DuniaVisual({ acak: acakBerbenih(7 + jalur) });
      const halteDatang = new Set<number>();
      const halteBerangkat = new Set<number>();
      let berangkat = 0;
      for (let t = 0; t < 240; t += 1 / 30) {
        dunia.perbarui(1 / 30, laju);
        for (const b of dunia.bus) {
          if (b.fase === 'turunkan') halteDatang.add(b.halte);
          if (b.fase === 'muat') halteBerangkat.add(b.halte);
          if (b.fase === 'keluar' && b.penumpangNaik > 0) berangkat++;
        }
      }
      expect(Math.max(...halteDatang)).toBeLessThan(jalur);
      expect(Math.max(...halteBerangkat)).toBeLessThan(jalur);
      expect(halteDatang.size).toBeGreaterThan(0);
      expect(halteBerangkat.size).toBeGreaterThan(0);
      expect(berangkat).toBeGreaterThan(0);
      expect(dunia.periksaKonsistensi()).toEqual([]);
    }
  }, 60_000);
});
