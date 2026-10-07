/**
 * Tampilan kelas bus di adegan (murni, tanpa DOM & three.js): ukuran badan
 * tiap kelas dan tata letak gambar samping kelas yang dilukis (jendela, kaca
 * depan, pintu, bagasi, area nama, pola cat) dalam satuan dunia, supaya pintu
 * & bagasi yang tergambar tepat di pintu & bagasi 3D (lihat tata-letak.ts).
 * lembar-bus.ts yang melukisnya ke lembar livery.
 *
 * Koordinat sisi: x = jarak dari ujung belakang bus (0 … BUS.panjang, depan di
 * kanan), h = tinggi dari dasar badan (0 … (1 − LENGKUNG.y) × tinggi badan; di
 * atasnya lengkung atap).
 */
import type { KelasBusId } from '../sim/fitur';
import { BAGASI, BUS, PINTU_BUS } from './tata-letak';

/** Lengkung atap badan bus dalam satuan badan (lebar & tinggi dinormalkan 1). */
export const LENGKUNG = { z: 0.14, y: 0.13, segmen: 4 } as const;

/** Tinggi dasar badan dari aspal (badan bus diletakkan sedikit di atas jalan). */
export const DASAR_BADAN = 0.02;

/** Roda bus terminal: pusat sepanjang badan (0 = belakang, 1 = depan) & jari-jari (unit). */
export const RODA_BUS = { u: [0.255, 0.735], r: 0.105 } as const;

/**
 * Panjang lintasan sisi badan dari bawah sampai puncak lengkung atap (satuan
 * badan ternormalkan): tekstur sisi direntangkan sepanjang lintasan ini.
 */
export function panjangSisiBadan(): number {
  const { z: rz, y: ry, segmen } = LENGKUNG;
  let panjang = 1 - ry;
  let z0 = 0.5;
  let y0 = 1 - ry;
  for (let i = 1; i <= segmen; i++) {
    const a = (i / segmen) * (Math.PI / 2);
    const z = 0.5 - rz + Math.cos(a) * rz;
    const y = 1 - ry + Math.sin(a) * ry;
    panjang += Math.hypot(z - z0, y - y0);
    z0 = z;
    y0 = y;
  }
  return panjang;
}

/** Tinggi (unit) sisi tegak badan sebelum lengkung atap. */
export const tinggiSisiTegak = (tinggiBadan: number): number => (1 - LENGKUNG.y) * tinggiBadan;

/** Persegi di sisi bus (satuan dunia, lihat koordinat di atas). */
export interface Kotak {
  readonly x0: number;
  readonly x1: number;
  readonly h0: number;
  readonly h1: number;
}

/** Tata letak sisi kelas bus yang dilukis (bukan gambar atlas). */
export interface TataLukis {
  /** Jendela penumpang (kaca gelap). */
  readonly jendela: readonly Kotak[];
  /** Tiang jendela di pita jendela yang panjang (jarak antartiang, unit); 0 = tanpa tiang. */
  readonly jarakTiang: number;
  /** Gorden di tiap jendela (kabin tidur sleeper). */
  readonly gorden: boolean;
  /** Kaca depan dilihat dari samping (atasnya miring ke belakang). */
  readonly kacaDepan: readonly Kotak[];
  readonly pintu: Kotak;
  /** Tutup bagasi di bawah lantai; yang tengah tepat di pintu bagasi 3D. */
  readonly bagasi: readonly Kotak[];
  /** Area tulisan nama PO (atau nama kelas untuk bus tanpa PO). */
  readonly nama: Kotak;
  /** Pola cat: tinggi garis aksen, batas bawah dua warna, dan garis tengah sapuan (h di x = 0 & x = panjang). */
  readonly pola: { readonly garis: readonly (readonly [number, number])[]; readonly dua: number; readonly sapuan: readonly [number, number] };
}

export interface TampilKelasBus {
  /** Tinggi badan (unit). */
  readonly tinggi: number;
  /** Tinggi lubang pintu depan dari dasar badan (unit). */
  readonly tinggiPintu: number;
  /** null = gambar samping dari atlas (bus kota); selain itu dilukis dengan tata letak ini. */
  readonly lukis: TataLukis | null;
  /** Atap: palka (tanpa AC), unit AC, atau AC panjang ramping. */
  readonly atap: 'palka' | 'ac' | 'acPanjang';
}

const L = BUS.panjang;
/** Pintu depan (lubang pintu 3D selebar 0,2 berpusat di PINTU_BUS). */
const X_PINTU = L / 2 + PINTU_BUS;
const LEBAR_PINTU = 0.2;
/** Tutup bagasi: tengah = pintu bagasi 3D, dua di sampingnya sampai lengkung roda. */
const BAGASI_TENGAH: Kotak = { x0: L / 2 + BAGASI.a - BAGASI.lebar / 2, x1: L / 2 + BAGASI.a + BAGASI.lebar / 2, h0: BAGASI.bawah - DASAR_BADAN, h1: BAGASI.atas - DASAR_BADAN };
/** Jari-jari lengkung roda yang digambar (sedikit lebih besar dari roda 3D). */
export const JARI_LENGKUNG_RODA = 0.13;
const X_RODA = RODA_BUS.u.map((u) => u * L) as [number, number];
const bagasiSamping = (): Kotak[] => [
  { x0: X_RODA[0] + JARI_LENGKUNG_RODA + 0.02, x1: BAGASI_TENGAH.x0 - 0.015, h0: BAGASI_TENGAH.h0, h1: BAGASI_TENGAH.h1 },
  BAGASI_TENGAH,
  { x0: BAGASI_TENGAH.x1 + 0.015, x1: X_RODA[1] - JARI_LENGKUNG_RODA - 0.02, h0: BAGASI_TENGAH.h0, h1: BAGASI_TENGAH.h1 },
];
const pintuSampai = (h1: number): Kotak => ({ x0: X_PINTU - LEBAR_PINTU / 2, x1: X_PINTU + LEBAR_PINTU / 2, h0: 0.03, h1 });

/** Jendela berjajar sama lebar dari x0 sampai x1. */
function barisJendela(x0: number, x1: number, h0: number, h1: number, jumlah: number, celah: number): Kotak[] {
  const lebar = (x1 - x0 - celah * (jumlah - 1)) / jumlah;
  return Array.from({ length: jumlah }, (_, i) => ({ x0: x0 + i * (lebar + celah), x1: x0 + i * (lebar + celah) + lebar, h0, h1 }));
}

/**
 * - ekonomi: bus kota dari atlas, atap berpalka (tanpa AC);
 * - patas: bus kota dari atlas dengan unit AC di atap;
 * - eksekutif: high deck, satu pita kaca gelap panjang, nama besar di badan bawah;
 * - sleeper: lebih tinggi, dua baris jendela kecil bergorden (kabin tidur);
 * - tingkat (double decker): dua dek, pintu hanya di dek bawah.
 */
export const TAMPIL_KELAS_BUS: Readonly<Record<KelasBusId, TampilKelasBus>> = {
  ekonomi: { tinggi: 0.8, tinggiPintu: 0.56, lukis: null, atap: 'palka' },
  patas: { tinggi: 0.8, tinggiPintu: 0.56, lukis: null, atap: 'ac' },
  eksekutif: {
    tinggi: 0.88,
    tinggiPintu: 0.63,
    atap: 'acPanjang',
    lukis: {
      jendela: [{ x0: 0.1, x1: X_PINTU - LEBAR_PINTU / 2 - 0.03, h0: 0.41, h1: 0.71 }],
      jarakTiang: 0.3,
      gorden: false,
      kacaDepan: [{ x0: X_PINTU + LEBAR_PINTU / 2 + 0.02, x1: L, h0: 0.37, h1: 0.74 }],
      pintu: pintuSampai(0.66),
      bagasi: bagasiSamping(),
      nama: { x0: 0.14, x1: 1.8, h0: 0.255, h1: 0.37 },
      pola: { garis: [[0.378, 0.395], [0.236, 0.248]], dua: 0.385, sapuan: [0.14, 0.66] },
    },
  },
  sleeper: {
    tinggi: 0.92,
    tinggiPintu: 0.63,
    atap: 'acPanjang',
    lukis: {
      jendela: [...barisJendela(0.12, X_PINTU - LEBAR_PINTU / 2 - 0.05, 0.54, 0.69, 8, 0.05), ...barisJendela(0.12, X_PINTU - LEBAR_PINTU / 2 - 0.05, 0.31, 0.46, 8, 0.05)],
      jarakTiang: 0,
      gorden: true,
      kacaDepan: [{ x0: X_PINTU - LEBAR_PINTU / 2, x1: L, h0: 0.66, h1: 0.77 }, { x0: X_PINTU + LEBAR_PINTU / 2 + 0.02, x1: L, h0: 0.36, h1: 0.66 }],
      pintu: pintuSampai(0.66),
      bagasi: bagasiSamping(),
      nama: { x0: 0.14, x1: 1.8, h0: 0.703, h1: 0.79 },
      pola: { garis: [[0.284, 0.297], [0.236, 0.248]], dua: 0.29, sapuan: [0.1, 0.62] },
    },
  },
  tingkat: {
    tinggi: 0.98,
    tinggiPintu: 0.47,
    atap: 'acPanjang',
    lukis: {
      jendela: [
        { x0: 0.08, x1: L - 0.2, h0: 0.57, h1: 0.8 },
        { x0: 0.1, x1: X_PINTU - LEBAR_PINTU / 2 - 0.03, h0: 0.3, h1: 0.44 },
      ],
      jarakTiang: 0.34,
      gorden: false,
      kacaDepan: [{ x0: L - 0.18, x1: L, h0: 0.55, h1: 0.82 }, { x0: X_PINTU + LEBAR_PINTU / 2 + 0.02, x1: L, h0: 0.26, h1: 0.5 }],
      pintu: pintuSampai(0.5),
      bagasi: bagasiSamping(),
      nama: { x0: 0.14, x1: 1.8, h0: 0.458, h1: 0.545 },
      pola: { garis: [[0.548, 0.558], [0.262, 0.274]], dua: 0.268, sapuan: [0.12, 0.72] },
    },
  },
};

/** Tulisan kelas di papan depan & belakang bus (dan di badan bus kelas lukis tanpa mitra PO). */
export const LABEL_KELAS_BUS: Readonly<Record<KelasBusId, string>> = {
  ekonomi: 'EKONOMI',
  patas: 'PATAS AC',
  eksekutif: 'EKSEKUTIF',
  sleeper: 'SLEEPER',
  tingkat: 'DOUBLE DECKER',
};

/** Pusat roda yang digambar di sisi (x, h dari dasar badan). */
export function pusatRoda(): readonly (readonly [number, number])[] {
  return X_RODA.map((x) => [x, RODA_BUS.r - DASAR_BADAN] as const);
}

/**
 * Kelas bus terminal yang datang: salah satu kelas yang beroperasi, sebanding
 * `bobot` (bagian penumpang tiap kelas menurut harga tiket; tanpa bobot sama
 * rata). Tetap untuk bus yang sama selama daftar & bobotnya sama; pemanggil
 * menyimpannya per bus (bus yang sudah berjalan tidak berganti kelas).
 */
export function pilihKelasBus<K>(idBus: number, acak: number, beroperasi: readonly K[], bobot?: (kelas: K) => number): K {
  const u = (((idBus * 0.7548776662 + acak * 0.2837) % 1) + 1) % 1;
  const total = bobot ? beroperasi.reduce((a, k) => a + Math.max(0, bobot(k)), 0) : 0;
  if (!bobot || !(total > 0)) return beroperasi[Math.min(beroperasi.length - 1, Math.floor(u * beroperasi.length))]!;
  let sisa = u * total;
  for (const k of beroperasi) {
    sisa -= Math.max(0, bobot(k));
    if (sisa < 0) return k;
  }
  return beroperasi[beroperasi.length - 1]!;
}
