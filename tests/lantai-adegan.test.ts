import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { kotak, Kumpulan, KumpulanUnit, tampilkanBagian, type BagianDenah } from '../src/game/geometri';
import {
  atapHujanLantai,
  BAGIAN_LANTAI,
  bagiIsiLantai,
  cangkangTerlihat,
  GEDUNG_ISI_DI_DASAR,
  hLantaiAtas,
  isiLantaiAdegan,
  JENIS_ISI,
  kameraLepasDariGedung,
  kunciLantai,
  lantaiAdegan,
  lantaiDibeli,
  mobilTanahTersembunyi,
  ruangGedungLantai,
  TANPA_LANTAI,
  titikKameraLantai,
  titikKembangApiLantai,
  unitIsi,
  unitIsiTerlihat,
  unitLantai,
  type LantaiGedung,
} from '../src/game/lantai-adegan';
import { bangunLantai, IsiLantai } from '../src/game/lantai3d';
import { slotBangunan } from '../src/sim/bangunan';
import { TITIK_LAMPU } from '../src/game/lingkungan3d';
import type { PustakaMaterial } from '../src/game/material3d';
import { geometriMobil } from '../src/game/mobil3d';
import { fasilitasAdegan } from '../src/game/fasilitas-adegan';
import { bangunSekitar } from '../src/game/sekitar3d';
import {
  AKSES_PARKIR,
  CADANGAN_ANTARPULAU,
  CADANGAN_SEBERANG,
  GEDUNG_PARKIR,
  JALAN_SAMPING,
  KEMIRINGAN_RAMP,
  RUANG_LANTAI,
  RUANG_TUNGGU,
  SAYAP_DUA,
  SELASAR,
  H_LANTAI_2,
  X_MOBIL_TERTIMPA,
  type Persegi,
} from '../src/game/tata-letak';
import { GEDUNG_LANTAI_IDS } from '../src/sim/fitur';

const SEMUA: LantaiGedung = { parkir: 2, ruangTunggu: 1, sayapBarat: 1, aula: 1 };
const B = BAGIAN_LANTAI;

/** Pustaka bahan palsu: tiap nama satu bahan (larik untuk bahan bervariasi), nama bahan bisa dibaca balik. */
function bahanPalsu(): { readonly m: PustakaMaterial; readonly nama: Map<THREE.Material, string> } {
  const nama = new Map<THREE.Material, string>();
  const simpan = new Map<string, unknown>();
  const satu = (n: string): THREE.Material => {
    const b = new THREE.MeshBasicMaterial();
    nama.set(b, n);
    return b;
  };
  const LARIK = new Set(['kios', 'kotaFasad', 'rukoDinding', 'atapRumah', 'kursi', 'kelompokParkir']);
  const m = new Proxy(
    {},
    {
      get: (_, p: string) => {
        if (!simpan.has(p)) {
          if (p === 'teks') {
            const atlas = satu('atlasTeks');
            simpan.set(p, () => ({ material: atlas, uv: { u0: 0, v0: 0, u1: 1, v1: 1 } }));
          } else simpan.set(p, LARIK.has(p) ? Array.from({ length: 6 }, (_, i) => satu(`${p}${i}`)) : satu(p));
        }
        return simpan.get(p);
      },
    },
  ) as PustakaMaterial;
  return { m, nama };
}

interface Potongan {
  readonly unit: number;
  readonly bagian: BagianDenah;
  readonly bahan: string;
  readonly kotak: THREE.Box3;
}

/** Rekam tiap tambah() bangunLantai: unit, bahan, dan kotak batasnya (X = x, Y = tinggi, Z = y denah). */
function rekamLantai(): { readonly daftar: Potongan[]; readonly bagianAkhir: BagianDenah } {
  const { m, nama } = bahanPalsu();
  const daftar: Potongan[] = [];
  const k = {
    bagian: 'dasar' as BagianDenah,
    unitLantai: 0,
    level: 0,
    tambah(bahan: THREE.Material, g: THREE.BufferGeometry) {
      g.computeBoundingBox();
      daftar.push({ unit: this.unitLantai, bagian: this.bagian, bahan: nama.get(bahan)!, kotak: g.boundingBox!.clone() });
    },
  };
  bangunLantai(k as unknown as Kumpulan, m);
  return { daftar, bagianAkhir: k.bagian };
}

const gedungUnit = (unit: number): string => GEDUNG_LANTAI_IDS[Math.floor(unit / 100) - 1]!;
/** Kotak batas mengiris persegi denah (bukan sekadar bersentuhan). */
const iris = (b: THREE.Box3, p: Persegi): boolean => b.min.x < p.x1 - 1e-6 && b.max.x > p.x0 + 1e-6 && b.min.z < p.y1 - 1e-6 && b.max.z > p.y0 + 1e-6;

describe('lantai yang digambar dan bagian cangkang yang terlihat', () => {
  it('lantaiAdegan: nol sebelum tahap lantai (save lama tahap 0–2 tidak menggambar apa pun), objek state sendiri sesudahnya', () => {
    for (const g of GEDUNG_LANTAI_IDS) expect(EKONOMI.tycoon.lantai[g].tahap).toBe(3);
    expect(lantaiAdegan(SEMUA, 0)).toBe(TANPA_LANTAI);
    expect(lantaiAdegan(SEMUA, 2)).toBe(TANPA_LANTAI);
    expect(lantaiAdegan(SEMUA, 3)).toBe(SEMUA);
    expect(lantaiAdegan(SEMUA, 5)).toBe(SEMUA);
    expect(lantaiAdegan(TANPA_LANTAI, 1)).toBe(TANPA_LANTAI);
  });

  it('tampilan biasa: semua lantai yang dibangun beratap, pagar mode tidak, puncak hanya di dek teratas, akses selama gedung parkir ada', () => {
    const lihat = (l: LantaiGedung, g: (typeof GEDUNG_LANTAI_IDS)[number], n: number, b: number): boolean => cangkangTerlihat(unitLantai(g, n, b), l, null);
    expect(lihat(SEMUA, 'ruangTunggu', 2, B.struktur)).toBe(true);
    expect(lihat(SEMUA, 'ruangTunggu', 2, B.atap)).toBe(true);
    expect(lihat(SEMUA, 'ruangTunggu', 2, B.pagar)).toBe(false);
    expect(lihat(SEMUA, 'parkir', 2, B.struktur)).toBe(true);
    expect(lihat(SEMUA, 'parkir', 3, B.struktur)).toBe(true);
    expect(lihat(SEMUA, 'parkir', 2, B.puncak)).toBe(false);
    expect(lihat(SEMUA, 'parkir', 3, B.puncak)).toBe(true);
    expect(lihat(SEMUA, 'parkir', 1, B.akses)).toBe(true);
    const dek2 = { ...SEMUA, parkir: 1 };
    expect(lihat(dek2, 'parkir', 3, B.struktur)).toBe(false);
    expect(lihat(dek2, 'parkir', 2, B.puncak)).toBe(true);
    const tanpaParkir = { ...SEMUA, parkir: 0 };
    expect(lihat(tanpaParkir, 'parkir', 1, B.akses)).toBe(false);
    expect(lihat(tanpaParkir, 'parkir', 2, B.struktur)).toBe(false);
    expect(lihat({ ...SEMUA, aula: 0 }, 'aula', 2, B.struktur)).toBe(false);
    for (const g of GEDUNG_LANTAI_IDS) for (let n = 1; n <= 3; n++) for (const b of Object.values(B)) expect(lihat(TANPA_LANTAI, g, n, b)).toBe(false);
  });

  it('mode lantai: lantai di atas yang dilihat hilang, atap dibuka, puncak pindah, gedung lain tidak berubah; Lantai 1 parkir tinggal akses', () => {
    const di = (gedung: (typeof GEDUNG_LANTAI_IDS)[number], lantai: number) => ({ gedung, lantai });
    const u = unitLantai;
    expect(cangkangTerlihat(u('ruangTunggu', 2, B.atap), SEMUA, di('ruangTunggu', 2))).toBe(false);
    expect(cangkangTerlihat(u('ruangTunggu', 2, B.pagar), SEMUA, di('ruangTunggu', 2))).toBe(true);
    expect(cangkangTerlihat(u('ruangTunggu', 2, B.struktur), SEMUA, di('ruangTunggu', 2))).toBe(true);
    expect(cangkangTerlihat(u('aula', 2, B.atap), SEMUA, di('ruangTunggu', 2))).toBe(true);
    expect(cangkangTerlihat(u('ruangTunggu', 2, B.struktur), SEMUA, di('ruangTunggu', 1))).toBe(false);
    expect(cangkangTerlihat(u('parkir', 3, B.struktur), SEMUA, di('parkir', 2))).toBe(false);
    expect(cangkangTerlihat(u('parkir', 2, B.puncak), SEMUA, di('parkir', 2))).toBe(true);
    expect(cangkangTerlihat(u('parkir', 2, B.struktur), SEMUA, di('parkir', 1))).toBe(false);
    expect(cangkangTerlihat(u('parkir', 1, B.akses), SEMUA, di('parkir', 1))).toBe(true);
    expect(cangkangTerlihat(u('parkir', 3, B.puncak), SEMUA, di('parkir', 3))).toBe(true);
  });

  it('kunciLantai berbeda untuk tiap keadaan yang berbeda, sama untuk keadaan yang sama', () => {
    const kunci = new Set<number>();
    for (const parkir of [0, 1, 2]) for (const aula of [0, 1]) for (const lihat of [null, { gedung: 'parkir' as const, lantai: 1 }, { gedung: 'parkir' as const, lantai: 2 }, { gedung: 'aula' as const, lantai: 2 }]) kunci.add(kunciLantai({ ...TANPA_LANTAI, parkir, aula }, lihat));
    expect(kunci.size).toBe(3 * 2 * 4);
    expect(kunciLantai({ ...SEMUA }, null)).toBe(kunciLantai(SEMUA, null));
  });

  it('mobil tanah di bawah ramp tersembunyi selama gedung parkir ada', () => {
    expect(mobilTanahTersembunyi(TANPA_LANTAI)).toBe(false);
    expect(mobilTanahTersembunyi({ ...TANPA_LANTAI, aula: 1 })).toBe(false);
    expect(mobilTanahTersembunyi({ ...TANPA_LANTAI, parkir: 1 })).toBe(true);
  });
});

describe('mesh gabungan dengan unit lantai di ekor', () => {
  const V = 36;
  const isi = (k: Kumpulan, m: THREE.Material, bagian: BagianDenah, unit: number, jumlah: number): void => {
    k.bagian = bagian;
    k.unitLantai = unit;
    for (let i = 0; i < jumlah; i++) k.tambah(m, kotak(0, 0, 1, 1, 0, 1));
    k.bagian = 'dasar';
  };

  it('satu mesh per bahan; index buffer = rentang keadaan + unit terpilih, bebas urutan', () => {
    const k = new Kumpulan();
    const m = new THREE.MeshBasicMaterial();
    isi(k, m, 'dasar', 0, 2);
    isi(k, m, 'lantai', 120, 1);
    isi(k, m, 'lahan', 0, 1);
    isi(k, m, 'lantai', 230, 3);
    const induk = new THREE.Group();
    const potongan = k.bangun(induk);
    expect(induk.children).toHaveLength(1);
    expect(potongan).toHaveLength(1);
    const p = potongan[0]!;
    expect(p.lantai).toEqual([
      { unit: 120, mulai: 3 * V, jumlah: V },
      { unit: 230, mulai: 4 * V, jumlah: 3 * V },
    ]);
    const indeks = (): number[] => Array.from(p.indeks!.array.slice(0, p.mesh.geometry.drawRange.count));
    const rentang = (a: number, n: number): number[] => Array.from({ length: n }, (_, i) => a + i);
    tampilkanBagian(potongan, 'berdiri', 0, (u) => u === 230);
    expect(indeks()).toEqual([...rentang(V, 2 * V), ...rentang(4 * V, 3 * V)]);
    tampilkanBagian(potongan, 'lahan', 0, (u) => u === 120);
    expect(indeks()).toEqual([...rentang(0, 3 * V), ...rentang(3 * V, V)]);
    tampilkanBagian(potongan, 'berdiri');
    expect(indeks()).toEqual(rentang(V, 2 * V));
  });

  it('bahan yang hanya dipakai lantai tersembunyi sampai unitnya terlihat (three.js tetap menggambar rentang kosong)', () => {
    const k = new Kumpulan();
    isi(k, new THREE.MeshBasicMaterial(), 'lantai', 211, 1);
    const potongan = k.bangun(new THREE.Group());
    tampilkanBagian(potongan, 'berdiri', 40, () => false);
    expect(potongan[0]!.mesh.visible).toBe(false);
    tampilkanBagian(potongan, 'berdiri', 40, (u) => u === 211);
    expect(potongan[0]!.mesh.visible).toBe(true);
  });
});

describe('cangkang lantai di denah (rancangan bagian 6.2, AC-GFX-01, 07, 08)', () => {
  const { daftar, bagianAkhir } = rekamLantai();
  const berdiri = daftar.filter((p) => p.kotak.max.y > 0.06);

  it('semua geometri di bagian lantai dengan unit yang sah; Kumpulan kembali ke bagian dasar', () => {
    expect(daftar.length).toBeGreaterThan(100);
    expect(bagianAkhir).toBe('dasar');
    for (const p of daftar) {
      expect(p.bagian).toBe('lantai');
      expect(GEDUNG_LANTAI_IDS).toContain(gedungUnit(p.unit));
      expect(Object.values(B)).toContain(p.unit % 10);
    }
    const unit = new Set(daftar.map((p) => p.unit));
    for (const g of ['aula', 'ruangTunggu', 'sayapBarat'] as const) for (const b of [B.struktur, B.atap, B.pagar]) expect(unit.has(unitLantai(g, 2, b))).toBe(true);
    for (const n of [2, 3]) for (const b of [B.struktur, B.puncak]) expect(unit.has(unitLantai('parkir', n, b))).toBe(true);
    expect(unit.has(unitLantai('parkir', 1, B.akses))).toBe(true);
  });

  it('hanya bahan yang sudah ada di mesh utama, ditambah kaca jendela malam lantai', () => {
    const ada = new Set(['batu', 'lantaiGranit', 'panel', 'dindingDalam', 'plester', 'atapLogam', 'kacaDinding', 'beton', 'aspal', 'marka', 'markaKuning', 'daun', 'lampuMenyala', 'kaca', 'atlasTeks']);
    const dipakai = new Set(daftar.map((p) => p.bahan));
    expect([...dipakai].filter((b) => !ada.has(b))).toEqual(['kacaLantai']);
    // Jendela malam hanya di pita jendela lantai 2 aula, ruang tunggu, sayap barat.
    for (const p of daftar.filter((x) => x.bahan === 'kacaLantai')) expect([unitLantai('aula', 2, B.atap), unitLantai('ruangTunggu', 2, B.atap), unitLantai('sayapBarat', 2, B.atap)]).toContain(p.unit);
  });

  it('cadangan Antarpulau dan lahan seberang: tanpa benda berdiri; aspal rata akses boleh lewat cadangan Antarpulau', () => {
    for (const p of berdiri) {
      expect(iris(p.kotak, CADANGAN_ANTARPULAU), `${p.unit} ${p.bahan}`).toBe(false);
      expect(iris(p.kotak, CADANGAN_SEBERANG), `${p.unit} ${p.bahan}`).toBe(false);
    }
    const rataDiCadangan = daftar.filter((p) => iris(p.kotak, CADANGAN_ANTARPULAU));
    expect(rataDiCadangan.length).toBeGreaterThan(0);
    for (const p of rataDiCadangan) {
      expect(p.unit).toBe(unitLantai('parkir', 1, B.akses));
      expect(p.kotak.max.y).toBeLessThan(0.04);
    }
  });

  it('lantai 2 kotak di letak akhir: aula di belakang dinding utara, ruang tunggu mulai x 29,6, selasar sayap barat dari A1 sampai dinding aula', () => {
    expect(RUANG_LANTAI.aula).toEqual({ x0: 11.6, y0: 10.0, x1: 29.14, y1: 11.2, hL: 1.9, hA: 3.2 });
    expect(RUANG_LANTAI.ruangTunggu).toEqual({ x0: 29.6, y0: 12.0, x1: 50.14, y1: 13.0, hL: 1.35, hA: 2.6 });
    expect(RUANG_LANTAI.sayapBarat).toEqual({ x0: 6.4, y0: 11.2, x1: 11.25, y1: 13.1, hL: 1.08, hA: 2.45 });
    // Selasar menempel muka timur A1 dan dinding barat aula; lantai jalannya setinggi lantai 2 Sayap 2 Lantai.
    expect(RUANG_LANTAI.sayapBarat.x0).toBe(SAYAP_DUA.a1.x1);
    expect(SELASAR.xAula).toBe(RUANG_LANTAI.aula.x0);
    expect(hLantaiAtas('sayapBarat')).toBe(H_LANTAI_2);
    for (const g of ['aula', 'ruangTunggu', 'sayapBarat'] as const) {
      const R = RUANG_LANTAI[g];
      const x1 = g === 'sayapBarat' ? SELASAR.xAula : R.x1;
      for (const p of daftar.filter((x) => gedungUnit(x.unit) === g)) {
        expect(p.kotak.min.x).toBeGreaterThanOrEqual(R.x0 - 0.07);
        expect(p.kotak.max.x).toBeLessThanOrEqual(x1 + 0.07);
        expect(p.kotak.min.z).toBeGreaterThanOrEqual(R.y0 - 0.06);
        expect(p.kotak.max.z).toBeLessThanOrEqual(R.y1 + 0.09);
        expect(p.kotak.min.y).toBeGreaterThanOrEqual(R.hL - 0.03);
        expect(p.kotak.max.y).toBeLessThanOrEqual(R.hA + 0.11);
      }
    }
  });

  it('gedung parkir A: tapak x 30,8–35,96, benda berdiri di x < 36, ramp ≤ 21,5 % dan ≤ 24 %, lajur bersih ≥ 0,65', () => {
    const P = GEDUNG_PARKIR;
    expect([P.x0, P.x1, P.y0, P.yDek, P.y1]).toEqual([30.8, 35.96, 13.6, 16.5, 17.25]);
    expect(P.hDek).toEqual([1.05, 2.1]);
    expect(KEMIRINGAN_RAMP.ramp1).toBeLessThanOrEqual(0.215);
    expect(KEMIRINGAN_RAMP.ramp2).toBeLessThanOrEqual(0.24);
    expect(P.y1 - P.yDek - 2 * 0.05).toBeGreaterThanOrEqual(0.65 - 1e-9);
    const gedung = daftar.filter((p) => gedungUnit(p.unit) === 'parkir' && p.unit % 10 !== B.akses);
    expect(gedung.length).toBeGreaterThan(50);
    for (const p of gedung) {
      expect(p.kotak.min.x, p.bahan).toBeGreaterThanOrEqual(P.x0 - 1e-6);
      expect(p.kotak.max.x, p.bahan).toBeLessThan(36);
      expect(p.kotak.min.z, p.bahan).toBeGreaterThanOrEqual(P.y0 - 1e-6);
      expect(p.kotak.max.z, p.bahan).toBeLessThanOrEqual(P.y1 + 0.03);
    }
  });

  it('akses: jalan samping x 51,2–57,8 y 4,5–5,3, lajur timur & lorong & lengkung S rata; yang berdiri hanya gapura & pos di timur ruang tunggu', () => {
    expect(JALAN_SAMPING).toEqual({ x0: 51.2, y0: 4.5, x1: 57.8, y1: 5.3 });
    expect(AKSES_PARKIR.xTimur - AKSES_PARKIR.lebarTimur / 2).toBeGreaterThan(RUANG_TUNGGU.x1);
    expect(AKSES_PARKIR.xTimur + AKSES_PARKIR.lebarTimur / 2).toBeLessThan(51.6);
    const akses = daftar.filter((p) => p.unit === unitLantai('parkir', 1, B.akses));
    for (const p of akses.filter((x) => x.kotak.max.y > 0.06)) expect(p.kotak.min.x).toBeGreaterThan(RUANG_TUNGGU.x1);
    const jalan = akses.find((p) => Math.abs(p.kotak.min.x - 51.2) < 1e-6 && Math.abs(p.kotak.max.x - 57.8) < 1e-6);
    expect(jalan).toBeDefined();
    expect([jalan!.kotak.min.z, jalan!.kotak.max.z].map((v) => +v.toFixed(3))).toEqual([4.5, 5.3]);
  });

  it('lampu taman timur ruang tunggu pindah ke (51,49, 9,6), di luar lajur akses', () => {
    const lampu = TITIK_LAMPU.filter((l) => Math.abs(l.y - 9.6) < 1e-9 && l.x > 50);
    expect(lampu.map((l) => +l.x.toFixed(2))).toEqual([51.49]);
    expect(TITIK_LAMPU.filter((l) => l.x > RUANG_TUNGGU.x1 && l.x < AKSES_PARKIR.xTimur + AKSES_PARKIR.lebarTimur / 2 + 0.1)).toEqual([]);
  });
});

describe('mobil tanah di bawah gedung parkir (AC-GFX-09)', () => {
  const { m, nama } = bahanPalsu();
  const k = new Kumpulan();
  const baris = [new Kumpulan(), new Kumpulan()] as const;
  bangunSekitar(k, m, new THREE.Group(), baris);
  const potongan = baris[1].bangun(new THREE.Group());
  const kendaraan = potongan.find((p) => nama.get(p.mesh.material as THREE.Material) === 'kendaraan')!;
  const verteksMobil = geometriMobil().getAttribute('position').count;

  it('tujuh mobil baris 2 di x 30,5–37,75 ada di bagian lahan; bagian lahan dan sisanya sama-sama tergambar tanpa gedung', () => {
    expect(kendaraan).toBeDefined();
    expect(kendaraan.lahan / verteksMobil).toBe(7);
    const pos = kendaraan.mesh.geometry.getAttribute('position');
    // Pusat x tiap mobil: rata-rata verteksnya; yang tersembunyi di rentang tertimpa, sisanya di luar.
    const pusat = (mulai: number): number => {
      let s = 0;
      for (let i = mulai; i < mulai + verteksMobil; i++) s += pos.getX(i);
      return s / verteksMobil;
    };
    for (let i = 0; i < kendaraan.lahan; i += verteksMobil) {
      expect(pusat(i)).toBeGreaterThanOrEqual(X_MOBIL_TERTIMPA[0]);
      expect(pusat(i)).toBeLessThanOrEqual(X_MOBIL_TERTIMPA[1]);
    }
    for (let i = kendaraan.lahan; i < kendaraan.lahan + kendaraan.dasar; i += verteksMobil) expect(pusat(i) > X_MOBIL_TERTIMPA[1] || pusat(i) < X_MOBIL_TERTIMPA[0]).toBe(true);
    tampilkanBagian(potongan, 'lahan');
    expect(kendaraan.mesh.geometry.drawRange).toEqual({ start: 0, count: kendaraan.lahan + kendaraan.dasar });
    tampilkanBagian(potongan, 'berdiri');
    expect(kendaraan.mesh.geometry.drawRange).toEqual({ start: kendaraan.lahan, count: kendaraan.dasar });
  });
});

describe('mode lantai: isi, kamera, hujan, kembang api (AC-GFX-02, 04, 05)', () => {
  const PENUH = { jalur: 9, jendela: 24, kursi: 14, kios: 4, toko: 6, toilet: 3, lahanParkir: 6, posRetribusi: 1 };
  /** Bangunan kosong kecuali yang disebut. */
  const B = (isi: Partial<typeof PENUH>) => ({ jalur: 9, jendela: 24, kursi: 0, kios: 0, toko: 0, toilet: 0, lahanParkir: 0, posRetribusi: 1, ...isi });
  const L0 = TANPA_LANTAI;
  const isiBaru = (b: typeof PENUH, g: (typeof GEDUNG_LANTAI_IDS)[number]) => {
    const hasil = { ...b };
    for (const j of JENIS_ISI) hasil[j] += EKONOMI.tycoon.lantai[g].isi[j] ?? 0;
    return hasil;
  };
  /** Acak kecil berbenih untuk tes sifat. */
  const acak = (benih: number) => {
    let x = benih >>> 0;
    return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
  };

  it('bagiIsiLantai: contoh rancangan 8.4 (lantai diisi lebih dulu, urut level terbuka; isi Sayap barat ikut lantai dasar)', () => {
    const bagi = (b: Partial<typeof PENUH>, l: Partial<LantaiGedung>) => bagiIsiLantai(B(b), { ...L0, ...l }, 3);
    // Kursi 6 + Ruang tunggu 2 = 10 → dasar 6, RT2 4. Kios 1 + RT2 = 2 → dasar 1, RT2 1.
    let r = bagi({ kursi: 10, kios: 2 }, { ruangTunggu: 1 });
    expect([r.dasar.kursi, r.dasar.kios, r.perLantai.ruangTunggu[0]]).toEqual([6, 1, { kursi: 4, kios: 1 }]);
    // Toko 0 + Aula 2 = 2 → dasar 0, Aula 2 2.
    r = bagi({ kursi: 10, toko: 2 }, { aula: 1 });
    expect([r.dasar.toko, r.perLantai.aula[0]]).toEqual([0, { kursi: 2, toko: 2 }]);
    // Lahan 1 + Gedung parkir 2 = 3 → dasar 1, dek 2 2; + Gedung parkir 3 = 5 → dasar 1, dek 2 2, dek 3 2.
    r = bagi({ lahanParkir: 3 }, { parkir: 1 });
    expect([r.dasar.lahanParkir, r.perLantai.parkir[0]!.lahanParkir]).toEqual([1, 2]);
    r = bagi({ lahanParkir: 5 }, { parkir: 2 });
    expect([r.dasar.lahanParkir, r.perLantai.parkir.map((x) => x.lahanParkir)]).toEqual([1, [2, 2]]);
    // Bongkar: kursi 14 dengan RT2 & Aula 2 dibongkar sampai 5 → dasar 0, RT2 4, Aula 2 1 (Aula 2 terbuka paling akhir).
    r = bagi({ kursi: 5 }, { ruangTunggu: 1, aula: 1 });
    expect([r.dasar.kursi, r.perLantai.ruangTunggu[0]!.kursi, r.perLantai.aula[0]!.kursi]).toEqual([0, 4, 1]);
    // Sayap barat 2: selasar tanpa toilet (owner, pesan 272), jadi toiletnya digambar di lantai dasar.
    expect(GEDUNG_ISI_DI_DASAR.has('sayapBarat')).toBe(true);
    r = bagi({ toilet: 2 }, { sayapBarat: 1 });
    expect([r.dasar.toilet, r.perLantai.sayapBarat[0]]).toEqual([2, {}]);
  });

  it('bagiIsiLantai: membeli lantai tidak mengubah lantai dasar dan lantai baru penuh; jumlah tetap; dasar ≤ slot tahap', () => {
    const r = acak(7);
    for (let k = 0; k < 300; k++) {
      const lantai = Object.fromEntries(GEDUNG_LANTAI_IDS.map((g) => [g, Math.floor(r() * (EKONOMI.tycoon.lantai[g].level.length + 1))])) as LantaiGedung;
      const b = { ...PENUH };
      for (const j of JENIS_ISI) b[j] = Math.floor(r() * (slotBangunan(j, 3, 40, EKONOMI, lantai) + 1));
      // Separuh contoh tanpa bongkar: lantai yang sudah ada penuh.
      if (k % 2 === 0) for (const j of JENIS_ISI) b[j] = Math.max(b[j], GEDUNG_LANTAI_IDS.reduce((a, h) => a + (GEDUNG_ISI_DI_DASAR.has(h) ? 0 : lantai[h] * (EKONOMI.tycoon.lantai[h].isi[j] ?? 0)), 0));
      const sebelum = bagiIsiLantai(b, lantai, 3);
      for (const j of JENIS_ISI) {
        // Jumlah dasar + semua lantai = bangunan; dasar muat di slot tahap (lantai dasar).
        const diLantai = GEDUNG_LANTAI_IDS.reduce((a, g) => a + sebelum.perLantai[g].reduce((c, x) => c + (x[j] ?? 0), 0), 0);
        expect(sebelum.dasar[j] + diLantai, j).toBe(b[j]);
        // Isi gedung GEDUNG_ISI_DI_DASAR memang tinggal di lantai dasar.
        const keDasar = [...GEDUNG_ISI_DI_DASAR].reduce((a, g) => a + lantai[g] * (EKONOMI.tycoon.lantai[g].isi[j] ?? 0), 0);
        expect(sebelum.dasar[j], j).toBeLessThanOrEqual(slotBangunan(j, 3, 40) + keDasar);
      }
      for (const g of GEDUNG_LANTAI_IDS) {
        if (lantai[g] >= EKONOMI.tycoon.lantai[g].level.length) continue;
        const sesudah = bagiIsiLantai(isiBaru(b, g), { ...lantai, [g]: lantai[g] + 1 }, 3);
        expect(sesudah.dasar, `${k} beli ${g}`).toEqual(GEDUNG_ISI_DI_DASAR.has(g) ? isiBaru(sebelum.dasar as typeof PENUH, g) : sebelum.dasar);
        // Lantai baru langsung penuh selama lantai yang sudah ada penuh (tanpa bongkar); dibongkar = lantai lama diisi dulu.
        const kapasitas = (j: (typeof JENIS_ISI)[number]): number => GEDUNG_LANTAI_IDS.reduce((a, h) => a + (GEDUNG_ISI_DI_DASAR.has(h) ? 0 : lantai[h] * (EKONOMI.tycoon.lantai[h].isi[j] ?? 0)), 0);
        if (!GEDUNG_ISI_DI_DASAR.has(g) && JENIS_ISI.every((j) => b[j] >= kapasitas(j))) expect(sesudah.perLantai[g][lantai[g]], `${k} lantai baru ${g}`).toEqual(EKONOMI.tycoon.lantai[g].isi);
      }
    }
  });

  it('bagiIsiLantai: tanpa lantai (tahap < 3 atau lantai 0) lantai dasar = bangunan, sama dengan 0.5.0', () => {
    for (const [l, tahap] of [
      [TANPA_LANTAI, 3],
      [SEMUA, 2],
      [SEMUA, 0],
    ] as const) {
      const r = bagiIsiLantai(PENUH, l, tahap);
      for (const j of JENIS_ISI) expect(r.dasar[j]).toBe(PENUH[j]);
    }
    // fasilitasAdegan: kursi, kios, toko, baris tanah dari dasar; toilet & ada lahan parkir dari total.
    const f = fasilitasAdegan(B({ kursi: 2, kios: 1, toko: 0, toilet: 1, lahanParkir: 2 }), { kursi: 2, kios: 1, toko: 0, lahanParkir: 0 });
    expect([f.barisParkir, f.adaParkir, f.toilet, f.kios]).toEqual([0, true, true, 1]);
    expect(fasilitasAdegan(B({ lahanParkir: 0 })).adaParkir).toBe(false);
  });

  it('isiLantaiAdegan & unitIsiTerlihat mengikuti pembagian: lantai yang baru dibeli langsung berisi', () => {
    const ada = (g: (typeof GEDUNG_LANTAI_IDS)[number], b: Partial<typeof PENUH>, l: Partial<LantaiGedung>) => isiLantaiAdegan(g, 2, { ...L0, ...l }, B(b), 3).map((u) => `${u.id}${u.urut}${u.ada ? '' : '-'}`);
    expect(ada('ruangTunggu', { kursi: 10, kios: 2 }, { ruangTunggu: 1 })).toEqual(['kursi1', 'kursi2', 'kursi3', 'kursi4', 'kios1']);
    expect(ada('aula', { kursi: 9, toko: 1 }, { aula: 1 })).toEqual(['kursi1', 'kursi2', 'toko1', 'toko2-']);
    expect(ada('sayapBarat', { toilet: 1 }, { sayapBarat: 1 })).toEqual([]);
    expect(isiLantaiAdegan('ruangTunggu', 1, SEMUA, PENUH, 3)).toEqual([]);
    expect(isiLantaiAdegan('parkir', 3, { ...SEMUA, parkir: 1 }, PENUH, 3)).toEqual([]);
    expect(unitIsiTerlihat(null, SEMUA, PENUH, 3).size).toBe(0);
    expect(unitIsiTerlihat({ gedung: 'ruangTunggu', lantai: 1 }, SEMUA, PENUH, 3).size).toBe(0);
    const rt = unitIsiTerlihat({ gedung: 'ruangTunggu', lantai: 2 }, SEMUA, PENUH, 3);
    expect([...rt].sort()).toEqual([unitIsi('ruangTunggu', 2, null, 0), ...[1, 2, 3, 4].map((u) => unitIsi('ruangTunggu', 2, 'kursi', u)), unitIsi('ruangTunggu', 2, 'kios', 1)].sort());
    // Selasar: hanya bagian tetapnya (orang yang lewat).
    expect([...unitIsiTerlihat({ gedung: 'sayapBarat', lantai: 2 }, SEMUA, PENUH, 3)]).toEqual([unitIsi('sayapBarat', 2, null, 0)]);
  });

  it('IsiLantai menggambar tiap unit isi lantai (dan hanya itu), di dalam ruang lantainya, di atas pelat dan di bawah atap', () => {
    const tambah = vi.spyOn(KumpulanUnit.prototype, 'tambah');
    new IsiLantai(bahanPalsu().m);
    const panggil = tambah.mock.calls.map(([unit, , g]) => {
      g.computeBoundingBox();
      return { unit, kotak: g.boundingBox!.clone() };
    });
    tambah.mockRestore();
    const PENUH = { jalur: 9, jendela: 24, kursi: 14, kios: 4, toko: 6, toilet: 3, lahanParkir: 6, posRetribusi: 1 };
    const sah = new Set(GEDUNG_LANTAI_IDS.flatMap((g) => [2, 3].flatMap((n) => isiLantaiAdegan(g, n, SEMUA, PENUH, 3).map((u) => unitIsi(g, n, u.id, u.urut)))));
    // Ditambah bagian tetap selasar sayap barat (orang yang lewat di karpet).
    expect(new Set(panggil.map((p) => p.unit))).toEqual(new Set([...sah, unitIsi('sayapBarat', 2, null, 0)]));
    for (const { unit, kotak: b } of panggil) {
      const g = GEDUNG_LANTAI_IDS[Math.floor(unit / 1000) - 1]!;
      const n = Math.floor(unit / 100) % 10;
      const R = ruangGedungLantai(g);
      const [lantaiH, atasH] = g === 'parkir' ? [GEDUNG_PARKIR.hDek[n - 2]!, GEDUNG_PARKIR.hDek[n - 2]! + 0.6] : [hLantaiAtas(g), R.hA];
      expect(b.min.x, `${unit}`).toBeGreaterThanOrEqual(R.x0);
      expect(b.max.x, `${unit}`).toBeLessThanOrEqual(R.x1);
      expect(b.min.z, `${unit}`).toBeGreaterThanOrEqual(R.y0);
      expect(b.max.z, `${unit}`).toBeLessThanOrEqual(R.y1);
      expect(b.min.y, `${unit}`).toBeGreaterThanOrEqual(lantaiH - 1e-6);
      expect(b.max.y, `${unit}`).toBeLessThanOrEqual(atasH);
    }
  });

  it('kamera mode lantai: bingkai kotak gedung diperluas pinggir per gedung; lepas bila digeser jauh dari titik pandangnya', () => {
    for (const g of GEDUNG_LANTAI_IDS) {
      const R = ruangGedungLantai(g);
      const t = titikKameraLantai(g);
      expect(Math.min(...t.map((p) => p[0]))).toBeLessThan(R.x0);
      expect(Math.max(...t.map((p) => p[0]))).toBeGreaterThan(R.x1);
      expect(Math.max(...t.map((p) => p[2]))).toBe(R.hA);
      const [x, y] = [(R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2];
      expect(kameraLepasDariGedung(x + 2, y + 1, x, y, g)).toBe(false);
      expect(kameraLepasDariGedung(x + (R.x1 - R.x0) / 2 + 4.5, y, x, y, g)).toBe(true);
      expect(kameraLepasDariGedung(x, y - 25, x, y, g)).toBe(true);
    }
    // Gedung parkir: dari tanah sampai tembok dek teratas.
    expect(ruangGedungLantai('parkir').hA).toBeCloseTo(GEDUNG_PARKIR.hDek[1] + GEDUNG_PARKIR.hTembok);
  });

  it('atap hujan: di atap lantai baru dan dek teratas parkir (dengan lajur ramp); mode lantai membuka atap lantai yang dilihat', () => {
    const P = GEDUNG_PARKIR;
    for (const g of ['aula', 'ruangTunggu', 'sayapBarat'] as const) {
      const R = RUANG_LANTAI[g];
      expect(atapHujanLantai(g, { ...SEMUA, [g]: 0 }, null)).toBeNull();
      expect(atapHujanLantai(g, SEMUA, null)).toEqual({ x0: R.x0, y0: R.y0, x1: R.x1, y1: R.y1, h: R.hA + 0.05 });
      expect(atapHujanLantai(g, SEMUA, { gedung: g, lantai: 2 })!.h).toBeCloseTo(hLantaiAtas(g));
      expect(atapHujanLantai(g, SEMUA, { gedung: g, lantai: 1 })).toBeNull();
      expect(atapHujanLantai(g, SEMUA, { gedung: 'parkir', lantai: 1 })!.h).toBeCloseTo(R.hA + 0.05);
    }
    expect(atapHujanLantai('parkir', TANPA_LANTAI, null)).toBeNull();
    expect(atapHujanLantai('parkir', { ...SEMUA, parkir: 1 }, null)).toEqual({ x0: P.x0, y0: P.y0, x1: P.x1, y1: P.y1, h: P.hDek[0] });
    expect(atapHujanLantai('parkir', SEMUA, null)!.h).toBe(P.hDek[1]);
    expect(atapHujanLantai('parkir', SEMUA, { gedung: 'parkir', lantai: 2 })!.h).toBe(P.hDek[0]);
    expect(atapHujanLantai('parkir', SEMUA, { gedung: 'parkir', lantai: 1 })).toBeNull();
  });

  it('kembang api: hanya saat satu gedung bertambah tepat satu lantai; titiknya di atas lantai baru', () => {
    expect(lantaiDibeli(TANPA_LANTAI, { ...TANPA_LANTAI, aula: 1 })).toBe('aula');
    expect(lantaiDibeli({ ...SEMUA, parkir: 1 }, SEMUA)).toBe('parkir');
    expect(lantaiDibeli(SEMUA, SEMUA)).toBeNull();
    expect(lantaiDibeli(TANPA_LANTAI, { ...TANPA_LANTAI, parkir: 2 })).toBeNull();
    expect(lantaiDibeli(TANPA_LANTAI, SEMUA)).toBeNull();
    expect(lantaiDibeli(SEMUA, TANPA_LANTAI)).toBeNull();
    for (const g of ['aula', 'ruangTunggu', 'sayapBarat'] as const) {
      const [x, y, h] = titikKembangApiLantai(g, 1);
      const R = RUANG_LANTAI[g];
      expect(x > R.x0 && x < R.x1 && y > R.y0 && y < R.y1).toBe(true);
      expect(h).toBeGreaterThan(R.hA);
    }
    expect(titikKembangApiLantai('parkir', 1)[2]).toBeGreaterThan(GEDUNG_PARKIR.hDek[0]);
    expect(titikKembangApiLantai('parkir', 2)[2]).toBeGreaterThan(GEDUNG_PARKIR.hDek[1]);
  });
});
