import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { KUNCI_SAVE, SesiGame, slotLokal, type Penyimpanan } from '../src/app/sesi';
import { EKONOMI } from '../src/config/economy.config';
import { WAKTU } from '../src/config/waktu.config';
import { terapkanAksi } from '../src/sim/aksi';
import { tengahMalamWib } from '../src/sim/event';
import { deserialisasi, serialisasi, VERSI_SKEMA } from '../src/sim/save';
import {
  acuanHarian,
  ambangKepuasan,
  aturTarif,
  bangun,
  beliTeknologi,
  bisaKlaimTantangan,
  buatStateBaru,
  buatTargetHarian,
  daftarPo,
  DETIK_SEHARI,
  hadiahTantangan,
  kepuasanTerminal,
  keuanganSekarang,
  klaimTantangan,
  kontrakPerJam,
  labaDenganKontrak,
  perbaruiTantangan,
  perpanjangPo,
  putusPo,
  tandaiWaktu,
  tick,
  type GameState,
} from '../src/sim/state';
import { JENIS_TANTANGAN, jenisTantanganMinggu, mingguWib } from '../src/sim/tantangan';
import { buatModel } from '../src/ui/model';
import { TEKS } from '../src/ui/teks';
import { denganBangunan, denganNilaiKontrak, denganPetugas, denganPo, jalankan, kaya, padaJam, stateOtomatis } from './helpers';

const wib = (tahun: number, bulan: number, tanggal: number, jam = 12): number => tengahMalamWib(tahun, bulan, tanggal) + jam * 3_600_000;
const RABU = wib(2026, 9, 30);

describe('minggu tantangan (WIB)', () => {
  it('Senin 00.00 WIB sampai Senin berikutnya', () => {
    const m = mingguWib(RABU);
    expect(m.kunci).toBe('2026-09-28');
    expect(m.mulaiMs).toBe(tengahMalamWib(2026, 9, 28));
    expect(m.selesaiMs - m.mulaiMs).toBe(7 * 86_400_000);
    expect(mingguWib(tengahMalamWib(2026, 9, 28)).kunci).toBe('2026-09-28');
    expect(mingguWib(tengahMalamWib(2026, 9, 28) - 1).kunci).toBe('2026-09-21');
    expect(mingguWib(wib(2026, 10, 4, 23.9)).kunci).toBe('2026-09-28');
    expect(mingguWib(tengahMalamWib(2026, 10, 5)).kunci).toBe('2026-10-05');
  });

  it('tiga jenis berbeda tiap minggu, tetap untuk minggu yang sama, bergilir antarminggu', () => {
    const set = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const kunci = mingguWib(RABU + i * 7 * 86_400_000).kunci;
      const jenis = jenisTantanganMinggu(kunci);
      expect(new Set(jenis).size).toBe(3);
      for (const j of jenis) expect(JENIS_TANTANGAN).toContain(j);
      expect(jenisTantanganMinggu(kunci)).toEqual(jenis);
      set.add([...jenis].sort().join(','));
    }
    expect(set.size).toBeGreaterThan(2);
  });
});

describe('tantangan mingguan di game', () => {
  const siap = (): GameState => kaya(denganPo(stateOtomatis({ jalur: 3 }), 'ondelOndel', { loket: 4 }));

  it('dimulai dari jam nyata dengan target sesuai terminal; minggu yang sama tidak berubah', () => {
    const s = perbaruiTantangan(siap(), RABU);
    expect(s.tantangan.minggu).toBe('2026-09-28');
    expect(s.tantangan.selesaiMs).toBe(mingguWib(RABU).selesaiMs);
    expect(s.tantangan.daftar.map((x) => x.jenis)).toEqual(jenisTantanganMinggu('2026-09-28'));
    for (const x of s.tantangan.daftar) {
      expect(x.target).toBeGreaterThan(0);
      expect(x.progres).toBe(0);
    }
    expect(perbaruiTantangan(s, RABU + 3_600_000)).toBe(s);
  });

  it('kemajuan tiap jenis: penumpang & laba dari main aktif, bangun, kepuasan', () => {
    const s = siap();
    const pakai = (dasar: GameState, jenis: (typeof JENIS_TANTANGAN)[number]): GameState => ({
      ...dasar,
      tantangan: { minggu: 'uji', selesaiMs: RABU, daftar: [{ jenis, target: 1e12, progres: 0, diklaim: false }], penumpang: 0 },
    });
    const kemajuan = (st: GameState): number => st.tantangan.daftar[0]!.progres;
    expect(kemajuan(jalankan(pakai(s, 'penumpang'), 10))).toBeGreaterThan(0);
    // Penumpang tidak membayar terminal: laba operasi dari retribusi bus.
    const laba = jalankan(pakai(denganPetugas(denganBangunan(s, { posRetribusi: 1 }), ['petugasRetribusi']), 'laba'), 10);
    expect(laba.statistik.totalPendapatan - laba.statistik.totalBiaya).toBeGreaterThan(0);
    expect(kemajuan(laba)).toBeCloseTo(laba.statistik.totalPendapatan - laba.statistik.totalBiaya, 3);
    expect(kemajuan(bangun(pakai(s, 'bangun'), 'kursi'))).toBe(1);
    expect(kemajuan(beliTeknologi(pakai(s, 'bangun'), 'mesinTiket'))).toBe(1);
    // Laba bisa turun lagi saat rugi, tidak di bawah nol.
    const rugi = aturTarif(denganPetugas(pakai(s, 'laba'), ['manajerOperasional', 'manajerKemitraan', 'satpam']), 'sewaLoket', 0);
    expect(kemajuan(jalankan(rugi, 10))).toBe(0);
    // Kepuasan: hanya bertambah selama kepuasan di atas batas.
    expect(kepuasanTerminal(s).nilai).toBeLessThan(EKONOMI.tantangan.kepuasanMin);
    expect(kemajuan(jalankan(pakai(s, 'kepuasan'), 10))).toBe(0);
    const puas = denganPetugas(denganBangunan(s, { kursi: 2, kios: 3, toilet: 1, lahanParkir: 1 }), ['kebersihan', 'kebersihan', 'satpam', 'satpam', 'satpam', 'petugasToilet']);
    expect(kepuasanTerminal(puas).nilai).toBeGreaterThanOrEqual(EKONOMI.tantangan.kepuasanMin);
    expect(kemajuan(jalankan(pakai(puas, 'kepuasan'), 10))).toBeCloseTo(10, 6);
  });

  it('klaim: hadiah uang sekali; hadiah yang lupa diklaim dikirim saat minggu berganti', () => {
    let s = perbaruiTantangan({ ...siap(), kas: 0 }, RABU);
    expect(bisaKlaimTantangan(s, 0)).toBe(false);
    s = { ...s, tantangan: { ...s.tantangan, daftar: s.tantangan.daftar.map((x) => ({ ...x, progres: x.target })) } };
    const hadiah = hadiahTantangan(s);
    expect(hadiah).toBeGreaterThan(0);
    const setelah = klaimTantangan(s, 0);
    expect(setelah.kas).toBeCloseTo(hadiah, 6);
    expect(klaimTantangan(setelah, 0)).toBe(setelah);
    // Dua sisanya belum diklaim: dikirim otomatis di minggu berikutnya.
    const minggu2 = perbaruiTantangan(setelah, RABU + 7 * 86_400_000);
    expect(minggu2.tantangan.minggu).toBe('2026-10-05');
    expect(minggu2.kas).toBeCloseTo(hadiah + 2 * hadiahTantangan(setelah), 3);
    expect(minggu2.tantangan.daftar.every((x) => x.progres === 0 && !x.diklaim)).toBe(true);
  });

  it('aksi, analitik, model & lencana klaim', () => {
    const s0 = perbaruiTantangan(siap(), RABU);
    const s = { ...s0, tantangan: { ...s0.tantangan, daftar: s0.tantangan.daftar.map((x, i) => (i === 1 ? { ...x, progres: x.target } : x)) } };
    const m = buatModel(s);
    expect(m.mingguan?.daftar[1]).toMatchObject({ selesai: true, diklaim: false, rasio: 1 });
    expect(m.jumlahKlaim).toBeGreaterThanOrEqual(1);
    const baru = terapkanAksi(s, { jenis: 'klaimTantangan', indeks: 1 });
    expect(baru.tantangan.daftar[1]!.diklaim).toBe(true);
    expect(peristiwaAksi({ jenis: 'klaimTantangan', indeks: 1 }, s, baru)).toEqual([{ nama: 'klaim_tantangan', data: { jenis: s.tantangan.daftar[1]!.jenis, minggu: '2026-09-28' } }]);
    expect(buatModel(baru).jumlahKlaim).toBe(m.jumlahKlaim - 1);
  });

  it('tersimpan; jenis yang tidak dikenal dibuang; save tanpa blok = belum dimulai', () => {
    const s = perbaruiTantangan(siap(), RABU);
    expect(deserialisasi(serialisasi(s), RABU).tantangan).toEqual(s.tantangan);
    const mentah = JSON.parse(serialisasi(s)) as { tantangan: { daftar: { jenis: string }[] } } & Record<string, unknown>;
    mentah.tantangan.daftar[0]!.jenis = 'upgrade';
    expect(deserialisasi(JSON.stringify(mentah), RABU).tantangan.daftar).toHaveLength(2);
    delete (mentah as Record<string, unknown>)['tantangan'];
    expect(deserialisasi(JSON.stringify(mentah), RABU).tantangan.minggu).toBeNull();
  });

  it('sesi memulai tantangan minggu ini dari jam dinding', async () => {
    const penyimpanan: Penyimpanan & { isi: Map<string, string> } = {
      isi: new Map(),
      async baca(k) {
        return this.isi.get(k) ?? null;
      },
      async tulis(k, v) {
        this.isi.set(k, v);
      },
      async hapus(k) {
        this.isi.delete(k);
      },
    };
    penyimpanan.isi.set(KUNCI_SAVE, serialisasi(tandaiWaktu(siap(), RABU - 60_000)));
    const { sesi } = await SesiGame.mulai({ slot: slotLokal(penyimpanan), jam: () => RABU });
    expect(sesi.pengendali.state.tantangan.minggu).toBe('2026-09-28');
  });
});

describe('saran 6: laba dirata-rata & ambang kepuasan (documents/15 bagian 5)', () => {
  /** Minggu yang mengundi kepuasan, laba, & penumpang. */
  const MINGGU = RABU + 14 * 86_400_000;
  const siap = (): GameState => kaya(denganPo(stateOtomatis({ jalur: 3 }), 'ondelOndel', { loket: 4 }));
  const tantanganUji = (s: GameState, jenis: (typeof JENIS_TANTANGAN)[number], ambang?: number): GameState => ({
    ...s,
    tantangan: { minggu: 'uji', selesaiMs: RABU, daftar: [{ jenis, target: 1e15, progres: 0, diklaim: false, ...(ambang !== undefined ? { ambang } : {}) }], penumpang: 0 },
  });
  const hariLaba = (s: GameState): GameState => ({ ...s, harian: { ...s.harian, jenis: 'laba', target: 1e15, progres: 0, diklaim: false } });
  const kemajuan = (s: GameState): number => s.tantangan.daftar[0]!.progres;

  it('kontrak yang dibayar sekaligus (daftar, perpanjang) tidak menambah kemajuan laba; kompensasi putus tidak menguranginya (AC-GP-09)', () => {
    const s = hariLaba(tantanganUji(stateOtomatis({}, 1e9), 'laba'));
    const daftar = daftarPo(s, 'peuyeumKilat');
    expect(daftar.kas).toBeGreaterThan(s.kas);
    expect(kemajuan(daftar)).toBe(0);
    expect(daftar.harian.progres).toBe(0);
    const tawaran = { ...daftar, mitra: { ...daftar.mitra, terdaftar: daftar.mitra.terdaftar.map((p) => ({ ...p, kontrakDetik: DETIK_SEHARI })) } };
    const perpanjang = perpanjangPo(tawaran, 'ondelOndel');
    expect(perpanjang.kas).toBeGreaterThan(tawaran.kas);
    expect(kemajuan(perpanjang)).toBe(0);
    expect(perpanjang.harian.progres).toBe(0);
    const berjalan = { ...daftar, tantangan: { ...daftar.tantangan, daftar: [{ ...daftar.tantangan.daftar[0]!, progres: 1e6 }] }, harian: { ...daftar.harian, progres: 1e6 } };
    const putus = putusPo(berjalan, 'peuyeumKilat');
    expect(putus.kas).toBeLessThan(berjalan.kas);
    expect(kemajuan(putus)).toBe(1e6);
    expect(putus.harian.progres).toBe(1e6);
  });

  it('kemajuan laba tiap tick = (laba operasi + kontrak PO per jam) × jam terminal, untuk tantangan & target harian (AC-GP-09)', () => {
    const s = hariLaba(tantanganUji(denganNilaiKontrak(siap(), 70_000_000), 'laba'));
    const perJam = keuanganSekarang(s).laba + kontrakPerJam(s);
    expect(kontrakPerJam(s)).toBeGreaterThan(0);
    expect(perJam).toBeGreaterThan(keuanganSekarang(s).laba);
    const dt = 1;
    const b = tick(s, dt);
    expect(kemajuan(b)).toBeCloseTo((perJam * dt) / WAKTU.detikPerJam, 3);
    expect(b.harian.progres).toBeCloseTo((perJam * dt) / WAKTU.detikPerJam, 3);
  });

  it('target harian laba = laba rata-rata sehari dengan kontrak × 12 jam (dibulatkan), paling sedikit batas bawah hadiah (AC-GP-09)', () => {
    const s = denganNilaiKontrak(siap(), 70_000_000);
    const a = acuanHarian(s);
    const perkiraan = Math.max(labaDenganKontrak(a), EKONOMI.hadiah.minPerMenit) * 24 * EKONOMI.harian.fraksiLaba;
    expect(labaDenganKontrak(a) * 12).toBeGreaterThan(EKONOMI.hadiah.minPerMenit * 12);
    const h = buatTargetHarian(s, 1);
    expect(h.jenis).toBe('laba');
    // Dibulatkan ke 2 angka penting.
    expect(h.target).toBeGreaterThanOrEqual(perkiraan * 0.95);
    expect(h.target).toBeLessThanOrEqual(perkiraan * 1.05);
    // Tanpa kontrak berjalan: batas bawahnya, seperti dulu.
    expect(buatTargetHarian(siap(), 1).target).toBe(Math.round(EKONOMI.hadiah.minPerMenit * 12));
  });

  it('ambang kepuasan: kepuasan awal minggu dibulatkan ke bawah ke 5 %, dijepit 50–75 % (AC-GP-10)', () => {
    expect(ambangKepuasan(0.28)).toBeCloseTo(0.5, 9);
    expect(ambangKepuasan(0.56)).toBeCloseTo(0.55, 9);
    expect(ambangKepuasan(0.91)).toBeCloseTo(0.75, 9);
    expect(ambangKepuasan(0.55)).toBeCloseTo(0.55, 9);
    expect(ambangKepuasan(0.6999)).toBeCloseTo(0.65, 9);
    expect(ambangKepuasan(0)).toBeCloseTo(0.5, 9);
    expect(ambangKepuasan(1)).toBeCloseTo(0.75, 9);
  });

  it('minggu baru: tantangan kepuasan mendapat ambang dari kepuasan saat itu (game baru 28 % → 50 %, 56 % → 55 %, 95 % → 75 %)', () => {
    expect(jenisTantanganMinggu(mingguWib(MINGGU).kunci)).toContain('kepuasan');
    const ambang = (s: GameState): number | undefined => perbaruiTantangan(s, MINGGU).tantangan.daftar.find((x) => x.jenis === 'kepuasan')?.ambang;
    const baru = buatStateBaru(MINGGU);
    expect(kepuasanTerminal(baru).nilai).toBeCloseTo(0.28, 2);
    expect(ambang(baru)).toBeCloseTo(0.5, 9);
    expect(kepuasanTerminal(siap()).nilai).toBeCloseTo(0.56, 2);
    expect(ambang(siap())).toBeCloseTo(0.55, 9);
    const puas = denganPetugas(denganBangunan(siap(), { kursi: 2, kios: 3, toilet: 1, lahanParkir: 1 }), ['kebersihan', 'kebersihan', 'satpam', 'satpam', 'satpam', 'petugasToilet']);
    expect(kepuasanTerminal(puas).nilai).toBeGreaterThan(0.9);
    expect(ambang(puas)).toBeCloseTo(0.75, 9);
    // Hanya tantangan kepuasan yang punya ambang.
    expect(perbaruiTantangan(siap(), MINGGU).tantangan.daftar.filter((x) => x.ambang !== undefined).map((x) => x.jenis)).toEqual(['kepuasan']);
  });

  it('kemajuan kepuasan bertambah selama kepuasan ≥ ambang tantangannya (bukan lagi 75 %)', () => {
    const s = siap();
    expect(kepuasanTerminal(s).nilai).toBeLessThan(EKONOMI.tantangan.kepuasanMin);
    expect(kemajuan(jalankan(tantanganUji(s, 'kepuasan', 0.55), 10))).toBeCloseTo(10, 6);
    expect(kemajuan(jalankan(tantanganUji(s, 'kepuasan', 0.6), 10))).toBe(0);
  });

  it('save: ambang tersimpan (skema tetap 3); save lama tanpa ambang atau ambang tidak sah dihitung ulang dari kepuasan saat dimuat (AC-GP-10)', () => {
    expect(VERSI_SKEMA).toBe(3);
    const s = perbaruiTantangan(siap(), MINGGU);
    const i = s.tantangan.daftar.findIndex((x) => x.jenis === 'kepuasan');
    expect(deserialisasi(serialisasi(s), MINGGU).tantangan).toEqual(s.tantangan);
    // Save lama (sebelum field ambang), dimuat saat kepuasan sudah 95 %: ambang dari kepuasan sekarang.
    const puas = denganPetugas(denganBangunan(s, { kursi: 2, kios: 3, toilet: 1, lahanParkir: 1 }), ['kebersihan', 'kebersihan', 'satpam', 'satpam', 'satpam', 'petugasToilet']);
    const mentah = (nilai: unknown): string => {
      const o = JSON.parse(serialisasi(puas)) as { tantangan: { daftar: Record<string, unknown>[] } };
      if (nilai === undefined) delete o.tantangan.daftar[i]!['ambang'];
      else o.tantangan.daftar[i]!['ambang'] = nilai;
      return JSON.stringify(o);
    };
    expect(JSON.parse(mentah(undefined)).tantangan.daftar[i]).not.toHaveProperty('ambang');
    for (const nilai of [undefined, 0.9, 0.3, 'x', null]) expect(deserialisasi(mentah(nilai), MINGGU).tantangan.daftar[i]!.ambang).toBeCloseTo(0.75, 9);
    // Ambang sah dipertahankan; field ambang di tantangan jenis lain dibuang.
    expect(deserialisasi(mentah(0.6), MINGGU).tantangan.daftar[i]!.ambang).toBe(0.6);
    const lain = JSON.parse(serialisasi(s)) as { tantangan: { daftar: Record<string, unknown>[] } };
    const j = s.tantangan.daftar.findIndex((x) => x.jenis !== 'kepuasan');
    lain.tantangan.daftar[j]!['ambang'] = 0.6;
    expect(deserialisasi(JSON.stringify(lain), MINGGU).tantangan.daftar[j]).not.toHaveProperty('ambang');
  });

  it('model: ambang & kepuasan kini di tantangan kepuasan, baris tantangan di popup kepuasan selama belum selesai (AC-GP-10)', () => {
    const s = perbaruiTantangan(siap(), MINGGU);
    const i = s.tantangan.daftar.findIndex((x) => x.jenis === 'kepuasan');
    const m = buatModel(s);
    expect(m.mingguan!.daftar[i]!.ambang).toBeCloseTo(0.55, 9);
    expect(m.mingguan!.daftar.filter((x) => x.jenis !== 'kepuasan').every((x) => x.ambang === null)).toBe(true);
    expect(m.mingguan!.kepuasanKini).toBeCloseTo(kepuasanTerminal(s).nilai, 9);
    expect(m.hud.kepuasan.tantangan).toEqual({ ambang: m.mingguan!.daftar[i]!.ambang, menit: 0, targetMenit: EKONOMI.tantangan.kepuasanDetik / 60 });
    const berjalan = jalankan(s, 90);
    expect(buatModel(berjalan).hud.kepuasan.tantangan).toMatchObject({ menit: 1 });
    const selesai = { ...s, tantangan: { ...s.tantangan, daftar: s.tantangan.daftar.map((x) => ({ ...x, progres: x.target })) } };
    expect(buatModel(selesai).hud.kepuasan.tantangan).toBeNull();
    expect(buatModel(siap()).hud.kepuasan.tantangan).toBeNull();
    // Teks (documents/15 bagian 5.2–5.3).
    expect(TEKS.tantanganKepuasan(55, 60)).toBe('Jaga kepuasan ≥ 55% selama 60 menit main');
    expect(TEKS.tantanganKepuasanKini(56)).toBe('kini 56% ›');
    expect(TEKS.kepuasanTantangan(55, 12, 60)).toBe('🎯 Tantangan: ≥ 55% · 12/60 menit main');
    expect(TEKS.tantanganCatatan).toBe('Tantangan baru tiap Senin (WIB). Laba dihitung seperti Laba/hari: kontrak PO dirata-rata.');
  });
});

describe('rekor pribadi', () => {
  it('hitungan hari ini, rekor harian saat hari berganti, arus tertinggi', () => {
    const dasar = stateOtomatis({ jalur: 3, posRetribusi: 1, lahanParkir: 1 }, 0, ['petugasRetribusi', 'juruParkir']);
    let s = jalankan(padaJam(kaya(denganPo(dasar, 'ondelOndel', { loket: 4 })), 22, 1), 60);
    expect(s.keuangan.hariIni.penumpang).toBeGreaterThan(0);
    expect(s.rekor.penumpangHarian).toBe(0);
    expect(s.rekor.arusTertinggi).toBeGreaterThan(0);
    const hariIni = s.keuangan.hariIni.penumpang;
    // Lewat tengah malam: hari yang lewat jadi rekor, hitungan mulai dari nol.
    s = jalankan(s, 2.2 * WAKTU.detikPerJam);
    expect(s.keuangan.hariIni.hariKe).toBe(2);
    expect(s.rekor.penumpangHarian).toBeGreaterThanOrEqual(hariIni);
    expect(s.rekor.labaHarian).toBeGreaterThan(0);
    expect(s.keuangan.hariIni.penumpang).toBeLessThan(s.rekor.penumpangHarian);
  });

  it('tersimpan; save tanpa blok mulai dari nol', () => {
    let s = jalankan(kaya(stateOtomatis()), 30);
    s = { ...s, rekor: { penumpangHarian: 12_345, labaHarian: 6_789, arusTertinggi: 99 } };
    expect(deserialisasi(serialisasi(s), RABU).rekor).toEqual(s.rekor);
    const mentah = JSON.parse(serialisasi(s)) as Record<string, unknown>;
    delete mentah['rekor'];
    expect(deserialisasi(JSON.stringify(mentah), RABU).rekor).toEqual({ penumpangHarian: 0, labaHarian: 0, arusTertinggi: 0 });
  });
});
