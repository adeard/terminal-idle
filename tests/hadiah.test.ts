import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { EKONOMI } from '../src/config/economy.config';
import { terapkanAksi } from '../src/sim/aksi';
import type { PoId } from '../src/sim/fitur';
import { xpLevelPo } from '../src/sim/mitra';
import { deserialisasi, serialisasi } from '../src/sim/save';
import {
  acuanHarian,
  aktifkanBoost,
  bisaAktifkanBoost,
  bisaKlaimBonusOffline,
  bisaPercepatProyek,
  busEmasAktif,
  cariPo,
  hadiahBusEmas,
  hadiahMenit,
  hadiahTantangan,
  keuanganSekarang,
  klaimBonusOffline,
  klaimBusEmas,
  klaimTantangan,
  levelPo,
  mulaiPerluasan,
  paketHadiah,
  pengaliBoost,
  perbaruiTantangan,
  percepatProyek,
  poArmada,
  terapkanOffline,
  tick,
  type GameState,
} from '../src/sim/state';
import { formatUang } from '../src/ui/format';
import { buatModel } from '../src/ui/model';
import { labelGandaTarget, NAMA_PO, TEKS, teksBagianLevel, teksPaket } from '../src/ui/teks';
import { denganLevelTerminal, denganNilaiKontrak, denganPetugas, denganPo, jalankan, kaya, stateOtomatis, T0 } from './helpers';

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

describe('paket hadiah: uang, armada PO, percepat proyek (documents/15 bagian 4, AC-GP-07)', () => {
  const xp = (s: GameState, id: PoId): number => cariPo(s, id)!.xp;
  /** Dua PO: ondelOndel Lv 5, peuyeumKilat Lv 3 (tepat di awal levelnya). */
  const duaPo = (): GameState => denganPo(denganPo(stateOtomatis(), 'ondelOndel', { level: 5 }), 'peuyeumKilat', { level: 3, loket: 2 });
  const targetSelesai = (s: GameState): GameState => ({ ...s, harian: { ...s.harian, progres: s.harian.target + 1 } });
  const denganProyek = (s: GameState, sisa: number): GameState => ({ ...s, perkembangan: { ...s.perkembangan, proyekDetik: sisa } });

  it('poArmada: PO berlevel terendah; seri = penumpang rata-rata sehari terbanyak, lalu yang lebih dulu terdaftar; tanpa PO = null', () => {
    expect(poArmada(stateOtomatis())).toBe('ondelOndel');
    expect(poArmada(duaPo())).toBe('peuyeumKilat');
    // Deterministik: state yang sama, PO yang sama.
    expect(poArmada(duaPo())).toBe(poArmada(duaPo()));
    const seri = denganPo(duaPo(), 'ondelOndel', { level: 3 });
    const arus = acuanHarian(seri).arusPo;
    expect(arus[0]).not.toBeCloseTo(arus[1]!, 6);
    expect(poArmada(seri)).toBe(arus[1]! > arus[0]! ? 'peuyeumKilat' : 'ondelOndel');
    const tanpa = { ...stateOtomatis(), mitra: { ...stateOtomatis().mitra, terdaftar: [] } };
    expect(poArmada(tanpa)).toBeNull();
    expect(paketHadiah(tanpa, 'harian').armada).toBeNull();
  });

  it('isi paket per sumber: target harian +50 % (& percepat 6 menit bila ada proyek), tantangan +1 level, Bus Emas +25 %', () => {
    const s = duaPo();
    expect(paketHadiah(s, 'harian')).toEqual({ uang: hadiahMenit(s, EKONOMI.harian.hadiahMenit), armada: { po: 'peuyeumKilat', bagian: H.armadaHarian }, percepatDetik: 0 });
    expect(paketHadiah(denganProyek(s, 1000), 'harian').percepatDetik).toBe(H.percepatDetik);
    expect(paketHadiah(s, 'tantangan')).toEqual({ uang: hadiahTantangan(s), armada: { po: 'peuyeumKilat', bagian: H.armadaTantangan }, percepatDetik: 0 });
    expect(paketHadiah(denganProyek(s, 1000), 'tantangan').percepatDetik).toBe(0);
    expect(paketHadiah(s, 'busEmas')).toEqual({ uang: hadiahBusEmas(s), armada: { po: 'peuyeumKilat', bagian: H.armadaBusEmas }, percepatDetik: 0 });
    expect([H.armadaHarian, H.armadaTantangan, H.armadaBusEmas, H.percepatDetik, H.percepatSisaMinDetik]).toEqual([0.5, 1, 0.25, 360, 720]);
  });

  it('klaim target: armada menaikkan XP PO yang tertulis di baris hadiah sebelum klaim; klaim 2× menggandakan seluruh paket', () => {
    const s = denganProyek(targetSelesai(duaPo()), 1440);
    const paket = buatModel(s).target.paket;
    expect(paket.armada?.po).toBe('peuyeumKilat');
    const perlu = xpLevelPo(3);
    const biasa = terapkanAksi(s, { jenis: 'klaimTarget' });
    expect(biasa.kas - s.kas).toBeCloseTo(paket.uang, 6);
    expect(xp(biasa, 'peuyeumKilat') - xp(s, 'peuyeumKilat')).toBeCloseTo(perlu * 0.5, 6);
    expect(xp(biasa, 'ondelOndel')).toBe(xp(s, 'ondelOndel'));
    expect(biasa.perkembangan.proyekDetik).toBe(1440 - 360);
    const ganda = terapkanAksi(s, { jenis: 'klaimTarget', ganda: true });
    expect(ganda.kas - s.kas).toBeCloseTo(paket.uang * 2, 6);
    expect(xp(ganda, 'peuyeumKilat') - xp(s, 'peuyeumKilat')).toBeCloseTo(perlu, 6);
    expect(levelPo(cariPo(ganda, 'peuyeumKilat')!)).toBe(4);
    expect(ganda.perkembangan.proyekDetik).toBe(1440 - 720);
    // Percepat dari target harian boleh menyelesaikan proyek yang tinggal sebentar.
    const hampir = terapkanAksi(denganProyek(targetSelesai(duaPo()), 200), { jenis: 'klaimTarget' });
    expect(hampir.perkembangan).toMatchObject({ proyekDetik: 0, perluasan: duaPo().perkembangan.perluasan + 1 });
  });

  it('klaim tantangan: armada satu level penuh; kiriman otomatis tantangan minggu lalu ikut membawa armada', () => {
    const RABU = Date.UTC(2026, 8, 30, 5);
    let s = perbaruiTantangan(denganPo(stateOtomatis(), 'ondelOndel', { level: 2 }), RABU);
    s = { ...s, tantangan: { ...s.tantangan, daftar: s.tantangan.daftar.map((x) => ({ ...x, progres: x.target })) } };
    const satu = klaimTantangan(s, 0);
    expect(levelPo(cariPo(satu, 'ondelOndel')!)).toBe(3);
    expect(xp(satu, 'ondelOndel') - xp(s, 'ondelOndel')).toBeCloseTo(xpLevelPo(2), 6);
    // Dua sisanya tidak diklaim: dikirim saat minggu berganti, masing-masing satu level.
    const minggu2 = perbaruiTantangan(satu, RABU + 7 * 86_400_000);
    expect(levelPo(cariPo(minggu2, 'ondelOndel')!)).toBe(5);
  });

  it('Bus Emas: uang & armada +25 % untuk PO di popup', () => {
    let s = jalankan(duaPo(), H.busEmasSelangDetik[0] + 1);
    expect(busEmasAktif(s)).toBe(true);
    const paket = paketHadiah(s, 'busEmas');
    s = terapkanAksi(s, { jenis: 'tahanBusEmas' });
    const b = terapkanAksi(s, { jenis: 'klaimBusEmas' });
    expect(b.kas - s.kas).toBeCloseTo(paket.uang, 6);
    expect(xp(b, paket.armada!.po) - xp(s, paket.armada!.po)).toBeCloseTo(xpLevelPo(levelPo(cariPo(s, paket.armada!.po)!)) * 0.25, 6);
  });

  it('teks paket & Bus Emas menulis armada dalam level (playtest P-2, AC-GP-20); toast armada tetap persen bilah', () => {
    const s = duaPo();
    const po = NAMA_PO.peuyeumKilat.nama;
    expect([1, 0.5, 0.25, 0.75, 2].map(teksBagianLevel)).toEqual(['1', '½', '¼', '75%', '2']);
    expect(teksPaket(paketHadiah(s, 'harian'))).toBe(`+${formatUang(hadiahMenit(s, EKONOMI.harian.hadiahMenit))} · 🚌 ${po} +½ level`);
    expect(teksPaket(paketHadiah(denganProyek(s, 1000), 'harian'))).toBe(`+${formatUang(hadiahMenit(s, EKONOMI.harian.hadiahMenit))} · 🚌 ${po} +½ level · 🏗️ −6 mnt`);
    expect(teksPaket(paketHadiah(s, 'tantangan'))).toBe(`+${formatUang(hadiahTantangan(s))} · 🚌 ${po} +1 level`);
    const emas = paketHadiah(s, 'busEmas').armada!;
    expect(TEKS.busEmasTeks('Rp 2,4 jt', po, teksBagianLevel(emas.bagian))).toBe(`Bus istimewa membawa rombongan. Tonton iklan untuk Rp 2,4 jt dan armada baru ${po} (+¼ level).`);
    expect(TEKS.notifArmada(po, 0, 50, 4)).toBe(`🚌 Armada baru ${po}: 0% → 50% menuju Lv 4`);
  });

  it('tombol 2× target "2× semua" bila paket berisi armada atau percepat (playtest P-1, AC-GP-19); uang saja tetap "2×"', () => {
    const s = targetSelesai(duaPo());
    expect(labelGandaTarget(buatModel(s).target.paket)).toBe('2× semua');
    const tanpaPo = targetSelesai({ ...stateOtomatis(), mitra: { ...stateOtomatis().mitra, terdaftar: [] } });
    expect(labelGandaTarget(buatModel(tanpaPo).target.paket)).toBe('2×');
    expect(labelGandaTarget(buatModel(denganProyek(tanpaPo, 1000)).target.paket)).toBe('2× semua');
    expect([TEKS.klaimGanda, TEKS.klaimGandaPaket]).toEqual(['2×', '2× semua']);
  });
});

describe('percepat proyek lewat iklan (documents/15 bagian 4.2, AC-GP-08)', () => {
  it('−360 detik per aksi, hanya bila sisa > 720 detik: paling banyak dua kali per proyek', () => {
    const p = mulaiPerluasan(kaya(denganLevelTerminal(stateOtomatis(), EKONOMI.mitra.perluasan[0]!.level)));
    expect(p.perkembangan.proyekDetik).toBe(EKONOMI.mitra.detikProyek);
    expect(bisaPercepatProyek(p)).toBe(true);
    let s = p;
    let n = 0;
    while (bisaPercepatProyek(s)) {
      s = terapkanAksi(s, { jenis: 'percepatProyek' });
      n++;
    }
    expect(n).toBe(2);
    expect(s.perkembangan.proyekDetik).toBe(EKONOMI.mitra.detikProyek - 2 * H.percepatDetik);
    expect(terapkanAksi(s, { jenis: 'percepatProyek' })).toBe(s);
    expect(percepatProyek(stateOtomatis())).toEqual(stateOtomatis());
    // Tanpa peristiwa analitik baru (tercatat lewat iklan_hadiah, tempat percepatProyek).
    expect(peristiwaAksi({ jenis: 'percepatProyek' }, p, terapkanAksi(p, { jenis: 'percepatProyek' }))).toEqual([]);
  });

  it('model kartu perluasan: tombol percepat sah hanya selama sisa proyek > 12 menit', () => {
    const p = mulaiPerluasan(kaya(denganLevelTerminal(stateOtomatis(), EKONOMI.mitra.perluasan[0]!.level)));
    expect(buatModel(p).terminal.perluasan.proyek?.bisaPercepat).toBe(true);
    expect(buatModel(jalankan(p, EKONOMI.mitra.detikProyek - H.percepatSisaMinDetik - 1)).terminal.perluasan.proyek?.bisaPercepat).toBe(true);
    expect(buatModel(jalankan(p, EKONOMI.mitra.detikProyek - H.percepatSisaMinDetik + 1)).terminal.perluasan.proyek?.bisaPercepat).toBe(false);
    expect(buatModel(stateOtomatis()).terminal.perluasan.proyek).toBeNull();
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
