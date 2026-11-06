import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PencatatAnalitik, peristiwaAksi, peristiwaLantaiLihat, peristiwaTujuanKetuk, ringkasanSesi, type DataAnalitik } from '../src/app/analitik';
import { EKONOMI } from '../src/config/economy.config';
import { terapkanAksi, type Aksi } from '../src/sim/aksi';
import { lantaiAwal, operasionalGedung, slotBangunan, type JumlahLantai } from '../src/sim/bangunan';
import { BANGUNAN_IDS, GEDUNG_LANTAI_IDS, type GedungLantaiId } from '../src/sim/fitur';
import { keuanganPerJam } from '../src/sim/keuangan';
import {
  biayaLantai,
  geserLantaiDilihat,
  lantaiDilihatAwal,
  lantaiMaks,
  lantaiTerbukaAntara,
  lantaiTertinggi,
  lantaiUntukUnit,
  petugasIkutLantai,
  syaratLantai,
} from '../src/sim/lantai';
import { bukaMusim, buatTugas } from '../src/sim/musim';
import { deserialisasi, keSaveV3, serialisasi } from '../src/sim/save';
import {
  bisaTambahLantai,
  bongkar,
  jumlahPetugas,
  keadaanOperasi,
  operasiState,
  perbaruiTantangan,
  slotBangunanState,
  tambahLantai,
  type GameState,
} from '../src/sim/state';
import { denganLevelTerminal, denganPerluasan, denganPetugas, stateOtomatis, T0 } from './helpers';

const jt = 1_000_000;
const M = 1_000_000_000;
const L = EKONOMI.tycoon.lantai;

/** Terminal tahap 3 pada level ini, dengan unit & petugas tertentu (kas berlimpah kecuali diberikan). */
function terminal(level = 40, bangunan: Parameters<typeof stateOtomatis>[0] = {}, petugas: Parameters<typeof stateOtomatis>[2] = [], kas = 1e13): GameState {
  return denganLevelTerminal(denganPerluasan(denganPetugas(stateOtomatis(bangunan, kas), petugas), 3), level);
}

const denganLantai = (s: GameState, l: Partial<JumlahLantai>): GameState => ({ ...s, terminal: { ...s.terminal, lantai: { ...s.terminal.lantai, ...l } } });

describe('config lantai (AC-GP-01, rancangan 4.2)', () => {
  it('angka persis rancangan bagian 4.2: 4 gedung, 5 lantai', () => {
    expect(GEDUNG_LANTAI_IDS).toEqual(['parkir', 'ruangTunggu', 'sayapBarat', 'aula']);
    expect(L).toEqual({
      parkir: { level: [15, 38], tahap: 3, biaya: [300 * jt, 2 * M], operasional: 1 * jt, isi: { lahanParkir: 2 } },
      ruangTunggu: { level: [21], tahap: 3, biaya: [500 * jt], operasional: 2 * jt, isi: { kursi: 4, kios: 1 } },
      sayapBarat: { level: [26], tahap: 3, biaya: [300 * jt], operasional: 1 * jt, isi: { toilet: 1 } },
      aula: { level: [33], tahap: 3, biaya: [1 * M], operasional: 1 * jt, isi: { kursi: 2, toko: 2 } },
    });
    expect(GEDUNG_LANTAI_IDS.reduce((a, g) => a + lantaiMaks(g), 0)).toBe(5);
  });
});

describe('slot, syarat & harga (AC-GP-01)', () => {
  it('slot naik sebesar isi tiap lantai; unit lain tidak berubah', () => {
    const nol = lantaiAwal();
    const penuh: JumlahLantai = { parkir: 2, ruangTunggu: 1, sayapBarat: 1, aula: 1 };
    const tambah = (id: (typeof BANGUNAN_IDS)[number], l: JumlahLantai): number => slotBangunan(id, 3, 40, EKONOMI, l) - slotBangunan(id, 3, 40, EKONOMI, nol);
    expect(BANGUNAN_IDS.map((id) => tambah(id, penuh))).toEqual(BANGUNAN_IDS.map((id) => ({ kursi: 6, kios: 1, toko: 2, toilet: 1, lahanParkir: 4 })[id as string] ?? 0));
    expect(tambah('lahanParkir', { ...nol, parkir: 1 })).toBe(2);
    // Tanpa lantai: sama dengan sebelum fitur ini.
    expect(slotBangunan('kursi', 3, 40)).toBe(slotBangunan('kursi', 3, 40, EKONOMI, nol));
    expect(slotBangunanState(denganLantai(terminal(), { ruangTunggu: 1 }), 'kursi')).toBe(12);
  });

  it('syarat: tahap 3, level, maksimal; harga per lantai', () => {
    expect(syaratLantai('parkir', 0, 2, 50)).toEqual({ jenis: 'tahap', tahap: 3 });
    expect(syaratLantai('parkir', 0, 3, 14)).toEqual({ jenis: 'level', level: 15 });
    expect(syaratLantai('parkir', 0, 3, 15)).toBeNull();
    expect(syaratLantai('parkir', 1, 3, 37)).toEqual({ jenis: 'level', level: 38 });
    expect(syaratLantai('parkir', 2, 3, 99)).toEqual({ jenis: 'maks' });
    expect(syaratLantai('aula', 0, 5, 32)).toEqual({ jenis: 'level', level: 33 });
    expect(biayaLantai('parkir', 0)).toBe(300 * jt);
    expect(biayaLantai('parkir', 1)).toBe(2 * M);
    expect(biayaLantai('parkir', 2)).toBeNull();
    expect(biayaLantai('ruangTunggu', 0)).toBe(500 * jt);
  });
});

describe('membeli lantai (AC-GP-01)', () => {
  it('kas berkurang sebesar harga, lantai +1, isinya langsung terbangun, tantangan bangun +1', () => {
    const s0 = perbaruiTantangan(terminal(21, { kursi: 8, kios: 3 }, [], 600 * jt), T0);
    const s = tambahLantai(s0, 'ruangTunggu');
    expect(s.kas).toBe(100 * jt);
    expect(s.terminal.lantai).toEqual({ parkir: 0, ruangTunggu: 1, sayapBarat: 0, aula: 0 });
    expect(s.terminal.bangunan.kursi).toBe(12);
    expect(s.terminal.bangunan.kios).toBe(4);
    expect(slotBangunanState(s, 'kursi')).toBe(12);
    // Tidak ada petugas wajib untuk kursi & kios.
    expect(s.terminal.petugas).toEqual(s0.terminal.petugas);
    for (const x of s.tantangan.daftar.filter((t) => t.jenis === 'bangun')) expect(x.progres).toBe(1);
  });

  it('isi ditambahkan ke unit yang ada, juga bila slot lama belum penuh', () => {
    const s = tambahLantai(terminal(26, { toilet: 1 }), 'sayapBarat');
    expect(s.terminal.bangunan.toilet).toBe(2);
    expect(slotBangunanState(s, 'toilet')).toBe(3);
  });

  it('tidak bisa sebelum tahap 3, sebelum levelnya, saat kas kurang, atau saat sudah maksimal', () => {
    const lv15 = terminal(15, {}, [], 300 * jt);
    expect(bisaTambahLantai(lv15, 'parkir')).toBe(true);
    const tahap2 = denganPerluasan(lv15, 2);
    expect(tambahLantai(tahap2, 'parkir')).toBe(tahap2);
    const lv14 = denganLevelTerminal(lv15, 14);
    expect(tambahLantai(lv14, 'parkir')).toBe(lv14);
    const miskin = { ...lv15, kas: 300 * jt - 1 };
    expect(bisaTambahLantai(miskin, 'parkir')).toBe(false);
    expect(tambahLantai(miskin, 'parkir')).toBe(miskin);
    const penuh = denganLantai(terminal(60), { parkir: 2 });
    expect(tambahLantai(penuh, 'parkir')).toBe(penuh);
    // Aksi yang tidak berlaku mengembalikan state yang sama persis.
    expect(terapkanAksi(lv14, { jenis: 'tambahLantai', gedung: 'parkir' })).toBe(lv14);
    // Lantai 3 baru sesudah lantai 2 dan Lv 38.
    const lv38 = denganLantai(terminal(38), { parkir: 1 });
    expect(tambahLantai(lv38, 'parkir').terminal.lantai.parkir).toBe(2);
    expect(bisaTambahLantai(denganLevelTerminal(lv38, 37), 'parkir')).toBe(false);
  });

  it('tidak bisa dibongkar: tidak ada aksinya; membongkar unit di lantai tidak mengurangi lantai maupun slotnya', () => {
    const s = tambahLantai(terminal(26, { toilet: 2 }, ['petugasToilet', 'petugasToilet']), 'sayapBarat');
    const b = bongkar(s, 'toilet');
    expect(b.terminal.bangunan.toilet).toBe(2);
    expect(b.terminal.lantai.sayapBarat).toBe(1);
    expect(slotBangunanState(b, 'toilet')).toBe(3);
  });
});

describe('petugas ikut direkrut (keputusan 4)', () => {
  it('toilet: ikut bila semua toilet yang ada dijaga; tidak bila pemain memilih tidak menjaga', () => {
    const dijaga = terminal(26, { toilet: 2 }, ['petugasToilet', 'petugasToilet']);
    expect(petugasIkutLantai(dijaga.terminal, 'sayapBarat')).toEqual(['petugasToilet']);
    expect(jumlahPetugas(tambahLantai(dijaga, 'sayapBarat')).petugasToilet).toBe(3);
    const tidak = terminal(26, { toilet: 2 }, ['petugasToilet']);
    expect(petugasIkutLantai(tidak.terminal, 'sayapBarat')).toEqual([]);
    expect(jumlahPetugas(tambahLantai(tidak, 'sayapBarat')).petugasToilet).toBe(1);
    // Belum ada toilet: belum ada pilihan pemain, jadi ikut direkrut (toilet tanpa petugas mengotori).
    expect(petugasIkutLantai(terminal(26).terminal, 'sayapBarat')).toEqual(['petugasToilet']);
  });

  it('parkir: dua juru parkir untuk dua lahan baru; ruang tunggu & aula tanpa petugas', () => {
    const s = terminal(15, { lahanParkir: 2 }, ['juruParkir', 'juruParkir']);
    const b = tambahLantai(s, 'parkir');
    expect(b.terminal.bangunan.lahanParkir).toBe(4);
    expect(jumlahPetugas(b).juruParkir).toBe(4);
    // Yang terakhir direkrut berhenti lebih dulu: juru parkir lantai ada di ujung urutan.
    expect(b.terminal.petugas.slice(-2)).toEqual(['juruParkir', 'juruParkir']);
    expect(petugasIkutLantai(terminal(40).terminal, 'ruangTunggu')).toEqual([]);
    expect(petugasIkutLantai(terminal(40).terminal, 'aula')).toEqual([]);
  });
});

describe('operasional lantai (rancangan 4.1 butir 5)', () => {
  it('masuk pos "Operasional gedung" tanpa pengali kelas', () => {
    const l: JumlahLantai = { parkir: 2, ruangTunggu: 1, sayapBarat: 1, aula: 1 };
    expect(operasionalGedung(3, EKONOMI, l) - operasionalGedung(3)).toBe(2 * jt + 2 * jt + 1 * jt + 1 * jt);
    const s = terminal(40);
    const a = keadaanOperasi(s);
    const b = keadaanOperasi(denganLantai(s, { ruangTunggu: 1 }));
    const op = operasiState(s);
    expect(keuanganPerJam(b, op, false).biaya.gedung - keuanganPerJam(a, op, false).biaya.gedung).toBeCloseTo((2 * jt) / 24, 6);
  });
});

describe('Musim: tugas kelola bangun (AC-GP-07)', () => {
  it('lantai dihitung satu pada tugas kelola bangun', () => {
    const senin = Date.UTC(2026, 10, 29, 17) + 10 * 3_600_000;
    let s = bukaMusim(terminal(21, { kursi: 8 }, [], 600 * jt), senin);
    const t = buatTugas(s, 'bangun', s.musim.hariTugas!)!;
    s = { ...s, musim: { ...s.musim, tugas: [t] } };
    const b = terapkanAksi(s, { jenis: 'tambahLantai', gedung: 'ruangTunggu' });
    expect(b.musim.tugas[0]!.selesai).toBe(true);
  });
});

describe('helper teks & toast', () => {
  it('lantaiUntukUnit: lantai belum dibangun dengan level terendah; null sebelum tahap 3 atau bila tidak ada', () => {
    const nol = lantaiAwal();
    expect(lantaiUntukUnit('kursi', nol, 3, 20)).toEqual({ gedung: 'ruangTunggu', lantai: 2, level: 21, terbuka: false });
    expect(lantaiUntukUnit('kursi', nol, 3, 21)).toEqual({ gedung: 'ruangTunggu', lantai: 2, level: 21, terbuka: true });
    expect(lantaiUntukUnit('kursi', { ...nol, ruangTunggu: 1 }, 3, 21)).toEqual({ gedung: 'aula', lantai: 2, level: 33, terbuka: false });
    expect(lantaiUntukUnit('lahanParkir', { ...nol, parkir: 1 }, 3, 20)).toEqual({ gedung: 'parkir', lantai: 3, level: 38, terbuka: false });
    expect(lantaiUntukUnit('lahanParkir', { ...nol, parkir: 2 }, 3, 60)).toBeNull();
    expect(lantaiUntukUnit('toko', nol, 5, 40)).toEqual({ gedung: 'aula', lantai: 2, level: 33, terbuka: true });
    expect(lantaiUntukUnit('kursi', nol, 2, 40)).toBeNull();
    expect(lantaiUntukUnit('jendela', nol, 3, 40)).toBeNull();
    expect(lantaiUntukUnit('jalur', nol, 3, 40)).toBeNull();
  });

  it('lantaiTerbukaAntara: level di (dari, ke]; sebelum tahap 3 tidak ada; dengan lantai hanya lantai berikutnya', () => {
    expect(lantaiTerbukaAntara(20, 21, 3)).toEqual([{ gedung: 'ruangTunggu', lantai: 2, level: 21 }]);
    expect(lantaiTerbukaAntara(14, 26, 3).map((x) => x.gedung)).toEqual(['parkir', 'ruangTunggu', 'sayapBarat']);
    expect(lantaiTerbukaAntara(21, 22, 3)).toEqual([]);
    expect(lantaiTerbukaAntara(14, 15, 2)).toEqual([]);
    expect(lantaiTerbukaAntara(37, 38, 3)).toEqual([{ gedung: 'parkir', lantai: 3, level: 38 }]);
    expect(lantaiTerbukaAntara(37, 38, 3, EKONOMI, lantaiAwal())).toEqual([]);
    expect(lantaiTerbukaAntara(37, 38, 3, EKONOMI, { ...lantaiAwal(), parkir: 1 })).toEqual([{ gedung: 'parkir', lantai: 3, level: 38 }]);
  });
});

describe('mode lihat per lantai (AC-GP-08, rancangan 6.4)', () => {
  it('masuk di lantai tertinggi; ‹ › dijepit Lantai 1 … tertinggi; tanpa lantai tambahan tidak bisa masuk', () => {
    const l: JumlahLantai = { ...lantaiAwal(), parkir: 2, ruangTunggu: 1 };
    expect(lantaiTertinggi(l, 'parkir')).toBe(3);
    expect(lantaiDilihatAwal(l, 'parkir')).toEqual({ gedung: 'parkir', lantai: 3 });
    expect(lantaiDilihatAwal(l, 'aula')).toBeNull();
    const v = lantaiDilihatAwal(l, 'parkir')!;
    expect(geserLantaiDilihat(v, 1, l)).toBe(v);
    const v2 = geserLantaiDilihat(v, -1, l);
    expect(v2).toEqual({ gedung: 'parkir', lantai: 2 });
    const v1 = geserLantaiDilihat(v2, -1, l);
    expect(v1).toEqual({ gedung: 'parkir', lantai: 1 });
    expect(geserLantaiDilihat(v1, -1, l)).toBe(v1);
    expect(geserLantaiDilihat({ gedung: 'ruangTunggu', lantai: 2 }, -1, l)).toEqual({ gedung: 'ruangTunggu', lantai: 1 });
  });

  it('tidak disimpan: state dan save tidak punya field mode lantai', () => {
    const d = keSaveV3(terminal()) as unknown as Record<string, unknown>;
    expect(JSON.stringify(d)).not.toContain('lantaiDilihat');
  });
});

// ---------------------------------------------------------------------------
// Save (AC-GP-03, rancangan 7.1)

const FIXTURE_050 = ['dump-J4-lv7', 'dump-J4-lv18', 'dump-J4-lv24', 'dump-J3-h2', 'dump-K2-h1', 'dump-K2-h12'] as const;
const muatFixture = (nama: string): { ms: number; save: string } => JSON.parse(readFileSync(new URL(`./fixtures/musim/${nama}.json`, import.meta.url), 'utf8')) as { ms: number; save: string };

const ubahLantaiSave = (s: GameState, lantai: unknown): string => {
  const d = JSON.parse(serialisasi(s)) as Record<string, Record<string, unknown>>;
  d['terminal']!['lantai'] = lantai;
  return JSON.stringify(d);
};

describe('save lantai (AC-GP-03)', () => {
  it('simpan-muat bolak-balik mempertahankan lantai dan semua unit lantai', () => {
    let s = terminal(40, { kursi: 8, kios: 3, toko: 4, toilet: 2, lahanParkir: 2 }, ['petugasToilet', 'petugasToilet', 'juruParkir', 'juruParkir']);
    for (const g of ['parkir', 'parkir', 'ruangTunggu', 'sayapBarat', 'aula'] as GedungLantaiId[]) s = tambahLantai(s, g);
    expect(s.terminal.lantai).toEqual({ parkir: 2, ruangTunggu: 1, sayapBarat: 1, aula: 1 });
    const b = deserialisasi(serialisasi(s), T0);
    expect(keSaveV3(b)).toEqual(keSaveV3(s));
    expect(b.terminal.bangunan).toMatchObject({ kursi: 14, kios: 4, toko: 6, toilet: 3, lahanParkir: 6 });
    expect(b.terminal.petugas.filter((p) => p === 'juruParkir')).toHaveLength(6);
  });

  it('urutan baca: unit di slot lantai tidak terpotong saat dimuat (lantai dibaca sebelum bangunan)', () => {
    const s = tambahLantai(terminal(21, { kursi: 8, kios: 3 }), 'ruangTunggu');
    const b = deserialisasi(serialisasi(s), T0);
    expect(b.terminal.bangunan.kursi).toBe(12);
    expect(b.terminal.bangunan.kios).toBe(4);
    // Tanpa lantai di save, unit yang sama terpotong ke slot tanpa lantai.
    const tanpa = deserialisasi(ubahLantaiSave(s, undefined), T0);
    expect(tanpa.terminal.bangunan.kursi).toBe(8);
  });

  it('save 0.5.0 tanpa lantai dimuat tanpa perubahan unit maupun petugas (fixture asli 0.5.0)', () => {
    for (const nama of FIXTURE_050) {
      const f = muatFixture(nama);
      const mentah = JSON.parse(f.save) as { terminal: { bangunan: Record<string, number>; petugas: string[]; lantai?: unknown } };
      expect(mentah.terminal.lantai, nama).toBeUndefined();
      const s = deserialisasi(f.save, f.ms);
      expect(s.terminal.lantai, nama).toEqual(lantaiAwal());
      expect(s.terminal.bangunan, nama).toEqual(mentah.terminal.bangunan);
      expect(s.terminal.petugas, nama).toEqual(mentah.terminal.petugas);
    }
  });

  it('nilai lantai rusak dijepit ke 0…maks dan dibulatkan ke bawah; gedung tak dikenal dibuang; save tidak ditolak', () => {
    const s = terminal();
    const muat = (lantai: unknown): JumlahLantai => deserialisasi(ubahLantaiSave(s, lantai), T0).terminal.lantai;
    expect(muat({ parkir: -1, ruangTunggu: 1.7, sayapBarat: 9, aula: 'dua', peron: 3 })).toEqual({ parkir: 0, ruangTunggu: 1, sayapBarat: 1, aula: 0 });
    expect(muat({ parkir: 2.9 })).toEqual({ ...lantaiAwal(), parkir: 2 });
    expect(muat({ parkir: Number.MAX_VALUE })).toEqual({ ...lantaiAwal(), parkir: 2 });
    expect(muat('rusak')).toEqual(lantaiAwal());
    expect(muat([1, 2])).toEqual(lantaiAwal());
    expect(muat(null)).toEqual(lantaiAwal());
  });

  it('bentuk save: terminal.lantai berisi keempat gedung', () => {
    const d = keSaveV3(terminal());
    expect(d.terminal.lantai).toEqual({ parkir: 0, ruangTunggu: 0, sayapBarat: 0, aula: 0 });
  });
});

// ---------------------------------------------------------------------------
// Analitik (AC-GP-09)

describe('analitik lantai (AC-GP-09)', () => {
  it('lantai_beli lewat PencatatAnalitik: gedung, nomor lantai, level; dihitung di ringkasan sesi', () => {
    const tercatat: { nama: string; data?: DataAnalitik }[] = [];
    const p = new PencatatAnalitik({ catat: (nama, data) => void tercatat.push({ nama, ...(data ? { data } : {}) }) });
    const lama = terminal(21);
    const aksi: Aksi = { jenis: 'tambahLantai', gedung: 'ruangTunggu' };
    const baru = terapkanAksi(lama, aksi);
    p.catatAksi(aksi, lama, baru);
    // Aksi yang tidak berlaku: tanpa peristiwa.
    p.catatAksi(aksi, baru, baru);
    expect(tercatat).toEqual([{ nama: 'lantai_beli', data: { gedung: 'ruangTunggu', lantai: 2, level: 21 } }]);
    // Seperti overlay: peristiwaLantaiLihat lewat catat (tidak dibatasi sekali per sesi).
    const lihat = peristiwaLantaiLihat({ gedung: 'ruangTunggu', lantai: 2 });
    p.catat(lihat.nama, lihat.data);
    p.catat(lihat.nama, lihat.data);
    expect(tercatat.slice(1)).toEqual([
      { nama: 'lantai_lihat', data: { gedung: 'ruangTunggu', lantai: 2 } },
      { nama: 'lantai_lihat', data: { gedung: 'ruangTunggu', lantai: 2 } },
    ]);
    p.catatRingkasanSesi(lama, baru, 30);
    expect(tercatat.at(-1)).toMatchObject({ nama: 'ringkasan_sesi', data: { lantai: 1, bangun: 1 } });
    expect(ringkasanSesi(lama, denganLantai(baru, { parkir: 2 }), 0, 1).lantai).toBe(3);
    expect(peristiwaAksi(aksi, lama, lama)).toEqual([]);
    // Baris tujuan yang menyarankan lantai: nilai baru tujuan_ketuk.jenis (tanpa gedung, uang, atau teks).
    expect(peristiwaTujuanKetuk('lantai')).toEqual({ nama: 'tujuan_ketuk', data: { jenis: 'lantai' } });
  });
});
