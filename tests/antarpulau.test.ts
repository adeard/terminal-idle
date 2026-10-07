import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { PELABUHAN_FERI, pelabuhanTerbuka } from '../src/game/antarpulau';
import { KELOMPOK_PARKIR, kunciPapanPulau, MASK_SEMUA_JURUSAN, maskAwal, maskJurusan, TUJUAN_BUS } from '../src/game/tata-letak';
import type { PoId } from '../src/sim/fitur';
import { levelMinimalKelas } from '../src/sim/level-terminal';
import { indeksJurusan, nilaiJurusan } from '../src/sim/mitra';
import { jumlahJurusanDarat, jurusanAntarpulau, jurusanDilayani, tick, type GameState } from '../src/sim/state';
import { buatModel } from '../src/ui/model';
import { denganLevelTerminal, denganPo, stateOtomatis } from './helpers';

const LEVEL_SEMUA_JURUSAN = EKONOMI.mitra.levelJurusan[2]!;
/** Nama jurusan yang dilayani. */
const dilayani = (s: GameState): string[] => EKONOMI.jurusan.filter((_, i) => jurusanDilayani(s)[i]).map((j) => j.nama);
/** Banyak PO sekaligus di level yang membuka ketiga jurusannya. */
const denganBanyakPo = (s: GameState, ids: readonly PoId[]): GameState => ids.reduce((x, id) => denganPo(x, id, { level: LEVEL_SEMUA_JURUSAN }), s);
const bit = (nama: string): number => 2 ** indeksJurusan(nama);

describe('rute antarpulau (sim)', () => {
  it('konfigurasi: jurusan Jawa–Bali lebih dulu, lalu rute feri yang makin bernilai & butuh kelas terminal', () => {
    const darat = jumlahJurusanDarat();
    expect(EKONOMI.jurusan[darat - 1]!.nama).toBe('DENPASAR');
    for (let i = 0; i < EKONOMI.jurusan.length; i++) expect(jurusanAntarpulau(i)).toBe(i >= darat);
    for (let i = darat; i < EKONOMI.jurusan.length; i++) {
      const j = EKONOMI.jurusan[i]!;
      expect(nilaiJurusan(i)).toBeGreaterThan(nilaiJurusan(i - 1));
      expect(j.kelasTerminal ?? 0).toBeGreaterThanOrEqual(1);
      expect(j.kelasTerminal ?? 0).toBeGreaterThanOrEqual(EKONOMI.jurusan[i - 1]!.kelasTerminal ?? 0);
      expect(PELABUHAN_FERI[j.feri!]).toBeDefined();
    }
    expect(EKONOMI.jurusan[EKONOMI.jurusan.length - 1]!.nama).toBe('BANDA ACEH');
  });

  it('rute antarpulau dilayani PO-nya hanya setelah terminal cukup tinggi kelasnya', () => {
    // Siger Sakti: daftar butuh Tipe B; Lampung dilayani sejak Lv 1, Palembang di Lv 6.
    let s = denganPo(denganLevelTerminal(stateOtomatis(), levelMinimalKelas(1)), 'sigerSakti');
    expect(dilayani(s)).toEqual(['JAKARTA', 'LAMPUNG']);
    s = denganPo(s, 'sigerSakti', { level: EKONOMI.mitra.levelJurusan[1]! });
    expect(dilayani(s)).toEqual(['JAKARTA', 'LAMPUNG', 'PALEMBANG']);
    // Kecak Laju di Lv 12: Mataram (rute ketiganya) menunggu Tipe A.
    s = denganPo(s, 'kecakLaju', { level: LEVEL_SEMUA_JURUSAN });
    expect(dilayani(s)).not.toContain('MATARAM');
    expect(dilayani(denganLevelTerminal(s, levelMinimalKelas(2)))).toContain('MATARAM');
  });

  it('pencapaian: Jawa–Bali lengkap, antarpulau pertama, lintas Nusantara', () => {
    const jawaBali: PoId[] = ['ondelOndel', 'peuyeumKilat', 'lumpiaKilat', 'bakpiaRasa'];
    let s = tick(denganBanyakPo(stateOtomatis(), jawaBali), 0.1);
    expect(dilayani(s)).toHaveLength(jumlahJurusanDarat());
    expect(s.pencapaian.tercapai).toContain('jurusanSemua');
    expect(s.pencapaian.tercapai).not.toContain('antarpulau');
    s = tick(denganPo(denganLevelTerminal(s, levelMinimalKelas(1)), 'sigerSakti'), 0.1);
    expect(s.pencapaian.tercapai).toContain('antarpulau');
    expect(s.pencapaian.tercapai).not.toContain('lintasNusantara');
    s = denganBanyakPo(denganLevelTerminal(s, levelMinimalKelas(3)), ['sigerSakti', 'rinjaniIndah', 'rumahGadang', 'danauToba']);
    expect(dilayani(s)).toHaveLength(EKONOMI.jurusan.length);
    expect(tick(s, 0.1).pencapaian.tercapai).toContain('lintasNusantara');
  });

  it('model kartu PO: jurusan antarpulau bertanda feri, dengan syarat level PO atau kelas terminal', () => {
    const s = denganPo(denganLevelTerminal(stateOtomatis(), levelMinimalKelas(1)), 'kecakLaju', { level: LEVEL_SEMUA_JURUSAN });
    const kecak = buatModel(s).mitra.terdaftar.find((p) => p.id === 'kecakLaju')!;
    const mataram = kecak.jurusan.find((j) => j.nama === 'MATARAM')!;
    expect(mataram).toMatchObject({ feri: 'Padangbai–Lembar', aktif: false, kurangKelas: 2, levelBuka: LEVEL_SEMUA_JURUSAN });
    expect(kecak.jurusan.find((j) => j.nama === 'DENPASAR')).toMatchObject({ feri: null, aktif: true });
    const siger = buatModel(denganPo(s, 'sigerSakti')).mitra.terdaftar.find((p) => p.id === 'sigerSakti')!;
    expect(siger.jurusan.find((j) => j.nama === 'PALEMBANG')).toMatchObject({ feri: 'Merak–Bakauheni', aktif: false, kurangKelas: null, levelBuka: 6 });
  });
});

describe('rute antarpulau di adegan', () => {
  it('tiap rute punya satu kelompok parkir; rute antarpulau di baris kedua papan kelompoknya', () => {
    const semua = KELOMPOK_PARKIR.flatMap((k) => k.tujuan);
    expect([...semua].sort((a, b) => a - b)).toEqual(TUJUAN_BUS.map((_, i) => i));
    const laut = KELOMPOK_PARKIR.flatMap((k) => k.antarpulau);
    expect([...laut].sort((a, b) => a - b)).toEqual(TUJUAN_BUS.map((_, i) => i).filter((i) => jurusanAntarpulau(i)));
    for (const k of KELOMPOK_PARKIR) expect([...k.antarpulau]).toEqual([...k.antarpulau].sort((a, b) => a - b));
  });

  it('mask jurusan: dari daftar dilayani, n jurusan pertama, dan semua', () => {
    expect(maskJurusan([true, false, true])).toBe(0b101);
    expect(maskAwal(3)).toBe(0b111);
    expect(maskAwal(TUJUAN_BUS.length)).toBe(MASK_SEMUA_JURUSAN);
    expect(maskJurusan(TUJUAN_BUS.map(() => true))).toBe(MASK_SEMUA_JURUSAN);
  });

  it('rambu pelabuhan mengikuti rute feri yang dilayani: Merak untuk Sumatra, Padangbai untuk Nusa Tenggara', () => {
    const darat = maskAwal(jumlahJurusanDarat());
    expect(pelabuhanTerbuka(darat)).toEqual({ barat: null, timur: null });
    expect(pelabuhanTerbuka(darat + bit('LAMPUNG'))).toEqual({ barat: 'MERAK', timur: null });
    // Tidak harus urut: Mataram saja tanpa Lampung.
    expect(pelabuhanTerbuka(bit('JAKARTA') + bit('MATARAM'))).toEqual({ barat: null, timur: 'PADANGBAI' });
    expect(pelabuhanTerbuka(MASK_SEMUA_JURUSAN)).toEqual({ barat: 'MERAK', timur: 'PADANGBAI' });
  });

  it('papan pulau kelompok: tutup, terbuka, lalu baris kedua berisi rute antarpulau yang dilayani', () => {
    const g = KELOMPOK_PARKIR[0]!; // JAKARTA · BANDUNG, antarpulau LAMPUNG & PALEMBANG
    expect(g.antarpulau.map((t) => TUJUAN_BUS[t])).toEqual(['LAMPUNG', 'PALEMBANG']);
    expect(kunciPapanPulau(g.tujuan, g.antarpulau, bit('SEMARANG'))).toBe(0);
    expect(kunciPapanPulau(g.tujuan, g.antarpulau, bit('JAKARTA'))).toBe(1);
    expect(kunciPapanPulau(g.tujuan, g.antarpulau, bit('JAKARTA') + bit('LAMPUNG'))).toBe(2);
    expect(kunciPapanPulau(g.tujuan, g.antarpulau, bit('JAKARTA') + bit('PALEMBANG'))).toBe(3);
    expect(kunciPapanPulau(g.tujuan, g.antarpulau, bit('JAKARTA') + bit('LAMPUNG') + bit('PALEMBANG'))).toBe(4);
    // Hanya rute antarpulaunya yang dilayani: papan tetap terbuka.
    expect(kunciPapanPulau(g.tujuan, g.antarpulau, bit('LAMPUNG'))).toBe(2);
  });
});
