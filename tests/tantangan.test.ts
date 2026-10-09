import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { KUNCI_SAVE, SesiGame, slotLokal, type Penyimpanan } from '../src/app/sesi';
import { EKONOMI } from '../src/config/economy.config';
import { WAKTU } from '../src/config/waktu.config';
import { terapkanAksi } from '../src/sim/aksi';
import { tengahMalamWib } from '../src/sim/event';
import { deserialisasi, serialisasi } from '../src/sim/save';
import {
  aturTarif,
  bangun,
  beliTeknologi,
  bisaKlaimTantangan,
  hadiahTantangan,
  kepuasanTerminal,
  klaimTantangan,
  perbaruiTantangan,
  tandaiWaktu,
  type GameState,
} from '../src/sim/state';
import { JENIS_TANTANGAN, jenisTantanganMinggu, mingguWib } from '../src/sim/tantangan';
import { buatModel } from '../src/ui/model';
import { denganBangunan, denganPetugas, denganPo, jalankan, kaya, padaJam, stateOtomatis } from './helpers';

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
