import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import {
  decimalKeString,
  deserialisasi,
  migrasikan,
  muatAtauBaru,
  SaveTidakValidError,
  serialisasi,
  stringKeDecimal,
  VERSI_SKEMA,
  type FungsiMigrasi,
} from '../src/sim/save';
import { buatStateBaru, tandaiWaktu, type GameState } from '../src/sim/state';
import { TAHAP_IDS } from '../src/sim/tahap';
import { jalankan, stateOtomatis, T0 } from './helpers';

function expectStateSama(a: GameState, b: GameState): void {
  expect(a.uang.eq(b.uang), `uang ${a.uang.toString()} vs ${b.uang.toString()}`).toBe(true);
  expect(a.terminal.id).toBe(b.terminal.id);
  for (const id of TAHAP_IDS) {
    expect(a.terminal.tahap[id].level).toBe(b.terminal.tahap[id].level);
    expect(a.terminal.tahap[id].kepala).toEqual(b.terminal.tahap[id].kepala);
  }
  expect(a.prestige.poin.eq(b.prestige.poin)).toBe(true);
  expect(a.prestige.jumlahReset).toBe(b.prestige.jumlahReset);
  expect(a.statistik.totalPendapatanRun.eq(b.statistik.totalPendapatanRun)).toBe(true);
  expect(a.statistik.totalPendapatanSepanjangMasa.eq(b.statistik.totalPendapatanSepanjangMasa)).toBe(true);
  expect(a.statistik.waktuMainDetik).toBe(b.statistik.waktuMainDetik);
  expect(a.waktuTerakhirMs).toBe(b.waktuTerakhirMs);
}

function stateTengahGame(): GameState {
  let s = stateOtomatis({ peron: 43, loket: 49, keberangkatan: 44 });
  s = jalankan(s, 12.3);
  s = {
    ...s,
    terminal: { ...s.terminal, tahap: { ...s.terminal.tahap, keberangkatan: { ...s.terminal.tahap.keberangkatan, kepala: { direkrut: false } } } },
    prestige: { poin: new Decimal(7), jumlahReset: 2 },
  };
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

  it('state tengah game (level, Kepala sebagian, prestige, statistik)', () => {
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
    expect(typeof (data['prestige'] as Record<string, unknown>)['poin']).toBe('string');
    expect(typeof (data['statistik'] as Record<string, unknown>)['totalPendapatanRun']).toBe('string');
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
    ['schemaVersion string', (d) => ({ ...d, schemaVersion: '1' })],
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
    ['prestige salah tipe', (d) => ({ ...d, prestige: 'banyak' })],
    ['prestige.poin rusak', (d) => ({ ...d, prestige: { poin: '??', jumlahReset: 0 } })],
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
    delete d['prestige'];
    delete d['statistik'];
    delete d['waktuTerakhirMs'];
    const s = deserialisasi(JSON.stringify(d), T0 + 5);
    expect(s.prestige.poin.toNumber()).toBe(0);
    expect(s.statistik.waktuMainDetik).toBe(0);
    expect(s.waktuTerakhirMs).toBe(T0 + 5); // tanpa timestamp → tanpa offline
    expect(s.terminal.tahap.loket.level).toBe(49);
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

function ubahTahap(d: Record<string, unknown>, tahapPeron: Record<string, unknown>): Record<string, unknown> {
  const terminal = d['terminal'] as Record<string, Record<string, unknown>>;
  return { ...d, terminal: { ...terminal, tahap: { ...terminal['tahap'], peron: tahapPeron } } };
}
