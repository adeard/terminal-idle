import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { terapkanAksi } from '../src/sim/aksi';
import { deserialisasi, serialisasi } from '../src/sim/save';
import {
  acuanHarian,
  aktifkanBoost,
  bisaAktifkanBoost,
  bisaKlaimBonusOffline,
  busEmasAktif,
  hadiahBusEmas,
  hadiahMenit,
  keuanganSekarang,
  klaimBonusOffline,
  klaimBusEmas,
  pengaliBoost,
  terapkanOffline,
  tick,
  type GameState,
} from '../src/sim/state';
import { denganNilaiKontrak, denganPetugas, jalankan, stateOtomatis, T0 } from './helpers';

const H = EKONOMI.hadiah;
const JAM_MS = 3_600_000;

const denganBoost = (s: GameState, boostDetik: number): GameState => ({ ...s, hadiah: { ...s.hadiah, boostDetik } });
const denganManajer = (s: GameState): GameState => denganPetugas(s, ['manajerOperasional']);

describe('boost pendapatan', () => {
  it('tiap iklan menambah 30 menit, ditumpuk sampai batas', () => {
    let s = stateOtomatis();
    expect(pengaliBoost(s)).toBe(1);
    s = aktifkanBoost(s);
    expect(s.hadiah.boostDetik).toBe(H.boostPerIklanDetik);
    expect(pengaliBoost(s)).toBe(H.pengaliBoost);
    for (let i = 0; i < 20; i++) s = aktifkanBoost(s);
    expect(s.hadiah.boostDetik).toBe(H.boostMaksDetik);
    expect(bisaAktifkanBoost(s)).toBe(false);
    expect(aktifkanBoost(s)).toBe(s);
  });

  it('pendapatan 2× selama boost (biaya tetap), lalu boost habis', () => {
    const s = stateOtomatis();
    const tanpa = jalankan(s, 60);
    const dengan = jalankan(denganBoost(s, 30), 60);
    const pendapatan = (x: GameState): number => x.statistik.totalPendapatan;
    // 30 detik pertama 2×, sisanya biasa: ±1,5× total.
    expect(pendapatan(dengan) / pendapatan(tanpa)).toBeCloseTo(1.5, 1);
    expect(dengan.statistik.totalBiaya).toBeCloseTo(tanpa.statistik.totalBiaya, 6);
    expect(dengan.hadiah.boostDetik).toBe(0);
  });

  it('boost ikut berjalan saat offline: jam yang ter-boost pendapatannya 2× (kontrak PO tidak ikut)', () => {
    const s = { ...denganBoost(denganManajer(denganNilaiKontrak(stateOtomatis(), 70_000_000)), 1800), waktuTerakhirMs: T0 };
    const { state, laporan } = terapkanOffline(s, T0 + JAM_MS);
    const a = acuanHarian(s, EKONOMI, s.terminal.tarif);
    const e = EKONOMI.tycoon.offline.efisiensi;
    const perJam = Math.min(a.pendapatan, acuanHarian(s).pendapatan) * e;
    expect(a.kontrak).toBeGreaterThan(0);
    expect(laporan.detikBoost).toBe(1800);
    expect(laporan.pendapatan).toBeCloseTo(perJam * (60 + 30) + a.kontrak * e * 60, 3);
    expect(state.hadiah.boostDetik).toBe(0);
  });
});

describe('bonus 2× laba offline', () => {
  it('ditawarkan untuk laporan terakhir dan hanya bisa diklaim sekali', () => {
    const s = { ...denganManajer(denganNilaiKontrak(stateOtomatis(), 70_000_000)), waktuTerakhirMs: T0 };
    const { state, laporan } = terapkanOffline(s, T0 + JAM_MS);
    expect(laporan.laba).toBeGreaterThan(0);
    expect(bisaKlaimBonusOffline(state)).toBe(true);
    const diklaim = terapkanAksi(state, { jenis: 'klaimBonusOffline' });
    expect(diklaim.kas - state.kas).toBe(Math.floor(laporan.laba));
    expect(bisaKlaimBonusOffline(diklaim)).toBe(false);
    expect(klaimBonusOffline(diklaim)).toBe(diklaim);
    // Laporan berikutnya (tanpa laba) menggantikan tawaran lama.
    const lagi = terapkanOffline(state, T0 + JAM_MS).state;
    expect(bisaKlaimBonusOffline(lagi)).toBe(false);
  });

  it('terminal tutup (tanpa Manajer Operasional): tidak ada bonus', () => {
    const { state } = terapkanOffline({ ...stateOtomatis(), waktuTerakhirMs: T0 }, T0 + JAM_MS);
    expect(bisaKlaimBonusOffline(state)).toBe(false);
  });
});

describe('Bus Emas', () => {
  it('muncul setelah jeda, bisa diklaim sekali untuk 10 menit laba, lalu dijadwalkan lagi', () => {
    let s = stateOtomatis();
    s = jalankan(s, H.busEmasSelangDetik[0] - 1);
    expect(busEmasAktif(s)).toBe(false);
    s = jalankan(s, 2);
    expect(busEmasAktif(s)).toBe(true);
    const hadiah = hadiahBusEmas(s);
    expect(hadiah).toBe(hadiahMenit(s, H.busEmasMenit));
    expect(hadiah).toBeGreaterThanOrEqual(H.minPerMenit * H.busEmasMenit);
    const diklaim = terapkanAksi(s, { jenis: 'klaimBusEmas' });
    expect(diklaim.kas - s.kas).toBeCloseTo(hadiah, 6);
    expect(busEmasAktif(diklaim)).toBe(false);
    expect(klaimBusEmas(diklaim)).toBe(diklaim);
    const t = diklaim.hadiah.busEmas.tungguDetik;
    expect(t).toBeGreaterThanOrEqual(H.busEmasSelangDetik[0]);
    expect(t).toBeLessThanOrEqual(H.busEmasSelangDetik[1]);
  });

  it('pergi kalau tidak diketuk, lalu muncul lagi nanti', () => {
    let s = jalankan(stateOtomatis(), H.busEmasSelangDetik[0] + 1);
    expect(busEmasAktif(s)).toBe(true);
    s = jalankan(s, H.busEmasAktifDetik);
    expect(busEmasAktif(s)).toBe(false);
    expect(s.hadiah.busEmas.jumlah).toBe(1);
    let detik = 0;
    while (!busEmasAktif(s) && detik <= H.busEmasSelangDetik[1] + 1) {
      s = jalankan(s, 1);
      detik++;
    }
    expect(busEmasAktif(s)).toBe(true);
    expect(detik).toBeGreaterThanOrEqual(H.busEmasSelangDetik[0] - 1);
  });

  it('diketuk: menunggu selama iklan (walau lewat 60 detik); ditolak: langsung pergi', () => {
    const muncul = jalankan(stateOtomatis(), H.busEmasSelangDetik[0] + 1);
    const ditahan = jalankan(terapkanAksi(muncul, { jenis: 'tahanBusEmas' }), H.busEmasAktifDetik * 3);
    expect(busEmasAktif(ditahan)).toBe(true);
    expect(terapkanAksi(ditahan, { jenis: 'klaimBusEmas' }).kas).toBeGreaterThan(ditahan.kas);
    const ditolak = terapkanAksi(muncul, { jenis: 'lepasBusEmas' });
    expect(busEmasAktif(ditolak)).toBe(false);
    expect(ditolak.hadiah.busEmas.jumlah).toBe(1);
    expect(terapkanAksi(ditolak, { jenis: 'klaimBusEmas' })).toBe(ditolak);
  });
});

describe('hadiah 2× target harian & penghargaan', () => {
  it('klaim ganda memberi dua kali hadiah biasa', () => {
    const s = { ...stateOtomatis(), harian: { ...stateOtomatis().harian, progres: 999, target: 10 } };
    const biasa = terapkanAksi(s, { jenis: 'klaimTarget' });
    const ganda = terapkanAksi(s, { jenis: 'klaimTarget', ganda: true });
    expect(ganda.kas - s.kas).toBeCloseTo((biasa.kas - s.kas) * 2, 6);
    expect(ganda.harian.diklaim).toBe(true);
  });

  it('penghargaan: klaim ganda memberi dua kali hadiah biasa', () => {
    const s = { ...stateOtomatis(), pencapaian: { tercapai: ['petugasPertama' as const], diklaim: [] } };
    const biasa = terapkanAksi(s, { jenis: 'klaimPencapaian', pencapaian: 'petugasPertama' });
    const ganda = terapkanAksi(s, { jenis: 'klaimPencapaian', pencapaian: 'petugasPertama', ganda: true });
    expect(ganda.kas - s.kas).toBeCloseTo((biasa.kas - s.kas) * 2, 6);
  });
});

describe('simpan & muat', () => {
  it('boost & Bus Emas tersimpan; bonus offline tidak; save tanpa blok hadiah memakai bawaan', () => {
    let s = aktifkanBoost(jalankan(stateOtomatis(), 30));
    s = { ...s, hadiah: { ...s.hadiah, bonusOffline: 500 } };
    const dimuat = deserialisasi(serialisasi(s), T0);
    expect(dimuat.hadiah.boostDetik).toBe(s.hadiah.boostDetik);
    expect(dimuat.hadiah.busEmas).toEqual(s.hadiah.busEmas);
    expect(dimuat.hadiah.bonusOffline).toBe(0);

    const lama = JSON.parse(serialisasi(s)) as Record<string, unknown>;
    delete lama['hadiah'];
    const dariLama = deserialisasi(JSON.stringify(lama), T0);
    expect(dariLama.hadiah.boostDetik).toBe(0);
    expect(dariLama.hadiah.busEmas.aktifDetik).toBe(0);
  });

  it('tick tanpa boost & sebelum Bus Emas: kas berubah tepat sebesar laba × waktu', () => {
    const s = stateOtomatis();
    const a = tick(s, 10);
    expect(a.kas).toBeCloseTo(s.kas + (keuanganSekarang(s).laba * 10) / 60, 6);
  });
});
