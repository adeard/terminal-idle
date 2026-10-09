import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { slotBangunan } from '../src/sim/bangunan';
import { deserialisasi, keSaveV3, migrasikan, muatAtauBaru, SaveTidakValidError, serialisasi, VERSI_SKEMA, type FungsiMigrasi } from '../src/sim/save';
import { aturTarif, bangun, buatStateBaru, DETIK_SEHARI, putusPo, tandaiWaktu, type GameState } from '../src/sim/state';
import { tarifBawaan } from '../src/sim/tarif';
import { denganLevelTerminal, denganPerluasan, denganPetugas, denganPo, jalankan, kaya, stateOtomatis, T0 } from './helpers';

/** Dua state sama persis menurut bentuk save-nya (bonus 2× offline memang tidak disimpan). */
function expectStateSama(a: GameState, b: GameState): void {
  expect(keSaveV3(a)).toEqual(keSaveV3(b));
}

/** State tengah game: bangunan, petugas, tarif, mitra PO (terdaftar, riwayat, jeda), perluasan, buku harian, rekor. */
function stateTengahGame(): GameState {
  let s = kaya(denganPerluasan(denganLevelTerminal(stateOtomatis({ jalur: 3, kursi: 2, kios: 2, toilet: 1, lahanParkir: 1 }), 12), 2), 5e8);
  s = denganPetugas(s, ['peron', 'kebersihan', 'manajerOperasional', 'juruParkir', 'peron']);
  s = denganPo(denganPo(s, 'peuyeumKilat', { level: 4, loket: 2 }), 'lumpiaKilat', { level: 2, loket: 2 });
  // Kontrak ketiga peuyeumKilat: 14 hari, dibayar di muka.
  s = { ...s, mitra: { ...s.mitra, terdaftar: s.mitra.terdaftar.map((p) => (p.id === 'peuyeumKilat' ? { ...p, kontrakHari: 14, nilaiKontrak: 123_400_000, kontrakKe: 3 } : p)) } };
  s = putusPo(s, 'lumpiaKilat');
  s = bangun(s, 'jendela', 'peuyeumKilat');
  s = aturTarif(aturTarif(s, 'retribusiBus', 25_000), 'parkir', 4000);
  s = { ...s, terminal: { ...s.terminal, teknologi: { ...s.terminal.teknologi, mesinTiket: true } }, pencapaian: { tercapai: ['petugasPertama', 'sepekan'], diklaim: ['petugasPertama'] } };
  return tandaiWaktu(jalankan(s, 120), T0 + 7);
}

const saveValid = (): Record<string, unknown> => JSON.parse(serialisasi(stateTengahGame())) as Record<string, unknown>;
const ubahTerminal = (d: Record<string, unknown>, ubah: Record<string, unknown>): Record<string, unknown> => ({ ...d, terminal: { ...(d['terminal'] as object), ...ubah } });
const ubahPoPertama = (d: Record<string, unknown>, ubah: Record<string, unknown>): Record<string, unknown> => {
  const mitra = d['mitra'] as Record<string, unknown[]>;
  return { ...d, mitra: { ...mitra, terdaftar: [{ ...(mitra['terdaftar']![0] as object), ...ubah }, ...mitra['terdaftar']!.slice(1)] } };
};

describe('round-trip save/load', () => {
  it('state baru', () => {
    const s = buatStateBaru(T0);
    expectStateSama(deserialisasi(serialisasi(s), T0), s);
  });

  it('state tengah game (bangunan, petugas urut rekrut, tarif, mitra PO, perluasan, buku harian, rekor)', () => {
    const s = stateTengahGame();
    expect(s.keuangan.hariIni.penumpang).toBeGreaterThan(0);
    expect(s.mitra.riwayat.lumpiaKilat).toBeDefined();
    const b = deserialisasi(serialisasi(s), T0);
    expectStateSama(b, s);
    expect(b.terminal.petugas).toEqual(['peron', 'kebersihan', 'manajerOperasional', 'juruParkir', 'peron']);
  });

  it('format JSON: schemaVersion 3, kas Rupiah sebagai angka', () => {
    const d = saveValid();
    expect(d['schemaVersion']).toBe(VERSI_SKEMA);
    expect(VERSI_SKEMA).toBe(3);
    expect(typeof d['kas']).toBe('number');
    expect(d['uang']).toBeUndefined();
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
    ['bukan JSON', () => '{kas: 12'],
    ['JSON null', () => null],
    ['JSON angka', () => 42],
    ['JSON array', () => []],
    ['objek kosong', () => ({ schemaVersion: 3 })],
    ['schemaVersion hilang', (d) => ({ ...d, schemaVersion: undefined })],
    ['schemaVersion string', (d) => ({ ...d, schemaVersion: '3' })],
    ['schemaVersion 0', (d) => ({ ...d, schemaVersion: 0 })],
    ['schemaVersion dari masa depan', (d) => ({ ...d, schemaVersion: 999 })],
    ['kas hilang', (d) => ({ ...d, kas: undefined })],
    ['kas string', (d) => ({ ...d, kas: '12' })],
    ['kas negatif', (d) => ({ ...d, kas: -5 })],
    ['kas tak hingga (null di JSON)', (d) => ({ ...d, kas: Number.POSITIVE_INFINITY })],
    ['terminal hilang', (d) => ({ ...d, terminal: undefined })],
    ['bangunan bukan objek', (d) => ubahTerminal(d, { bangunan: 'x' })],
    ['jalur pecahan', (d) => ubahTerminal(d, { bangunan: { jalur: 1.5 } })],
    ['kios string', (d) => ubahTerminal(d, { bangunan: { kios: '2' } })],
    ['petugas bukan array', (d) => ubahTerminal(d, { petugas: 'peron' })],
    ['tarif string', (d) => ubahTerminal(d, { tarif: { parkir: '10' } })],
    ['teknologi bukan boolean', (d) => ubahTerminal(d, { teknologi: { eTiket: 'ya' } })],
    ['mitra salah tipe', (d) => ({ ...d, mitra: [] })],
    ['mitra.terdaftar bukan array', (d) => ({ ...d, mitra: { ...(d['mitra'] as object), terdaftar: {} } })],
    ['loket PO pecahan', (d) => ubahPoPertama(d, { loket: 2.5 })],
    ['xp PO negatif', (d) => ubahPoPertama(d, { xp: -1 })],
    ['nilai kontrak PO negatif', (d) => ubahPoPertama(d, { nilaiKontrak: -1 })],
    ['perkembangan salah tipe', (d) => ({ ...d, perkembangan: 5 })],
    ['keuangan salah tipe', (d) => ({ ...d, keuangan: 'untung' })],
    ['buku harian negatif', (d) => ({ ...d, keuangan: { hariIni: { hariKe: 0, pendapatan: { parkir: -1 } } } })],
    ['target harian jenis lama', (d) => ({ ...d, harian: { ...(d['harian'] as object), jenis: 'upgrade' } })],
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
    for (const k of ['perkembangan', 'statistik', 'keuangan', 'rekor', 'hadiah', 'tantangan', 'event', 'profil', 'waktuTerakhirMs']) delete d[k];
    const s = deserialisasi(JSON.stringify(d), T0 + 5);
    expect(s.perkembangan).toEqual({ xpTerminal: 0, perluasan: 0, proyekDetik: 0 });
    expect(s.statistik.waktuMainDetik).toBe(0);
    expect(s.keuangan.kemarin).toBeNull();
    expect(s.rekor).toEqual({ penumpangHarian: 0, labaHarian: 0, arusTertinggi: 0 });
    expect(s.profil).toEqual({ namaTerminal: '', ikutPeringkat: false });
    expect(s.waktuTerakhirMs).toBe(T0 + 5); // tanpa timestamp → tanpa offline
  });

  it('tanpa blok mitra (atau semua PO tak dikenal) → PO awal, terminal tidak pernah tanpa PO', () => {
    const d = saveValid();
    delete d['mitra'];
    expect(deserialisasi(JSON.stringify(d), T0).mitra.terdaftar.map((p) => p.id)).toEqual(['ondelOndel']);
    const d2 = { ...saveValid(), mitra: { terdaftar: [{ id: 'poGaib', xp: 1, loket: 3 }] } };
    expect(deserialisasi(JSON.stringify(d2), T0).mitra.terdaftar.map((p) => p.id)).toEqual(['ondelOndel']);
  });

  it('isi PO dirapikan: duplikat & id tak dikenal dibuang, reputasi dijepit, loket paling sedikit satu', () => {
    const d = saveValid();
    const mitra = d['mitra'] as Record<string, unknown[]>;
    const pertama = mitra['terdaftar']![0] as Record<string, unknown>;
    mitra['terdaftar'] = [{ ...pertama, reputasi: 250, loket: 0 }, pertama, { id: 'poGaib', xp: 0, loket: 1 }];
    const s = deserialisasi(JSON.stringify(d), T0);
    expect(s.mitra.terdaftar).toHaveLength(1);
    expect(s.mitra.terdaftar[0]!.reputasi).toBe(100);
    expect(s.mitra.terdaftar[0]!.loket).toBe(1);
  });

  it('bangunan dijepit ke slot tahap perluasannya; jalur & jendela paling sedikit satu, jendela cukup untuk PO', () => {
    const d = ubahTerminal({ ...saveValid(), perkembangan: { xpTerminal: 0, perluasan: 0, proyekDetik: 0 } }, { bangunan: { jalur: 0, jendela: 99, kursi: 0, toilet: 7 } });
    const s = deserialisasi(JSON.stringify(d), T0);
    expect(s.terminal.bangunan.jalur).toBe(1);
    expect(s.terminal.bangunan.jendela).toBe(slotBangunan('jendela', 0));
    expect(s.terminal.bangunan.kursi).toBe(0);
    expect(s.terminal.bangunan.toilet).toBe(slotBangunan('toilet', 0));
    const kurang = ubahTerminal(saveValid(), { bangunan: { jendela: 1 } });
    const k = deserialisasi(JSON.stringify(kurang), T0);
    expect(k.terminal.bangunan.jendela).toBeGreaterThanOrEqual(k.mitra.terdaftar.reduce((a, p) => a + p.loket, 0));
  });

  it('petugas: peran tak dikenal dibuang, yang melebihi batas bangunannya keluar; tarif dirapikan', () => {
    // Tarif 0.3.0 (biaya layanan & toilet) dibuang.
    const d = ubahTerminal(saveValid(), { petugas: ['peron', 'kepalaLoket', 'peron', 'peron', 'peron', 'satpam'], tarif: { layanan: 10, toilet: 2000, retribusiBus: 999_999, parkir: 1234 } });
    const s = deserialisasi(JSON.stringify(d), T0);
    expect(s.terminal.petugas).toEqual(['peron', 'peron', 'peron', 'satpam']);
    expect(Object.keys(s.terminal.tarif).sort()).toEqual(['parkir', 'retribusiBus', 'sewaKios', 'sewaLoket']);
    expect(s.terminal.tarif.retribusiBus).toBe(EKONOMI.tycoon.tarif.retribusiBus.maks);
    expect(s.terminal.tarif.parkir).toBe(1000);
    expect(s.terminal.tarif.sewaKios).toBe(tarifBawaan().sewaKios);
  });

  it('PO dari save 0.3.0 (tanpa panjang & nilai kontrak): kontrak 7 hari yang sudah dibayar, kontrak ke-1; sisa kontrak dibatasi', () => {
    const d = ubahPoPertama(saveValid(), { kontrakHari: undefined, nilaiKontrak: undefined, kontrakKe: undefined, kontrakDetik: 1e9 });
    const p = deserialisasi(JSON.stringify(d), T0).mitra.terdaftar[0]!;
    const K = EKONOMI.mitra.kontrak;
    expect([p.kontrakHari, p.nilaiKontrak, p.kontrakKe]).toEqual([7, 0, 1]);
    expect(p.kontrakDetik).toBe((K.pilihanHari[K.pilihanHari.length - 1]! + K.hariTawaran) * DETIK_SEHARI);
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
// Save ekonomi idle (versi 1 & 2): dimulai baru, profil & benih cuaca dibawa

/** Save v2 (ekonomi mitra PO 0.2.0) seperti yang ditulis versi sebelum tycoon. */
function saveV2(): Record<string, unknown> {
  const tahap = (level: number): Record<string, unknown> => ({ level, kepala: { direkrut: true } });
  return {
    schemaVersion: 2,
    waktuTerakhirMs: T0 - 60_000,
    uang: '1.5e9',
    terminal: { id: 'tipe-c', tahap: { peron: tahap(80), loket: tahap(20), keberangkatan: tahap(80) }, fasilitas: { kios: 3, parkir: 2, toilet: 1, retribusi: 0 }, teknologi: { rambuHalte: true }, jalur: 3, loketKosong: 0 },
    mitra: { terdaftar: [{ id: 'ondelOndel', xp: 900, loket: 20, rekorLoket: 20, reputasi: 70, harga: { 0: 120 }, kontrakDetik: 9000 }], riwayat: {}, jedaSampai: {}, hadiahEvent: [] },
    perkembangan: { xpTerminal: 2e6, perluasan: 3, proyekDetik: 0 },
    renovasi: { poin: '5e0', jumlah: 2 },
    statistik: { totalPendapatanRun: '2e9', totalPendapatanSepanjangMasa: '3e10', waktuMainDetik: 50_000, totalPenumpang: 9e6 },
    harian: { hariKe: 34, jenis: 'upgrade', target: 10, progres: 3, diklaim: false, jumlahSelesai: 12 },
    pencapaian: { tercapai: ['kepalaPertama', 'level25'], diklaim: ['kepalaPertama'] },
    benihCuaca: 4242,
    profil: { namaTerminal: 'Sukamaju', ikutPeringkat: true },
  };
}

describe('save ekonomi idle (versi 1 & 2) → game tycoon baru', () => {
  it('ekonomi dimulai baru; nama terminal, persetujuan papan peringkat, dan benih cuaca dibawa', () => {
    const s = deserialisasi(JSON.stringify(saveV2()), T0);
    const baru = buatStateBaru(T0);
    expect(s.kas).toBe(EKONOMI.tycoon.modalAwal);
    expect(s.terminal.bangunan).toEqual(baru.terminal.bangunan);
    expect(s.mitra.terdaftar.map((p) => [p.id, p.loket])).toEqual([['ondelOndel', 1]]);
    expect(s.perkembangan).toEqual({ xpTerminal: 0, perluasan: 0, proyekDetik: 0 });
    expect(s.statistik.totalPenumpang).toBe(0);
    expect(s.pencapaian).toEqual({ tercapai: [], diklaim: [] });
    expect(s.profil).toEqual({ namaTerminal: 'Sukamaju', ikutPeringkat: true });
    expect(s.benihCuaca).toBe(4242);
  });

  it('save v1 juga; profil yang rusak diganti bawaan', () => {
    const v1 = { schemaVersion: 1, waktuTerakhirMs: T0, uang: '20e0', terminal: { tahap: {} }, profil: { namaTerminal: 7 }, benihCuaca: -3 };
    const s = deserialisasi(JSON.stringify(v1), T0);
    expect(s.kas).toBe(EKONOMI.tycoon.modalAwal);
    expect(s.profil.namaTerminal).toBe('');
    expect(Number.isSafeInteger(s.benihCuaca) && s.benihCuaca >= 0).toBe(true);
  });

  it('hasil migrasi tersimpan sebagai v3 dan dimuat ulang sama persis', () => {
    const s = deserialisasi(JSON.stringify(saveV2()), T0);
    const ulang = deserialisasi(serialisasi(s), T0);
    expectStateSama(ulang, s);
    expect((JSON.parse(serialisasi(s)) as Record<string, unknown>)['schemaVersion']).toBe(3);
  });
});
