import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  AMBANG_PELINTIR,
  arahKamera,
  AZIMUT_LANSKAP,
  AZIMUT_POTRET,
  bingkaiAwal,
  ELEVASI_KAMERA,
  FOV_KAMERA,
  JENDELA_POTRET,
  PelacakPelintir,
  selisihSudut,
  type BingkaiKamera,
} from '../src/game/kamera';
import { GEDUNG, JALAN, MULUT_ANTREAN, PANGKALAN, PULAU_JURUSAN, TITIK_INTI, TITIK_INTI_POTRET, Y_LUAPAN, ZONA } from '../src/game/tata-letak';

type V3 = readonly [number, number, number];
const kali = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const silang = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Titik denah (x, y, tinggi) di layar adegan (px CSS) seperti PerspectiveCamera three.js yang
 * menatap titik pandang (basis dari perkalian silang, bukan rumus bingkaiJendela).
 */
function proyeksi(b: BingkaiKamera, azimut: number, lebar: number, tinggi: number, [x, y, h]: V3): { x: number; y: number; dalam: number } {
  const d = arahKamera(azimut);
  const maju: V3 = [-d[0], -d[1], -d[2]];
  const k = silang(maju, [0, 1, 0]);
  const panjang = Math.hypot(...k);
  const kanan: V3 = [k[0] / panjang, k[1] / panjang, k[2] / panjang];
  const atas = silang(kanan, maju);
  const q: V3 = [x - b.x, h, y - b.y];
  const dalam = b.jarak - kali(q, d);
  const tanV = Math.tan((FOV_KAMERA * Math.PI) / 360);
  const tanH = (tanV * lebar) / tinggi;
  return { x: ((kali(q, kanan) / (dalam * tanH) + 1) / 2) * lebar, y: ((1 - kali(q, atas) / (dalam * tanV)) / 2) * tinggi, dalam };
}

/**
 * Bingkai kamera 0.3.1 (adegan.ts sebelum documents/14), disalin apa adanya dengan three.js
 * sebagai pembanding: arah tenggara 45°, titik pandang di tengah kotak titik, batas zoom 1,25×.
 */
function bingkai031(titik: readonly V3[], lebar: number, tinggi: number, margin = 0.94): { target: THREE.Vector3; posisi: THREE.Vector3; d: THREE.Vector3; jarakMaks: number } {
  const elevasi = (42 * Math.PI) / 180;
  const d = new THREE.Vector3(Math.cos(elevasi) * Math.SQRT1_2, Math.sin(elevasi), Math.cos(elevasi) * Math.SQRT1_2);
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [x, y] of titik) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, y);
    z1 = Math.max(z1, y);
  }
  const target = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const maju = d.clone().negate();
  const kanan = new THREE.Vector3().crossVectors(maju, new THREE.Vector3(0, 1, 0)).normalize();
  const atas = new THREE.Vector3().crossVectors(kanan, maju);
  const tanV = Math.tan(THREE.MathUtils.degToRad(26 / 2)) * margin;
  const tanH = tanV * (lebar / tinggi);
  let jarak = 10;
  for (const [x, y, h] of titik) {
    const q = new THREE.Vector3(x, h, y).sub(target);
    const dalam = q.dot(d);
    jarak = Math.max(jarak, dalam + Math.abs(q.dot(kanan)) / tanH, dalam + Math.abs(q.dot(atas)) / tanV);
  }
  return { target, posisi: target.clone().addScaledVector(d, jarak), d, jarakMaks: jarak * 1.25 };
}

/** Titik inti portrait 0.3.1: pangkalan, gedung utama, ruang tunggu (peron di barat terpotong). */
const TITIK_POTRET_031: readonly V3[] = [[PULAU_JURUSAN[1]! - 1, PANGKALAN.y0, 0], [PULAU_JURUSAN[1]! - 1, JALAN.y0, 0], ...TITIK_INTI.slice(2)];

/**
 * Area adegan portrait (px CSS) di layar 540×960, diukur: 622 tanpa baris tujuan (tutorial,
 * acuan sekarang-05) dan 590 dengan baris tujuan; Pixel 412×915 dan HP 360×800 (diukur di 0.3.1).
 */
const ADEGAN_POTRET = [
  { lebar: 540, tinggi: 622 },
  { lebar: 540, tinggi: 590 },
  { lebar: 412, tinggi: 657 },
  { lebar: 360, tinggi: 575 },
] as const;
/** Area adegan landscape (px CSS): layar 900×420 (diukur, panel di kanan), desktop, dan HP lebar. */
const ADEGAN_LANSKAP = [
  { lebar: 667, tinggi: 420 },
  { lebar: 1100, tinggi: 640 },
  { lebar: 560, tinggi: 360 },
] as const;
/** Label zona dan lebarnya (px CSS, terukur di Chrome); tingginya 20 px, digambar di atas titiknya. */
const LABEL_ZONA: readonly (readonly [string, V3, number])[] = [
  ['PERON', ZONA.peron.label, 65],
  ['LOKET', ZONA.loket.label, 62],
  ['KEBERANGKATAN', ZONA.keberangkatan.label, 124],
];
/** Kolom tombol kanan portrait (px logis; lebar layar logis 720): mulai x 656, sampai y 499 dari atas adegan. */
const KOLOM_TOMBOL = { x0: 656, y1: 499 } as const;
/** Aula loket dan antreannya (tepi selatan gedung, mulut antrean, ujung luapan, pusat aula). */
const AULA: readonly V3[] = [
  [GEDUNG.x0, GEDUNG.y1, 0.12],
  [GEDUNG.x1, GEDUNG.y1, 0.12],
  [MULUT_ANTREAN[0], MULUT_ANTREAN[1] + 0.3, 0],
  [15.4, Y_LUAPAN, 0],
];
const PUSAT_AULA: V3 = [(GEDUNG.x0 + GEDUNG.x1) / 2, (GEDUNG.y0 + GEDUNG.y1) / 2, 0.12];

/** Dua jari berseberangan di sekitar (cx, cy) dengan jarak r dan sudut a (layar, y ke bawah). */
function jari(p: PelacakPelintir, a: number, r: number, cx = 200, cy = 300): number {
  const dx = Math.cos(a) * r;
  const dy = Math.sin(a) * r;
  return p.gerak(1, cx - dx, cy - dy) + p.gerak(2, cx + dx, cy + dy);
}

describe('rotasi kamera (pelintir dua jari)', () => {
  it('selisih sudut dibungkus ke (−π, π]', () => {
    expect(selisihSudut(0.1, 0.3)).toBeCloseTo(0.2, 12);
    expect(selisihSudut(3.1, -3.1)).toBeCloseTo(2 * Math.PI - 6.2, 12);
    expect(selisihSudut(-3.1, 3.1)).toBeCloseTo(-(2 * Math.PI - 6.2), 12);
  });

  it('cubit zoom (jari menjauh segaris) tidak memutar', () => {
    const p = new PelacakPelintir();
    p.turun(1, 150, 300);
    p.turun(2, 250, 300);
    let total = 0;
    for (let r = 50; r < 150; r += 5) total += jari(p, 0, r);
    expect(total).toBe(0);
  });

  it('pelintir kecil di bawah ambang diabaikan; lewat ambang mengikuti jari searah jarum jam', () => {
    const p = new PelacakPelintir();
    p.turun(1, 150, 300);
    p.turun(2, 250, 300);
    let total = 0;
    for (let a = 0; a <= AMBANG_PELINTIR * 0.8; a += 0.01) total += jari(p, a, 50);
    expect(total).toBe(0);
    // Terus dipelintir searah jarum jam (sudut layar naik) sampai 60°.
    for (let a = AMBANG_PELINTIR * 0.8; a <= Math.PI / 3; a += 0.01) total += jari(p, a, 50);
    expect(total).toBeGreaterThan(Math.PI / 3 - 0.03);
    expect(total).toBeLessThan(Math.PI / 3 + 0.03);
    // Berbalik arah: ikut berbalik tanpa ambang lagi.
    const balik = jari(p, Math.PI / 3 - 0.2, 50);
    expect(balik).toBeLessThan(0);
  });

  it('mengangkat satu jari mengulang pelacakan (tidak ada lompatan saat jari turun lagi)', () => {
    const p = new PelacakPelintir();
    p.turun(1, 150, 300);
    p.turun(2, 250, 300);
    for (let a = 0; a <= 0.6; a += 0.02) jari(p, a, 50);
    p.angkat(2);
    p.turun(2, 200, 400); // posisi berbeda jauh
    expect(p.gerak(2, 201, 400)).toBe(0);
    expect(p.gerak(1, 150, 300)).toBe(0);
  });
});

describe('bingkai kamera awal (documents/14 bagian 4.3)', () => {
  it('landscape tetap dari tenggara 45° seperti 0.3.1', () => {
    const [x, h, y] = arahKamera(AZIMUT_LANSKAP);
    expect(x).toBeCloseTo(Math.cos(ELEVASI_KAMERA) * Math.SQRT1_2, 12);
    expect(h).toBeCloseTo(Math.sin(ELEVASI_KAMERA), 12);
    expect(y).toBeCloseTo(Math.cos(ELEVASI_KAMERA) * Math.SQRT1_2, 12);
  });

  for (const { lebar, tinggi } of ADEGAN_LANSKAP) {
    it(`${lebar}×${tinggi} landscape: titik pandang, posisi kamera, dan batas zoom sama dengan 0.3.1`, () => {
      const lama = bingkai031(TITIK_INTI, lebar, tinggi);
      const b = bingkaiAwal(TITIK_INTI, TITIK_INTI, lebar, tinggi);
      expect(b.azimut).toBe(AZIMUT_LANSKAP);
      const [dx, dh, dy] = arahKamera(b.azimut);
      const hasil = [b.x, b.y, b.x + dx * b.jarak, dh * b.jarak, b.y + dy * b.jarak, b.jarakMaks];
      const harapan = [lama.target.x, lama.target.z, lama.posisi.x, lama.posisi.y, lama.posisi.z, lama.jarakMaks];
      hasil.forEach((v, i) => expect(v).toBeCloseTo(harapan[i]!, 9));
    });
  }

  it('orientasi seperti terminal3d (lebar > tinggi = landscape); arah awal untuk kompas ikut orientasi', () => {
    expect(bingkaiAwal(TITIK_INTI_POTRET, TITIK_INTI, 540, 540).azimut).toBe(AZIMUT_POTRET);
    expect(bingkaiAwal(TITIK_INTI, TITIK_INTI, 541, 540).azimut).toBe(AZIMUT_LANSKAP);
  });

  for (const { lebar, tinggi } of ADEGAN_POTRET) {
    const b = bingkaiAwal(TITIK_INTI_POTRET, TITIK_INTI, lebar, tinggi);
    const layar = (t: V3): { x: number; y: number; dalam: number } => proyeksi(b, AZIMUT_POTRET, lebar, tinggi, t);

    it(`${lebar}×${tinggi}: dari AZIMUT_POTRET, lebih dekat dari 0.3.1; zoom keluar maksimal memuat seluruh terminal`, () => {
      expect(b.azimut).toBe(AZIMUT_POTRET);
      const lama = bingkai031(TITIK_POTRET_031, lebar, tinggi);
      expect(b.jarak).toBeLessThan(lama.posisi.distanceTo(lama.target));
      // Zoom keluar penuh dari titik pandang awal: seluruh terminal (TITIK_INTI) di dalam layar.
      // (Jaraknya bisa sedikit di bawah 0.3.1 di HP sempit: dari 55° pita terminal lebih tegak.)
      const maks: BingkaiKamera = { x: b.x, y: b.y, jarak: b.jarakMaks };
      for (const t of TITIK_INTI) {
        const p = proyeksi(maks, AZIMUT_POTRET, lebar, tinggi, t);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(lebar);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(tinggi);
      }
    });

    it(`${lebar}×${tinggi}: titik inti di dalam jendela, satu sisi pas (sedekat mungkin)`, () => {
      const p = TITIK_INTI_POTRET.map(layar);
      const xs = p.map((q) => q.x);
      const ys = p.map((q) => q.y);
      const j = JENDELA_POTRET;
      expect(Math.min(...xs)).toBeGreaterThan(j.kiri - 0.5);
      expect(Math.max(...xs)).toBeLessThan(lebar - j.kanan + 0.5);
      expect(Math.min(...ys)).toBeGreaterThan(j.atas - 0.5);
      expect(Math.max(...ys)).toBeLessThan(tinggi * (1 - j.bawah) + 0.5);
      const pasDatar = Math.min(...xs) < j.kiri + 1 && Math.max(...xs) > lebar - j.kanan - 1;
      const pasTegak = Math.min(...ys) < j.atas + 1 && Math.max(...ys) > tinggi * (1 - j.bawah) - 1;
      expect(pasDatar || pasTegak).toBe(true);
    });

    it(`${lebar}×${tinggi}: label PERON, LOKET, KEBERANGKATAN utuh dan tidak di bawah kolom tombol`, () => {
      const skala = lebar / 720;
      for (const [nama, titik, lebarLabel] of LABEL_ZONA) {
        const p = layar(titik);
        // zona3d.ts menjepit label ke dalam layar (tepi 4 px, bawah label ≥ 56 px); di sini tidak perlu dijepit.
        expect(p.x - lebarLabel / 2, nama).toBeGreaterThanOrEqual(4);
        expect(p.x + lebarLabel / 2, nama).toBeLessThanOrEqual(lebar - 4);
        expect(p.y, nama).toBeGreaterThanOrEqual(56 - 0.5);
        // Di atas 22% bawah: tidak tertutup gelembung tutorial.
        expect(p.y, nama).toBeLessThanOrEqual(tinggi * 0.78 + 0.5);
        const diBawahKolom = p.x + lebarLabel / 2 > KOLOM_TOMBOL.x0 * skala && p.y - 20 < KOLOM_TOMBOL.y1 * skala;
        expect(diBawahKolom, nama).toBe(false);
      }
    });

    it(`${lebar}×${tinggi}: 22% bawah adegan bebas dari aula, loket, dan antrean loket`, () => {
      for (const t of [...AULA, PUSAT_AULA, ZONA.loket.label]) expect(layar(t).y).toBeLessThanOrEqual(tinggi * 0.78 + 0.5);
    });
  }

  for (const tinggi of [622, 590]) {
    it(`540×${tinggi}: orang di aula ±1,3× lebih tinggi dari sekarang-05 (0.3.1, 540×622); aula di tengah atas`, () => {
      const lama = bingkai031(TITIK_POTRET_031, 540, 622);
      const dalamLama = lama.posisi.clone().sub(new THREE.Vector3(PUSAT_AULA[0], PUSAT_AULA[2], PUSAT_AULA[1])).dot(lama.d);
      const b = bingkaiAwal(TITIK_INTI_POTRET, TITIK_INTI, 540, tinggi);
      const aula = proyeksi(b, AZIMUT_POTRET, 540, tinggi, PUSAT_AULA);
      // Tinggi orang di layar ∝ tinggi adegan ÷ kedalaman (sudut pandang tegak tetap).
      expect(tinggi / aula.dalam / (622 / dalamLama)).toBeGreaterThanOrEqual(1.3);
      expect(aula.x / 540).toBeGreaterThan(0.35);
      expect(aula.x / 540).toBeLessThan(0.65);
      // Bukan 35–50%: dengan label PERON di atas dan ±1,3× pusat aula paling tinggi ±55%
      // (documents/14 bagian 4.3, jalur cadangan; lihat AZIMUT_POTRET). Tetap di atas 22% bawah.
      expect(aula.y / tinggi).toBeGreaterThan(0.35);
      expect(aula.y / tinggi).toBeLessThan(0.6);
    });
  }
});
