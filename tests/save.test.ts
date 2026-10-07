import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { kelasDariLevel, levelMinimalKelas, slotPo, xpKumulatifTerminal } from '../src/sim/level-terminal';
import { jatahLoket } from '../src/sim/mitra';
import { bonusJatahPerluasan } from '../src/sim/perluasan';
import {
  decimalKeString,
  deserialisasi,
  migrasikan,
  migrasiV1keV2,
  muatAtauBaru,
  SaveTidakValidError,
  serialisasi,
  stringKeDecimal,
  VERSI_SKEMA,
  type FungsiMigrasi,
} from '../src/sim/save';
import {
  buatPoTerdaftar,
  buatStateBaru,
  DETIK_SEHARI,
  kelasBusBeroperasi,
  kelasTerminal,
  levelPo,
  levelTerminal,
  loketTerisi,
  tandaiWaktu,
  type GameState,
} from '../src/sim/state';
import { TAHAP_IDS } from '../src/sim/tahap';
import { jalankan, stateOtomatis, T0 } from './helpers';

function expectStateSama(a: GameState, b: GameState): void {
  expect(a.uang.eq(b.uang), `uang ${a.uang.toString()} vs ${b.uang.toString()}`).toBe(true);
  expect(a.terminal.id).toBe(b.terminal.id);
  for (const id of TAHAP_IDS) {
    expect(a.terminal.tahap[id].level).toBe(b.terminal.tahap[id].level);
    expect(a.terminal.tahap[id].kepala).toEqual(b.terminal.tahap[id].kepala);
  }
  expect(a.terminal.loketKosong).toBe(b.terminal.loketKosong);
  expect(a.mitra).toEqual(b.mitra);
  expect(a.perkembangan).toEqual(b.perkembangan);
  expect(a.renovasi.poin.eq(b.renovasi.poin)).toBe(true);
  expect(a.renovasi.jumlah).toBe(b.renovasi.jumlah);
  expect(a.statistik.totalPendapatanRun.eq(b.statistik.totalPendapatanRun)).toBe(true);
  expect(a.statistik.totalPendapatanSepanjangMasa.eq(b.statistik.totalPendapatanSepanjangMasa)).toBe(true);
  expect(a.statistik.waktuMainDetik).toBe(b.statistik.waktuMainDetik);
  expect(a.waktuTerakhirMs).toBe(b.waktuTerakhirMs);
}

/** Dua PO (salah satu dengan harga sendiri), satu PO di riwayat & masa jeda, loket kosong, perluasan berjalan, Renovasi. */
function stateTengahGame(): GameState {
  let s = stateOtomatis({ peron: 43, loket: 49, keberangkatan: 44 });
  s = jalankan(s, 12.3);
  const kedua = { ...buatPoTerdaftar('lumpiaKilat', 3), xp: 1234.5, harga: { 2: 110 } };
  s = {
    ...s,
    terminal: { ...s.terminal, loketKosong: 2, tahap: { ...s.terminal.tahap, keberangkatan: { ...s.terminal.tahap.keberangkatan, kepala: { direkrut: false } } } },
    mitra: {
      ...s.mitra,
      terdaftar: [...s.mitra.terdaftar, kedua],
      riwayat: { bakpiaRasa: { xp: 400, reputasi: 41, rekorLoket: 5, harga: { 3: 90 } } },
      jedaSampai: { bakpiaRasa: 9_999 },
      hadiahEvent: ['mudikCeria'],
    },
    perkembangan: { xpTerminal: 123_456, perluasan: 2, proyekDetik: 100 },
    renovasi: { poin: new Decimal(7), jumlah: 2 },
  };
  s = { ...s, terminal: { ...s.terminal, tahap: { ...s.terminal.tahap, loket: { ...s.terminal.tahap.loket, level: loketTerisi(s) + 2 } } } };
  return tandaiWaktu(s, T0 + 123_456);
}

function saveValid(): Record<string, unknown> {
  return JSON.parse(serialisasi(stateTengahGame())) as Record<string, unknown>;
}

describe('round-trip save/load', () => {
  it('state baru', () => {
    const s = buatStateBaru(T0);
    expectStateSama(deserialisasi(serialisasi(s), 0), s);
  });

  it('state tengah game (level, Kepala sebagian, mitra PO, perluasan, Renovasi, statistik)', () => {
    const s = stateTengahGame();
    expectStateSama(deserialisasi(serialisasi(s), 0), s);
  });

  it('angka di luar batas Number (1e500) tetap persis', () => {
    const s: GameState = { ...stateTengahGame(), uang: Decimal.pow(10, 500).times(1.2345678901234) };
    const hasil = deserialisasi(serialisasi(s), 0);
    expect(hasil.uang.eq(s.uang)).toBe(true);
    expect(hasil.uang.exponent).toBe(500);
  });

  it('Decimal ⇄ string persis untuk banyak nilai acak', () => {
    let seed = 42;
    const acak = (): number => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = 0; i < 2000; i++) {
      const d = new Decimal(acak() * 10 ** Math.floor(acak() * 30)).times(1.0837).pow(1.01);
      expect(stringKeDecimal(decimalKeString(d), 'x').eq(d)).toBe(true);
    }
  });

  it('format JSON: schemaVersion + angka besar sebagai string', () => {
    const data = saveValid();
    expect(data['schemaVersion']).toBe(VERSI_SKEMA);
    expect(typeof data['uang']).toBe('string');
    expect(typeof (data['renovasi'] as Record<string, unknown>)['poin']).toBe('string');
    expect(typeof (data['statistik'] as Record<string, unknown>)['totalPendapatanRun']).toBe('string');
    // Blok v1 tidak ditulis lagi.
    expect(data['prestige']).toBeUndefined();
    expect(data['armada']).toBeUndefined();
    expect(data['harga']).toBeUndefined();
  });

  it('level Loket dihitung ulang dari loket PO + loket kosong (angka di save diabaikan)', () => {
    const d = saveValid();
    const tahap = (d['terminal'] as Record<string, Record<string, Record<string, unknown>>>)['tahap']!;
    tahap['loket'] = { level: 3, kepala: { direkrut: true } };
    const s = deserialisasi(JSON.stringify(d), T0);
    expect(s.terminal.tahap.loket.level).toBe(49 + 3 + 2);
  });
});

describe('muatAtauBaru', () => {
  it('tidak ada save → game baru', () => {
    expect(muatAtauBaru(null, T0).status).toBe('baru');
    expect(muatAtauBaru(undefined, T0).status).toBe('baru');
    expect(muatAtauBaru('', T0).status).toBe('baru');
  });

  it('save valid → dimuat', () => {
    const s = stateTengahGame();
    const h = muatAtauBaru(serialisasi(s), T0);
    expect(h.status).toBe('dimuat');
    expectStateSama(h.state, s);
  });

  const korup: Array<[string, (d: Record<string, unknown>) => unknown]> = [
    ['bukan JSON', () => '{uang: 12'],
    ['JSON null', () => null],
    ['JSON angka', () => 42],
    ['JSON array', () => []],
    ['objek kosong', () => ({})],
    ['schemaVersion hilang', (d) => ({ ...d, schemaVersion: undefined })],
    ['schemaVersion string', (d) => ({ ...d, schemaVersion: '2' })],
    ['schemaVersion 0', (d) => ({ ...d, schemaVersion: 0 })],
    ['schemaVersion dari masa depan', (d) => ({ ...d, schemaVersion: 999 })],
    ['uang hilang', (d) => ({ ...d, uang: undefined })],
    ['uang number', (d) => ({ ...d, uang: 12 })],
    ['uang teks', (d) => ({ ...d, uang: 'abc' })],
    ['uang format lokal', (d) => ({ ...d, uang: '12,5' })],
    ['uang negatif', (d) => ({ ...d, uang: '-5e0' })],
    ['uang NaN', (d) => ({ ...d, uang: 'NaN' })],
    ['uang Infinity', (d) => ({ ...d, uang: 'Infinity' })],
    ['terminal hilang', (d) => ({ ...d, terminal: undefined })],
    ['tahap bukan objek', (d) => ({ ...d, terminal: { id: 'tipe-c', tahap: 'x' } })],
    ['level 0', (d) => ubahTahap(d, { level: 0 })],
    ['level pecahan', (d) => ubahTahap(d, { level: 1.5 })],
    ['level string', (d) => ubahTahap(d, { level: '3' })],
    ['level hilang', (d) => ubahTahap(d, { level: undefined })],
    ['kepala.direkrut bukan boolean', (d) => ubahTahap(d, { level: 3, kepala: { direkrut: 'ya' } })],
    ['renovasi salah tipe', (d) => ({ ...d, renovasi: 'banyak' })],
    ['renovasi.poin rusak', (d) => ({ ...d, renovasi: { poin: '??', jumlah: 0 } })],
    ['mitra salah tipe', (d) => ({ ...d, mitra: [] })],
    ['mitra.terdaftar bukan array', (d) => ({ ...d, mitra: { ...(d['mitra'] as object), terdaftar: {} } })],
    ['loket PO pecahan', (d) => ubahPoPertama(d, { loket: 2.5 })],
    ['xp PO negatif', (d) => ubahPoPertama(d, { xp: -1 })],
    ['perkembangan salah tipe', (d) => ({ ...d, perkembangan: 5 })],
    ['loketKosong negatif', (d) => ({ ...d, terminal: { ...(d['terminal'] as object), loketKosong: -1 } })],
    ['waktuTerakhirMs string', (d) => ({ ...d, waktuTerakhirMs: 'kemarin' })],
  ];

  for (const [nama, rusak] of korup) {
    it(`save korup (${nama}) → game baru tanpa crash`, () => {
      const hasil = rusak(saveValid());
      const raw = typeof hasil === 'string' ? hasil : JSON.stringify(hasil);
      const h = muatAtauBaru(raw, T0);
      expect(h.status).toBe('korup');
      if (h.status === 'korup') expect(h.error).toBeInstanceOf(SaveTidakValidError);
      expectStateSama(h.state, buatStateBaru(T0));
    });
  }

  it('deserialisasi langsung melempar SaveTidakValidError', () => {
    expect(() => deserialisasi('rusak', T0)).toThrow(SaveTidakValidError);
  });
});

describe('kompatibilitas ke depan', () => {
  it('blok opsional yang hilang diisi default', () => {
    const d = saveValid();
    delete d['renovasi'];
    delete d['perkembangan'];
    delete d['statistik'];
    delete d['waktuTerakhirMs'];
    const s = deserialisasi(JSON.stringify(d), T0 + 5);
    expect(s.renovasi.poin.toNumber()).toBe(0);
    expect(s.perkembangan).toEqual({ xpTerminal: 0, perluasan: 0, proyekDetik: 0 });
    expect(s.statistik.waktuMainDetik).toBe(0);
    expect(s.waktuTerakhirMs).toBe(T0 + 5); // tanpa timestamp → tanpa offline
    expect(s.terminal.tahap.loket.level).toBe(49 + 3 + 2);
  });

  it('tanpa blok mitra (atau semua PO tak dikenal) → PO awal, terminal tidak pernah tanpa PO', () => {
    const d = saveValid();
    delete d['mitra'];
    expect(deserialisasi(JSON.stringify(d), T0).mitra.terdaftar.map((p) => p.id)).toEqual(['ondelOndel']);
    const d2 = { ...saveValid(), mitra: { terdaftar: [{ id: 'poGaib', xp: 1, loket: 3 }] } };
    const s2 = deserialisasi(JSON.stringify(d2), T0);
    expect(s2.mitra.terdaftar.map((p) => p.id)).toEqual(['ondelOndel']);
    expect(s2.terminal.tahap.loket.level).toBe(1 + 2);
  });

  it('isi PO dirapikan: duplikat & id tak dikenal dibuang, reputasi dijepit, harga di luar jurusan dibuang & dirapikan', () => {
    const d = saveValid();
    const mitra = d['mitra'] as Record<string, unknown[]>;
    const pertama = mitra['terdaftar']![0] as Record<string, unknown>;
    mitra['terdaftar'] = [{ ...pertama, reputasi: 250, harga: { 0: 117, 99: 120, x: 80 } }, pertama, { id: 'poGaib', xp: 0, loket: 1 }];
    const s = deserialisasi(JSON.stringify(d), T0);
    expect(s.mitra.terdaftar).toHaveLength(1);
    expect(s.mitra.terdaftar[0]!.reputasi).toBe(100);
    expect(s.mitra.terdaftar[0]!.harga).toEqual({ 0: 120 });
  });

  it('tahap yang belum ada di save mulai dari level 1', () => {
    const d = saveValid();
    const tahap = (d['terminal'] as Record<string, Record<string, unknown>>)['tahap']!;
    delete tahap['keberangkatan'];
    const s = deserialisasi(JSON.stringify(d), T0);
    expect(s.terminal.tahap.keberangkatan.level).toBe(1);
    expect(s.terminal.tahap.peron.level).toBe(43);
  });

  it('field tak dikenal diabaikan', () => {
    const d = { ...saveValid(), eventMudik: { aktif: true }, iap: ['no_ads'] };
    expect(muatAtauBaru(JSON.stringify(d), T0).status).toBe('dimuat');
  });

  it('migrasi dijalankan berurutan dan menaikkan schemaVersion', () => {
    const daftar: Record<number, FungsiMigrasi> = {
      1: (d) => ({ ...d, a: 1 }),
      2: (d) => ({ ...d, b: (d['a'] as number) + 1 }),
    };
    expect(migrasikan({ schemaVersion: 1 }, 1, daftar, 3)).toEqual({ schemaVersion: 3, a: 1, b: 2 });
    expect(() => migrasikan({ schemaVersion: 1 }, 1, {}, 2)).toThrow(SaveTidakValidError);
  });
});

// ---------------------------------------------------------------------------
// Migrasi save v1 (prestige naik kelas, jurusan & kelas bus dibeli, kontrak PO sekali)

/** Save v1 seperti yang ditulis versi sebelum ekonomi mitra PO. */
function saveV1(o: { loket?: number; kelas?: number; penumpang?: number; po?: unknown[]; kelasBus?: Record<string, boolean>; poin?: string } = {}): Record<string, unknown> {
  const tahap = (level: number): Record<string, unknown> => ({ level, kepala: { direkrut: true } });
  return {
    schemaVersion: 1,
    waktuTerakhirMs: T0,
    uang: '1.5e6',
    terminal: {
      id: 'tipe-c',
      tahap: { peron: tahap(30), loket: tahap(o.loket ?? 30), keberangkatan: tahap(30) },
      fasilitas: { kios: 3, parkir: 2, toilet: 1, retribusi: 0 },
      teknologi: { rambuHalte: true },
      jalur: 3,
      jurusanBuka: 6,
      kelasBus: o.kelasBus ?? { ekonomi: true, patas: true, eksekutif: false, sleeper: false, tingkat: false },
    },
    armada: { po: o.po ?? [] },
    harga: { jurusan: [120, 110], kelas: { patas: 20 } },
    prestige: { poin: o.poin ?? '0e0', jumlahReset: o.kelas ?? 0 },
    statistik: { totalPendapatanRun: '2e6', totalPendapatanSepanjangMasa: '3e7', waktuMainDetik: 5000, totalPenumpang: o.penumpang ?? 50_000 },
    pencapaian: { tercapai: ['kepalaPertama'], diklaim: ['kepalaPertama'] },
    profil: { namaTerminal: 'Sukamaju' },
  };
}

const muatV1 = (d: Record<string, unknown>): GameState => deserialisasi(JSON.stringify(d), T0);

describe('migrasi v1 → v2', () => {
  it('save v1 tanpa mitra PO: PO awal menyewa semua loket lama, level terminal dari total penumpang', () => {
    const s = muatV1(saveV1({ loket: 30, penumpang: 50_000 }));
    expect(s.mitra.terdaftar.map((p) => p.id)).toEqual(['ondelOndel']);
    expect(loketTerisi(s)).toBe(30);
    expect(s.terminal.tahap.loket.level).toBe(30);
    expect(s.perkembangan.xpTerminal).toBe(50_000);
    // Jatah PO cukup menampung semua loket lama: kapasitas Loket tidak turun.
    const p = s.mitra.terdaftar[0]!;
    expect(p.loket).toBeLessThanOrEqual(jatahLoket(levelPo(p), bonusJatahPerluasan(s.perkembangan.perluasan)));
    // Data lain ikut terbawa.
    expect(s.terminal.tahap.peron.level).toBe(30);
    expect(s.terminal.fasilitas.kios).toBe(3);
    expect(s.terminal.jalur).toBe(3);
    expect(s.profil.namaTerminal).toBe('Sukamaju');
    expect(s.pencapaian.tercapai).toEqual(['kepalaPertama']);
  });

  it('kelas v1 dipertahankan: level terminal minimal setara kelasnya, perluasan sampai level itu langsung jadi; prestige → Renovasi', () => {
    const s = muatV1(saveV1({ kelas: 2, penumpang: 10, poin: '7e0' }));
    expect(levelTerminal(s)).toBe(levelMinimalKelas(2));
    expect(kelasTerminal(s)).toBe(2);
    expect(s.perkembangan.xpTerminal).toBe(xpKumulatifTerminal(levelMinimalKelas(2)));
    expect(s.perkembangan.perluasan).toBe(EKONOMI.mitra.perluasan.filter((t) => t.level <= levelMinimalKelas(2)).length);
    expect(s.perkembangan.proyekDetik).toBe(0);
    expect(s.renovasi.poin.toNumber()).toBe(7);
    expect(s.renovasi.jumlah).toBe(2);
    // Total penumpang yang lebih tinggi dari minimal kelas tetap dipakai.
    const banyak = muatV1(saveV1({ kelas: 1, penumpang: xpKumulatifTerminal(25) }));
    expect(levelTerminal(banyak)).toBe(25);
    expect(kelasDariLevel(25)).toBe(2);
  });

  it('mitra PO lama: yang paling bernilai menempati slot, sisanya riwayat; id tak dikenal diabaikan; PO event jadi hadiah', () => {
    const po = ['ondelOndel', 'lumpiaKilat', 'bakpiaRasa', 'wayangLestari', 'mudikCeria', 'poGaib'];
    const s = muatV1(saveV1({ loket: 31, kelas: 0, penumpang: 0, po }));
    const slot = slotPo(1, 0);
    expect(slot).toBe(2);
    // Biaya daftar tertinggi lebih dulu: Wayang Lestari, lalu Bakpia Rasa.
    expect(s.mitra.terdaftar.map((p) => p.id)).toEqual(['wayangLestari', 'bakpiaRasa']);
    expect(Object.keys(s.mitra.riwayat).sort()).toEqual(['lumpiaKilat', 'mudikCeria', 'ondelOndel']);
    expect(s.mitra.hadiahEvent).toEqual(['mudikCeria']);
    // Loket lama dibagi rata ke PO terdaftar, semuanya muat di jatahnya.
    expect(s.mitra.terdaftar.map((p) => p.loket)).toEqual([16, 15]);
    for (const p of s.mitra.terdaftar) expect(p.loket).toBeLessThanOrEqual(jatahLoket(levelPo(p), bonusJatahPerluasan(s.perkembangan.perluasan)));
    // Harga tiket kembali normal; kontrak baru panjang.
    for (const p of s.mitra.terdaftar) {
      expect(p.harga).toEqual({});
      expect(p.kontrakDetik).toBe(EKONOMI.mitra.kontrak.hariHadiah * DETIK_SEHARI);
    }
  });

  it('kelas bus yang sudah dibeli tetap beroperasi (PO naik ke level yang membukanya, sebatas tingkat & kelas terminal)', () => {
    const kelasBus = { ekonomi: true, patas: true, eksekutif: true, sleeper: true, tingkat: true };
    const s = muatV1(saveV1({ kelas: 2, po: ['ondelOndel', 'mudikCeria'], kelasBus }));
    // Lokal paling tinggi Eksekutif; Regional (Mudik Ceria) sampai Sleeper; Double Decker butuh PO nasional.
    expect(kelasBusBeroperasi(s)).toEqual(['ekonomi', 'patas', 'eksekutif', 'sleeper']);
    const ondel = s.mitra.terdaftar.find((p) => p.id === 'ondelOndel')!;
    expect(levelPo(ondel)).toBeGreaterThanOrEqual(EKONOMI.mitra.kelas.eksekutif.levelPo);
    // Tanpa kelas terminal yang cukup, kelas besar tidak ikut (Sleeper butuh Tipe B).
    const c = muatV1(saveV1({ kelas: 0, penumpang: 0, po: ['mudikCeria'], kelasBus }));
    expect(kelasBusBeroperasi(c)).toEqual(['ekonomi', 'patas', 'eksekutif']);
  });

  it('blok v1 dibuang; hasil migrasi tersimpan sebagai v2 dan dimuat ulang sama persis', () => {
    const d = migrasiV1keV2(saveV1({ kelas: 1, po: ['ondelOndel'] }));
    expect(d['prestige']).toBeUndefined();
    expect(d['armada']).toBeUndefined();
    expect(d['harga']).toBeUndefined();
    expect((d['terminal'] as Record<string, unknown>)['jurusanBuka']).toBeUndefined();
    expect((d['terminal'] as Record<string, unknown>)['kelasBus']).toBeUndefined();
    const s = muatV1(saveV1({ kelas: 1, po: ['ondelOndel'] }));
    expectStateSama(deserialisasi(serialisasi(s), 0), s);
  });

  it('save v1 yang rusak tetap ditolak setelah migrasi', () => {
    expect(muatAtauBaru(JSON.stringify({ ...saveV1(), uang: 'abc' }), T0).status).toBe('korup');
    expect(muatAtauBaru(JSON.stringify({ ...saveV1(), terminal: undefined }), T0).status).toBe('korup');
  });
});

function ubahTahap(d: Record<string, unknown>, tahapPeron: Record<string, unknown>): Record<string, unknown> {
  const terminal = d['terminal'] as Record<string, Record<string, unknown>>;
  return { ...d, terminal: { ...terminal, tahap: { ...terminal['tahap'], peron: tahapPeron } } };
}

function ubahPoPertama(d: Record<string, unknown>, ubah: Record<string, unknown>): Record<string, unknown> {
  const mitra = d['mitra'] as Record<string, unknown[]>;
  const [pertama, ...sisa] = mitra['terdaftar']!;
  return { ...d, mitra: { ...mitra, terdaftar: [{ ...(pertama as object), ...ubah }, ...sisa] } };
}
