import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { bangunanAwal, biayaBangun, biayaUnitBerikutnya, operasionalGedung, pengaliBiayaKelas, pengembalianBongkar, perawatanHarian, petakBus, slotBangunan } from '../src/sim/bangunan';
import { BANGUNAN_IDS, TEKNOLOGI_IDS, type TeknologiId } from '../src/sim/fitur';

const T = EKONOMI.tycoon;
const tanpaTeknologi = Object.fromEntries(TEKNOLOGI_IDS.map((id) => [id, false])) as Record<TeknologiId, boolean>;

describe('bangunan tycoon', () => {
  it('game baru: satu jalur, satu jendela loket, satu blok kursi; slot tidak pernah berkurang per tahap perluasan', () => {
    expect(bangunanAwal()).toMatchObject({ jalur: 1, jendela: 1, kursi: 1, kios: 0, toko: 0, toilet: 0, lahanParkir: 0, posRetribusi: 0 });
    for (const id of BANGUNAN_IDS) {
      expect(slotBangunan(id, 0)).toBeGreaterThanOrEqual(T.bangunan[id].awal);
      for (let t = 1; t <= EKONOMI.mitra.perluasan.length; t++) expect(slotBangunan(id, t)).toBeGreaterThanOrEqual(slotBangunan(id, t - 1));
    }
    // Jendela loket mengikuti aula: 4 di awal, bertambah tiap tahap; jalur bertambah di Gedung Antarpulau & Terpadu.
    expect([0, 1, 2, 3, 4, 5].map((t) => slotBangunan('jendela', t))).toEqual([4, 6, 8, 12, 16, 20]);
    expect([0, 3, 4, 5].map((t) => slotBangunan('jalur', t))).toEqual([5, 5, 7, 9]);
  });

  it('biaya unit berikutnya: daftar biayanya lalu pertumbuhan; slot penuh = null', () => {
    const awal = bangunanAwal();
    expect(biayaBangun('jalur', awal, 0)).toBe(T.bangunan.jalur.biaya[0]);
    expect(biayaBangun('jalur', { ...awal, jalur: 5 }, 0)).toBeNull();
    expect(biayaBangun('jalur', { ...awal, jalur: 5 }, 4)).toBe(T.bangunan.jalur.biaya[4]);
    // Jendela: biaya pertama lalu × pertumbuhan tiap jendela berikutnya.
    const j = T.bangunan.jendela;
    expect(biayaUnitBerikutnya('jendela', 1)).toBe(j.biaya[0]);
    expect(biayaUnitBerikutnya('jendela', 2)).toBeCloseTo(j.biaya[0]! * j.pertumbuhan, 6);
    expect(biayaUnitBerikutnya('jendela', 4)).toBeCloseTo(j.biaya[0]! * j.pertumbuhan ** 3, 6);
    expect(biayaBangun('jendela', { ...awal, jendela: 4 }, 0)).toBeNull();
    expect(biayaBangun('jendela', { ...awal, jendela: 4 }, 1)).not.toBeNull();
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
    expect([0, 1, 2, 4, 5].map((t) => petakBus(t))).toEqual([10, 10, 20, 40, 60]);
    expect(pengaliBiayaKelas(0)).toBe(1);
    for (let k = 1; k <= 4; k++) expect(pengaliBiayaKelas(k)).toBeGreaterThanOrEqual(pengaliBiayaKelas(k - 1));
  });
});
