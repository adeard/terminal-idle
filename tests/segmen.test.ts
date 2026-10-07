import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { indeksJurusan, nilaiTiketPo } from '../src/sim/mitra';
import { hitungSegmen, type PoSegmen } from '../src/sim/segmen';

const JKT = indeksJurusan('JAKARTA');
/** Reputasi 50 = faktor minat 1, sama dengan v1. */
const po = (id: PoSegmen['id'], o: Partial<PoSegmen> = {}): PoSegmen => ({ id, level: 1, loket: 5, reputasi: 50, ...o });

describe('segmen PO × jurusan × kelas', () => {
  it('satu PO, harga normal, reputasi 50: kursi terisi = min(1, permintaan) seperti v1', () => {
    for (const permintaan of [0, 0.3, 0.75, 1, 2.5]) {
      expect(hitungSegmen([po('ondelOndel')], permintaan, 0).terisi).toBeCloseTo(Math.min(1, permintaan), 12);
    }
  });

  it('tanpa loket: tidak ada penumpang', () => {
    const h = hitungSegmen([po('ondelOndel', { loket: 0 })], 2, 0);
    expect(h.terisi).toBe(0);
    expect(h.tiket).toBe(0);
  });

  it('kursi dibagi menurut loket; uang tiket = nilai jurusan × kelas × level PO × harga', () => {
    // Ondel-Ondel Lv1: Jakarta (nilai 1) kelas ekonomi (nilai 1) → Rp 5 per penumpang.
    const satu = hitungSegmen([po('ondelOndel')], 10, 0);
    expect(satu.terisi).toBeCloseTo(1, 12);
    expect(satu.tiket).toBeCloseTo(EKONOMI.nilaiPerPenumpang, 12);
    // Lumpia Kilat Lv1: Semarang (nilai 1,4). Dua PO beda jurusan, loket 3 : 1.
    const dua = hitungSegmen([po('ondelOndel', { loket: 3 }), po('lumpiaKilat', { loket: 1 })], 10, 0);
    expect(dua.po[0]!.kursi).toBeCloseTo(0.75, 12);
    expect(dua.po[1]!.kursi).toBeCloseTo(0.25, 12);
    expect(dua.tiket).toBeCloseTo(EKONOMI.nilaiPerPenumpang * (0.75 * 1 + 0.25 * 1.4), 12);
    // Level PO menaikkan nilai tiket.
    const lv11 = hitungSegmen([po('ondelOndel', { level: 11 })], 10, 0);
    const kelas = lv11.po[0]!.kelas;
    expect(kelas).toEqual(['ekonomi', 'patas', 'eksekutif']);
    const rataKelas = (4 * 1 + 3 * 1.25 + 2 * 1.6) / 9;
    // Lv 11: Jakarta & Semarang (peminat 3 : 1,5).
    const rataJurusan = (3 * 1 + 1.5 * 1.4) / 4.5;
    expect(lv11.tiket).toBeCloseTo(EKONOMI.nilaiPerPenumpang * rataJurusan * rataKelas * nilaiTiketPo(11), 9);
  });

  it('harga di atas normal: uang per penumpang naik, penumpang turun', () => {
    const normal = hitungSegmen([po('ondelOndel')], 1, 0);
    const mahal = hitungSegmen([po('ondelOndel', { harga: { [JKT]: 130 } })], 1, 0);
    expect(mahal.terisi).toBeLessThan(normal.terisi);
    expect(mahal.tiket / mahal.terisi).toBeCloseTo(1.3 * (normal.tiket / normal.terisi), 9);
    expect(mahal.po[0]!.hargaRataPersen).toBe(130);
    // Mode harga normal (dasar hadiah) mengabaikan harga pemain.
    expect(hitungSegmen([po('ondelOndel', { harga: { [JKT]: 130 } })], 1, 0, EKONOMI, { hargaNormal: true }).tiket).toBeCloseTo(normal.tiket, 12);
  });

  it('reputasi tinggi mendatangkan lebih banyak penumpang', () => {
    const rendah = hitungSegmen([po('ondelOndel', { reputasi: 20 })], 0.6, 0);
    const tinggi = hitungSegmen([po('ondelOndel', { reputasi: 90 })], 0.6, 0);
    expect(tinggi.terisi).toBeGreaterThan(rendah.terisi);
  });

  it('kejenuhan: dua PO setara di jurusan yang sama sama-sama kehilangan sebagian penumpang', () => {
    // Ondel-Ondel & Juara Kelas Lv1 sama-sama hanya ke Jakarta (peminat 3): kejenuhan 1 ÷ (1 + 0,3/3) = 0,909.
    const h = hitungSegmen([po('ondelOndel'), po('juaraKelas')], 1, 1);
    expect(h.terisi).toBeCloseTo(1 / 1.1, 9);
    expect(h.po[0]!.terisi).toBeCloseTo(h.po[1]!.terisi, 12);
  });

  it('persaingan: PO lebih murah merebut penumpang PO pesaing di jurusan yang sama', () => {
    const setara = hitungSegmen([po('ondelOndel'), po('juaraKelas')], 0.8, 1);
    const murah = hitungSegmen([po('ondelOndel', { harga: { [JKT]: 80 } }), po('juaraKelas')], 0.8, 1);
    expect(murah.po[0]!.terisi).toBeGreaterThan(setara.po[0]!.terisi);
    expect(murah.po[1]!.terisi).toBeLessThan(setara.po[1]!.terisi);
  });

  it('persaingan juga dari reputasi', () => {
    const h = hitungSegmen([po('ondelOndel', { reputasi: 90 }), po('juaraKelas', { reputasi: 30 })], 0.7, 1);
    expect(h.po[0]!.terisi).toBeGreaterThan(h.po[1]!.terisi);
  });

  it('PO di jurusan berbeda tidak saling memengaruhi', () => {
    const sendiri = hitungSegmen([po('lumpiaKilat')], 0.8, 0).po[0]!.terisi;
    const bersama = hitungSegmen([po('lumpiaKilat'), po('ondelOndel', { harga: { [JKT]: 60 } })], 0.8, 0).po[0]!.terisi;
    // Jatah kursinya kini separuh, tapi isi per kursinya tetap.
    expect(bersama).toBeCloseTo(sendiri / 2, 12);
  });

  it('permintaan tak hingga = semua kursi penuh (dasar pendapatan potensial)', () => {
    const h = hitungSegmen([po('ondelOndel', { level: 20 }), po('kecakLaju', { level: 15 })], Number.POSITIVE_INFINITY, 2, EKONOMI, { hargaNormal: true });
    expect(h.terisi).toBeCloseTo(1, 12);
    expect(Number.isFinite(h.tiket)).toBe(true);
  });
});
