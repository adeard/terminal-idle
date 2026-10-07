import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { EKONOMI, SIMULASI } from '../src/config/economy.config';
import { pendapatanUntukPoin } from '../src/sim/economy';
import { majukanWaktu } from '../src/sim/loop';
import {
  beliUpgrade,
  bisaRenovasi,
  bisaRekrutKepala,
  buatStateBaru,
  daftarBottleneckState,
  dayaTarikKepuasan,
  kepuasanTerminal,
  keterisianTerminal,
  renovasi,
  pendapatanPerDetikState,
  permintaanPenumpang,
  rekrutKepala,
  rincianPendapatan,
  tahapBottleneck,
  terapkanOffline,
  throughputState,
  tick,
  type GameState,
} from '../src/sim/state';
import { TAHAP_IDS } from '../src/sim/tahap';
import { DT, jalankan, padaJam, stateOtomatis, T0 } from './helpers';

const JAM_MS = 3600 * 1000;

/** State dengan Kios & Toilet Lv 3: kepuasan naik (komponen fasilitas), kapasitas tetap. */
function denganFasilitas(s: GameState): GameState {
  return { ...s, terminal: { ...s.terminal, fasilitas: { ...s.terminal.fasilitas, kios: 3, toilet: 3 } } };
}

describe('state awal', () => {
  it('uang 20, semua level 1, tanpa Kepala', () => {
    const s = buatStateBaru(T0);
    expect(s.uang.toNumber()).toBe(20);
    for (const id of TAHAP_IDS) {
      expect(s.terminal.tahap[id].level).toBe(1);
      expect(s.terminal.tahap[id].kepala.direkrut).toBe(false);
    }
    expect(s.waktuTerakhirMs).toBe(T0);
    expect(tahapBottleneck(s)).toBe('loket');
  });
});

describe('tick', () => {
  it('fungsi murni: state masukan tidak berubah', () => {
    const s = stateOtomatis();
    const beku = JSON.stringify(s);
    const s2 = tick(s, 2);
    expect(JSON.stringify(s)).toBe(beku);
    expect(s2).not.toBe(s);
    expect(s2.uang.gt(s.uang)).toBe(true);
  });

  it('dt ≤ 0 atau NaN tidak mengubah apa pun', () => {
    const s = stateOtomatis();
    expect(tick(s, 0)).toBe(s);
    expect(tick(s, -1)).toBe(s);
    expect(tick(s, Number.NaN)).toBe(s);
  });

  it('semua otomatis: pendapatan kontinu = throughput × 5 per detik', () => {
    const s = jalankan(stateOtomatis(), 10);
    expect(s.uang.toNumber()).toBeCloseTo(20 + 0.8 * 5 * 10, 8);
    expect(s.statistik.totalPendapatanRun.toNumber()).toBeCloseTo(40, 8);
    expect(s.statistik.waktuMainDetik).toBeCloseTo(10, 8);
  });
});

describe('terminal selalu berjalan (tanpa Kepala, tanpa diketuk)', () => {
  it('game baru langsung menghasilkan: throughput × 5 per detik di jam ramai', () => {
    const s = jalankan(buatStateBaru(T0), 10);
    expect(s.uang.toNumber()).toBeCloseTo(20 + 0.8 * 5 * 10, 8);
    expect(s.statistik.totalPenumpang).toBeCloseTo(0.8 * 10, 8);
    expect(throughputState(s, 'aktif')).toBe(0.8);
  });

  it('Kepala pertama terjangkau dalam 10 detik tanpa melakukan apa pun', () => {
    let s = buatStateBaru(T0);
    let t = 0;
    while (!bisaRekrutKepala(s, 'peron') && t < 600) {
      s = tick(s, DT);
      t += DT;
    }
    expect(t).toBeLessThanOrEqual(10);
    s = rekrutKepala(s, 'peron');
    expect(s.terminal.tahap.peron.kepala.direkrut).toBe(true);
  });
});

describe('permintaan penumpang: kepuasan & jam', () => {
  it('jam sibuk: penumpang yang datang melebihi kapasitas, arus = kapasitas', () => {
    const s = padaJam(buatStateBaru(T0), 7.25);
    expect(permintaanPenumpang(s)).toBeGreaterThan(1);
    expect(keterisianTerminal(s)).toBe(1);
    expect(throughputState(s, 'aktif')).toBe(throughputState(s));
  });

  it('malam berangsur sepi: makin larut makin sedikit penumpang', () => {
    const s = buatStateBaru(T0);
    // Selasa 18:00 … Rabu 02:00.
    const isi = [18, 20, 22, 23, 24, 26].map((jam) => keterisianTerminal(padaJam(s, jam)));
    expect(isi[0]).toBe(1);
    for (let i = 1; i < isi.length; i++) expect(isi[i]).toBeLessThanOrEqual(isi[i - 1]!);
    expect(isi[isi.length - 1]).toBeLessThan(0.7);
  });

  it('tidak pernah berhenti: sepanjang pekan paling sepi = ritmeMin × daya tarik', () => {
    const s = buatStateBaru(T0);
    const minimal = EKONOMI.permintaan.ritmeMin * dayaTarikKepuasan(kepuasanTerminal(s).nilai);
    for (let jam = 0; jam < 7 * 24; jam += 0.25) {
      expect(keterisianTerminal(padaJam(s, jam))).toBeGreaterThanOrEqual(minimal - 1e-9);
    }
  });

  it('makin puas, makin banyak penumpang datang di jam sepi', () => {
    const s = padaJam(buatStateBaru(T0), 2);
    const puas = denganFasilitas(s);
    expect(kepuasanTerminal(puas).nilai).toBeGreaterThan(kepuasanTerminal(s).nilai);
    expect(permintaanPenumpang(puas)).toBeGreaterThan(permintaanPenumpang(s));
    expect(throughputState(puas, 'aktif')).toBeGreaterThan(throughputState(s, 'aktif'));
    // Kapasitas tidak berubah: yang bertambah hanya penumpang yang datang.
    expect(throughputState(puas)).toBe(throughputState(s));
  });

  it('tick memakai arus nyata: malam pendapatan & penumpang lebih sedikit', () => {
    const s = padaJam(buatStateBaru(T0), 2);
    const isi = keterisianTerminal(s);
    expect(isi).toBeLessThan(1);
    const t = tick(s, 10);
    const penumpang = 0.8 * isi * 10;
    expect(t.statistik.totalPenumpang).toBeCloseTo(penumpang, 10);
    expect(t.uang.toNumber()).toBe(20 + Math.floor(penumpang) * 5);
  });
});

describe('uang masuk per transaksi', () => {
  it('tiket dibayar per penumpang utuh: pecahannya disimpan, tidak hilang', () => {
    let s = buatStateBaru(T0); // 0,8 pnp/dtk
    s = tick(s, DT);
    expect(s.uang.toNumber()).toBe(20);
    expect(s.transaksi.sisaPenumpang).toBeCloseTo(0.08, 12);
    s = jalankan(s, 1.2); // total 1,3 dtk → 1,04 penumpang
    expect(s.uang.toNumber()).toBe(25);
    expect(s.transaksi.sisaPenumpang).toBeCloseTo(0.04, 9);
  });

  it('parkir bus dibayar sekali tiap bus (penumpangPerBus penumpang)', () => {
    let s = stateOtomatis({}, 0);
    s = { ...s, terminal: { ...s.terminal, fasilitas: { ...s.terminal.fasilitas, retribusi: 2 } } };
    const perBus = 2 * EKONOMI.fasilitas.retribusi.nilaiPerLevel;
    const detikSebus = EKONOMI.penumpangPerBus / 0.8;
    const sebelum = jalankan(s, detikSebus - 1);
    expect(sebelum.uang.toNumber()).toBeCloseTo((EKONOMI.penumpangPerBus - 1) * 5, 9); // hanya tiket
    const sesudah = jalankan(sebelum, 1);
    expect(sesudah.uang.toNumber()).toBeCloseTo(EKONOMI.penumpangPerBus * 5 + perBus, 9);
    expect(sesudah.transaksi.sisaBus).toBeLessThan(1e-6);
  });

  it('dalam jangka panjang totalnya sama dengan arus × harga', () => {
    let s = stateOtomatis({}, 0);
    s = { ...s, terminal: { ...s.terminal, fasilitas: { ...s.terminal.fasilitas, retribusi: 1, parkir: 3 } } };
    const r = rincianPendapatan(s, 'aktif');
    const perDetik = r.tiket.add(r.retribusi).add(r.parkir).toNumber();
    const t = jalankan(s, 100);
    // Selisihnya paling banyak satu tiket & satu bus yang belum utuh.
    expect(Math.abs(t.uang.toNumber() - perDetik * 100)).toBeLessThan(5 + 0.45 + 5);
  });
});

describe('upgrade & rekrut Kepala', () => {
  it('upgrade mengurangi uang sebesar biaya dan menaikkan level', () => {
    const s = beliUpgrade(buatStateBaru(T0), 'peron');
    expect(s.terminal.tahap.peron.level).toBe(2);
    expect(s.uang.toNumber()).toBe(5);
  });

  it('uang kurang → state tidak berubah', () => {
    const s = buatStateBaru(T0); // 20 < 30
    expect(beliUpgrade(s, 'keberangkatan')).toBe(s);
  });

  it('upgrade dengan uang pas → uang 0', () => {
    const s = beliUpgrade(stateOtomatis({}, 22), 'loket');
    expect(s.uang.toNumber()).toBe(0);
    expect(s.terminal.tahap.loket.level).toBe(2);
  });

  it('rekrut Kepala: bayar sekali, lalu tahap otomatis', () => {
    let s: GameState = { ...buatStateBaru(T0), uang: new Decimal(1000) };
    s = rekrutKepala(s, 'keberangkatan');
    expect(s.uang.toNumber()).toBe(600);
    expect(s.terminal.tahap.keberangkatan.kepala.direkrut).toBe(true);
    expect(rekrutKepala(s, 'keberangkatan')).toBe(s);
  });

  it('rekrut Kepala tanpa uang cukup → state tidak berubah', () => {
    const s = buatStateBaru(T0);
    expect(rekrutKepala(s, 'peron')).toBe(s);
  });

  it('bottleneck berpindah setelah upgrade', () => {
    let s = stateOtomatis({}, 1000);
    expect(daftarBottleneckState(s)).toEqual(['loket']);
    s = beliUpgrade(s, 'loket'); // loket 1.25 → bottleneck keberangkatan 0.9
    expect(tahapBottleneck(s)).toBe('keberangkatan');
    expect(throughputState(s)).toBe(0.9);
  });
});

describe('offline', () => {
  it('semua otomatis: pendapatan × detik × 0.5', () => {
    const s = stateOtomatis();
    const { state, laporan } = terapkanOffline(s, T0 + JAM_MS);
    expect(laporan.detik).toBe(3600);
    expect(laporan.pendapatan.toNumber()).toBeCloseTo(4 * 3600 * 0.5, 6);
    expect(state.uang.toNumber()).toBeCloseTo(20 + 7200, 6);
    expect(state.waktuTerakhirMs).toBe(T0 + JAM_MS);
    expect(state.statistik.totalPendapatanRun.toNumber()).toBeCloseTo(7200, 6);
  });

  it('dibatasi 4 jam', () => {
    const { laporan } = terapkanOffline(stateOtomatis(), T0 + 10 * JAM_MS);
    expect(laporan.detik).toBe(4 * 3600);
    expect(laporan.pendapatan.toNumber()).toBeCloseTo(4 * 14400 * 0.5, 6);
  });

  it('memakai pendapatan/detik saat keluar (termasuk bonus Renovasi)', () => {
    const s: GameState = { ...stateOtomatis({ peron: 43, loket: 49, keberangkatan: 44 }), renovasi: { poin: new Decimal(3), jumlah: 1 } };
    const { laporan } = terapkanOffline(s, T0 + 60_000);
    expect(laporan.pendapatan.toNumber()).toBeCloseTo(44 * 5 * 1.3 * 60 * 0.5, 6);
    expect(laporan.pendapatan.eq(pendapatanPerDetikState(s, 'offline').times(30))).toBe(true);
  });

  it('jam dimundurkan → tidak ada penghasilan', () => {
    const s = stateOtomatis();
    const { state, laporan } = terapkanOffline(s, T0 - 2 * JAM_MS);
    expect(laporan.detik).toBe(0);
    expect(laporan.pendapatan.toNumber()).toBe(0);
    expect(state.uang.eq(s.uang)).toBe(true);
  });

  it('ada tahap tanpa Kepala → throughput offline 0', () => {
    let s = stateOtomatis();
    s = { ...s, terminal: { ...s.terminal, tahap: { ...s.terminal.tahap, loket: { ...s.terminal.tahap.loket, kepala: { direkrut: false } } } } };
    const { laporan } = terapkanOffline(s, T0 + JAM_MS);
    expect(laporan.detik).toBe(3600);
    expect(laporan.pendapatan.toNumber()).toBe(0);
  });

  it('game baru tanpa Kepala → 0: tanpa Kepala terminal hanya berjalan saat game dibuka', () => {
    const s = jalankan(buatStateBaru(T0), 1);
    expect(terapkanOffline(s, T0 + JAM_MS).laporan.pendapatan.toNumber()).toBe(0);
  });
});

describe('Renovasi (logika)', () => {
  it('belum bisa di bawah ambang', () => {
    const s = stateOtomatis();
    expect(bisaRenovasi(s)).toBe(false);
    expect(renovasi(s)).toBe(s);
  });

  it('reset kapasitas & uang, tambah poin, simpan statistik sepanjang masa; bonus langsung berlaku', () => {
    let s = stateOtomatis({ peron: 30, loket: 30, keberangkatan: 30 });
    const run = pendapatanUntukPoin(3);
    s = { ...s, statistik: { ...s.statistik, totalPendapatanRun: run, totalPendapatanSepanjangMasa: run } };
    const p = renovasi(s);
    expect(p.renovasi.poin.toNumber()).toBe(3);
    expect(p.renovasi.jumlah).toBe(1);
    expect(p.uang.toNumber()).toBe(EKONOMI.uangAwal);
    expect(p.terminal.tahap.peron.level).toBe(1);
    expect(p.terminal.tahap.peron.kepala.direkrut).toBe(false);
    expect(p.statistik.totalPendapatanRun.toNumber()).toBe(0);
    expect(p.statistik.totalPendapatanSepanjangMasa.eq(run)).toBe(true);
    // Bonus +30% langsung berlaku.
    const tanpaBonus = { ...p, renovasi: { ...p.renovasi, poin: new Decimal(0) } };
    expect(pendapatanPerDetikState(p).div(pendapatanPerDetikState(tanpaBonus)).toNumber()).toBeCloseTo(1 + 3 * EKONOMI.bonusPrestige, 10);
  });
});

describe('fixed timestep (majukanWaktu)', () => {
  function jalankanDenganFrame(frameDetik: number[]): { state: GameState; tick: number } {
    let state = stateOtomatis();
    let akumulator = 0;
    let total = 0;
    for (const dt of frameDetik) {
      const h = majukanWaktu(state, akumulator, dt);
      state = h.state;
      akumulator = h.akumulatorDetik;
      total += h.jumlahTick;
    }
    return { state, tick: total };
  }

  it('hasil sama untuk frame rate berbeda', () => {
    const detik = 10;
    const fps60 = jalankanDenganFrame(Array(600).fill(1 / 60));
    const fps30 = jalankanDenganFrame(Array(300).fill(1 / 30));
    const fps7 = jalankanDenganFrame(Array(70).fill(1 / 7));
    const tidakRata: number[] = [];
    for (let sisa = detik, i = 0; sisa > 1e-9; i++) {
      const dt = Math.min(sisa, [0.013, 0.051, 0.2, 0.0337][i % 4]!);
      tidakRata.push(dt);
      sisa -= dt;
    }
    const acak = jalankanDenganFrame(tidakRata);

    const n = detik * SIMULASI.tickPerDetik;
    for (const h of [fps60, fps30, fps7, acak]) {
      expect(h.tick).toBe(n);
      expect(h.state.uang.eq(fps60.state.uang)).toBe(true);
    }
  });

  it('frame yang sangat panjang dibatasi maksKejarDetik', () => {
    const h = majukanWaktu(stateOtomatis(), 0, 30);
    expect(h.jumlahTick).toBe(SIMULASI.maksKejarDetik * SIMULASI.tickPerDetik);
  });

  it('dt negatif atau NaN diabaikan', () => {
    const s = stateOtomatis();
    expect(majukanWaktu(s, 0, -5).jumlahTick).toBe(0);
    expect(majukanWaktu(s, 0, Number.NaN).jumlahTick).toBe(0);
  });
});
