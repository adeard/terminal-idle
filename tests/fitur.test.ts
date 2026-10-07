import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { WAKTU } from '../src/config/waktu.config';
import { terapkanAksi } from '../src/sim/aksi';
import { FASILITAS_IDS, KELAS_BUS_IDS, PENCAPAIAN_IDS, TEKNOLOGI_IDS, type FasilitasId } from '../src/sim/fitur';
import { deserialisasi, serialisasi } from '../src/sim/save';
import {
  bangunFasilitas,
  belanjaKiosPerPenumpang,
  beliKelasBus,
  bukaJalur,
  beliTeknologi,
  biayaFasilitas,
  bisaBeliTeknologi,
  bukaJurusan,
  buatStateBaru,
  hadiahMenit,
  hitungOffline,
  kapasitasTahap,
  klaimPencapaian,
  klaimTarget,
  lakukanPrestige,
  multJurusan,
  nilaiPerPenumpangState,
  pendapatanLangsungPerDetik,
  pendapatanPerDetikState,
  pengaliKepuasan,
  rincianPendapatan,
  tandaiWaktu,
  throughputState,
  tick,
  type GameState,
} from '../src/sim/state';
import { jalankan, stateOtomatis, T0 } from './helpers';

const kaya = (s: GameState, uang = 1e12): GameState => ({ ...s, uang: new Decimal(uang) });
/** Detik main sampai pukul 00.00 hari ke-`hari` (hari 0 dimulai pukul jamAwal). */
const detikKeHari = (hari: number): number => (hari * 24 - WAKTU.jamAwal) * WAKTU.detikPerJam;

describe('fasilitas penunjang', () => {
  it('belum dibangun di game baru; tiap level menaikkan pendapatan, biaya naik eksponensial', () => {
    let s = kaya(stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 }));
    for (const id of FASILITAS_IDS) expect(s.terminal.fasilitas[id]).toBe(0);
    const awal = pendapatanPerDetikState(s).toNumber();
    expect(biayaFasilitas(s, 'kios').toNumber()).toBe(EKONOMI.fasilitas.kios.biayaAwal);
    s = bangunFasilitas(s, 'kios');
    s = bangunFasilitas(s, 'kios');
    expect(s.terminal.fasilitas.kios).toBe(2);
    expect(biayaFasilitas(s, 'kios').toNumber()).toBeCloseTo(EKONOMI.fasilitas.kios.biayaAwal * EKONOMI.fasilitas.kios.r ** 2, 6);
    // Kios tidak menaikkan harga tiket; belanja penumpangnya jadi sewa harian.
    expect(nilaiPerPenumpangState(s)).toBeCloseTo(EKONOMI.nilaiPerPenumpang, 10);
    expect(belanjaKiosPerPenumpang(s)).toBeCloseTo(2 * EKONOMI.fasilitas.kios.nilaiPerLevel, 10);
    expect(pendapatanPerDetikState(s).toNumber()).toBeGreaterThan(awal);
  });

  it('uang kurang → tidak berubah; ikut dihitung saat offline', () => {
    const miskin = { ...stateOtomatis(), uang: new Decimal(10) };
    expect(bangunFasilitas(miskin, 'retribusi')).toBe(miskin);
    const s = tandaiWaktu(bangunFasilitas(kaya(stateOtomatis()), 'parkir'), T0);
    const tanpa = tandaiWaktu(kaya(stateOtomatis()), T0);
    expect(hitungOffline(s, T0 + 3_600_000).pendapatan.gt(hitungOffline(tanpa, T0 + 3_600_000).pendapatan)).toBe(true);
  });
});

describe('sumber pendapatan: tiket, retribusi bus, parkir, sewa kios harian', () => {
  const dengan = (s: GameState, f: Partial<Record<FasilitasId, number>>): GameState => ({ ...s, terminal: { ...s.terminal, fasilitas: { ...s.terminal.fasilitas, ...f } } });
  const dasar = stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 });
  const arus = throughputState(dasar);

  it('tanpa fasilitas hanya tiket: sama dengan rumus lama (arus × harga tiket)', () => {
    const r = rincianPendapatan(dasar);
    expect(r.tiket.toNumber()).toBeCloseTo(arus * EKONOMI.nilaiPerPenumpang, 9);
    for (const x of [r.retribusi, r.parkir, r.sewaKios]) expect(x.toNumber()).toBe(0);
    expect(pendapatanPerDetikState(dasar).toNumber()).toBeCloseTo(arus * EKONOMI.nilaiPerPenumpang, 9);
  });

  it('retribusi dihitung per bus yang parkir; parkir per penumpang; toilet & musholla tidak menghasilkan uang', () => {
    const r = rincianPendapatan(dengan(dasar, { retribusi: 2, parkir: 3 }));
    expect(r.retribusi.toNumber()).toBeCloseTo((arus / EKONOMI.penumpangPerBus) * 2 * EKONOMI.fasilitas.retribusi.nilaiPerLevel, 9);
    expect(r.parkir.toNumber()).toBeCloseTo(arus * 3 * EKONOMI.fasilitas.parkir.nilaiPerLevel, 9);
    // Toilet tidak menghasilkan uang sendiri (paling-paling lewat bonus kepuasan, yang dikeluarkan di sini)...
    const langsung = (st: GameState): number => pendapatanPerDetikState(st).toNumber() / pengaliKepuasan(st);
    const hanyaToilet = dengan(dasar, { toilet: 5 });
    expect(langsung(hanyaToilet)).toBeCloseTo(langsung(dasar), 9);
    // ...tapi menaikkan belanja di kios (sewa).
    const kios = dengan(dasar, { kios: 2 });
    const kiosToilet = dengan(dasar, { kios: 2, toilet: 3 });
    const sewa = (st: GameState): number => rincianPendapatan(st).sewaKios.toNumber() / pengaliKepuasan(st);
    expect(sewa(kiosToilet)).toBeCloseTo(sewa(kios) * (1 + 3 * EKONOMI.fasilitas.toilet.nilaiPerLevel), 9);
  });

  it('belanja kios terkumpul sepanjang hari, dibayar sekaligus saat hari berganti', () => {
    let s = dengan(dasar, { kios: 3 });
    const sewaPerDetik = rincianPendapatan(s).sewaKios.toNumber();
    const langsung = pendapatanLangsungPerDetik(s).toNumber();
    const sampaiTengahMalam = detikKeHari(1) - s.statistik.waktuMainDetik;
    const detik = Math.floor(sampaiTengahMalam) - 1;
    const awal = s.uang.toNumber();
    s = jalankan(s, detik);
    // Belum tengah malam: uang hanya bertambah dari tiket (tanpa sewa kios). Keduanya ikut
    // penumpang yang datang (malam lebih sepi), jadi perbandingannya tetap.
    const masuk = s.uang.toNumber() - awal;
    expect(masuk).toBeLessThanOrEqual(langsung * detik + 1e-6);
    expect(masuk).toBeGreaterThan(langsung * detik * 0.9);
    expect(s.sewaKios.terkumpul.toNumber() / masuk).toBeCloseTo(sewaPerDetik / langsung, 9);
    const terkumpul = s.sewaKios.terkumpul;
    const sebelum = s.uang;
    s = jalankan(s, 2);
    expect(s.sewaKios.hariTerakhir).toBe(0);
    expect(s.sewaKios.terakhir.toNumber()).toBeGreaterThanOrEqual(terkumpul.toNumber());
    expect(s.uang.sub(sebelum).toNumber()).toBeGreaterThan(terkumpul.toNumber());
    expect(s.sewaKios.terkumpul.toNumber()).toBeLessThan(sewaPerDetik * 2);
  });

  it('boost 2× ikut menggandakan belanja kios; sewa yang terkumpul ikut tersimpan', () => {
    const s = dengan(dasar, { kios: 2 });
    const biasa = jalankan(s, 10).sewaKios.terkumpul.toNumber();
    const boost = jalankan({ ...s, hadiah: { ...s.hadiah, boostDetik: 100 } }, 10).sewaKios.terkumpul.toNumber();
    expect(boost).toBeCloseTo(biasa * EKONOMI.hadiah.pengaliBoost, 6);
    const tersimpan = jalankan(s, 10);
    const dimuat = deserialisasi(serialisasi(tersimpan), T0);
    expect(dimuat.sewaKios.terkumpul.toNumber()).toBeCloseTo(tersimpan.sewaKios.terkumpul.toNumber(), 9);
  });
});

describe('jurusan', () => {
  it('mulai dengan jurusan awal; dibuka berurutan, tiket makin mahal; berhenti di jurusan terakhir', () => {
    let s = kaya(buatStateBaru(T0));
    expect(s.terminal.jurusanBuka).toBe(EKONOMI.jurusanAwal);
    expect(multJurusan(s)).toBe(1);
    const uangAwal = s.uang;
    s = bukaJurusan(s);
    expect(s.terminal.jurusanBuka).toBe(EKONOMI.jurusanAwal + 1);
    expect(uangAwal.sub(s.uang).toNumber()).toBe(EKONOMI.jurusan[EKONOMI.jurusanAwal]!.biaya);
    expect(multJurusan(s)).toBeCloseTo(1 + EKONOMI.jurusan[EKONOMI.jurusanAwal]!.bonusTiket, 10);
    // Rute antarpulau terakhir butuh Terminal Terpadu (dan uang ±Rp 1,3 T).
    s = kaya({ ...s, prestige: { ...s.prestige, jumlahReset: 3 } }, 1e15);
    for (let i = 0; i < 30; i++) s = bukaJurusan(s);
    expect(s.terminal.jurusanBuka).toBe(EKONOMI.jurusan.length);
    const semua = EKONOMI.jurusan.reduce((a, j) => a + j.bonusTiket, 1);
    expect(multJurusan(s)).toBeCloseTo(semua, 10);
    expect(bukaJurusan(s)).toBe(s);
  });
});

describe('modernisasi', () => {
  it('butuh teknologi pendahulu; menambah kapasitas tahapnya saja; sekali beli', () => {
    let s = kaya(stateOtomatis({ peron: 5, loket: 5, keberangkatan: 5 }));
    expect(bisaBeliTeknologi(s, 'eTiket')).toBe(false); // butuh mesinTiket
    const loketAwal = kapasitasTahap(s, 'loket');
    const peronAwal = kapasitasTahap(s, 'peron');
    s = beliTeknologi(s, 'mesinTiket');
    expect(kapasitasTahap(s, 'loket')).toBeCloseTo(loketAwal * EKONOMI.teknologi.mesinTiket.multKapasitas, 10);
    expect(kapasitasTahap(s, 'peron')).toBe(peronAwal);
    expect(beliTeknologi(s, 'mesinTiket')).toBe(s);
    s = beliTeknologi(s, 'eTiket');
    expect(kapasitasTahap(s, 'loket')).toBeCloseTo(loketAwal * EKONOMI.teknologi.mesinTiket.multKapasitas * EKONOMI.teknologi.eTiket.multKapasitas, 10);
    for (const id of TEKNOLOGI_IDS) s = beliTeknologi(s, id);
    for (const id of TEKNOLOGI_IDS) expect(s.terminal.teknologi[id]).toBe(true);
  });
});

describe('target harian', () => {
  it('hari pertama: lakukan N upgrade; selesai bisa diklaim sekali (hadiah = beberapa menit pendapatan)', () => {
    let s = kaya(stateOtomatis({ peron: 5, loket: 5, keberangkatan: 5 }), 1e9);
    expect(s.harian).toMatchObject({ hariKe: 0, jenis: 'upgrade', target: EKONOMI.harian.targetUpgrade, progres: 0 });
    expect(klaimTarget(s)).toBe(s);
    for (let i = 0; i < EKONOMI.harian.targetUpgrade; i++) s = terapkanAksi(s, { jenis: 'upgrade', tahap: 'loket' });
    expect(s.harian.progres).toBe(EKONOMI.harian.targetUpgrade);
    expect(s.harian.jumlahSelesai).toBe(1);
    const hadiah = hadiahMenit(s, EKONOMI.harian.hadiahMenit);
    expect(hadiah.toNumber()).toBeCloseTo(pendapatanPerDetikState(s).toNumber() * 60 * EKONOMI.harian.hadiahMenit, -1);
    const diklaim = klaimTarget(s);
    expect(diklaim.uang.sub(s.uang).eq(hadiah)).toBe(true);
    expect(klaimTarget(diklaim)).toBe(diklaim);
  });

  it('berganti tiap hari terminal: hari ganjil memberangkatkan N penumpang (dari arus), maju lewat tick', () => {
    let s = stateOtomatis({ peron: 20, loket: 20, keberangkatan: 20 });
    s = { ...s, statistik: { ...s.statistik, waktuMainDetik: detikKeHari(1) - 0.05 } };
    s = tick(s, 0.1);
    expect(s.harian.hariKe).toBe(1);
    expect(s.harian.jenis).toBe('penumpang');
    expect(s.harian.target).toBeGreaterThan(1000);
    const awal = s.harian.progres;
    const penumpangAwal = s.statistik.totalPenumpang;
    s = jalankan(s, 10);
    // Progres = penumpang yang benar-benar berangkat; tengah malam lebih sepi dari kapasitas.
    expect(s.harian.progres - awal).toBeCloseTo(s.statistik.totalPenumpang - penumpangAwal, 6);
    expect(s.harian.progres - awal).toBeGreaterThan(0);
    expect(s.harian.progres - awal).toBeLessThan(throughputState(s) * 10);
    expect(s.statistik.totalPenumpang).toBeGreaterThan(s.harian.progres);
  });
});

describe('pencapaian', () => {
  it('tercatat otomatis saat syarat terpenuhi, hadiah diklaim sekali', () => {
    let s = tick(stateOtomatis(), 0.1);
    expect(s.pencapaian.tercapai).toContain('kepalaPertama');
    expect(s.pencapaian.tercapai).toContain('semuaOtomatis');
    expect(s.pencapaian.tercapai).not.toContain('level25');
    const k = klaimPencapaian(s, 'kepalaPertama');
    expect(k.uang.gt(s.uang)).toBe(true);
    expect(klaimPencapaian(k, 'kepalaPertama')).toBe(k);
    expect(klaimPencapaian(k, 'level25')).toBe(k);
    s = tick(bangunFasilitas(kaya(s), 'toilet'), 0.1);
    expect(s.pencapaian.tercapai).toContain('fasilitasPertama');
  });

  it('semua pencapaian bisa diraih', () => {
    let s = kaya(stateOtomatis({ peron: 100, loket: 100, keberangkatan: 100 }), 1e15);
    // Terminal Terpadu: semua rute antarpulau & kelas bus bisa dibuka.
    s = { ...s, prestige: { ...s.prestige, jumlahReset: 3 } };
    for (const id of FASILITAS_IDS) for (let i = 0; i < 10; i++) s = bangunFasilitas(s, id);
    for (let i = 0; i < 30; i++) s = bukaJurusan(s);
    for (let i = 0; i < 10; i++) s = bukaJalur(s);
    for (const id of TEKNOLOGI_IDS) s = beliTeknologi(s, id);
    s = {
      ...s,
      statistik: { ...s.statistik, totalPenumpang: 1e7, waktuMainDetik: detikKeHari(7) + 1 },
      harian: { ...s.harian, jumlahSelesai: 1 },
    };
    for (const id of KELAS_BUS_IDS) s = beliKelasBus(s, id);
    s = tick(s, 0.1);
    expect([...s.pencapaian.tercapai].sort()).toEqual([...PENCAPAIAN_IDS].sort());
  });
});

describe('prestige & save', () => {
  it('prestige mengosongkan fasilitas, jurusan, modernisasi; pencapaian tetap', () => {
    let s = kaya(stateOtomatis());
    s = tick(bukaJurusan(beliTeknologi(bangunFasilitas(s, 'kios'), 'mesinTiket')), 0.1);
    s = { ...s, statistik: { ...s.statistik, totalPendapatanRun: new Decimal(1e6) } };
    const p = lakukanPrestige(s);
    expect(p.terminal.fasilitas.kios).toBe(0);
    expect(p.terminal.jurusanBuka).toBe(EKONOMI.jurusanAwal);
    expect(p.terminal.teknologi.mesinTiket).toBe(false);
    expect(p.pencapaian).toEqual(s.pencapaian);
  });

  it('round-trip save; save lama tanpa blok fitur dimuat dengan nilai awal', () => {
    let s = kaya(stateOtomatis({ peron: 30, loket: 30, keberangkatan: 30 }));
    s = tick(bukaJurusan(beliTeknologi(bangunFasilitas(bangunFasilitas(s, 'parkir'), 'parkir'), 'jadwalDigital')), 0.1);
    s = klaimPencapaian(s, 'semuaOtomatis');
    const hasil = deserialisasi(serialisasi(s), 0);
    expect(hasil.terminal.fasilitas).toEqual(s.terminal.fasilitas);
    expect(hasil.terminal.jurusanBuka).toBe(s.terminal.jurusanBuka);
    expect(hasil.terminal.teknologi).toEqual(s.terminal.teknologi);
    expect(hasil.harian).toEqual(s.harian);
    expect(hasil.pencapaian).toEqual(s.pencapaian);
    expect(hasil.statistik.totalPenumpang).toBe(s.statistik.totalPenumpang);

    const lama = JSON.parse(serialisasi(s)) as Record<string, unknown>;
    const terminal = lama['terminal'] as Record<string, unknown>;
    delete terminal['fasilitas'];
    delete terminal['jurusanBuka'];
    delete terminal['teknologi'];
    delete lama['harian'];
    delete lama['pencapaian'];
    const dimuat = deserialisasi(JSON.stringify(lama), 0);
    expect(dimuat.terminal.fasilitas.parkir).toBe(0);
    expect(dimuat.terminal.jurusanBuka).toBe(EKONOMI.jurusanAwal);
    expect(dimuat.pencapaian).toEqual({ tercapai: [], diklaim: [] });
  });
});
