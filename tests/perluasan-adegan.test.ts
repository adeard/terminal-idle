import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { kurvaKeluarPetak, kurvaMasukPetak } from '../src/game/dunia-visual';
import type { Titik2 } from '../src/game/geometri';
import {
  jendelaDipakai,
  jendelaPo,
  jendelaTahap,
  jendelaTersedia,
  keadaanKelompokParkir,
  kelompokParkirDibangun,
  kelompokTahap,
  LOKASI_PROYEK,
  lokasiProyek,
  posisiPekerja,
} from '../src/game/perluasan-adegan';
import { BUS, KELOMPOK_PARKIR, MASK_SEMUA_JURUSAN, PARKIR_SERONG, tinggiLantai, URUTAN_LOKET, X_LOKET, type Persegi, type Titik } from '../src/game/tata-letak';
import { PO_IDS } from '../src/sim/fitur';
import { jarakPoligon, jejakBus } from './helpers';

const TAHAP = EKONOMI.mitra.perluasan.length;
const [A, B, C] = [PO_IDS[0]!, PO_IDS[1]!, PO_IDS[2]!];
/** Jendela yang dipakai bila n jendela dipakai, urut barat → timur. */
const dipakai = (n: number): number[] => URUTAN_LOKET.slice(0, n).sort((a, b) => a - b);
const sudut = (p: Persegi): Titik2[] => [
  [p.x0, p.y0],
  [p.x1, p.y0],
  [p.x1, p.y1],
  [p.x0, p.y1],
];
const di = (p: Persegi, [x, y]: Titik): boolean => x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1;

/** Jejak bus di sepanjang lintasan (arah hadap dari titik ke titik berikutnya). */
function jejakSepanjang(titik: readonly Titik[]): Titik2[][] {
  const hasil: Titik2[][] = [];
  for (let i = 0; i + 1 < titik.length; i++) {
    const [ax, ay] = titik[i]!;
    const [bx, by] = titik[i + 1]!;
    const arah = Math.atan2(by - ay, bx - ax);
    for (let u = 0; u < 1; u += 0.25) hasil.push(jejakBus(ax + (bx - ax) * u, ay + (by - ay) * u, arah, BUS.panjang, BUS.lebar));
  }
  return hasil;
}

describe('perluasan terminal di adegan', () => {
  it('tiap tahap menambah jendela loket & kelompok parkir, tidak pernah berkurang', () => {
    expect([0, 1, 2].map(jendelaTersedia)).toEqual([4, 6, 8]);
    expect([0, 1, 2].map(kelompokParkirDibangun)).toEqual([2, 2, 4]);
    for (let t = 1; t <= TAHAP; t++) {
      expect(jendelaTersedia(t)).toBeGreaterThanOrEqual(jendelaTersedia(t - 1));
      expect(kelompokParkirDibangun(t)).toBeGreaterThanOrEqual(kelompokParkirDibangun(t - 1));
    }
    expect(jendelaTersedia(TAHAP)).toBe(X_LOKET.length);
    expect(kelompokParkirDibangun(TAHAP)).toBe(KELOMPOK_PARKIR.length);
    // Jendela awal di depan kepala antrean; tiap jendela dibangun tepat sekali, berpasangan di kedua ujung deretan.
    const dibangun = [URUTAN_LOKET.slice(0, jendelaTersedia(0)), ...Array.from({ length: TAHAP }, (_, i) => jendelaTahap(i + 1))];
    expect(dibangun.flat().sort((a, b) => a - b)).toEqual(X_LOKET.map((_, i) => i));
    expect([...jendelaTahap(1)].sort((a, b) => a - b)).toEqual([1, 6]);
    expect([...jendelaTahap(2)].sort((a, b) => a - b)).toEqual([0, 7]);
    expect(kelompokTahap(2)).toEqual([2, 3]);
    for (const t of [1, 3, 4, 5]) expect(kelompokTahap(t)).toEqual([]);
  });

  it('jendela yang dipakai: satu per loket disewa, paling sedikit satu, sebatas yang sudah dibangun', () => {
    expect(jendelaDipakai(0, 0)).toBe(1);
    expect(jendelaDipakai(0, 3)).toBe(3);
    expect(jendelaDipakai(0, 20)).toBe(4);
    expect(jendelaDipakai(1, 20)).toBe(6);
    expect(jendelaDipakai(2, 5.7)).toBe(5);
    expect(jendelaDipakai(TAHAP, 99)).toBe(X_LOKET.length);
  });

  it('jendela dibagi ke PO menurut loketnya, berderet per PO dari barat ke timur', () => {
    // Tanpa jendela atau tanpa loket: tidak ada pemilik.
    expect(jendelaPo(0, [{ id: A, loket: 2 }]).every((p) => p === null)).toBe(true);
    expect(jendelaPo(4, [{ id: A, loket: 0 }]).every((p) => p === null)).toBe(true);
    // Satu PO memakai semua jendela yang dipakai.
    const satu = jendelaPo(3, [{ id: A, loket: 3 }]);
    expect(satu.flatMap((p, i) => (p ? [i] : []))).toEqual(dipakai(3));
    // Dua PO: tiap PO kebagian satu dulu, sisanya sebanding loket; jendela PO yang lebih dulu terdaftar di barat.
    const dua = jendelaPo(4, [
      { id: A, loket: 1 },
      { id: B, loket: 3 },
    ]);
    expect(dipakai(4).map((i) => dua[i])).toEqual([A, B, B, B]);
    // Seri: urutan terdaftar.
    const seri = jendelaPo(5, [
      { id: A, loket: 3 },
      { id: B, loket: 3 },
    ]);
    expect(dipakai(5).map((i) => seri[i])).toEqual([A, A, A, B, B]);
    // Jendela lebih sedikit dari PO: PO dengan loket terbanyak yang kebagian, tetap urut terdaftar.
    const sempit = jendelaPo(2, [
      { id: A, loket: 1 },
      { id: B, loket: 5 },
      { id: C, loket: 2 },
    ]);
    expect(dipakai(2).map((i) => sempit[i])).toEqual([B, C]);
    // PO tanpa loket tidak kebagian jendela.
    expect(
      jendelaPo(4, [
        { id: A, loket: 0 },
        { id: B, loket: 2 },
      ]),
    ).not.toContain(A);
    // Sifat umum: semua jendela yang dipakai berpemilik, tiap PO kebagian bila cukup, jendela tiap PO berderet.
    for (let n = 1; n <= X_LOKET.length; n++) {
      for (const loket of [[1, 1], [2, 7], [5, 1, 1], [1, 2, 3], [4, 4, 4, 4]]) {
        const po = loket.map((l, i) => ({ id: PO_IDS[i]!, loket: l }));
        const hasil = jendelaPo(n, po);
        const urut = dipakai(n).map((i) => hasil[i]);
        expect(urut.every((p) => p !== null)).toBe(true);
        expect(hasil.filter((p) => p !== null)).toHaveLength(n);
        if (n >= po.length) for (const p of po) expect(urut).toContain(p.id);
        const blok = urut.filter((p, i) => i === 0 || p !== urut[i - 1]);
        expect(new Set(blok).size).toBe(blok.length);
      }
    }
  });

  it('keadaan kelompok parkir: belum dibangun, berjurusan (ada jurusannya dilayani), atau parkir tambahan', () => {
    expect(keadaanKelompokParkir(MASK_SEMUA_JURUSAN, 2)).toEqual(['jurusan', 'jurusan', 'belum', 'belum']);
    expect(keadaanKelompokParkir(MASK_SEMUA_JURUSAN, 4)).toEqual(['jurusan', 'jurusan', 'jurusan', 'jurusan']);
    // Jakarta saja: kelompok lain yang sudah dibangun jadi parkir tambahan.
    expect(keadaanKelompokParkir(2 ** 0, 4)).toEqual(['jurusan', 'tambahan', 'tambahan', 'tambahan']);
    // Surabaya saja, padahal kelompoknya belum dibangun: semua kelompok yang sudah ada jadi parkir tambahan.
    expect(keadaanKelompokParkir(2 ** 5, 2)).toEqual(['tambahan', 'tambahan', 'belum', 'belum']);
  });
});

describe('proyek perluasan', () => {
  it('tiap tahap punya lokasi proyek; crane & material di luar gedung, jendela proyek = jendela tahap itu', () => {
    expect(LOKASI_PROYEK).toHaveLength(TAHAP);
    expect(lokasiProyek(0)).toBeNull();
    expect(lokasiProyek(TAHAP + 1)).toBeNull();
    LOKASI_PROYEK.forEach((l, i) => {
      expect(lokasiProyek(i + 1)).toBe(l);
      expect([...l.jendela].sort((a, b) => a - b)).toEqual([...jendelaTahap(i + 1)].sort((a, b) => a - b));
      expect(l.pekerja.length).toBeGreaterThan(0);
      if (l.crane) expect(tinggiLantai(l.crane.x, l.crane.y)).toBeNull();
      for (const [x, y] of l.material) expect(tinggiLantai(x, y)).toBeNull();
      // Bila berpagar: crane, material, & pekerja di dalam pagar.
      if (l.pagar.length > 0) {
        const dalam = (t: Titik): boolean => l.pagar.some((p) => di(p, t));
        if (l.crane) expect(dalam([l.crane.x, l.crane.y])).toBe(true);
        for (const t of l.material) expect(dalam(t)).toBe(true);
        for (const r of l.pekerja.filter((r) => !l.jendela.some((j) => Math.abs(r.dari[0] - X_LOKET[j]!) < 0.5))) {
          expect(dalam(r.dari)).toBe(true);
          expect(dalam(r.ke)).toBe(true);
        }
      }
    });
  });

  it('pagar proyek pangkalan memuat kelompok parkir barunya dan tidak menghalangi bus di kelompok yang sudah dipakai', () => {
    const tahap = 2;
    const [pagar] = LOKASI_PROYEK[tahap - 1]!.pagar;
    expect(pagar).toBeDefined();
    const sisi = sudut(pagar!);
    for (const k of kelompokTahap(tahap)) for (const p of KELOMPOK_PARKIR[k]!.petak) expect(di(pagar!, [PARKIR_SERONG.pusatX[p]!, PARKIR_SERONG.pusatY])).toBe(true);
    let terdekat = Number.POSITIVE_INFINITY;
    for (let k = 0; k < kelompokParkirDibangun(tahap - 1); k++) {
      for (const p of KELOMPOK_PARKIR[k]!.petak) {
        const sx = PARKIR_SERONG.pusatX[p]!;
        for (const jejak of [...jejakSepanjang(kurvaMasukPetak(sx)), ...jejakSepanjang(kurvaKeluarPetak(sx))]) terdekat = Math.min(terdekat, jarakPoligon(jejak, sisi));
      }
    }
    expect(terdekat).toBeGreaterThan(0.05);
  });

  it('pekerja bolak-balik di rutenya dengan jeda kerja di tiap ujung, tidak serempak', () => {
    const rute = { dari: [0, 0], ke: [2, 0] } as const;
    for (let t = 0; t < 40; t += 0.25) {
      const [x, y] = posisiPekerja(rute, 0, t);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(2);
      expect(y).toBe(0);
    }
    expect(posisiPekerja(rute, 0, 1)).toEqual([0, 0]);
    expect(posisiPekerja(rute, 0, 9)).toEqual([2, 0]);
    expect(posisiPekerja(rute, 0, 5.5)).toEqual([1, 0]);
    expect(posisiPekerja(rute, 0, 21.5)).toEqual(posisiPekerja(rute, 0, 5.5));
    expect(posisiPekerja(rute, 1, 5)).not.toEqual(posisiPekerja(rute, 0, 5));
  });
});
