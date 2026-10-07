import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { terapkanAksi } from '../src/sim/aksi';
import { pendapatanOffline } from '../src/sim/economy';
import { deserialisasi, serialisasi } from '../src/sim/save';
import {
  aktifkanBoost,
  bisaAktifkanBoost,
  bisaKlaimBonusOffline,
  busEmasAktif,
  hadiahBusEmas,
  hadiahMenit,
  klaimBonusOffline,
  klaimBusEmas,
  lakukanPrestige,
  pendapatanPerDetikState,
  pengaliBoost,
  terapkanOffline,
  tick,
  type GameState,
} from '../src/sim/state';
import { jalankan, stateOtomatis, T0 } from './helpers';

const H = EKONOMI.hadiah;
const JAM_MS = 3_600_000;

const denganBoost = (s: GameState, boostDetik: number): GameState => ({ ...s, hadiah: { ...s.hadiah, boostDetik } });

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

  it('pendapatan 2× selama boost, lalu boost habis', () => {
    const tanpa = jalankan(stateOtomatis(), 60);
    const dengan = jalankan(denganBoost(stateOtomatis(), 30), 60);
    const dasar = tanpa.uang.toNumber() - 20;
    // 30 detik pertama 2×, sisanya biasa: 1,5× total.
    expect(dengan.uang.toNumber() - 20).toBeCloseTo(dasar * 1.5, 4);
    expect(dengan.hadiah.boostDetik).toBe(0);
  });

  it('boost ikut berjalan saat offline: detik yang ter-boost dapat 2×, sisanya biasa', () => {
    const s = { ...denganBoost(stateOtomatis(), 1800), waktuTerakhirMs: T0 };
    const { state, laporan } = terapkanOffline(s, T0 + JAM_MS);
    const laju = pendapatanPerDetikState(s, 'offline');
    const harapan = pendapatanOffline(laju, 3600).add(pendapatanOffline(laju, 1800));
    expect(laporan.detikBoost).toBe(1800);
    expect(laporan.pendapatan.toNumber()).toBeCloseTo(harapan.toNumber(), 6);
    expect(state.hadiah.boostDetik).toBe(0);
  });

  it('prestige tidak menghapus boost', () => {
    const s = denganBoost({ ...stateOtomatis(), statistik: { ...stateOtomatis().statistik, totalPendapatanRun: new Decimal(1e7) } }, 900);
    expect(lakukanPrestige(s).hadiah.boostDetik).toBe(900);
  });
});

describe('bonus 2× penghasilan offline', () => {
  it('ditawarkan untuk laporan terakhir dan hanya bisa diklaim sekali', () => {
    const s = { ...stateOtomatis(), waktuTerakhirMs: T0 };
    const { state, laporan } = terapkanOffline(s, T0 + JAM_MS);
    expect(bisaKlaimBonusOffline(state)).toBe(true);
    const diklaim = terapkanAksi(state, { jenis: 'klaimBonusOffline' });
    expect(diklaim.uang.sub(state.uang).toNumber()).toBeCloseTo(laporan.pendapatan.toNumber(), 6);
    expect(bisaKlaimBonusOffline(diklaim)).toBe(false);
    expect(klaimBonusOffline(diklaim)).toBe(diklaim);
    // Laporan berikutnya (tanpa penghasilan) menggantikan tawaran lama.
    const lagi = terapkanOffline(state, T0 + JAM_MS).state;
    expect(bisaKlaimBonusOffline(lagi)).toBe(false);
  });
});

describe('Bus Emas', () => {
  it('muncul setelah jeda, bisa diklaim sekali untuk 10 menit pendapatan, lalu dijadwalkan lagi', () => {
    let s = stateOtomatis();
    s = jalankan(s, H.busEmasSelangDetik[0] - 1);
    expect(busEmasAktif(s)).toBe(false);
    s = jalankan(s, 2);
    expect(busEmasAktif(s)).toBe(true);
    const hadiah = hadiahBusEmas(s);
    expect(hadiah.toNumber()).toBeCloseTo(hadiahMenit(s, H.busEmasMenit).toNumber(), 6);
    const diklaim = terapkanAksi(s, { jenis: 'klaimBusEmas' });
    expect(diklaim.uang.sub(s.uang).toNumber()).toBeCloseTo(hadiah.toNumber(), 6);
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
    expect(terapkanAksi(ditahan, { jenis: 'klaimBusEmas' }).uang.gt(ditahan.uang)).toBe(true);
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
    expect(ganda.uang.sub(s.uang).toNumber()).toBeCloseTo(biasa.uang.sub(s.uang).toNumber() * 2, 6);
    expect(ganda.harian.diklaim).toBe(true);
  });

  it('penghargaan: klaim ganda memberi dua kali hadiah biasa', () => {
    const s = { ...stateOtomatis(), pencapaian: { tercapai: ['kepalaPertama' as const], diklaim: [] } };
    const biasa = terapkanAksi(s, { jenis: 'klaimPencapaian', pencapaian: 'kepalaPertama' });
    const ganda = terapkanAksi(s, { jenis: 'klaimPencapaian', pencapaian: 'kepalaPertama', ganda: true });
    expect(ganda.uang.sub(s.uang).toNumber()).toBeCloseTo(biasa.uang.sub(s.uang).toNumber() * 2, 6);
  });
});

describe('simpan & muat', () => {
  it('boost & Bus Emas tersimpan; bonus offline tidak; save lama tanpa blok hadiah memakai bawaan', () => {
    let s = aktifkanBoost(jalankan(stateOtomatis(), 30));
    s = { ...s, hadiah: { ...s.hadiah, bonusOffline: new Decimal(500) } };
    const dimuat = deserialisasi(serialisasi(s), T0);
    expect(dimuat.hadiah.boostDetik).toBe(s.hadiah.boostDetik);
    expect(dimuat.hadiah.busEmas).toEqual(s.hadiah.busEmas);
    expect(dimuat.hadiah.bonusOffline.toNumber()).toBe(0);

    const lama = JSON.parse(serialisasi(s)) as Record<string, unknown>;
    delete lama['hadiah'];
    const dariLama = deserialisasi(JSON.stringify(lama), T0);
    expect(dariLama.hadiah.boostDetik).toBe(0);
    expect(dariLama.hadiah.busEmas.aktifDetik).toBe(0);
  });

  it('tick tanpa boost & sebelum Bus Emas tidak mengubah hasil ekonomi', () => {
    // 10 detik: 8 penumpang utuh (uang masuk per tiket), sama dengan laju × waktu.
    const a = tick(stateOtomatis(), 10);
    expect(a.uang.toNumber()).toBeCloseTo(20 + 10 * pendapatanPerDetikState(stateOtomatis()).toNumber(), 9);
  });
});
