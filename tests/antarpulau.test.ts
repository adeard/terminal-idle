import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { PELABUHAN_FERI, pelabuhanTerbuka } from '../src/game/antarpulau';
import { KELOMPOK_PARKIR, TUJUAN_BUS } from '../src/game/tata-letak';
import { deserialisasi, serialisasi } from '../src/sim/save';
import {
  bisaBukaJurusan,
  bukaJurusan,
  jumlahJurusanDarat,
  jurusanAntarpulau,
  kelasKurangJurusan,
  multJurusan,
  tick,
  type GameState,
} from '../src/sim/state';
import { buatModel } from '../src/ui/model';
import { stateOtomatis, T0 } from './helpers';

const kaya = (s: GameState, uang = 1e15): GameState => ({ ...s, uang: new Decimal(uang) });
const kelas = (s: GameState, jumlahReset: number): GameState => ({ ...s, prestige: { ...s.prestige, jumlahReset } });
/** Semua jurusan Jawa–Bali sudah dibuka (Denpasar). */
const sampaiDenpasar = (s: GameState): GameState => ({ ...s, terminal: { ...s.terminal, jurusanBuka: jumlahJurusanDarat() } });
const indeks = (nama: string): number => EKONOMI.jurusan.findIndex((j) => j.nama === nama);

describe('rute antarpulau (sim)', () => {
  it('konfigurasi: jurusan Jawa–Bali lebih dulu, lalu rute feri yang makin mahal & butuh kelas terminal', () => {
    const darat = jumlahJurusanDarat();
    expect(EKONOMI.jurusan[darat - 1]!.nama).toBe('DENPASAR');
    for (let i = 0; i < EKONOMI.jurusan.length; i++) expect(jurusanAntarpulau(i)).toBe(i >= darat);
    for (let i = darat; i < EKONOMI.jurusan.length; i++) {
      const j = EKONOMI.jurusan[i]!;
      expect(j.biaya).toBeGreaterThan(EKONOMI.jurusan[i - 1]!.biaya);
      expect(j.kelasTerminal ?? 0).toBeGreaterThanOrEqual(1);
      expect(j.kelasTerminal ?? 0).toBeGreaterThanOrEqual(EKONOMI.jurusan[i - 1]!.kelasTerminal ?? 0);
      expect(PELABUHAN_FERI[j.feri!]).toBeDefined();
    }
    expect(EKONOMI.jurusan[EKONOMI.jurusan.length - 1]!.nama).toBe('BANDA ACEH');
  });

  it('setelah Denpasar: rute antarpulau terkunci sampai terminal cukup tinggi kelasnya', () => {
    let s = sampaiDenpasar(kaya(stateOtomatis()));
    // Tipe C: Lampung butuh Tipe B walau uangnya cukup.
    expect(kelasKurangJurusan(s)).toBe(EKONOMI.jurusan[indeks('LAMPUNG')]!.kelasTerminal);
    expect(bisaBukaJurusan(s)).toBe(false);
    expect(bukaJurusan(s)).toBe(s);
    s = kelas(s, 1);
    expect(kelasKurangJurusan(s)).toBeNull();
    const multSebelum = multJurusan(s);
    s = bukaJurusan(s);
    expect(s.terminal.jurusanBuka).toBe(indeks('LAMPUNG') + 1);
    expect(multJurusan(s)).toBeCloseTo(multSebelum + EKONOMI.jurusan[indeks('LAMPUNG')]!.bonusTiket, 9);
    // PO kotanya langsung bergabung.
    expect(s.armada.po).toContain('sigerSakti');
    s = bukaJurusan(s);
    expect(s.terminal.jurusanBuka).toBe(indeks('PALEMBANG') + 1);
    // Mataram butuh Tipe A.
    expect(kelasKurangJurusan(s)).toBe(2);
    expect(bukaJurusan(s)).toBe(s);
    s = kelas(s, 3);
    for (let i = 0; i < 20; i++) s = bukaJurusan(s);
    expect(s.terminal.jurusanBuka).toBe(EKONOMI.jurusan.length);
    expect(s.armada.po).toEqual(expect.arrayContaining(['rinjaniIndah', 'rumahGadang', 'danauToba', 'kopiGayo']));
    expect(bisaBukaJurusan(s)).toBe(false);
  });

  it('pencapaian: Jawa–Bali lengkap, antarpulau pertama, lintas Nusantara', () => {
    let s = tick(sampaiDenpasar(kaya(stateOtomatis())), 0.1);
    expect(s.pencapaian.tercapai).toContain('jurusanSemua');
    expect(s.pencapaian.tercapai).not.toContain('antarpulau');
    s = tick(bukaJurusan(kelas(s, 3)), 0.1);
    expect(s.pencapaian.tercapai).toContain('antarpulau');
    expect(s.pencapaian.tercapai).not.toContain('lintasNusantara');
    for (let i = 0; i < 20; i++) s = bukaJurusan(s);
    expect(tick(s, 0.1).pencapaian.tercapai).toContain('lintasNusantara');
  });

  it('tersimpan: jurusan antarpulau yang terbuka ikut dimuat', () => {
    let s = kelas(sampaiDenpasar(kaya(stateOtomatis())), 3);
    for (let i = 0; i < 3; i++) s = bukaJurusan(s);
    expect(deserialisasi(serialisasi(s), T0).terminal.jurusanBuka).toBe(jumlahJurusanDarat() + 3);
  });

  it('model tab Jurusan: tanda feri, penyeberangan & syarat kelas jurusan berikutnya', () => {
    const s = sampaiDenpasar(kaya(stateOtomatis()));
    const j = buatModel(s).jurusan;
    expect(j.daftar.filter((d) => d.feri !== null)).toHaveLength(EKONOMI.jurusan.length - jumlahJurusanDarat());
    expect(j.berikutnya).toMatchObject({ nama: 'LAMPUNG', feri: 'Merak–Bakauheni', kurangKelas: 1, bisa: false, po: 'sigerSakti' });
    expect(buatModel(kelas(s, 1)).jurusan.berikutnya).toMatchObject({ kurangKelas: null, bisa: true });
  });
});

describe('rute antarpulau di adegan', () => {
  it('tiap rute punya satu kelompok parkir; rute antarpulau di baris kedua papan kelompoknya', () => {
    const semua = KELOMPOK_PARKIR.flatMap((k) => k.tujuan);
    expect([...semua].sort((a, b) => a - b)).toEqual(TUJUAN_BUS.map((_, i) => i));
    const laut = KELOMPOK_PARKIR.flatMap((k) => k.antarpulau);
    expect([...laut].sort((a, b) => a - b)).toEqual(TUJUAN_BUS.map((_, i) => i).filter((i) => jurusanAntarpulau(i)));
    for (const k of KELOMPOK_PARKIR) {
      // Urut dibuka, dan kota darat kelompok selalu terbuka lebih dulu (papan bertingkat).
      expect([...k.antarpulau]).toEqual([...k.antarpulau].sort((a, b) => a - b));
      const darat = k.tujuan.filter((t) => !k.antarpulau.includes(t));
      expect(Math.max(...darat)).toBeLessThan(Math.min(...k.antarpulau));
    }
  });

  it('rambu pelabuhan: Merak muncul bersama Lampung, Padangbai bersama Mataram', () => {
    const darat = jumlahJurusanDarat();
    expect(pelabuhanTerbuka(darat)).toEqual({ barat: null, timur: null });
    expect(pelabuhanTerbuka(indeks('LAMPUNG') + 1)).toEqual({ barat: 'MERAK', timur: null });
    expect(pelabuhanTerbuka(indeks('MATARAM') + 1)).toEqual({ barat: 'MERAK', timur: 'PADANGBAI' });
    expect(pelabuhanTerbuka(EKONOMI.jurusan.length)).toEqual({ barat: 'MERAK', timur: 'PADANGBAI' });
  });
});
