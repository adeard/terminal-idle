import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { hitungKepuasan } from '../src/sim/kepuasan';
import {
  bangunFasilitas,
  bisaKontrakPo,
  bukaJalur,
  kepuasanTerminal,
  kontrakPo,
  pendapatanPerDetikState,
  pengaliKepuasan,
  type GameState,
} from '../src/sim/state';
import { buatModel } from '../src/ui/model';
import { stateOtomatis } from './helpers';

const kaya = (s: GameState, uang = 1e15): GameState => ({ ...s, uang: new Decimal(uang) });
const masukan = { kapasitas: [10, 10, 10], arus: 10, levelFasilitas: 100, jalur: 5, jalurMaks: 5 };

describe('kepuasan penumpang (murni)', () => {
  it('kelancaran: tahap seimbang penuh, tahap yang tertinggal jauh nol', () => {
    expect(hitungKepuasan(masukan).kelancaran).toBe(1);
    expect(hitungKepuasan({ ...masukan, kapasitas: [10, 9, 10] }).kelancaran).toBe(1);
    expect(hitungKepuasan({ ...masukan, kapasitas: [10, 2, 10] }).kelancaran).toBe(0);
    const tengah = hitungKepuasan({ ...masukan, kapasitas: [10, 5.5, 10] }).kelancaran;
    expect(tengah).toBeGreaterThan(0.3);
    expect(tengah).toBeLessThan(0.7);
  });

  it('fasilitas & jalur yang dibutuhkan naik seiring arus', () => {
    const k = (arus: number) => hitungKepuasan({ ...masukan, arus, levelFasilitas: 0, jalur: 1 });
    expect(k(1).fasilitasPerlu).toBeLessThan(k(100).fasilitasPerlu);
    expect(k(100).fasilitasPerlu).toBeLessThan(k(10_000).fasilitasPerlu);
    expect(k(1).jalurPerlu).toBe(1);
    expect(k(6).jalurPerlu).toBe(2);
    expect(k(100).jalurPerlu).toBe(4);
    expect(k(1e6).jalurPerlu).toBe(5);
    expect(hitungKepuasan({ ...masukan, arus: 100, jalur: 2 }).jalur).toBeCloseTo(0.5, 9);
  });

  it('nilai = rata-rata berbobot; semuanya penuh = 100 %', () => {
    expect(hitungKepuasan(masukan).nilai).toBeCloseTo(1, 12);
    const b = EKONOMI.kepuasan.bobot;
    const tanpaFasilitas = hitungKepuasan({ ...masukan, levelFasilitas: 0 });
    expect(tanpaFasilitas.nilai).toBeCloseTo((b.kelancaran + b.jalur) / (b.kelancaran + b.fasilitas + b.jalur), 12);
  });
});

describe('kepuasan di terminal', () => {
  it('terminal tanpa fasilitas paling puas 70 %: belum ada bonus, ekonomi dasar sama dengan spreadsheet', () => {
    const s = stateOtomatis({ peron: 30, loket: 30, keberangkatan: 30 });
    expect(kepuasanTerminal(s).nilai).toBeLessThanOrEqual(EKONOMI.kepuasan.bonusMulai + 1e-12);
    expect(pengaliKepuasan(s)).toBe(1);
  });

  it('fasilitas & jalur yang cukup menaikkan kepuasan dan memberi bonus pendapatan', () => {
    // Loket (tidak ikut dipercepat jalur) di-upgrade lebih tinggi supaya tahap tetap seimbang.
    let s = kaya(stateOtomatis({ peron: 30, loket: 50, keberangkatan: 30 }));
    const awal = pendapatanPerDetikState(s).toNumber();
    for (let i = 0; i < 12; i++) s = bangunFasilitas(bangunFasilitas(s, 'kios'), 'toilet');
    for (let i = 0; i < 5; i++) s = bukaJalur(s);
    const k = kepuasanTerminal(s);
    expect(k.fasilitas).toBe(1);
    expect(k.jalur).toBe(1);
    expect(k.nilai).toBeGreaterThan(EKONOMI.kepuasan.bonusMulai);
    expect(pengaliKepuasan(s)).toBeGreaterThan(1);
    expect(pengaliKepuasan(s)).toBeLessThanOrEqual(1 + EKONOMI.kepuasan.bonusPendapatan + 1e-12);
    expect(pendapatanPerDetikState(s).toNumber()).toBeGreaterThan(awal);
    const m = buatModel(s).hud.kepuasan;
    expect(m.nilai).toBeCloseTo(k.nilai, 12);
    expect(m.bonus).toBeCloseTo(pengaliKepuasan(s) - 1, 12);
    expect(m.jalurPerlu).toBe(k.jalurPerlu);
  });

  it('mitra PO besar butuh kepuasan minimal walau uangnya cukup', () => {
    let s = kaya(stateOtomatis({ peron: 30, loket: 50, keberangkatan: 30 }));
    const sy = EKONOMI.po.syarat.sultanGarasi;
    expect(sy.jenis === 'kontrak' && sy.kepuasanMin).toBeGreaterThan(kepuasanTerminal(s).nilai);
    expect(bisaKontrakPo(s, 'sultanGarasi')).toBe(false);
    expect(kontrakPo(s, 'sultanGarasi')).toBe(s);
    expect(buatModel(s).armada.daftar.find((p) => p.id === 'sultanGarasi')?.syarat).toMatchObject({ jenis: 'kontrak', kepuasanKurang: true });
    // PO tanpa syarat kepuasan tetap bisa dikontrak.
    expect(bisaKontrakPo(s, 'ondelOndel')).toBe(true);
    for (let i = 0; i < 12; i++) s = bangunFasilitas(bangunFasilitas(s, 'kios'), 'toilet');
    for (let i = 0; i < 5; i++) s = bukaJalur(s);
    expect(bisaKontrakPo(s, 'sultanGarasi')).toBe(true);
    expect(kontrakPo(s, 'sultanGarasi').armada.po).toContain('sultanGarasi');
  });
});
