import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { KUNCI_SAVE, SesiGame, slotLokal, type Penyimpanan } from '../src/app/sesi';
import { EKONOMI } from '../src/config/economy.config';
import { WAKTU } from '../src/config/waktu.config';
import { terapkanAksi } from '../src/sim/aksi';
import { tengahMalamWib } from '../src/sim/event';
import { deserialisasi, serialisasi } from '../src/sim/save';
import {
  bangunFasilitas,
  beliUpgrade,
  bisaKlaimTantangan,
  bukaJalur,
  hadiahTantangan,
  kepuasanTerminal,
  klaimTantangan,
  renovasi,
  perbaruiTantangan,
  tandaiWaktu,
  tick,
  type GameState,
} from '../src/sim/state';
import { JENIS_TANTANGAN, jenisTantanganMinggu, mingguWib } from '../src/sim/tantangan';
import { buatModel } from '../src/ui/model';
import { jalankan, stateOtomatis } from './helpers';

const wib = (tahun: number, bulan: number, tanggal: number, jam = 12): number => tengahMalamWib(tahun, bulan, tanggal) + jam * 3_600_000;
const kaya = (s: GameState, uang = 1e12): GameState => ({ ...s, uang: new Decimal(uang) });
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
  const siap = (): GameState => kaya(stateOtomatis({ peron: 20, loket: 20, keberangkatan: 20 }));

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

  it('kemajuan tiap jenis: penumpang & pendapatan dari main aktif, upgrade, fasilitas, kepuasan', () => {
    let s = siap();
    const pakai = (jenis: (typeof JENIS_TANTANGAN)[number]): GameState => ({
      ...s,
      tantangan: { minggu: 'uji', selesaiMs: RABU, daftar: [{ jenis, target: 1e12, progres: 0, diklaim: false }], penumpang: 0 },
    });
    const kemajuan = (st: GameState): number => st.tantangan.daftar[0]!.progres;
    expect(kemajuan(jalankan(pakai('penumpang'), 10))).toBeGreaterThan(0);
    expect(kemajuan(jalankan(pakai('pendapatan'), 10))).toBeGreaterThan(0);
    expect(kemajuan(beliUpgrade(pakai('upgrade'), 'peron'))).toBe(1);
    expect(kemajuan(bangunFasilitas(pakai('fasilitas'), 'kios'))).toBe(1);
    // Kepuasan: hanya bertambah selama kepuasan di atas batas.
    expect(kepuasanTerminal(s).nilai).toBeLessThan(EKONOMI.tantangan.kepuasanMin);
    expect(kemajuan(jalankan(pakai('kepuasan'), 10))).toBe(0);
    s = kaya(stateOtomatis({ peron: 30, loket: 50, keberangkatan: 30 }));
    for (let i = 0; i < 12; i++) s = bangunFasilitas(bangunFasilitas(s, 'kios'), 'toilet');
    for (let i = 0; i < 5; i++) s = bukaJalur(s);
    expect(kepuasanTerminal(s).nilai).toBeGreaterThanOrEqual(EKONOMI.tantangan.kepuasanMin);
    expect(kemajuan(jalankan(pakai('kepuasan'), 10))).toBeCloseTo(10, 6);
  });

  it('klaim: hadiah uang sekali; hadiah yang lupa diklaim dikirim saat minggu berganti', () => {
    let s = perbaruiTantangan({ ...siap(), uang: new Decimal(0) }, RABU);
    expect(bisaKlaimTantangan(s, 0)).toBe(false);
    s = { ...s, tantangan: { ...s.tantangan, daftar: s.tantangan.daftar.map((x) => ({ ...x, progres: x.target })) } };
    const hadiah = hadiahTantangan(s).toNumber();
    expect(hadiah).toBeGreaterThan(0);
    const setelah = klaimTantangan(s, 0);
    expect(setelah.uang.toNumber()).toBeCloseTo(hadiah, 6);
    expect(klaimTantangan(setelah, 0)).toBe(setelah);
    // Dua sisanya belum diklaim: dikirim otomatis di minggu berikutnya.
    const minggu2 = perbaruiTantangan(setelah, RABU + 7 * 86_400_000);
    expect(minggu2.tantangan.minggu).toBe('2026-10-05');
    expect(minggu2.uang.toNumber()).toBeCloseTo(hadiah + 2 * hadiahTantangan(setelah).toNumber(), 3);
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

  it('tersimpan; jenis yang tidak dikenal dibuang; save lama tanpa blok = belum dimulai', () => {
    const s = perbaruiTantangan(siap(), RABU);
    expect(deserialisasi(serialisasi(s), RABU).tantangan).toEqual(s.tantangan);
    const mentah = JSON.parse(serialisasi(s)) as { tantangan: { daftar: { jenis: string }[] } } & Record<string, unknown>;
    mentah.tantangan.daftar[0]!.jenis = 'jenisMasaDepan';
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
  const sehari = 24 * WAKTU.detikPerJam;

  it('hitungan hari ini, rekor harian saat hari berganti, arus tertinggi', () => {
    let s = kaya(stateOtomatis({ peron: 20, loket: 20, keberangkatan: 20 }));
    s = jalankan(s, 60);
    expect(s.rekor.penumpangHariIni).toBeGreaterThan(0);
    expect(s.rekor.pendapatanHariIni).toBeGreaterThan(0);
    expect(s.rekor.penumpangHarian).toBe(0);
    expect(s.rekor.arusTertinggi).toBeGreaterThan(0);
    const hariIni = s.rekor.penumpangHariIni;
    // Lompat ke akhir hari: hari yang lewat jadi rekor, hitungan mulai dari nol.
    const hari = s.rekor.hariKe;
    s = { ...s, statistik: { ...s.statistik, waktuMainDetik: (hari + 1) * sehari - WAKTU.jamAwal * WAKTU.detikPerJam - 0.05 } };
    s = tick(s, 0.1);
    expect(s.rekor.hariKe).toBe(hari + 1);
    expect(s.rekor.penumpangHarian).toBeGreaterThanOrEqual(hariIni);
    expect(s.rekor.penumpangHariIni).toBeLessThan(hariIni);
  });

  it('tetap walau naik kelas & tersimpan', () => {
    let s = jalankan(kaya(stateOtomatis({ peron: 20, loket: 20, keberangkatan: 20 })), 30);
    s = { ...s, rekor: { ...s.rekor, penumpangHarian: 12_345, pendapatanHarian: 6_789, arusTertinggi: 99 } };
    const naik = renovasi({ ...s, statistik: { ...s.statistik, totalPendapatanRun: new Decimal(1e9) } });
    expect(naik.rekor).toEqual(s.rekor);
    expect(deserialisasi(serialisasi(s), RABU).rekor).toEqual(s.rekor);
    const mentah = JSON.parse(serialisasi(s)) as Record<string, unknown>;
    delete mentah['rekor'];
    expect(deserialisasi(JSON.stringify(mentah), RABU).rekor).toMatchObject({ penumpangHarian: 0, arusTertinggi: 0 });
  });
});
