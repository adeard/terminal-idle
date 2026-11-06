import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LIVERY_PO } from '../src/config/livery.config';
import { kotak, Kumpulan, tampilkanBagian } from '../src/game/geometri';
import { HIASAN_LEVEL, hiasanBaru, hiasanLevel, jamBersambung, kotaNaik, poBaliho, POHON_PLAZA, type IdHiasan } from '../src/game/hiasan-level';
import { HiasanLevel3D } from '../src/game/hiasan-level3d';
import { KembangApi, WARNA_KEMBANG_API } from '../src/game/kembang-api';
import { PATROLI_SATPAM } from '../src/game/kehidupan-malam';
import { KOTA } from '../src/game/lingkungan3d';
import type { PustakaMaterial } from '../src/game/material3d';
import { CADANGAN_ANTARPULAU, CADANGAN_SEBERANG, GEDUNG, GEDUNG_KOTA_NAIK, PANGKALAN, RUANG_LANTAI, RUANG_TUNGGU, SAYAP_DUA, type Persegi } from '../src/game/tata-letak';
import { PO_IDS } from '../src/sim/fitur';

const iris = (a: Persegi, b: Persegi): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const urut = (s: ReadonlySet<IdHiasan>): IdHiasan[] => HIASAN_LEVEL.map((h) => h.id).filter((id) => s.has(id));
const [A, B, C] = [PO_IDS[0]!, PO_IDS[1]!, PO_IDS[2]!];

describe('hiasan per level (rancangan ronde 2 bagian 5)', () => {
  it('dua belas benda di levelnya; Lv 16 di K13, pohon atap butuh tahap 3', () => {
    expect(HIASAN_LEVEL.map((h) => [h.id, h.level])).toEqual([
      ['pohonPlaza', 5],
      ['kanopi', 8],
      ['baliho1', 13],
      ['kotaK13', 16],
      ['kotaK12', 21],
      ['baliho2', 22],
      ['kotaK07', 23],
      ['pohonAtap', 24],
      ['menaraJam', 25],
      ['kotaK09', 26],
      ['monumen', 27],
      ['kotaK11', 35],
    ]);
    expect(HIASAN_LEVEL.filter((h) => h.tahap > 0).map((h) => [h.id, h.tahap])).toEqual([['pohonAtap', 3]]);
  });

  it('hiasanLevel di batas Lv 4/5, 15/16, 20/21, 23/24 tahap 2 vs 3, 34/35, dan Lv 50', () => {
    expect(urut(hiasanLevel(1, 0))).toEqual([]);
    expect(urut(hiasanLevel(4, 5))).toEqual([]);
    expect(urut(hiasanLevel(5, 0))).toEqual(['pohonPlaza']);
    expect(hiasanLevel(15, 2).has('kotaK13')).toBe(false);
    expect(hiasanLevel(16, 2).has('kotaK13')).toBe(true);
    expect(hiasanLevel(20, 2).has('kotaK12')).toBe(false);
    expect(hiasanLevel(21, 2).has('kotaK12')).toBe(true);
    expect(hiasanLevel(23, 3).has('pohonAtap')).toBe(false);
    expect(hiasanLevel(24, 2).has('pohonAtap')).toBe(false);
    expect(hiasanLevel(24, 3).has('pohonAtap')).toBe(true);
    expect(hiasanLevel(34, 5).has('kotaK11')).toBe(false);
    expect(hiasanLevel(35, 5).has('kotaK11')).toBe(true);
    expect(hiasanLevel(50, 5).size).toBe(12);
    expect(urut(hiasanLevel(50, 2))).toEqual(HIASAN_LEVEL.map((h) => h.id).filter((id) => id !== 'pohonAtap'));
  });

  it('hiasanBaru: hanya naik tepat satu level; muat, lompatan +2, dan turun tanpa kembang api', () => {
    expect(hiasanBaru(4, 5, 0).map((h) => h.id)).toEqual(['pohonPlaza']);
    expect(hiasanBaru(15, 16, 2).map((h) => h.id)).toEqual(['kotaK13']);
    expect(hiasanBaru(20, 21, 2).map((h) => h.id)).toEqual(['kotaK12']);
    expect(hiasanBaru(23, 24, 2)).toEqual([]);
    expect(hiasanBaru(23, 24, 3).map((h) => h.id)).toEqual(['pohonAtap']);
    expect(hiasanBaru(34, 35, 5).map((h) => h.id)).toEqual(['kotaK11']);
    expect(hiasanBaru(49, 50, 5)).toEqual([]);
    expect(hiasanBaru(6, 7, 1)).toEqual([]);
    // Lompatan +2 melewati Lv 5 dan Lv 8 sekaligus, muat ulang di level sama, level turun.
    expect(hiasanBaru(4, 6, 0)).toEqual([]);
    expect(hiasanBaru(7, 9, 1)).toEqual([]);
    expect(hiasanBaru(5, 5, 0)).toEqual([]);
    expect(hiasanBaru(6, 5, 0)).toEqual([]);
    // Kembang api kecil di atas puncak bendanya.
    for (const h of HIASAN_LEVEL) {
      expect(h.kembangApi[2]).toBeGreaterThan(h.kotak.h1);
      expect(h.kembangApi[0]).toBeGreaterThanOrEqual(h.kotak.x0);
      expect(h.kembangApi[0]).toBeLessThanOrEqual(h.kotak.x1);
    }
  });

  it('naik level di sesi aktif dibedakan dari hasil offline dan save yang diganti', () => {
    // Frame biasa 1×/3×, frame tanpa tick, panel layar penuh (gambar berhenti, jam main tetap jalan).
    expect(jamBersambung(0.1, 1 / 60)).toBe(true);
    expect(jamBersambung(0.05, 1 / 60)).toBe(true);
    expect(jamBersambung(0, 1 / 60)).toBe(true);
    expect(jamBersambung(60, 60)).toBe(true);
    expect(jamBersambung(180, 60)).toBe(true);
    // Resume sesudah dijeda: jeda nyata panjang, jam main hampir diam (offline tidak memajukannya).
    expect(jamBersambung(0.1, 600)).toBe(false);
    expect(jamBersambung(0, 8 * 3600)).toBe(false);
    // Save lain (cloud): jam main melompat maju atau mundur.
    expect(jamBersambung(3600, 1 / 60)).toBe(false);
    expect(jamBersambung(-50, 1 / 60)).toBe(false);
  });

  it('baliho: PO terdaftar ke-1 & ke-2 menurut urutan daftar, null bila kurang', () => {
    expect(poBaliho([])).toEqual([null, null]);
    expect(poBaliho([{ id: A }])).toEqual([A, null]);
    expect(poBaliho([{ id: A }, { id: B }, { id: C }])).toEqual([A, B]);
    expect(poBaliho([{ id: C }, { id: A }])).toEqual([C, A]);
  });
});

describe('lahan seberang & gedung kota (ADR 008)', () => {
  /** Deret depan kota urut barat → timur, dengan masjid (x0 7,2) sebagai K10. */
  const lot = [...KOTA.filter((b) => b.y1 > -2), { x0: 7.2, y0: -4.6, x1: 10.6, y1: -1.5, tinggi: 0, jenis: -1 }].sort((a, b) => a.x0 - b.x0);
  const namaLot = (b: Persegi): string => `K${String(lot.findIndex((x) => x.x0 === b.x0 && x.y0 === b.y0) + 1).padStart(2, '0')}`;

  it('cadangan lahan seberang tetap di x 24,8…39,0, y −5,0…−1,2', () => {
    expect(CADANGAN_SEBERANG).toEqual({ x0: 24.8, y0: -5.0, x1: 39.0, y1: -1.2 });
    expect(lot).toHaveLength(22);
  });

  it('hanya K07, K09, K11, K12, K13 yang meninggi, jejak & tinggi lamanya sama dengan gedungnya di KOTA', () => {
    expect(GEDUNG_KOTA_NAIK.map((g) => [g.lot, g.tinggiLama, g.tinggiBaru, g.level])).toEqual([
      ['K13', 2.5, 6.0, 16],
      ['K12', 5.9, 9.0, 21],
      ['K07', 5.0, 8.5, 23],
      ['K09', 3.7, 7.2, 26],
      ['K11', 2.8, 6.5, 35],
    ]);
    for (const g of GEDUNG_KOTA_NAIK) {
      const b = KOTA.find((x) => x.x0 === g.x0 && x.y0 === g.y0 && x.x1 === g.x1 && x.y1 === g.y1);
      expect(b, g.lot).toBeDefined();
      expect(b!.tinggi).toBe(g.tinggiLama);
      expect(namaLot(g)).toBe(g.lot);
    }
    expect([0, 15, 16, 21, 23, 26, 34, 35, 60].map(kotaNaik)).toEqual([0, 0, 1, 2, 3, 4, 4, 5, 5]);
  });

  it('tidak ada hiasan level atau gedung yang dinaikkan di lahan cadangan; lot K14–K17 tidak berubah', () => {
    for (const h of HIASAN_LEVEL) expect(iris(h.kotak, CADANGAN_SEBERANG), h.id).toBe(false);
    for (const g of GEDUNG_KOTA_NAIK) expect(iris(g, CADANGAN_SEBERANG), g.lot).toBe(false);
    const cadangan = lot.filter((b) => iris(b, CADANGAN_SEBERANG));
    expect(cadangan.map(namaLot)).toEqual(['K14', 'K15', 'K16', 'K17']);
    expect(cadangan.map((b) => [b.x0, b.y0, b.x1, b.y1, b.tinggi])).toEqual([
      [24.8, -4.6, 28.0, -1.6, 4.4],
      [28.8, -3.4, 31.4, -1.4, 2.1],
      [32.2, -4.2, 35.4, -1.5, 3.5],
      [36.2, -3.6, 39.0, -1.5, 2.9],
    ]);
  });

  it('baliho di depan muka lantai 2 ruang tunggu (y ≥ 13,05); tidak ada hiasan di cadangan Antarpulau', () => {
    for (const id of ['baliho1', 'baliho2'] as const) {
      const h = HIASAN_LEVEL.find((x) => x.id === id)!;
      expect(h.kotak.y0, id).toBeGreaterThanOrEqual(13.05);
      expect(h.kotak.y0, id).toBeGreaterThanOrEqual(RUANG_LANTAI.ruangTunggu.y1 + 0.08);
    }
    for (const h of HIASAN_LEVEL) expect(iris(h.kotak, CADANGAN_ANTARPULAU), h.id).toBe(false);
  });

  it('hiasan plaza tidak di atas pangkalan atau gedung, pohon plaza di luar rute patroli satpam', () => {
    for (const h of HIASAN_LEVEL.filter((x) => !x.id.startsWith('kota') && !x.id.startsWith('baliho'))) {
      for (const p of [PANGKALAN, GEDUNG, RUANG_TUNGGU, SAYAP_DUA.a1]) expect(iris(h.kotak, p), h.id).toBe(false);
    }
    const yPatroli = Math.max(...PATROLI_SATPAM.titik.map(([, y]) => y));
    for (const [, y] of POHON_PLAZA) expect(y - yPatroli).toBeGreaterThanOrEqual(0.15);
  });
});

describe('mesh gabungan dengan tambahan per level', () => {
  const V = 36;
  const isi = (k: Kumpulan, m: THREE.Material, level: number, jumlah: number): void => {
    k.level = level;
    for (let i = 0; i < jumlah; i++) k.tambah(m, kotak(0, 0, 1, 1, 0, 1));
    k.level = 0;
  };

  it('[lahan][dasar][level…] tetap satu rentang bersambung di tiap keadaan dan level', () => {
    const k = new Kumpulan();
    const m = new THREE.MeshBasicMaterial();
    isi(k, m, 21, 3);
    isi(k, m, 16, 2);
    isi(k, m, 0, 1);
    k.bagian = 'lahan';
    k.tambah(m, kotak(0, 0, 1, 1, 0, 1));
    k.bagian = 'dasar';
    const potongan = k.bangun(new THREE.Group());
    expect(potongan).toHaveLength(1);
    expect(potongan[0]!.naik).toEqual([
      [16, 2 * V],
      [21, 3 * V],
    ]);
    const rentang = (): readonly [number, number] => [potongan[0]!.mesh.geometry.drawRange.start, potongan[0]!.mesh.geometry.drawRange.count];
    tampilkanBagian(potongan, 'lahan', 15);
    expect(rentang()).toEqual([0, 2 * V]);
    tampilkanBagian(potongan, 'lahan', 16);
    expect(rentang()).toEqual([0, 4 * V]);
    tampilkanBagian(potongan, 'proyek', 30);
    expect(rentang()).toEqual([V, 6 * V]);
    tampilkanBagian(potongan, 'berdiri', 20);
    expect(rentang()).toEqual([V, 3 * V]);
  });

  it('bahan yang hanya punya tambahan per level tersembunyi sebelum levelnya; bahan bersayap ditolak', () => {
    const k = new Kumpulan();
    isi(k, new THREE.MeshBasicMaterial(), 16, 1);
    const potongan = k.bangun(new THREE.Group());
    tampilkanBagian(potongan, 'berdiri', 15);
    expect(potongan[0]!.mesh.visible).toBe(false);
    tampilkanBagian(potongan, 'berdiri', 16);
    expect(potongan[0]!.mesh.visible).toBe(true);
    const salah = new Kumpulan();
    const m = new THREE.MeshBasicMaterial();
    isi(salah, m, 16, 1);
    salah.bagian = 'sayap';
    salah.tambah(m, kotak(0, 0, 1, 1, 0, 1));
    expect(() => salah.bangun(new THREE.Group())).toThrow();
  });
});

describe('hiasan di adegan', () => {
  const daun = new THREE.MeshStandardMaterial({ vertexColors: true });
  const buat = (): HiasanLevel3D => new HiasanLevel3D({ daun } as unknown as PustakaMaterial);
  const mesh = (h: HiasanLevel3D): THREE.Mesh => h.objek.children[0] as THREE.Mesh;

  it('satu mesh berbahan daun yang melempar bayangan (dua draw call) berapa pun hiasan yang tampil', () => {
    const h = buat();
    expect(h.objek.children).toHaveLength(1);
    expect(mesh(h).material).toBe(daun);
    expect(mesh(h).castShadow).toBe(true);
    h.perbarui(hiasanLevel(4, 0), [null, null]);
    expect(mesh(h).visible).toBe(false);
    h.perbarui(hiasanLevel(5, 0), [null, null]);
    const lv5 = mesh(h).geometry.drawRange.count;
    h.perbarui(hiasanLevel(50, 5), [null, null]);
    const semua = mesh(h).geometry.drawRange.count;
    expect(lv5).toBeGreaterThan(0);
    expect(semua).toBeGreaterThan(lv5);
    // Batas segitiga rancangan bagian 4.2: hiasan plaza ±2,9 rb segitiga sebelum bayangan.
    expect(semua / 3).toBeLessThan(3000);
  });

  it('warna baliho mengikuti livery PO dan berganti bila daftar PO berubah; warna terminal bila PO kurang', () => {
    const h = buat();
    /** Banyaknya verteks berwarna hex ini. */
    const jumlah = (hex: number): number => {
      const c = mesh(h).geometry.getAttribute('color');
      const w = new THREE.Color(hex).toArray().map((v) => +v.toFixed(4));
      let n = 0;
      for (let i = 0; i < c.count; i++) if (+c.getX(i).toFixed(4) === w[0] && +c.getY(i).toFixed(4) === w[1] && +c.getZ(i).toFixed(4) === w[2]) n++;
      return n;
    };
    const tampil = hiasanLevel(30, 3);
    h.perbarui(tampil, [A, null]);
    const satu = jumlah(LIVERY_PO[A].warna);
    expect(satu).toBeGreaterThan(0);
    // Baliho ke-2 tanpa PO: latar biru terminal (biru yang sama juga dipakai atap kanopi).
    const biru = jumlah(0x1d4ed8);
    h.perbarui(tampil, [A, A]);
    expect(jumlah(LIVERY_PO[A].warna)).toBe(2 * satu);
    expect(jumlah(0x1d4ed8)).toBe(biru - satu);
    h.perbarui(tampil, [B, C]);
    expect(jumlah(LIVERY_PO[A].warna)).toBe(0);
    expect(jumlah(LIVERY_PO[B].warna)).toBe(satu);
    expect(jumlah(LIVERY_PO[C].warna)).toBe(satu);
  });
});

describe('kembang api kecil hiasan', () => {
  it('tiga letupan berbeda warna, rapat di titik bendanya, lebih kecil dari peresmian', () => {
    const k = new KembangApi();
    k.rayakanKecil(20, 10, 6, 3);
    const warna = new Set<number>();
    let jauh = 0;
    for (let t = 0; t < 5; t += 1 / 30) {
      k.perbarui(1 / 30);
      for (const p of k.partikel) {
        warna.add(WARNA_KEMBANG_API[p.warna]!);
        jauh = Math.max(jauh, Math.hypot(p.x - 20, p.y - 10));
      }
    }
    expect(k.aktif).toBe(false);
    expect(warna.size).toBeGreaterThanOrEqual(3);
    expect(jauh).toBeLessThan(4.5);
    expect(WARNA_KEMBANG_API).not.toContain(0xffffff);
  });
});
