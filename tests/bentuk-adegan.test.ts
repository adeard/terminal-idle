import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { kotak, Kumpulan, KumpulanUnit, tampilkanBagian, type BagianDenah } from '../src/game/geometri';
import { ambangOrangL2, faseProyekSayap, isiLantai2, jumlahPengunjung, keadaanJendelaL2, keadaanSayap, MAKS_PENGUNJUNG, pengunjungDiTeras, posisiPengunjung, TAHAP_SAYAP, tingkatKeramaian } from '../src/game/bentuk-adegan';
import { dalamRentang, JAM_LOKET_MALAM } from '../src/game/kehidupan-malam';
import { LOKASI_PROYEK } from '../src/game/perluasan-adegan';
import {
  BLOK_KURSI_L2,
  diSayapDua,
  H_LANTAI_2,
  JALUR_ANTREAN,
  KECEPATAN_JALAN,
  KIOS_TERAS,
  KURSI,
  LOKET_L2,
  MEJA_L2,
  MEJA_TERAS,
  PANGKALAN,
  SAYAP_BARAT,
  SAYAP_DUA,
  TANGGA_L2,
  TIANG_BENDERA,
  tinggiTanggaL2,
  X_JALUR_KAKI,
  Y_PAGAR,
  type Persegi,
} from '../src/game/tata-letak';

const bangunan = (jendela: number, kursi: number, toko: number): { jendela: number; kursi: number; toko: number } => ({ jendela, kursi, toko });
const JAM_SIANG = 12;
const JAM_MALAM = 23;

const beririsan = (a: Persegi, b: Persegi): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const BAGIAN: readonly (readonly [string, Persegi])[] = Object.entries(SAYAP_DUA);

describe('keadaan Sayap 2 Lantai', () => {
  it('lahan sebelum proyek tahap 3, proyek selama dibangun, berdiri sejak tahap 3 sampai tahap 5', () => {
    expect(TAHAP_SAYAP).toBe(3);
    expect(keadaanSayap(0, 0)).toBe('lahan');
    expect(keadaanSayap(1, 500)).toBe('lahan');
    expect(keadaanSayap(2, 0)).toBe('lahan');
    expect(keadaanSayap(2, 1)).toBe('proyek');
    expect(keadaanSayap(3, 0)).toBe('berdiri');
    // Proyek tahap 4–5 berjalan di lapangan timur, sayapnya tetap berdiri.
    expect(keadaanSayap(3, 800)).toBe('berdiri');
    expect(keadaanSayap(4, 800)).toBe('berdiri');
    expect(keadaanSayap(5, 0)).toBe('berdiri');
  });

  it('fase proyek mengikuti sisa waktu, dan percepat cukup melompati fasenya', () => {
    const T = 1440;
    expect(faseProyekSayap(T, T)).toBe(0);
    expect(faseProyekSayap(T * 0.67, T)).toBe(0);
    expect(faseProyekSayap(T * 0.66, T)).toBe(1);
    expect(faseProyekSayap(T * 0.34, T)).toBe(1);
    expect(faseProyekSayap(T * 0.33, T)).toBe(2);
    expect(faseProyekSayap(1, T)).toBe(2);
    expect(faseProyekSayap(0, 0)).toBe(2);
  });
});

describe('unit lantai 2', () => {
  it('jendela ke-9 ke atas di lantai 2, sampai 24 unit, lebihnya tidak digambar', () => {
    expect(LOKET_L2).toHaveLength(16);
    expect(isiLantai2(bangunan(8, 4, 2), 8, JAM_SIANG).jendela).toBe(0);
    expect(isiLantai2(bangunan(9, 4, 2), 8, JAM_SIANG).jendela).toBe(1);
    expect(isiLantai2(bangunan(24, 4, 2), 8, JAM_SIANG).jendela).toBe(16);
    expect(isiLantai2(bangunan(34, 4, 2), 8, JAM_SIANG).jendela).toBe(16);
  });

  it('keempat keadaan jendela: belum, kosong, disewa buka, disewa tutup malam', () => {
    const siang = isiLantai2(bangunan(14, 4, 2), 11, JAM_SIANG);
    expect(siang.jendela).toBe(6);
    expect(siang.disewa).toBe(3);
    expect(keadaanJendelaL2(0, siang)).toBe('buka');
    expect(keadaanJendelaL2(2, siang)).toBe('buka');
    expect(keadaanJendelaL2(3, siang)).toBe('kosong');
    expect(keadaanJendelaL2(5, siang)).toBe('kosong');
    expect(keadaanJendelaL2(6, siang)).toBe('belum');
    expect(keadaanJendelaL2(15, siang)).toBe('belum');
    const malam = isiLantai2(bangunan(24, 4, 2), 24, JAM_MALAM);
    expect(malam.buka).toHaveLength(8);
    expect(keadaanJendelaL2(7, malam)).toBe('buka');
    expect(keadaanJendelaL2(8, malam)).toBe('tutupMalam');
    expect(keadaanJendelaL2(15, malam)).toBe('tutupMalam');
  });

  it('malam hari tetap buka paling sedikit dua jendela, dan disewa tidak melebihi yang dibangun', () => {
    expect(dalamRentang(JAM_MALAM, JAM_LOKET_MALAM)).toBe(true);
    expect(isiLantai2(bangunan(24, 4, 2), 9, JAM_MALAM).buka).toEqual([0]);
    expect(isiLantai2(bangunan(24, 4, 2), 10, JAM_MALAM).buka).toEqual([0, 1]);
    expect(isiLantai2(bangunan(24, 4, 2), 11, JAM_MALAM).buka).toEqual([0, 1]);
    expect(isiLantai2(bangunan(12, 4, 2), 24, JAM_SIANG).disewa).toBe(4);
    expect(isiLantai2(bangunan(24, 4, 2), 3, JAM_SIANG).disewa).toBe(0);
  });

  it('blok kursi ke-5 sampai ke-8 muncul per unit dengan urutan pasang B8, B6, B7, B5', () => {
    expect(BLOK_KURSI_L2).toHaveLength(4);
    const blok = (kursi: number): readonly boolean[] => isiLantai2(bangunan(8, kursi, 2), 8, JAM_SIANG).blokKursi;
    expect(blok(4)).toEqual([false, false, false, false]);
    expect(blok(5)).toEqual([false, false, false, true]);
    expect(blok(6)).toEqual([false, true, false, true]);
    expect(blok(7)).toEqual([false, true, true, true]);
    expect(blok(8)).toEqual([true, true, true, true]);
    expect(blok(99)).toEqual([true, true, true, true]);
  });

  it('kios teras mengikuti toko ke-3 & ke-4, malam tutup', () => {
    expect(KIOS_TERAS).toHaveLength(2);
    expect(isiLantai2(bangunan(8, 4, 2), 8, JAM_SIANG).kios).toBe(0);
    expect(isiLantai2(bangunan(8, 4, 3), 8, JAM_SIANG).kios).toBe(1);
    expect(isiLantai2(bangunan(8, 4, 4), 8, JAM_SIANG).kios).toBe(2);
    expect(isiLantai2(bangunan(8, 4, 4), 8, JAM_SIANG).kiosBuka).toBe(2);
    expect(isiLantai2(bangunan(8, 4, 4), 8, JAM_MALAM).kios).toBe(2);
    expect(isiLantai2(bangunan(8, 4, 4), 8, JAM_MALAM).kiosBuka).toBe(0);
  });

  it('unit yang dibongkar kembali ke keadaan belum dibangun', () => {
    const lengkap = isiLantai2(bangunan(24, 8, 4), 24, JAM_SIANG);
    const bongkar = isiLantai2(bangunan(20, 6, 3), 20, JAM_SIANG);
    expect(keadaanJendelaL2(15, lengkap)).toBe('buka');
    expect(keadaanJendelaL2(15, bongkar)).toBe('belum');
    expect(bongkar.blokKursi).toEqual([false, true, false, true]);
    expect(bongkar.kios).toBe(1);
  });

  it('orang diam muncul bertahap mengikuti keramaian, dan tingkatnya berganti jarang', () => {
    for (let i = 0; i < 80; i++) {
      expect(ambangOrangL2(i)).toBeGreaterThanOrEqual(0.12);
      expect(ambangOrangL2(i)).toBeLessThanOrEqual(0.82);
    }
    const terlihat = (keramaian: number): number => Array.from({ length: 80 }, (_, i) => ambangOrangL2(i)).filter((a) => tingkatKeramaian(keramaian) >= a).length;
    expect(terlihat(0.05)).toBe(0);
    expect(terlihat(1)).toBe(80);
    expect(terlihat(0.5)).toBeGreaterThan(terlihat(0.25));
    // Perubahan keramaian yang kecil tidak memicu penulisan ulang index buffer.
    expect(tingkatKeramaian(0.5)).toBe(tingkatKeramaian(0.52));
    expect(tingkatKeramaian(0.5)).not.toBe(tingkatKeramaian(0.56));
  });

  it('keadaan yang sama menghasilkan objek yang sama, jadi tiap frame tidak mengalokasi', () => {
    expect(isiLantai2(bangunan(24, 8, 4), 24, JAM_SIANG)).toBe(isiLantai2(bangunan(24, 8, 4), 24, JAM_SIANG + 0.5));
    expect(isiLantai2(bangunan(24, 8, 4), 24, JAM_SIANG)).not.toBe(isiLantai2(bangunan(23, 8, 4), 24, JAM_SIANG));
  });
});

describe('denah Sayap 2 Lantai (dokumen 16 bagian 3.1)', () => {
  it('koordinat A1, A2, A3', () => {
    expect(SAYAP_DUA.a1).toEqual({ x0: -2.0, y0: 11.2, x1: 6.4, y1: 17.2 });
    expect(SAYAP_DUA.a2a).toEqual({ x0: 6.4, y0: 15.6, x1: 10.4, y1: 17.2 });
    expect(SAYAP_DUA.a2b).toEqual({ x0: 2.0, y0: 17.2, x1: 10.4, y1: 19.9 });
    expect(SAYAP_DUA.a3).toEqual({ x0: 10.45, y0: 15.7, x1: 11.55, y1: 17.46 });
  });

  it('tidak beririsan dengan jalur kaki, pangkalan, sayap barat, tiang bendera, dan slot luapan terakhir', () => {
    const jalurKaki: Persegi = { x0: X_JALUR_KAKI - 0.34, y0: -100, x1: X_JALUR_KAKI + 0.34, y1: 100 };
    const [fx, fy] = TIANG_BENDERA;
    const bendera: Persegi = { x0: fx - 0.2, y0: fy - 0.2, x1: fx + 0.2, y1: fy + 0.2 };
    // Slot luapan terakhir di ujung JALUR_ANTREAN, selebar dua kolom antrean.
    const [lx, ly] = JALUR_ANTREAN[JALUR_ANTREAN.length - 1]!;
    const luapan: Persegi = { x0: lx - 0.2, y0: ly - 0.2, x1: lx + 0.2, y1: ly + 0.2 };
    for (const [nama, a] of BAGIAN) {
      for (const [lain, b] of [
        ['jalur kaki', jalurKaki],
        ['pangkalan', PANGKALAN],
        ['sayap barat', SAYAP_BARAT],
        ['tiang bendera', bendera],
        ['luapan', luapan],
      ] as const) {
        expect(beririsan(a, b), `${nama} × ${lain}`).toBe(false);
      }
    }
  });

  it('bagian sayap bersambung: teras menempel A1, tangga di sisi timur teras', () => {
    expect(SAYAP_DUA.a2a.x0).toBe(SAYAP_DUA.a1.x1);
    expect(SAYAP_DUA.a2b.y0).toBe(SAYAP_DUA.a1.y1);
    expect(SAYAP_DUA.a3.x0).toBeGreaterThanOrEqual(SAYAP_DUA.a2a.x1);
    expect(SAYAP_DUA.a3.x0 - SAYAP_DUA.a2a.x1).toBeLessThan(0.1);
  });

  it('jendela, kursi, meja, & kios berada di lantainya dan tidak saling tumpuk', () => {
    const { a1, a2a, a2b } = SAYAP_DUA;
    const di = (p: Persegi, x: number, y: number): boolean => x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1;
    for (const j of LOKET_L2) {
      expect(di(a1, j.x, j.y)).toBe(true);
      expect(di(a1, j.petugas[0], j.petugas[1])).toBe(true);
      expect(di(a1, j.pembeli[0], j.pembeli[1])).toBe(true);
    }
    for (const [x, y] of MEJA_L2) expect(di(a1, x, y)).toBe(true);
    for (const [x, y] of MEJA_TERAS) expect(di(a2b, x, y)).toBe(true);
    for (const f of KIOS_TERAS) expect(beririsan(f, { x0: a2a.x0, y0: a2a.y0, x1: a2a.x1, y1: a2a.y1 })).toBe(true);
    const lebar = KURSI.jarak * KURSI.perBaris;
    const panjang = (KURSI.jumlahBaris - 1) * KURSI.jarakBaris + 0.14;
    const kotakBlok = BLOK_KURSI_L2.map((b): Persegi => ({ x0: b.x0, y0: b.yBaris0 - 0.07, x1: b.x0 + lebar, y1: b.yBaris0 - 0.07 + panjang }));
    for (const p of kotakBlok) {
      expect(p.x1).toBeCloseTo(p.x0 + lebar);
      expect(p.x0).toBeGreaterThan(a1.x0);
      expect(p.y1).toBeLessThan(a1.y1);
      for (const [x, y] of MEJA_L2) expect(di(p, x, y)).toBe(false);
    }
    kotakBlok.forEach((p, i) => kotakBlok.slice(i + 1).forEach((q) => expect(beririsan(p, q)).toBe(false)));
  });

  it('teras menjorok melewati pagar kompleks, proyek tahap 4–5 tetap di lapangan timur', () => {
    expect(SAYAP_DUA.a2b.y1).toBeGreaterThan(Y_PAGAR);
    for (const l of [LOKASI_PROYEK[3]!, LOKASI_PROYEK[4]!]) expect(l.pagar).toEqual([{ x0: 53.4, y0: 6.0, x1: 57.7, y1: 14.8 }]);
    expect(LOKASI_PROYEK[3]!.crane).toEqual({ x: 55.6, y: 10.4, tinggi: 5.2, lengan: 5.0, arah: 2.4 });
    expect(LOKASI_PROYEK[4]!.crane).toEqual({ x: 55.4, y: 8.4, tinggi: 6.0, lengan: 5.4, arah: 3.6 });
  });
});

describe('mesh gabungan per bagian denah', () => {
  /** Satu kotak non-indexed = 36 verteks. */
  const V = 36;
  const bahan = (): THREE.Material => new THREE.MeshBasicMaterial();
  const isi = (k: Kumpulan, m: THREE.Material, bagian: BagianDenah, jumlah: number): void => {
    k.bagian = bagian;
    for (let i = 0; i < jumlah; i++) k.tambah(m, kotak(0, 0, 1, 1, 0, 1));
    k.bagian = 'dasar';
  };

  it('tiap keadaan adalah satu rentang bersambung dari [lahan][dasar][sayap], urutan tambah() tidak berpengaruh', () => {
    const k = new Kumpulan();
    const m = bahan();
    isi(k, m, 'sayap', 3);
    isi(k, m, 'dasar', 2);
    isi(k, m, 'lahan', 1);
    const induk = new THREE.Group();
    const potongan = k.bangun(induk);
    expect(potongan).toHaveLength(1);
    expect(induk.children).toHaveLength(1);
    const [p] = potongan;
    expect([p!.lahan, p!.dasar, p!.sayap]).toEqual([V, 2 * V, 3 * V]);
    const rentang = (): readonly [number, number] => [p!.mesh.geometry.drawRange.start, p!.mesh.geometry.drawRange.count];
    tampilkanBagian(potongan, 'lahan');
    expect(rentang()).toEqual([0, 3 * V]);
    tampilkanBagian(potongan, 'proyek');
    expect(rentang()).toEqual([V, 2 * V]);
    tampilkanBagian(potongan, 'berdiri');
    expect(rentang()).toEqual([V, 5 * V]);
  });

  it('bahan yang hanya dipakai satu bagian disembunyikan di keadaan lain: three.js tetap menggambar rentang kosong', () => {
    const k = new Kumpulan();
    isi(k, bahan(), 'sayap', 1);
    const potongan = k.bangun(new THREE.Group());
    tampilkanBagian(potongan, 'lahan');
    expect(potongan[0]!.mesh.visible).toBe(false);
    tampilkanBagian(potongan, 'proyek');
    expect(potongan[0]!.mesh.visible).toBe(false);
    tampilkanBagian(potongan, 'berdiri');
    expect(potongan[0]!.mesh.visible).toBe(true);
  });

  it('mesh yang seluruhnya bagian dasar tidak ikut dipotong', () => {
    const k = new Kumpulan();
    isi(k, bahan(), 'dasar', 2);
    expect(k.bangun(new THREE.Group())).toEqual([]);
  });
});

describe('mesh per unit', () => {
  const V = 36;
  const buat = (): { k: KumpulanUnit; induk: THREE.Group } => {
    const k = new KumpulanUnit();
    const m = new THREE.MeshBasicMaterial();
    for (const [unit, jumlah] of [[0, 1], [5, 2], [9, 1]] as const) for (let i = 0; i < jumlah; i++) k.tambah(unit, m, kotak(0, 0, 1, 1, 0, 1));
    const induk = new THREE.Group();
    k.bangun(induk);
    return { k, induk };
  };

  it('tetap satu mesh per bahan, dan unit yang tampil dipilih lewat index buffer', () => {
    const { k, induk } = buat();
    expect(induk.children).toHaveLength(1);
    const mesh = induk.children[0] as THREE.Mesh;
    expect(mesh.visible).toBe(false);
    k.tampilkan((u) => u === 5);
    expect(mesh.visible).toBe(true);
    expect(mesh.geometry.drawRange.count).toBe(2 * V);
    expect(mesh.geometry.index!.getX(0)).toBe(V);
    k.tampilkan((u) => u !== 5);
    expect(mesh.geometry.drawRange.count).toBe(2 * V);
    expect(mesh.geometry.index!.getX(0)).toBe(0);
    expect(mesh.geometry.index!.getX(V)).toBe(3 * V);
  });

  it('tanpa unit yang tampil, mesh disembunyikan supaya tidak ada draw call kosong', () => {
    const { k, induk } = buat();
    k.tampilkan(() => true);
    expect(induk.children[0]!.visible).toBe(true);
    k.tampilkan(() => false);
    expect(induk.children[0]!.visible).toBe(false);
  });
});

describe('pengunjung lantai 2', () => {
  const SEMUA = Array.from({ length: MAKS_PENGUNJUNG }, (_, i) => i);
  const LANGKAH = 0.25;
  const DURASI = 400;

  it('jumlahnya mengikuti unit terbuka & keramaian, paling banyak 12', () => {
    const penuh = isiLantai2(bangunan(24, 8, 4), 24, JAM_SIANG);
    const kosong = isiLantai2(bangunan(8, 4, 2), 8, JAM_SIANG);
    expect(jumlahPengunjung(kosong, 1)).toBe(4);
    expect(jumlahPengunjung(penuh, 1)).toBe(12);
    expect(jumlahPengunjung(penuh, 0.5)).toBe(6);
    expect(jumlahPengunjung(penuh, 0)).toBe(0);
    expect(jumlahPengunjung(penuh, 2)).toBe(MAKS_PENGUNJUNG);
  });

  it('berjalan dengan laju wajar dan tinggi yang halus, tanpa loncatan', () => {
    for (const i of SEMUA) {
      let lalu = posisiPengunjung(i, 0);
      lalu = { ...lalu };
      for (let t = LANGKAH; t < DURASI; t += LANGKAH) {
        const p = { ...posisiPengunjung(i, t) };
        const jarak = Math.hypot(p.x - lalu.x, p.y - lalu.y, p.h - lalu.h);
        // Melewati batas putaran (kembali ke titik awal) tetap tanpa loncatan: rutenya tertutup.
        expect(jarak, `orang ${i} detik ${t}`).toBeLessThan(KECEPATAN_JALAN * LANGKAH * 1.5 + 1e-6);
        lalu = p;
      }
    }
  });

  it('terlihat naik & turun lewat lajurnya, dan tingginya mengikuti tangga', () => {
    const { naik, turun, yBordes, y1 } = TANGGA_L2;
    for (const i of SEMUA) {
      let naikTerlihat = false;
      let turunTerlihat = false;
      for (let t = 0; t < DURASI; t += LANGKAH) {
        const p = posisiPengunjung(i, t);
        if (p.y <= yBordes || p.y >= y1) continue;
        const diNaik = p.x >= naik[0] && p.x <= naik[1];
        const diTurun = p.x >= turun[0] && p.x <= turun[1];
        if (!diNaik && !diTurun) continue;
        expect(p.h).toBeCloseTo(tinggiTanggaL2(p.y), 5);
        naikTerlihat ||= diNaik;
        turunTerlihat ||= diTurun;
      }
      expect(naikTerlihat, `orang ${i} naik`).toBe(true);
      expect(turunTerlihat, `orang ${i} turun`).toBe(true);
    }
  });

  it('di dalam tapak bangunan selalu di lantai atas: tidak menembus pelat', () => {
    const { a1, a2a, a2b } = SAYAP_DUA;
    const di = (p: Persegi, x: number, y: number): boolean => x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1;
    for (const i of SEMUA) {
      for (let t = 0; t < DURASI; t += LANGKAH) {
        const p = posisiPengunjung(i, t);
        if (di(a1, p.x, p.y) || di(a2a, p.x, p.y) || di(a2b, p.x, p.y)) expect(p.h, `orang ${i} detik ${t}`).toBeCloseTo(H_LANTAI_2, 5);
      }
    }
  });

  it('duduk 20–40 detik di bangkunya, setengah di teras dan setengah di lantai 2', () => {
    for (const i of SEMUA) {
      let lama = 0;
      for (let t = 0; t < DURASI; t += LANGKAH) if (posisiPengunjung(i, t).duduk) lama += LANGKAH;
      expect(lama, `orang ${i}`).toBeGreaterThanOrEqual(20 - 1);
      const duduk = Array.from({ length: DURASI / LANGKAH }, (_, k) => ({ ...posisiPengunjung(i, k * LANGKAH) })).find((p) => p.duduk)!;
      expect(duduk.h).toBeCloseTo(H_LANTAI_2, 5);
      expect(diSayapDua(duduk.x, duduk.y)).toBe(!pengunjungDiTeras(i));
    }
    expect(SEMUA.filter(pengunjungDiTeras)).toHaveLength(6);
  });

  it('objek hasil boleh dipakai ulang, supaya lingkaran frame tidak mengalokasi', () => {
    const keluar = { x: 0, y: 0, h: 0, duduk: false, hadap: 0 };
    expect(posisiPengunjung(3, 50, keluar)).toBe(keluar);
    expect(keluar.x).toBe(posisiPengunjung(3, 50).x);
  });
});
