import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { PENCAPAIAN_IDS, TEKNOLOGI_IDS, type PoId } from '../src/sim/fitur';
import { levelMinimalKelas } from '../src/sim/level-terminal';
import {
  acuanHarian,
  beliTeknologi,
  bisaBeliTeknologi,
  buatStateBaru,
  buatTargetHarian,
  hadiahMenit,
  keuanganSekarang,
  klaimPencapaian,
  operasiState,
  rekrutPetugas,
  tick,
} from '../src/sim/state';
import { DETIK_SEHARI } from '../src/sim/state';
import { denganBangunan, denganLevelTerminal, denganPetugas, denganPo, jalankan, kaya, stateOtomatis, T0 } from './helpers';

const T = EKONOMI.tycoon;

describe('fasilitas berbayar', () => {
  it('game baru tanpa fasilitas: hanya sewa jendela loket (penumpang tidak membayar terminal; kontrak PO dibayar di muka)', () => {
    const p = keuanganSekarang(stateOtomatis()).pendapatan;
    expect(Object.keys(p).sort()).toEqual(['kontrak', 'parkir', 'retribusi', 'sewaKios', 'sewaLoket']);
    expect(p.sewaLoket).toBeGreaterThan(0);
    expect(p.kontrak + p.parkir + p.retribusi + p.sewaKios).toBe(0);
  });

  it('lahan parkir & pos retribusi: pendapatannya baru ada setelah dibangun; toilet gratis', () => {
    const tanpaToilet = keuanganSekarang(stateOtomatis({ lahanParkir: 1, posRetribusi: 1 })).pendapatan;
    const p = keuanganSekarang(stateOtomatis({ toilet: 1, lahanParkir: 1, posRetribusi: 1 })).pendapatan;
    expect(p).toEqual(tanpaToilet);
    expect(p.parkir).toBeGreaterThan(0);
    expect(p.retribusi).toBeGreaterThan(0);
  });

  it('tanpa juru parkir / petugas retribusi hanya separuh yang terpungut', () => {
    const tanpa = stateOtomatis({ lahanParkir: 1, posRetribusi: 1 });
    const dengan = denganPetugas(tanpa, ['juruParkir', 'petugasRetribusi']);
    expect(keuanganSekarang(dengan).pendapatan.parkir).toBeCloseTo(2 * keuanganSekarang(tanpa).pendapatan.parkir, 6);
    expect(keuanganSekarang(dengan).pendapatan.retribusi).toBeCloseTo(2 * keuanganSekarang(tanpa).pendapatan.retribusi, 6);
  });

  it('kios & toko laku disewakan bila terminal cukup ramai untuk sewanya', () => {
    const sepi = stateOtomatis({ kios: 1 });
    expect(keuanganSekarang(sepi).pendapatan.sewaKios).toBe(0);
    const ramai = denganPo(stateOtomatis({ kios: 1, jalur: 4, jendela: 8 }), 'ondelOndel', { loket: 8, level: 12 });
    expect(operasiState(ramai).arusPuncak * T.kios.nilaiPerArus).toBeGreaterThan(T.tarif.sewaKios.bawaan);
    expect(keuanganSekarang(ramai).pendapatan.sewaKios).toBeCloseTo(T.tarif.sewaKios.bawaan / 24, 6);
  });

  it('tiap unit menambah perawatan harian', () => {
    const a = keuanganSekarang(stateOtomatis()).biaya.perawatan;
    const b = keuanganSekarang(stateOtomatis({ toilet: 1 })).biaya.perawatan;
    expect(b - a).toBeCloseTo(T.bangunan.toilet.perawatan / 24, 6);
  });
});

describe('modernisasi', () => {
  it('butuh teknologi pendahulu; menambah kapasitas areanya saja; sekali beli; ada perawatannya', () => {
    const s = kaya(stateOtomatis());
    expect(bisaBeliTeknologi(s, 'pengaturBus')).toBe(false);
    const a = beliTeknologi(s, 'rambuHalte');
    expect(a.kas).toBe(s.kas - EKONOMI.teknologi.rambuHalte.biaya);
    expect(operasiState(a).kapasitas.peron).toBeCloseTo(operasiState(s).kapasitas.peron * EKONOMI.teknologi.rambuHalte.multKapasitas, 6);
    expect(operasiState(a).kapasitas.loket).toBeCloseTo(operasiState(s).kapasitas.loket, 6);
    expect(bisaBeliTeknologi(a, 'rambuHalte')).toBe(false);
    expect(beliTeknologi(a, 'rambuHalte')).toBe(a);
    expect(bisaBeliTeknologi(a, 'pengaturBus')).toBe(true);
    expect(keuanganSekarang(a).biaya.perawatan - keuanganSekarang(s).biaya.perawatan).toBeCloseTo(EKONOMI.teknologi.rambuHalte.perawatan / 24, 6);
  });
});

describe('target harian', () => {
  it('hari pertama: berangkatkan N penumpang (separuh arus rata-rata sehari), maju lewat tick', () => {
    const s = buatStateBaru(T0);
    expect(s.harian.jenis).toBe('penumpang');
    const perkiraan = acuanHarian(s).arus * 24 * EKONOMI.harian.fraksiPenumpang;
    expect(s.harian.target).toBeGreaterThan(perkiraan * 0.9);
    expect(s.harian.target).toBeLessThan(perkiraan * 1.1);
    const b = jalankan(s, 60);
    expect(b.harian.progres).toBeCloseTo(b.statistik.totalPenumpang, 6);
  });

  it('hari ganjil: raih laba bersih N (separuh laba rata-rata sehari, paling sedikit batas bawah hadiah)', () => {
    const s = stateOtomatis();
    const h = buatTargetHarian(s, 1);
    expect(h.jenis).toBe('laba');
    expect(h.target).toBeGreaterThanOrEqual(EKONOMI.hadiah.minPerMenit * 24 * EKONOMI.harian.fraksiLaba * 0.9);
  });
});

describe('pencapaian', () => {
  it('tercatat otomatis saat syarat terpenuhi, hadiah diklaim sekali', () => {
    let s = tick(rekrutPetugas(stateOtomatis(), 'peron'), 0.1);
    expect(s.pencapaian.tercapai).toContain('petugasPertama');
    expect(s.pencapaian.tercapai).not.toContain('manajerOperasional');
    const k = klaimPencapaian(s, 'petugasPertama');
    expect(k.kas).toBe(s.kas + hadiahMenit(s, EKONOMI.hadiahMenitPencapaian));
    expect(klaimPencapaian(k, 'petugasPertama')).toBe(k);
    expect(klaimPencapaian(k, 'kelasA')).toBe(k);
    s = tick(denganBangunan(s, { toilet: 1 }), 0.1);
    expect(s.pencapaian.tercapai).toContain('fasilitasPertama');
  });

  it('semua pencapaian bisa diraih', () => {
    let s = kaya(stateOtomatis({ jalur: 9, kios: 3, toko: 4, toilet: 2, lahanParkir: 2, posRetribusi: 1 }), 2e9);
    // Terminal Terpadu: semua rute antarpulau & kelas bus bisa dilayani PO yang levelnya cukup.
    s = denganLevelTerminal(s, levelMinimalKelas(3));
    const po: PoId[] = ['ondelOndel', 'peuyeumKilat', 'lumpiaKilat', 'bakpiaRasa', 'sigerSakti', 'rinjaniIndah', 'rumahGadang', 'danauToba', 'kecakLaju'];
    for (const id of po) s = denganPo(s, id, { level: 15, loket: 3 });
    for (const id of TEKNOLOGI_IDS) s = { ...s, terminal: { ...s.terminal, teknologi: { ...s.terminal.teknologi, [id]: true } } };
    s = denganPetugas(s, ['manajerOperasional']);
    s = {
      ...s,
      statistik: { ...s.statistik, totalPenumpang: 2e6, waktuMainDetik: 7 * DETIK_SEHARI + 1 },
      harian: { ...s.harian, jumlahSelesai: 1 },
      keuangan: { ...s.keuangan, hariTanpaRugi: 7 },
    };
    s = tick(s, 0.1);
    expect([...s.pencapaian.tercapai].sort()).toEqual([...PENCAPAIAN_IDS].sort());
  });
});
