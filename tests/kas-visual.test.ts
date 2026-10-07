import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { acakBerbenih, DuniaVisual, type JenisTransaksi, type TransaksiVisual } from '../src/game/dunia-visual';
import { JENIS_TRANSAKSI, KasVisual, lajuUangState, LOMPATAN_MAKS_DETIK, POP_MIN, type LajuUang, type PopUang } from '../src/game/kas-visual';
import { hitungLajuVisual, terapkanRitme } from '../src/game/laju';
import { LOKET, PARKIR_SERONG, X_LOKET } from '../src/game/tata-letak';
import type { FasilitasId } from '../src/sim/fitur';
import { nilaiFasilitas, nilaiPerPenumpangState, tarifRetribusiPerBus, tick, type GameState } from '../src/sim/state';
import { stateOtomatis } from './helpers';

const d = (x: number): Decimal => new Decimal(x);
const laju = (l: Partial<Record<JenisTransaksi, number>>): LajuUang => ({ tiket: d(l.tiket ?? 0), retribusi: d(l.retribusi ?? 0), parkir: d(l.parkir ?? 0), belanja: d(l.belanja ?? 0) });
const tx = (jenis: JenisTransaksi, x = 0, y = 0): TransaksiVisual => ({ jenis, x, y });
/** Sisa yang belum tampil tidak lebih dari sekian kali "+Rp" rata-rata. */
const TRANSAKSI_BATAS = 12;
const TANPA_SEWA = { hariTerakhir: -1, terakhir: d(0) };
const jumlah = (pop: readonly PopUang[], jenis?: string): number => pop.filter((p) => !jenis || p.jenis === jenis).reduce((a, p) => a + p.jumlah.toNumber(), 0);

describe('KasVisual: uang sim dibagikan ke transaksi yang terlihat', () => {
  it('besar "+Rp" stabil mengikuti rata-rata transaksi walau datangnya tak teratur; totalnya = uang yang masuk', () => {
    const kas = new KasVisual();
    const l = laju({ tiket: 10, retribusi: 4 });
    kas.perbarui(0, 0, l, [], TANPA_SEWA, [0, 0]);
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
      pop.push(...kas.perbarui(t, 0.1, l, ada ? [tx('tiket', 5, 6)] : [], TANPA_SEWA, [0, 0]));
    }
    expect(pop.every((p) => p.jenis === 'tiket' && p.x === 5 && p.y === 6)).toBe(true);
    const stabil = pop.slice(20).map((p) => p.jumlah.toNumber());
    for (const x of stabil) expect(Math.abs(x - 5)).toBeLessThan(5 * 0.25);
    expect(jumlah(pop) + kas.sisa('tiket').toNumber()).toBeCloseTo(10 * t, 6);
    expect(kas.sisa('retribusi').toNumber()).toBeCloseTo(4 * t, 6);
  });

  it('beberapa transaksi dalam satu frame mendapat bagian yang sama', () => {
    const kas = new KasVisual();
    kas.perbarui(0, 0, laju({ parkir: 3 }), [], TANPA_SEWA, [0, 0]);
    for (let t = 0.5; t < 10; t += 0.5) kas.perbarui(t, 0.5, laju({ parkir: 3 }), [tx('parkir')], TANPA_SEWA, [0, 0]);
    const pop = kas.perbarui(10, 0.5, laju({ parkir: 3 }), [tx('parkir'), tx('parkir'), tx('parkir')], TANPA_SEWA, [0, 0]);
    expect(pop).toHaveLength(3);
    expect(new Set(pop.map((p) => p.jumlah.toString())).size).toBe(1);
  });

  it('di bawah Rp 1 ditahan (tidak tampil "+Rp 0"); sumber tanpa pendapatan tidak memunculkan apa-apa', () => {
    const kas = new KasVisual();
    const l = laju({ parkir: 0.2 });
    kas.perbarui(0, 0, l, [], TANPA_SEWA, [0, 0]);
    const pop: PopUang[] = [];
    for (let t = 1; t <= 60; t++) pop.push(...kas.perbarui(t, 1, l, [tx('parkir'), tx('retribusi')], TANPA_SEWA, [0, 0]));
    expect(pop.filter((p) => p.jenis === 'retribusi')).toEqual([]);
    expect(pop.length).toBeGreaterThan(0);
    for (const p of pop) expect(p.jumlah.toNumber()).toBeGreaterThanOrEqual(POP_MIN);
    expect(jumlah(pop) + kas.sisa('parkir').toNumber()).toBeCloseTo(0.2 * 60, 9);
  });

  it('lompatan waktu (muat save, tab tertidur) tidak dibagikan: sudah masuk laporan offline', () => {
    const kas = new KasVisual();
    const l = laju({ tiket: 100 });
    kas.perbarui(0, 0, l, [], TANPA_SEWA, [0, 0]);
    kas.perbarui(1, 1, l, [], TANPA_SEWA, [0, 0]);
    expect(kas.perbarui(1 + LOMPATAN_MAKS_DETIK + 60, 0.1, l, [tx('tiket')], TANPA_SEWA, [0, 0])).toEqual([]);
    expect(kas.sisa('tiket').toNumber()).toBe(0);
    // Mundur (ganti ke save yang lebih muda) juga diabaikan.
    expect(kas.perbarui(5, 0.1, l, [tx('tiket')], TANPA_SEWA, [0, 0])).toEqual([]);
  });

  it('sewa kios: satu "+Rp" besar saat hari berganti (tidak saat pertama dimuat), belanja mulai dari nol lagi', () => {
    const kas = new KasVisual();
    const l = laju({ belanja: 5 });
    const tempat = [7, 8] as const;
    expect(kas.perbarui(0, 0, l, [], { hariTerakhir: 3, terakhir: d(999) }, tempat)).toEqual([]);
    kas.perbarui(1, 1, l, [], { hariTerakhir: 3, terakhir: d(999) }, tempat);
    const pop = kas.perbarui(1.1, 0.1, l, [], { hariTerakhir: 4, terakhir: d(7200) }, tempat);
    expect(pop).toEqual([{ jenis: 'sewa', x: 7, y: 8, jumlah: d(7200) }]);
    expect(kas.sisa('belanja').toNumber()).toBeCloseTo(0.5, 9);
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

  it('jumlah semua "+Rp" = uang yang masuk dari tiket, retribusi & parkir (sisanya menunggu transaksi berikutnya)', () => {
    const fasilitas: Partial<Record<FasilitasId, number>> = { kios: 2, parkir: 3, retribusi: 2 };
    const awal = stateOtomatis({ peron: 12, loket: 12, keberangkatan: 12 });
    let s: GameState = { ...awal, terminal: { ...awal.terminal, fasilitas: { ...awal.terminal.fasilitas, ...fasilitas } } };
    const dunia = new DuniaVisual({ acak: acakBerbenih(9) });
    const kas = new KasVisual();
    const lajuVisual = { ...terapkanRitme(hitungLajuVisual(s), 1), jam: 12 };
    dunia.pemanasan(60, lajuVisual);
    kas.perbarui(s.statistik.waktuMainDetik, 0, lajuUangState(s), [], s.sewaKios, [0, 0]);
    const uangAwal = s.uang.toNumber();
    const pop: PopUang[] = [];
    for (let i = 0; i < 1800; i++) {
      s = tick(s, 0.1);
      // Seperti di peramban: state maju tiap tick 0,1 detik, keramaian tiap frame (60 fps).
      for (let f = 0; f < 6; f++) {
        dunia.perbarui(0.1 / 6, lajuVisual);
        pop.push(...kas.perbarui(s.statistik.waktuMainDetik, 0.1 / 6, lajuUangState(s), dunia.transaksi, s.sewaKios, [0, 0]));
      }
    }
    const langsung = ['tiket', 'retribusi', 'parkir'] as const;
    for (const j of langsung) expect(pop.some((p) => p.jenis === j)).toBe(true);
    expect(pop.some((p) => p.jenis === 'belanja')).toBe(true);
    const tampil = langsung.reduce((a, j) => a + jumlah(pop, j) + kas.sisa(j).toNumber(), 0);
    // "+Rp" mengikuti laju; uang masuk per tiket & per bus, jadi selisihnya paling banyak satu tiket + satu bus yang belum utuh.
    const satuTransaksi = nilaiPerPenumpangState(s) + nilaiFasilitas(s, 'parkir') + tarifRetribusiPerBus(s);
    expect(Math.abs(tampil - (s.uang.toNumber() - uangAwal))).toBeLessThan(satuTransaksi);
    // Selisih yang belum tampil (lebih/kurang) tetap kecil: beberapa kali "+Rp" rata-rata.
    for (const j of JENIS_TRANSAKSI) {
      const semua = pop.filter((p) => p.jenis === j);
      const rata = jumlah(semua) / Math.max(1, semua.length);
      expect(Math.abs(kas.sisa(j).toNumber())).toBeLessThan(TRANSAKSI_BATAS * rata + 1);
    }
  }, 60_000);
});
