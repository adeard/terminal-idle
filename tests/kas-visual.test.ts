import { describe, expect, it } from 'vitest';
import { acakBerbenih, DuniaVisual, type JenisTransaksi, type TransaksiVisual } from '../src/game/dunia-visual';
import { JENIS_TRANSAKSI, KasVisual, lajuUangState, LOMPATAN_MAKS_DETIK, POP_MIN, type LajuUang, type PopUang } from '../src/game/kas-visual';
import { hitungLajuVisual, terapkanRitme } from '../src/game/laju';
import { LOKET, PARKIR_SERONG, X_LOKET } from '../src/game/tata-letak';
import { tick, type GameState } from '../src/sim/state';
import { denganPo, stateOtomatis } from './helpers';

const laju = (l: Partial<Record<JenisTransaksi, number>>): LajuUang => ({ tiket: l.tiket ?? 0, retribusi: l.retribusi ?? 0, parkir: l.parkir ?? 0, belanja: l.belanja ?? 0 });
const tx = (jenis: JenisTransaksi, x = 0, y = 0): TransaksiVisual => ({ jenis, x, y });
/** Sisa yang belum tampil tidak lebih dari sekian kali "+Rp" rata-rata. */
const TRANSAKSI_BATAS = 12;
const jumlah = (pop: readonly PopUang[], jenis?: string): number => pop.filter((p) => !jenis || p.jenis === jenis).reduce((a, p) => a + p.jumlah, 0);

describe('KasVisual: uang sim dibagikan ke transaksi yang terlihat', () => {
  it('besar "+Rp" stabil mengikuti rata-rata transaksi walau datangnya tak teratur; totalnya = uang yang masuk', () => {
    const kas = new KasVisual();
    const l = laju({ tiket: 10, retribusi: 4 });
    kas.perbarui(0, 0, l, []);
    const pop: PopUang[] = [];
    // Tiket terjual bergantian 0,2 & 0,8 detik (rata-rata 2 per detik); retribusi tak pernah ada transaksinya.
    let berikut = 0.2;
    let selang = 0.8;
    let t = 0;
    for (let i = 1; i <= 1200; i++) {
      t = i / 10;
      const ada = t >= berikut - 1e-9;
      if (ada) {
        berikut += selang;
        selang = selang > 0.5 ? 0.2 : 0.8;
      }
      pop.push(...kas.perbarui(t, 0.1, l, ada ? [tx('tiket', 5, 6)] : []));
    }
    expect(pop.every((p) => p.jenis === 'tiket' && p.x === 5 && p.y === 6)).toBe(true);
    const stabil = pop.slice(20).map((p) => p.jumlah);
    for (const x of stabil) expect(Math.abs(x - 5)).toBeLessThan(5 * 0.25);
    expect(jumlah(pop) + kas.sisa('tiket')).toBeCloseTo(10 * t, 6);
    expect(kas.sisa('retribusi')).toBeCloseTo(4 * t, 6);
  });

  it('beberapa transaksi dalam satu frame mendapat bagian yang sama', () => {
    const kas = new KasVisual();
    kas.perbarui(0, 0, laju({ parkir: 3 }), []);
    for (let t = 0.5; t < 10; t += 0.5) kas.perbarui(t, 0.5, laju({ parkir: 3 }), [tx('parkir')]);
    const pop = kas.perbarui(10, 0.5, laju({ parkir: 3 }), [tx('parkir'), tx('parkir'), tx('parkir')]);
    expect(pop).toHaveLength(3);
    expect(new Set(pop.map((p) => String(p.jumlah))).size).toBe(1);
  });

  it('di bawah Rp 1 ditahan (tidak tampil "+Rp 0"); sumber tanpa pendapatan tidak memunculkan apa-apa', () => {
    const kas = new KasVisual();
    const l = laju({ parkir: 0.2 });
    kas.perbarui(0, 0, l, []);
    const pop: PopUang[] = [];
    for (let t = 1; t <= 60; t++) pop.push(...kas.perbarui(t, 1, l, [tx('parkir'), tx('retribusi')]));
    expect(pop.filter((p) => p.jenis === 'retribusi')).toEqual([]);
    expect(pop.length).toBeGreaterThan(0);
    for (const p of pop) expect(p.jumlah).toBeGreaterThanOrEqual(POP_MIN);
    expect(jumlah(pop) + kas.sisa('parkir')).toBeCloseTo(0.2 * 60, 9);
  });

  it('lompatan waktu (muat save, tab tertidur) tidak dibagikan: sudah masuk laporan offline', () => {
    const kas = new KasVisual();
    const l = laju({ tiket: 100 });
    kas.perbarui(0, 0, l, []);
    kas.perbarui(1, 1, l, []);
    expect(kas.perbarui(1 + LOMPATAN_MAKS_DETIK + 60, 0.1, l, [tx('tiket')])).toEqual([]);
    expect(kas.sisa('tiket')).toBe(0);
    // Mundur (ganti ke save yang lebih muda) juga diabaikan.
    expect(kas.perbarui(5, 0.1, l, [tx('tiket')])).toEqual([]);
  });

});

describe('DuniaVisual: transaksi di keramaian', () => {
  it('tiket di jendela loket, retribusi di petak parkir, parkir kendaraan, belanja di kios & toko', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(7) });
    const L = { turun: 1.4, layanLoket: 2.2, naik: 1.4, busDatang: 0.12, muatanBus: 16, faktorKecepatanBus: 1, jam: 12.2 };
    const semua: TransaksiVisual[] = [];
    for (let t = 0; t < 400; t += 1 / 30) {
      dunia.perbarui(1 / 30, L);
      semua.push(...dunia.transaksi);
    }
    const per = (j: JenisTransaksi): TransaksiVisual[] => semua.filter((x) => x.jenis === j);
    expect(per('tiket').length).toBeGreaterThan(100);
    expect(per('retribusi').length).toBeGreaterThan(3);
    expect(per('parkir').length).toBeGreaterThan(10);
    expect(per('belanja').length).toBeGreaterThan(0);
    for (const x of per('tiket')) {
      expect(X_LOKET).toContain(x.x);
      expect(x.y).toBe(LOKET.yPembeli);
    }
    for (const x of per('retribusi')) expect(PARKIR_SERONG.pusatX.some((px) => Math.abs(px - x.x) < 0.1)).toBe(true);
  }, 60_000);

  it('jumlah semua "+Rp" = pendapatan yang masuk (sisanya menunggu transaksi berikutnya)', () => {
    let s: GameState = denganPo(stateOtomatis({ jalur: 3, jendela: 6, kios: 2, toko: 1, toilet: 1, lahanParkir: 1, posRetribusi: 1 }), 'ondelOndel', { loket: 6, level: 12 });
    const dunia = new DuniaVisual({ acak: acakBerbenih(9) });
    const kas = new KasVisual();
    const lajuVisual = { ...terapkanRitme(hitungLajuVisual(s), 1), jam: 12 };
    dunia.pemanasan(60, lajuVisual);
    kas.perbarui(s.statistik.waktuMainDetik, 0, lajuUangState(s), []);
    for (const j of JENIS_TRANSAKSI) expect(lajuUangState(s)[j]).toBeGreaterThan(0);
    const pendapatanAwal = s.statistik.totalPendapatan;
    const pop: PopUang[] = [];
    for (let i = 0; i < 1800; i++) {
      s = tick(s, 0.1);
      // Seperti di peramban: state maju tiap tick 0,1 detik, keramaian tiap frame (60 fps).
      for (let f = 0; f < 6; f++) {
        dunia.perbarui(0.1 / 6, lajuVisual);
        pop.push(...kas.perbarui(s.statistik.waktuMainDetik, 0.1 / 6, lajuUangState(s), dunia.transaksi));
      }
    }
    for (const j of JENIS_TRANSAKSI) expect(pop.some((p) => p.jenis === j)).toBe(true);
    const tampil = JENIS_TRANSAKSI.reduce((a, j) => a + jumlah(pop, j) + kas.sisa(j), 0);
    const masuk = s.statistik.totalPendapatan - pendapatanAwal;
    expect(Math.abs(tampil - masuk)).toBeLessThan(masuk * 0.01);
    // Selisih yang belum tampil (lebih/kurang) tetap kecil: beberapa kali "+Rp" rata-rata.
    for (const j of JENIS_TRANSAKSI) {
      const semua = pop.filter((p) => p.jenis === j);
      const rata = jumlah(semua) / Math.max(1, semua.length);
      expect(Math.abs(kas.sisa(j))).toBeLessThan(TRANSAKSI_BATAS * rata + 1);
    }
  }, 60_000);
});
