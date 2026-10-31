import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import {
  bangunanAwal,
  biayaBangun,
  biayaUnitBerikutnya,
  bonusIzin,
  izinAntara,
  izinBerikut,
  izinPadaLevel,
  operasionalGedung,
  pengaliBiayaKelas,
  pengembalianBongkar,
  perawatanHarian,
  petakBus,
  slotBangunan,
} from '../src/sim/bangunan';
import { BANGUNAN_IDS, TEKNOLOGI_IDS, type TeknologiId } from '../src/sim/fitur';

const T = EKONOMI.tycoon;
const tanpaTeknologi = Object.fromEntries(TEKNOLOGI_IDS.map((id) => [id, false])) as Record<TeknologiId, boolean>;

describe('bangunan tycoon', () => {
  it('game baru: satu jalur, satu jendela loket, satu blok kursi; slot tidak pernah berkurang per tahap perluasan', () => {
    expect(bangunanAwal()).toMatchObject({ jalur: 1, jendela: 1, kursi: 1, kios: 0, toko: 0, toilet: 0, lahanParkir: 0, posRetribusi: 0 });
    for (const id of BANGUNAN_IDS) {
      expect(slotBangunan(id, 0, 1)).toBeGreaterThanOrEqual(T.bangunan[id].awal);
      for (let t = 1; t <= EKONOMI.mitra.perluasan.length; t++) expect(slotBangunan(id, t, 1)).toBeGreaterThanOrEqual(slotBangunan(id, t - 1, 1));
    }
    // Tabel tahap (tanpa izin level): jendela loket mengikuti aula; jalur bertambah di Gedung Antarpulau & Terpadu.
    expect([0, 1, 2, 3, 4, 5].map((t) => slotBangunan('jendela', t, 1))).toEqual([4, 6, 8, 12, 16, 20]);
    expect([0, 3, 4, 5].map((t) => slotBangunan('jalur', t, 1))).toEqual([5, 5, 6, 7]);
  });

  it('biaya unit berikutnya: daftar biayanya lalu pertumbuhan; slot penuh = null', () => {
    const awal = bangunanAwal();
    expect(biayaBangun('jalur', awal, 0, 1)).toBe(T.bangunan.jalur.biaya[0]);
    expect(biayaBangun('jalur', { ...awal, jalur: 5 }, 0, 1)).toBeNull();
    expect(biayaBangun('jalur', { ...awal, jalur: 5 }, 4, 1)).toBe(T.bangunan.jalur.biaya[4]);
    // Jendela: biaya pertama lalu × pertumbuhan tiap jendela berikutnya.
    const j = T.bangunan.jendela;
    expect(biayaUnitBerikutnya('jendela', 1)).toBe(j.biaya[0]);
    expect(biayaUnitBerikutnya('jendela', 2)).toBeCloseTo(j.biaya[0]! * j.pertumbuhan, 6);
    expect(biayaUnitBerikutnya('jendela', 4)).toBeCloseTo(j.biaya[0]! * j.pertumbuhan ** 3, 6);
    expect(biayaBangun('jendela', { ...awal, jendela: 4 }, 0, 1)).toBeNull();
    expect(biayaBangun('jendela', { ...awal, jendela: 4 }, 1, 1)).not.toBeNull();
    // Slot dari izin level ikut dihitung: Perluasan 3 penuh (12) di Lv 10, satu slot lagi di Lv 11.
    expect(biayaBangun('jendela', { ...awal, jendela: 12 }, 3, 10)).toBeNull();
    expect(biayaBangun('jendela', { ...awal, jendela: 12 }, 3, 11)).toBe(biayaUnitBerikutnya('jendela', 12));
    // Harga tetap: kursi.
    expect(biayaUnitBerikutnya('kursi', 1)).toBe(biayaUnitBerikutnya('kursi', 3));
  });

  it('bongkar mengembalikan sebagian harga unit itu; jalur permanen, jendela loket paling sedikit satu', () => {
    const b = { ...bangunanAwal(), jendela: 3, toilet: 1, kursi: 2 };
    expect(pengembalianBongkar('toilet', b)).toBe(Math.floor(T.bangunan.toilet.biaya[0]! * T.bongkar));
    expect(pengembalianBongkar('jendela', b)).toBe(Math.floor(biayaUnitBerikutnya('jendela', 2) * T.bongkar));
    expect(pengembalianBongkar('jalur', b)).toBeNull();
    expect(pengembalianBongkar('jendela', { ...b, jendela: 1 })).toBeNull();
    expect(pengembalianBongkar('kios', b)).toBeNull();
    expect(pengembalianBongkar('kursi', b)).not.toBeNull();
  });

  it('perawatan, operasional gedung, petak bus, dan pengali biaya kelas', () => {
    const b = bangunanAwal();
    expect(perawatanHarian(b, tanpaTeknologi)).toBe(T.bangunan.jalur.perawatan + T.bangunan.jendela.perawatan + T.bangunan.kursi.perawatan);
    expect(perawatanHarian(b, { ...tanpaTeknologi, mesinTiket: true }) - perawatanHarian(b, tanpaTeknologi)).toBe(EKONOMI.teknologi.mesinTiket.perawatan);
    expect(operasionalGedung(0)).toBe(0);
    expect(operasionalGedung(2)).toBe(EKONOMI.mitra.perluasan[0]!.operasional + EKONOMI.mitra.perluasan[1]!.operasional);
    expect([0, 1, 2, 3, 4, 5].map((t) => petakBus(t))).toEqual([10, 10, 20, 30, 40, 60]);
    expect(pengaliBiayaKelas(0)).toBe(1);
    for (let k = 1; k <= 4; k++) expect(pengaliBiayaKelas(k)).toBeGreaterThanOrEqual(pengaliBiayaKelas(k - 1));
  });
});

describe('izin level (documents/15 bagian 3, AC-GP-02)', () => {
  const LEVEL = [10, 11, 16, 19, 20, 26, 30, 32];
  const slot = (id: 'jendela' | 'jalur', perluasan: number): number[] => LEVEL.map((l) => slotBangunan(id, perluasan, l));

  it('slot jendela & jalur di Lv 10/11/16/19/20/26/30/32 untuk Perluasan 2, 3, 4, 5', () => {
    // Jendela: +1 tiap level Lv 11–30, lalu tiap level genap sejak Lv 32 (sejak Perluasan 3).
    expect(slot('jendela', 2)).toEqual([8, 8, 8, 8, 8, 8, 8, 8]);
    expect(slot('jendela', 3)).toEqual([12, 13, 18, 21, 22, 28, 32, 33]);
    expect(slot('jendela', 4)).toEqual([16, 17, 22, 25, 26, 32, 36, 37]);
    expect(slot('jendela', 5)).toEqual([20, 21, 26, 29, 30, 36, 40, 41]);
    // Jalur: +1 di Lv 16 & 26; totalnya tetap 7 di Perluasan 4 (perlu Lv 20) dan 9 di Perluasan 5 (perlu Lv 30).
    expect(slot('jalur', 2)).toEqual([5, 5, 5, 5, 5, 5, 5, 5]);
    expect(slot('jalur', 3)).toEqual([5, 5, 6, 6, 6, 7, 7, 7]);
    expect(slot('jalur', 4)).toEqual([6, 6, 7, 7, 7, 8, 8, 8]);
    expect(slot('jalur', 5)).toEqual([7, 7, 8, 8, 8, 9, 9, 9]);
    expect(slotBangunan('jalur', 4, EKONOMI.mitra.perluasan[3]!.level)).toBe(7);
    expect(slotBangunan('jalur', 5, EKONOMI.mitra.perluasan[4]!.level)).toBe(9);
    // Hanya jendela & jalur.
    expect(bonusIzin('kursi', 140, 5)).toBe(0);
    expect(bonusIzin('jendela', 140, 5)).toBe(20 + 55);
  });

  it('tidak ada izin sebelum Perluasan 3; izin yang levelnya sudah lewat aktif sekaligus saat Perluasan 3 diresmikan', () => {
    for (const p of [0, 1, 2]) for (const l of [1, 11, 16, 26, 60, 140]) for (const id of BANGUNAN_IDS) expect(bonusIzin(id, l, p)).toBe(0);
    expect(slotBangunan('jendela', 3, 25) - slotBangunan('jendela', 2, 25)).toBe(4 + 15);
    expect(slotBangunan('jalur', 3, 25) - slotBangunan('jalur', 2, 25)).toBe(1);
  });

  it('slot tidak pernah turun antar-level atau antar-tahap', () => {
    for (const id of BANGUNAN_IDS)
      for (let p = 0; p <= EKONOMI.mitra.perluasan.length; p++)
        for (let l = 1; l <= 150; l++) {
          expect(slotBangunan(id, p, l)).toBeGreaterThanOrEqual(slotBangunan(id, p, l - 1));
          if (p > 0) expect(slotBangunan(id, p, l)).toBeGreaterThanOrEqual(slotBangunan(id, p - 1, l));
        }
  });

  it('izin per level & izin berikutnya (toast, kartu level, baris tujuan): jendela, jalur, slot PO', () => {
    expect(izinPadaLevel(16, 3)).toEqual({ jendela: 1, jalur: 1, slotPo: 0 });
    expect(izinPadaLevel(17, 4)).toEqual({ jendela: 1, jalur: 0, slotPo: 7 });
    // Slot PO ke-9 butuh aula loket kedua (Perluasan 4).
    expect(izinPadaLevel(27, 3)).toEqual({ jendela: 1, jalur: 0, slotPo: 0 });
    expect(izinPadaLevel(27, 4)).toEqual({ jendela: 1, jalur: 0, slotPo: 9 });
    expect(izinPadaLevel(31, 5)).toEqual({ jendela: 0, jalur: 0, slotPo: 0 });
    // Sebelum Perluasan 3 hanya slot PO.
    expect(izinPadaLevel(11, 2)).toEqual({ jendela: 0, jalur: 0, slotPo: 0 });
    expect(izinBerikut(4, 1)).toEqual({ level: 6, izin: { jendela: 0, jalur: 0, slotPo: 4 } });
    expect(izinBerikut(16, 3)).toEqual({ level: 17, izin: { jendela: 1, jalur: 0, slotPo: 7 } });
    expect(izinBerikut(30, 5)).toEqual({ level: 32, izin: { jendela: 1, jalur: 0, slotPo: 0 } });
    expect(izinBerikut(140, 5)).toBeNull();
    expect(izinAntara(10, 20, 3)).toEqual({ jendela: 10, jalur: 1, slotPo: 8 });
  });
});
