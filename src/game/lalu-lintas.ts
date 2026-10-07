/**
 * Lalu lintas dekoratif di jalan lingkungan belakang terminal (dua arah):
 * mobil & motor melaju konstan, menjaga jarak dengan kendaraan di depannya,
 * lalu muncul lagi di ujung lain. Murni TypeScript (tanpa three.js) supaya
 * perilakunya bisa dites; tidak terkait ekonomi.
 */
import { acakBerbenih } from './dunia-visual';

export type JenisKendaraanKecil = 'mobil' | 'motor' | 'angkot';

export interface KendaraanKecil {
  readonly id: number;
  readonly jenis: JenisKendaraanKecil;
  /** Indeks warna badan (dipetakan renderer). */
  readonly warna: number;
  /** +1 = ke arah +x, −1 = ke arah −x. */
  readonly arah: 1 | -1;
  x: number;
  readonly y: number;
  v: number;
  readonly vIngin: number;
  readonly panjang: number;
  /** Ikut melaju di jalan (terlihat). Kendaraan nonaktif menunggu di luar layar. */
  aktif: boolean;
  /** Aktif bila kepadatan > ambang ini (0–1, tetap per kendaraan). */
  readonly ambang: number;
}

export interface OpsiLaluLintas {
  readonly x0: number;
  readonly x1: number;
  /** Posisi y lajur ke arah +x dan ke arah −x. */
  readonly lajurTimur: number;
  readonly lajurBarat: number;
  readonly jumlahPerLajur: number;
  readonly benih?: number;
}

const PANJANG: Readonly<Record<JenisKendaraanKecil, number>> = { mobil: 0.9, angkot: 0.8, motor: 0.4 };
const JARAK_AMAN = 0.5;

/** Pecahan tetap per id (0–1), menyebar merata: urutan kendaraan/orang yang ikut aktif. */
const ambangId = (id: number): number => (id * 0.6180339887 + 0.13) % 1;

export class LaluLintas {
  readonly kendaraan: KendaraanKecil[] = [];
  /**
   * Porsi kendaraan yang melaju (0–1), mengikuti ritme harian. Kendaraan baru
   * ikut/berhenti saat membungkus di ujung jalan (di luar layar), jadi tidak
   * ada yang muncul atau hilang di depan mata.
   */
  kepadatan = 1;

  constructor(private readonly o: OpsiLaluLintas) {
    const acak = acakBerbenih(o.benih ?? 77);
    let id = 0;
    for (const arah of [1, -1] as const) {
      const y = arah === 1 ? o.lajurTimur : o.lajurBarat;
      const jarak = (o.x1 - o.x0) / o.jumlahPerLajur;
      for (let i = 0; i < o.jumlahPerLajur; i++) {
        const r = acak();
        const jenis: JenisKendaraanKecil = r < 0.45 ? 'motor' : r < 0.85 ? 'mobil' : 'angkot';
        const vIngin = jenis === 'motor' ? 2.4 + acak() * 0.9 : 2.0 + acak() * 0.8;
        this.kendaraan.push({
          id: id++,
          jenis,
          warna: Math.floor(acak() * 8),
          arah,
          x: o.x0 + i * jarak + acak() * jarak * 0.5,
          y,
          v: vIngin,
          vIngin,
          panjang: PANJANG[jenis],
          aktif: true,
          ambang: ambangId(id - 1),
        });
      }
    }
  }

  /** Terapkan kepadatan sekarang juga ke semua kendaraan (saat adegan baru dibuat). */
  aturKepadatanSegera(kepadatan: number): void {
    this.kepadatan = kepadatan;
    for (const k of this.kendaraan) k.aktif = k.ambang < kepadatan;
  }

  perbarui(dt: number): void {
    const { x0, x1 } = this.o;
    const lebar = x1 - x0;
    for (const k of this.kendaraan) {
      if (k.aktif) continue;
      // Kendaraan yang menunggu tetap bergeser supaya saat aktif lagi posisinya menyebar.
      k.x += k.vIngin * k.arah * dt;
      if (k.x > x1 || k.x < x0) {
        k.x += k.x > x1 ? -lebar : lebar;
        k.aktif = k.ambang < this.kepadatan;
      }
    }
    for (const arah of [1, -1] as const) {
      const lajur = this.kendaraan.filter((k) => k.arah === arah && k.aktif);
      // Urutkan dari yang paling depan (searah laju).
      lajur.sort((a, b) => (b.x - a.x) * arah);
      for (let i = 0; i < lajur.length; i++) {
        const k = lajur[i]!;
        const depan = lajur[i === 0 ? lajur.length - 1 : i - 1]!;
        let celah = (depan.x - k.x) * arah;
        if (celah <= 0) celah += lebar; // kendaraan depan sudah membungkus ke ujung
        celah -= (depan.panjang + k.panjang) / 2;
        // Melambat mulus kalau terlalu dekat, kembali ke kecepatan ingin kalau lega.
        const vAman = Math.max(0, (celah - JARAK_AMAN) * 1.6);
        const target = Math.min(k.vIngin, vAman);
        k.v += (target - k.v) * Math.min(1, dt * 3);
      }
      for (const k of lajur) {
        k.x += k.v * k.arah * dt;
        if (k.x > x1 || k.x < x0) {
          k.x += k.x > x1 ? -lebar : lebar;
          k.aktif = k.ambang < this.kepadatan;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Pejalan kaki di trotoar luar terminal

export interface PejalanKaki {
  readonly id: number;
  readonly varian: number;
  readonly arah: 1 | -1;
  x: number;
  readonly y: number;
  readonly v: number;
  /** Sedang berjalan di trotoar (terlihat). */
  aktif: boolean;
  readonly ambang: number;
}

export interface OpsiPejalan {
  readonly x0: number;
  readonly x1: number;
  /** Posisi y tiap jalur trotoar. */
  readonly jalur: readonly number[];
  readonly jumlahPerJalur: number;
  readonly jumlahVarian: number;
  readonly benih?: number;
}

/** Pejalan kaki berjalan santai di trotoar dan muncul lagi di ujung lain. */
export class Trotoar {
  readonly orang: PejalanKaki[] = [];
  /** Porsi pejalan kaki yang terlihat (0–1); berganti saat membungkus di ujung trotoar. */
  kepadatan = 1;

  constructor(private readonly o: OpsiPejalan) {
    const acak = acakBerbenih(o.benih ?? 97);
    let id = 0;
    for (const y of o.jalur) {
      for (let i = 0; i < o.jumlahPerJalur; i++) {
        this.orang.push({
          id: id++,
          varian: Math.floor(acak() * o.jumlahVarian),
          arah: acak() < 0.5 ? 1 : -1,
          x: o.x0 + acak() * (o.x1 - o.x0),
          y: y + (acak() - 0.5) * 0.18,
          v: 0.32 + acak() * 0.3,
          aktif: true,
          ambang: ambangId(id - 1),
        });
      }
    }
  }

  aturKepadatanSegera(kepadatan: number): void {
    this.kepadatan = kepadatan;
    for (const p of this.orang) p.aktif = p.ambang < kepadatan;
  }

  perbarui(dt: number): void {
    const lebar = this.o.x1 - this.o.x0;
    for (const p of this.orang) {
      p.x += p.v * p.arah * dt;
      if (p.x > this.o.x1 || p.x < this.o.x0) {
        p.x += p.x > this.o.x1 ? -lebar : lebar;
        p.aktif = p.ambang < this.kepadatan;
      }
    }
  }
}
