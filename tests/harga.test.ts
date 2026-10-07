import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { PencatatAnalitik, peristiwaAksi, type DataAnalitik } from '../src/app/analitik';
import { EKONOMI } from '../src/config/economy.config';
import { hitungLajuVisual } from '../src/game/laju';
import { pilihKelasBus } from '../src/game/kelas-bus';
import { terapkanAksi } from '../src/sim/aksi';
import { deserialisasi, serialisasi } from '../src/sim/save';
import {
  arusHarga,
  aturHargaJurusan,
  aturTambahanKelas,
  beliKelasBus,
  buatStateBaru,
  faktorPeminat,
  hadiahMenit,
  hitungOffline,
  kelebihanHarga,
  kepuasanTerminal,
  keterisianTerminal,
  lakukanPrestige,
  nilaiPerPenumpangState,
  penaltiHarga,
  permintaanPenumpang,
  rapikanHarga,
  rapikanTambahan,
  rincianPendapatan,
  saranHarga,
  throughputState,
  type GameState,
} from '../src/sim/state';
import { buatModel } from '../src/ui/model';
import { padaJam, stateOtomatis, T0 } from './helpers';

const JAM_MS = 3600 * 1000;
const H = EKONOMI.harga;

/** Pendapatan tiket rata-rata sepanjang hari Selasa (sampel tiap 15 menit jam terminal). */
function tiketSehari(s: GameState): number {
  let total = 0;
  for (let jam = 0; jam < 24; jam += 0.25) total += rincianPendapatan(padaJam(s, jam), 'aktif').tiket.toNumber();
  return total / 96;
}

const semuaJurusan = (s: GameState): GameState => ({ ...s, terminal: { ...s.terminal, jurusanBuka: EKONOMI.jurusan.length } });
const hargaSemua = (s: GameState, persen: number): GameState => s.harga.jurusan.reduce((x, _, i) => aturHargaJurusan(x, i, persen), s);
const kaya = (s: GameState): GameState => ({ ...s, uang: new Decimal(1e12) });

describe('harga tiket: dasar', () => {
  it('semua harga normal: ekonomi sama persis seperti tanpa pengaturan harga', () => {
    const s = buatStateBaru(T0);
    for (const p of [0.4, 0.8, 1, 1.3]) {
      const a = arusHarga(s, p);
      expect(a.terisi).toBeCloseTo(Math.min(1, p), 12);
      expect(a.harga).toBeCloseTo(1, 12);
      expect(a.peminat).toBeCloseTo(1, 12);
    }
    const malam = padaJam(s, 2);
    expect(keterisianTerminal(malam)).toBeCloseTo(Math.min(1, permintaanPenumpang(malam)), 12);
    expect(penaltiHarga(s)).toBe(0);
    expect(rincianPendapatan(s, 'aktif').tiket.toNumber()).toBeCloseTo(0.8 * EKONOMI.nilaiPerPenumpang, 10);
  });

  it('harga jurusan & tambahan kelas dirapikan ke kelipatan langkah di dalam batasnya', () => {
    expect(rapikanHarga(123)).toBe(120);
    expect(rapikanHarga(126)).toBe(130);
    expect(rapikanHarga(10)).toBe(H.min);
    expect(rapikanHarga(999)).toBe(H.maks);
    expect(rapikanHarga(Number.NaN)).toBe(100);
    expect(rapikanTambahan(-20)).toBe(0);
    expect(rapikanTambahan(14)).toBe(10);
    expect(rapikanTambahan(999)).toBe(H.tambahanMaks);
    expect(rapikanTambahan(Number.NaN)).toBe(0);
  });

  it('hanya jurusan yang sudah dibuka & kelas yang beroperasi yang bisa diatur; nilai sama = state yang sama', () => {
    let s = buatStateBaru(T0);
    s = aturHargaJurusan(s, 0, 134);
    expect(s.harga.jurusan[0]).toBe(130);
    expect(aturHargaJurusan(s, 0, 130)).toBe(s);
    expect(aturHargaJurusan(s, EKONOMI.jurusanAwal, 150)).toBe(s); // belum dibuka
    expect(aturHargaJurusan(s, -1, 150)).toBe(s);
    expect(aturTambahanKelas(s, 'patas', 20)).toBe(s); // belum beroperasi
    s = aturTambahanKelas(s, 'ekonomi', 20);
    expect(s.harga.tambahanKelas.ekonomi).toBe(20);
    const patas = aturTambahanKelas(beliKelasBus(kaya(s), 'patas'), 'patas', 30);
    expect(patas.harga.tambahanKelas.patas).toBe(30);
  });
});

describe('harga tiket: tiket = harga jurusan + tambahan kelas', () => {
  it('tiket & calon penumpang tiap segmen mengikuti harga jurusan + tambahan kelas', () => {
    const s = aturTambahanKelas(aturHargaJurusan(buatStateBaru(T0), 0, 120), 'ekonomi', 20);
    const eJ = EKONOMI.jurusan[0]!.elastisitas;
    const eB = EKONOMI.jurusan[1]!.elastisitas;
    const eK = EKONOMI.kelasBus.ekonomi.elastisitas;
    const bobotJakarta = EKONOMI.jurusan[0]!.peminat / (EKONOMI.jurusan[0]!.peminat + EKONOMI.jurusan[1]!.peminat);
    const dJ = faktorPeminat(120, 20, eJ, eK);
    const dB = faktorPeminat(100, 20, eB, eK);
    expect(dJ).toBeCloseTo(Math.pow(1.2, -eJ) * Math.pow(1.4 / 1.2, -eK), 12);
    const a = arusHarga(s, 0.8);
    const isiJ = Math.min(1, 0.8 * dJ);
    const isiB = Math.min(1, 0.8 * dB);
    expect(a.terisi).toBeCloseTo(bobotJakarta * isiJ + (1 - bobotJakarta) * isiB, 12);
    expect(a.harga).toBeCloseTo((bobotJakarta * isiJ * 1.4 + (1 - bobotJakarta) * isiB * 1.2) / a.terisi, 12);
  });

  it('kursi kosong karena harga tidak diisi penumpang jurusan lain', () => {
    const s = buatStateBaru(T0);
    const normal = arusHarga(s, 1.3);
    const mahal = arusHarga(aturHargaJurusan(s, 0, 200), 1.3);
    expect(normal.terisiJurusan[1]).toBe(1);
    expect(mahal.terisiJurusan[1]).toBe(1); // Bandung tetap penuh, tidak bertambah
    expect(mahal.terisiJurusan[0]).toBeLessThan(1);
    expect(mahal.terisi).toBeLessThan(normal.terisi);
  });

  it('jam sibuk & kursi penuh: harga sedikit naik tidak mengurangi penumpang, pendapatan naik', () => {
    const s = padaJam(buatStateBaru(T0), 7.25);
    expect(permintaanPenumpang(s)).toBeGreaterThan(1.1);
    const naik = aturHargaJurusan(s, 0, 110);
    expect(throughputState(naik, 'aktif')).toBe(throughputState(s, 'aktif'));
    expect(rincianPendapatan(naik, 'aktif').tiket.gt(rincianPendapatan(s, 'aktif').tiket)).toBe(true);
  });

  it('terminal baru: harga terlalu murah atau terlalu mahal sama-sama merugikan dalam sehari', () => {
    const s = buatStateBaru(T0);
    const normal = tiketSehari(s);
    expect(tiketSehari(hargaSemua(s, 50))).toBeLessThan(normal * 0.7);
    expect(tiketSehari(hargaSemua(s, 200))).toBeLessThan(normal * 0.8);
  });
});

describe('harga tiket: terlalu mahal', () => {
  it('di bawah ambang penumpang tidak kecewa; di atasnya kepuasan turun sebanding kelebihannya', () => {
    const s = buatStateBaru(T0);
    expect(penaltiHarga(hargaSemua(s, 120))).toBe(0);
    const mahal = hargaSemua(s, 150);
    const lebih = 1.5 - H.ambangMahal / 100;
    expect(kelebihanHarga(mahal).total).toBeCloseTo(lebih, 12);
    expect(penaltiHarga(mahal)).toBeCloseTo(H.penaltiMahal * lebih, 12);
    expect(kepuasanTerminal(mahal).nilai).toBeCloseTo(kepuasanTerminal(s).nilai * (1 - H.penaltiMahal * lebih), 12);
    // Kepuasan turun → calon penumpang di semua jurusan ikut turun (bukan hanya karena harganya).
    expect(permintaanPenumpang(mahal)).toBeLessThan(permintaanPenumpang(s));
    expect(penaltiHarga(hargaSemua(s, 200))).toBeLessThanOrEqual(H.penaltiMaks);
  });

  it('tambahan kelas ikut dihitung: harga jurusan wajar + tambahan besar tetap terlalu mahal', () => {
    const s = aturTambahanKelas(buatStateBaru(T0), 'ekonomi', 50);
    const k = kelebihanHarga(s);
    expect(k.kelas.ekonomi).toBeGreaterThan(0);
    expect(k.jurusan[0]).toBeGreaterThan(0);
    expect(penaltiHarga(s)).toBeGreaterThan(0);
  });
});

describe('harga tiket: saran', () => {
  it('saran tidak pernah membuat penumpang kecewa, dan hasil sehari tidak lebih buruk dari harga normal', () => {
    const s = buatStateBaru(T0);
    const saran = saranHarga(s);
    expect(saran.jurusan[EKONOMI.jurusanAwal]).toBeNull();
    expect(saran.tambahanKelas.patas).toBeNull();
    let x = s;
    saran.jurusan.forEach((p, i) => {
      if (p !== null) x = aturHargaJurusan(x, i, p);
    });
    x = aturTambahanKelas(x, 'ekonomi', saran.tambahanKelas.ekonomi!);
    expect(penaltiHarga(x)).toBe(0);
    expect(tiketSehari(x)).toBeGreaterThanOrEqual(tiketSehari(s) - 1e-9);
  });

  it('rute yang kurang peka harga disarankan lebih mahal daripada rute pendek, tetap di bawah ambang', () => {
    const s = semuaJurusan(stateOtomatis());
    const saran = saranHarga(s);
    const terakhir = EKONOMI.jurusan.length - 1;
    expect(saran.jurusan[terakhir]!).toBeGreaterThan(saran.jurusan[0]!);
    expect(saran.jurusan[terakhir]!).toBeLessThanOrEqual(H.ambangMahal);
    // Tambahan kelas yang terpasang ikut membatasi saran harga jurusan.
    const bertambahan = saranHarga(aturTambahanKelas(s, 'ekonomi', 20));
    for (const p of bertambahan.jurusan) if (p !== null) expect(p + 20).toBeLessThanOrEqual(H.ambangMahal);
  });
});

describe('harga tiket tidak bisa dipakai menggelembungkan hadiah & offline', () => {
  it('hadiah "N menit pendapatan" & target memakai harga normal', () => {
    const s = stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 });
    const mahal = aturTambahanKelas(hargaSemua(s, 200), 'ekonomi', 100);
    // Kepuasan ikut turun (tiket terlalu mahal), jadi hadiah tidak mungkin lebih besar.
    expect(hadiahMenit(mahal, 5).lte(hadiahMenit(s, 5))).toBe(true);
    expect(throughputState(mahal)).toBe(throughputState(s));
  });

  it('offline: harga di atas atau di bawah normal selalu menghasilkan lebih sedikit', () => {
    const s = stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 });
    const offline = (x: GameState): number => hitungOffline(x, T0 + JAM_MS).pendapatan.toNumber();
    const normal = offline(s);
    expect(normal).toBeGreaterThan(0);
    for (const persen of [50, 80, 120, 200]) expect(offline(hargaSemua(s, persen))).toBeLessThan(normal);
    expect(offline(aturTambahanKelas(s, 'ekonomi', 30))).toBeLessThan(normal);
  });
});

describe('harga tiket: save, naik kelas, aksi, analitik', () => {
  it('ikut tersimpan; save lama tanpa blok harga = normal; nilai aneh dirapikan; tipe salah ditolak', () => {
    const s = aturTambahanKelas(aturHargaJurusan(buatStateBaru(T0), 1, 70), 'ekonomi', 30);
    const dimuat = deserialisasi(serialisasi(s), T0);
    expect(dimuat.harga.jurusan[1]).toBe(70);
    expect(dimuat.harga.tambahanKelas.ekonomi).toBe(30);
    expect(dimuat.harga.jurusan).toHaveLength(EKONOMI.jurusan.length);

    const mentah = JSON.parse(serialisasi(s)) as Record<string, unknown>;
    delete mentah['harga'];
    const lama = deserialisasi(JSON.stringify(mentah), T0).harga;
    expect(lama.jurusan.every((x) => x === 100)).toBe(true);
    expect(lama.tambahanKelas.ekonomi).toBe(0);
    const aneh = { ...mentah, harga: { jurusan: [123, 5], tambahanKelas: { ekonomi: 999 }, kelas: { ekonomi: 150 } } };
    const dirapikan = deserialisasi(JSON.stringify(aneh), T0).harga;
    expect(dirapikan.jurusan.slice(0, 3)).toEqual([120, H.min, 100]);
    expect(dirapikan.tambahanKelas.ekonomi).toBe(H.tambahanMaks);
    expect(() => deserialisasi(JSON.stringify({ ...mentah, harga: { jurusan: 'murah' } }), T0)).toThrow();
  });

  it('tetap walau naik kelas terminal', () => {
    let s = aturHargaJurusan(stateOtomatis({ peron: 30, loket: 30, keberangkatan: 30 }), 0, 120);
    s = { ...s, statistik: { ...s.statistik, totalPendapatanRun: new Decimal(400_000) } };
    expect(lakukanPrestige(s).harga.jurusan[0]).toBe(120);
  });

  it('aksi diteruskan ke sim; analitik dicatat sekali per sesi per jurusan/kelas', () => {
    const s = buatStateBaru(T0);
    const baru = terapkanAksi(s, { jenis: 'aturHargaJurusan', indeks: 0, persen: 110 });
    expect(baru.harga.jurusan[0]).toBe(110);
    expect(peristiwaAksi({ jenis: 'aturHargaJurusan', indeks: 0, persen: 110 }, s, baru)).toEqual([{ nama: 'atur_harga', data: { jurusan: 'JAKARTA' } }]);
    const kelas = terapkanAksi(s, { jenis: 'aturTambahanKelas', kelas: 'ekonomi', persen: 10 });
    expect(kelas.harga.tambahanKelas.ekonomi).toBe(10);
    expect(peristiwaAksi({ jenis: 'aturTambahanKelas', kelas: 'ekonomi', persen: 10 }, s, kelas)).toEqual([{ nama: 'atur_harga', data: { kelas: 'ekonomi' } }]);

    const catatan: { nama: string; data: DataAnalitik | undefined }[] = [];
    const p = new PencatatAnalitik({ catat: (nama, data) => catatan.push({ nama, data }) });
    for (let i = 0; i < 5; i++) p.catat('atur_harga', { jurusan: 'JAKARTA' });
    p.catat('atur_harga', { jurusan: 'BANDUNG' });
    expect(catatan).toHaveLength(2);
  });
});

describe('harga tiket: tampilan', () => {
  it('model dalam Rupiah: harga, langkah, saran, batas tombol, tanda terlalu mahal', () => {
    let s = aturHargaJurusan(buatStateBaru(T0), 0, H.maks);
    s = aturTambahanKelas(s, 'ekonomi', 0);
    const m = buatModel(s);
    const normal = nilaiPerPenumpangState(s);
    const jakarta = m.jurusan.daftar[0]!.harga!;
    expect(jakarta.rupiah).toBeCloseTo((normal * H.maks) / 100, 12);
    expect(jakarta.langkahRupiah).toBeCloseTo((normal * H.langkah) / 100, 12);
    expect(jakarta.bisaNaik).toBe(false);
    expect(jakarta.terlaluMahal).toBe(true);
    expect(jakarta.saranPersen).toBeLessThanOrEqual(H.ambangMahal);
    expect(jakarta.saranRupiah).toBeCloseTo((normal * jakarta.saranPersen) / 100, 12);
    expect(jakarta.peminat).toBeCloseTo(faktorPeminat(H.maks, 0, EKONOMI.jurusan[0]!.elastisitas, 0) - 1, 12);
    expect(m.jurusan.daftar[1]!.harga!.terlaluMahal).toBe(false);
    expect(m.jurusan.daftar[EKONOMI.jurusanAwal]!.harga).toBeNull();
    expect(m.jurusan.penaltiHarga).toBeGreaterThan(0);
    expect(m.hud.kepuasan.penaltiHarga).toBe(m.jurusan.penaltiHarga);
    expect(m.jurusan.batasWajar).toBeCloseTo((normal * H.ambangMahal) / 100, 12);
    const ekonomi = m.armada.kelasBus.find((k) => k.id === 'ekonomi')!.harga!;
    expect(ekonomi.rupiah).toBe(0);
    expect(ekonomi.bisaTurun).toBe(false);
    expect(m.armada.kelasBus.find((k) => k.id === 'patas')!.harga).toBeNull();
  });

  it('tanda terlalu mahal hanya pada penyumbangnya: jurusan di atas normal atau kelas bertambahan', () => {
    const jurusanMahal = buatModel(aturHargaJurusan(buatStateBaru(T0), 0, 160));
    expect(jurusanMahal.jurusan.daftar[0]!.harga!.terlaluMahal).toBe(true);
    expect(jurusanMahal.armada.kelasBus.find((k) => k.id === 'ekonomi')!.harga!.terlaluMahal).toBe(false);
    const kelasMahal = buatModel(aturTambahanKelas(buatStateBaru(T0), 'ekonomi', 50));
    expect(kelasMahal.armada.kelasBus.find((k) => k.id === 'ekonomi')!.harga!.terlaluMahal).toBe(true);
    expect(kelasMahal.jurusan.daftar[0]!.harga!.terlaluMahal).toBe(false);
    expect(kelasMahal.jurusan.penaltiHarga).toBeGreaterThan(0);
  });

  it('adegan (malam, kursi belum penuh): jurusan yang lebih murah kebagian lebih banyak bus; tiket murah mendatangkan lebih banyak bus', () => {
    const s = padaJam(buatStateBaru(T0), 2);
    const biasa = hitungLajuVisual(s);
    const murah = hitungLajuVisual(aturHargaJurusan(s, 1, 60));
    expect(murah.bagianJurusan![1]).toBeGreaterThan(biasa.bagianJurusan![1]!);
    expect(murah.busDatang).toBeGreaterThan(biasa.busDatang);
    expect(biasa.bagianJurusan!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it('kelas bus yang datang sebanding bagian penumpangnya', () => {
    const bobot = { ekonomi: 3, patas: 1 } as const;
    let ekonomi = 0;
    for (let id = 0; id < 2000; id++) if (pilihKelasBus(id, id % 40, ['ekonomi', 'patas'] as const, (k) => bobot[k]) === 'ekonomi') ekonomi++;
    expect(ekonomi / 2000).toBeGreaterThan(0.7);
    expect(ekonomi / 2000).toBeLessThan(0.8);
  });
});
