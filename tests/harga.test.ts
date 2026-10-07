import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { PencatatAnalitik, peristiwaAksi, type DataAnalitik } from '../src/app/analitik';
import { EKONOMI } from '../src/config/economy.config';
import { pilihKelasBus } from '../src/game/kelas-bus';
import { hitungLajuVisual } from '../src/game/laju';
import { terapkanAksi } from '../src/sim/aksi';
import type { PoId } from '../src/sim/fitur';
import { indeksJurusan, nilaiJurusan, skorHarga, xpKumulatifPo } from '../src/sim/mitra';
import { deserialisasi, serialisasi } from '../src/sim/save';
import {
  aturHargaPo,
  buatStateBaru,
  cariPo,
  daftarPo,
  hadiahMenit,
  hitungOffline,
  putusPo,
  rapikanHarga,
  renovasi,
  rincianPendapatan,
  saranHargaPo,
  segmenState,
  throughputState,
  type GameState,
} from '../src/sim/state';
import { buatModel } from '../src/ui/model';
import { jalankan, padaJam, stateOtomatis, T0 } from './helpers';

const JAM_MS = 3600 * 1000;
const H = EKONOMI.harga;
const JAKARTA = indeksJurusan('JAKARTA');
const SEMARANG = indeksJurusan('SEMARANG');
const SURABAYA = indeksJurusan('SURABAYA');
const BANDUNG = indeksJurusan('BANDUNG');

/** Pendapatan tiket rata-rata sepanjang hari Selasa (sampel tiap 15 menit jam terminal). */
function tiketSehari(s: GameState): number {
  let total = 0;
  for (let jam = 0; jam < 24; jam += 0.25) total += rincianPendapatan(padaJam(s, jam), 'aktif').tiket.toNumber();
  return total / 96;
}

/** Harga semua jurusan semua PO terdaftar. */
const hargaSemua = (s: GameState, persen: number): GameState =>
  s.mitra.terdaftar.reduce((x, p) => EKONOMI.mitra.po[p.id].jurusan.reduce((y, nama) => aturHargaPo(y, p.id, indeksJurusan(nama), persen), x), s);
const kaya = (s: GameState): GameState => ({ ...s, uang: new Decimal(1e12) });
/** PO naik ke level tertentu (XP kumulatifnya). */
const levelkan = (s: GameState, id: PoId, level: number): GameState => ({
  ...s,
  mitra: { ...s.mitra, terdaftar: s.mitra.terdaftar.map((p) => (p.id === id ? { ...p, xp: xpKumulatifPo(level) } : p)) },
});
const harga = (s: GameState, id: PoId): Readonly<Partial<Record<number, number>>> => cariPo(s, id)!.harga;

describe('harga tiket PO: dasar', () => {
  it('harga dirapikan ke kelipatan langkah di dalam batasnya', () => {
    expect(rapikanHarga(123)).toBe(120);
    expect(rapikanHarga(126)).toBe(130);
    expect(rapikanHarga(10)).toBe(H.min);
    expect(rapikanHarga(999)).toBe(H.maks);
    expect(rapikanHarga(Number.NaN)).toBe(100);
  });

  it('hanya jurusan milik PO terdaftar yang bisa diatur; nilai sama = state yang sama; 100 tidak disimpan', () => {
    const s = buatStateBaru(T0);
    const a = aturHargaPo(s, 'ondelOndel', JAKARTA, 134);
    expect(harga(a, 'ondelOndel')).toEqual({ [JAKARTA]: 130 });
    expect(aturHargaPo(a, 'ondelOndel', JAKARTA, 130)).toBe(a);
    expect(aturHargaPo(a, 'ondelOndel', BANDUNG, 150)).toBe(a); // bukan jurusan Ondel-Ondel
    expect(aturHargaPo(a, 'lumpiaKilat', SEMARANG, 150)).toBe(a); // belum terdaftar
    expect(aturHargaPo(a, 'ondelOndel', -1, 150)).toBe(a);
    // Jurusan yang baru terbuka di level PO lebih tinggi boleh diatur lebih dulu.
    expect(harga(aturHargaPo(a, 'ondelOndel', SEMARANG, 90), 'ondelOndel')).toEqual({ [JAKARTA]: 130, [SEMARANG]: 90 });
    expect(harga(aturHargaPo(a, 'ondelOndel', JAKARTA, 100), 'ondelOndel')).toEqual({});
  });

  it('PO berbeda boleh memasang harga berbeda untuk jurusan yang sama', () => {
    let s = daftarPo(kaya(stateOtomatis()), 'lumpiaKilat');
    s = levelkan(s, 'ondelOndel', EKONOMI.mitra.levelJurusan[1]!);
    s = aturHargaPo(aturHargaPo(s, 'ondelOndel', SEMARANG, 80), 'lumpiaKilat', SEMARANG, 120);
    expect(harga(s, 'ondelOndel')[SEMARANG]).toBe(80);
    expect(harga(s, 'lumpiaKilat')[SEMARANG]).toBe(120);
  });
});

describe('harga tiket PO: penumpang & pendapatan', () => {
  it('lebih mahal: peminat turun, tiket per penumpang naik; lebih murah sebaliknya', () => {
    const s = stateOtomatis();
    const ukur = (persen: number): { terisi: number; perPenumpang: number } => {
      const seg = segmenState(aturHargaPo(s, 'ondelOndel', JAKARTA, persen), 0.6);
      return { terisi: seg.terisi, perPenumpang: seg.tiket / seg.terisi };
    };
    const normal = ukur(100);
    expect(ukur(130).terisi).toBeLessThan(normal.terisi);
    expect(ukur(130).perPenumpang).toBeCloseTo(normal.perPenumpang * 1.3, 9);
    expect(ukur(70).terisi).toBeGreaterThan(normal.terisi);
    expect(ukur(70).perPenumpang).toBeCloseTo(normal.perPenumpang * 0.7, 9);
  });

  it('kursi penuh (permintaan jauh di atas kapasitas): harga naik tidak mengurangi penumpang, pendapatan naik', () => {
    const s = stateOtomatis();
    const normal = segmenState(s, 3);
    const naik = segmenState(aturHargaPo(s, 'ondelOndel', JAKARTA, 110), 3);
    expect(normal.terisi).toBe(1);
    expect(naik.terisi).toBe(1);
    expect(naik.tiket).toBeCloseTo(normal.tiket * 1.1, 9);
  });

  it('terminal baru: harga terlalu murah atau terlalu mahal sama-sama merugikan dalam sehari', () => {
    const s = buatStateBaru(T0);
    const normal = tiketSehari(s);
    expect(tiketSehari(hargaSemua(s, 50))).toBeLessThan(normal * 0.7);
    expect(tiketSehari(hargaSemua(s, 200))).toBeLessThan(normal * 0.8);
  });
});

describe('harga tiket PO: reputasi', () => {
  it('skor harga: penuh sampai harga normal-ish, nol di harga sangat mahal', () => {
    const r = EKONOMI.mitra.reputasi;
    expect(skorHarga(r.hargaNol - r.rentangHarga)).toBe(1);
    expect(skorHarga(r.hargaNol)).toBe(0);
    expect(skorHarga(H.maks)).toBe(0);
    expect(skorHarga(120)).toBeLessThan(skorHarga(100));
  });

  it('harga di atas normal pelan-pelan menurunkan reputasi PO, harga murah menaikkannya', () => {
    const s = stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 });
    const reputasiSetelah = (persen: number): number => cariPo(jalankan(aturHargaPo(s, 'ondelOndel', JAKARTA, persen), 600), 'ondelOndel')!.reputasi;
    const mahal = reputasiSetelah(H.maks);
    const normal = reputasiSetelah(100);
    const murah = reputasiSetelah(H.min);
    expect(mahal).toBeLessThan(normal);
    expect(normal).toBeLessThanOrEqual(murah);
    // Bergerak pelan (konstanta waktu), tidak langsung loncat ke targetnya.
    expect(Math.abs(mahal - cariPo(s, 'ondelOndel')!.reputasi)).toBeLessThan(25);
  });

  it('reputasi tinggi mendatangkan lebih banyak penumpang pada harga yang sama', () => {
    const s = stateOtomatis();
    const dengan = (reputasi: number): number =>
      segmenState({ ...s, mitra: { ...s.mitra, terdaftar: s.mitra.terdaftar.map((p) => ({ ...p, reputasi })) } }, 0.5).terisi;
    expect(dengan(80)).toBeGreaterThan(dengan(50));
    expect(dengan(50)).toBeGreaterThan(dengan(20));
  });
});

describe('harga tiket PO: saran', () => {
  it('saran hanya untuk jurusan yang dilayani, paling tinggi 120 %, dan hasil sehari tidak lebih buruk dari harga normal', () => {
    const s = buatStateBaru(T0);
    const saran = saranHargaPo(s, 'ondelOndel');
    expect(Object.keys(saran).map(Number)).toEqual([JAKARTA]); // Semarang baru di Lv 6
    expect(saran[JAKARTA]!).toBeLessThanOrEqual(120);
    const x = aturHargaPo(s, 'ondelOndel', JAKARTA, saran[JAKARTA]!);
    expect(tiketSehari(x)).toBeGreaterThanOrEqual(tiketSehari(s) - 1e-9);
    expect(saranHargaPo(s, 'lumpiaKilat')).toEqual({});
  });

  it('rute jauh yang kurang peka harga disarankan tidak lebih murah daripada rute pendek', () => {
    const s = levelkan(stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 }), 'ondelOndel', EKONOMI.mitra.levelJurusan[2]!);
    const saran = saranHargaPo(s, 'ondelOndel');
    expect(Object.keys(saran).map(Number).sort((a, b) => a - b)).toEqual([JAKARTA, SEMARANG, SURABAYA]);
    expect(saran[SURABAYA]!).toBeGreaterThanOrEqual(saran[JAKARTA]!);
  });
});

describe('harga tiket tidak bisa dipakai menggelembungkan hadiah & offline', () => {
  it('hadiah "N menit pendapatan" & arus potensial memakai harga normal', () => {
    const s = stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 });
    const mahal = hargaSemua(s, H.maks);
    expect(hadiahMenit(mahal, 5).eq(hadiahMenit(s, 5))).toBe(true);
    expect(throughputState(mahal)).toBe(throughputState(s));
  });

  it('offline: harga di atas atau di bawah normal tidak pernah menghasilkan lebih banyak', () => {
    const s = stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 });
    const offline = (x: GameState): number => hitungOffline(x, T0 + JAM_MS).pendapatan.toNumber();
    const normal = offline(s);
    expect(normal).toBeGreaterThan(0);
    for (const persen of [50, 80, 120, 200]) expect(offline(hargaSemua(s, persen))).toBeLessThanOrEqual(normal + 1e-9);
    expect(offline(hargaSemua(s, 200))).toBeLessThan(normal);
  });
});

describe('harga tiket PO: save, Renovasi, aksi, analitik', () => {
  it('tersimpan per PO, tetap walau Renovasi, dan ikut riwayat saat PO keluar lalu kembali', () => {
    let s = aturHargaPo(stateOtomatis({ peron: 30, loket: 30, keberangkatan: 30 }), 'ondelOndel', JAKARTA, 120);
    expect(harga(deserialisasi(serialisasi(s), T0), 'ondelOndel')).toEqual({ [JAKARTA]: 120 });
    const kayaRun = { ...s, statistik: { ...s.statistik, totalPendapatanRun: new Decimal(1e9) } };
    expect(harga(renovasi(kayaRun), 'ondelOndel')).toEqual({ [JAKARTA]: 120 });
    s = aturHargaPo(daftarPo(kaya(s), 'lumpiaKilat'), 'lumpiaKilat', SEMARANG, 80);
    const keluar = putusPo(s, 'lumpiaKilat');
    expect(keluar.mitra.riwayat.lumpiaKilat?.harga).toEqual({ [SEMARANG]: 80 });
    const kembali = daftarPo({ ...keluar, mitra: { ...keluar.mitra, jedaSampai: {} } }, 'lumpiaKilat');
    expect(harga(kembali, 'lumpiaKilat')).toEqual({ [SEMARANG]: 80 });
  });

  it('aksi diteruskan ke sim; analitik dicatat sekali per sesi per PO & jurusan', () => {
    const s = buatStateBaru(T0);
    const aksi = { jenis: 'aturHargaPo', po: 'ondelOndel', jurusan: JAKARTA, persen: 110 } as const;
    const baru = terapkanAksi(s, aksi);
    expect(harga(baru, 'ondelOndel')[JAKARTA]).toBe(110);
    expect(peristiwaAksi(aksi, s, baru)).toEqual([{ nama: 'atur_harga', data: { po: 'ondelOndel', jurusan: 'JAKARTA' } }]);

    const catatan: { nama: string; data: DataAnalitik | undefined }[] = [];
    const p = new PencatatAnalitik({ catat: (nama, data) => catatan.push({ nama, data }) });
    for (let i = 0; i < 5; i++) p.catat('atur_harga', { po: 'ondelOndel', jurusan: 'JAKARTA' });
    p.catat('atur_harga', { po: 'lumpiaKilat', jurusan: 'JAKARTA' });
    expect(catatan).toHaveLength(2);
  });
});

describe('harga tiket PO: tampilan', () => {
  it('model dalam Rupiah: harga normal & sekarang, langkah, saran, batas tombol, jurusan terkunci', () => {
    const s = aturHargaPo(buatStateBaru(T0), 'ondelOndel', JAKARTA, H.maks);
    const po = buatModel(s).mitra.terdaftar[0]!;
    const jakarta = po.jurusan.find((j) => j.jurusan === JAKARTA)!;
    const normal = EKONOMI.nilaiPerPenumpang * nilaiJurusan(JAKARTA);
    expect(jakarta.aktif).toBe(true);
    expect(jakarta.normalRupiah).toBeCloseTo(normal, 9);
    expect(jakarta.rupiah).toBeCloseTo((normal * H.maks) / 100, 9);
    expect(jakarta.langkahRupiah).toBeCloseTo((normal * H.langkah) / 100, 9);
    expect(jakarta.bisaNaik).toBe(false);
    expect(jakarta.bisaTurun).toBe(true);
    expect(jakarta.saranPersen).toBeLessThanOrEqual(120);
    expect(jakarta.saranRupiah).toBeCloseTo((normal * jakarta.saranPersen) / 100, 9);
    const semarang = po.jurusan.find((j) => j.jurusan === SEMARANG)!;
    expect(semarang.aktif).toBe(false);
    expect(semarang.levelBuka).toBe(EKONOMI.mitra.levelJurusan[1]);
    expect(po.hargaRata).toBe(H.maks);
  });

  it('adegan (malam, kursi belum penuh): jurusan yang lebih murah kebagian lebih banyak bus; tiket murah mendatangkan lebih banyak bus', () => {
    const s = padaJam(levelkan(buatStateBaru(T0), 'ondelOndel', EKONOMI.mitra.levelJurusan[1]!), 2);
    const biasa = hitungLajuVisual(s);
    const murah = hitungLajuVisual(aturHargaPo(s, 'ondelOndel', SEMARANG, 60));
    expect(murah.bagianJurusan![SEMARANG]).toBeGreaterThan(biasa.bagianJurusan![SEMARANG]!);
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
