/**
 * Lintasan untuk gerak bus yang halus: polyline dengan panjang kumulatif,
 * dibangun dari garis lurus dan kurva Bézier kubik. Murni, tanpa Phaser.
 */
import type { Titik } from './tata-letak';

export interface Pose {
  readonly x: number;
  readonly y: number;
  /** Arah garis singgung (radian, 0 = +x). */
  readonly sudut: number;
}

export class Jalur {
  readonly titik: readonly Titik[];
  private readonly kumulatif: number[];
  readonly panjang: number;

  constructor(titik: readonly Titik[]) {
    if (titik.length < 2) throw new Error('Jalur butuh minimal 2 titik');
    this.titik = titik;
    this.kumulatif = [0];
    let total = 0;
    for (let i = 1; i < titik.length; i++) {
      const [x0, y0] = titik[i - 1]!;
      const [x1, y1] = titik[i]!;
      total += Math.hypot(x1 - x0, y1 - y0);
      this.kumulatif.push(total);
    }
    this.panjang = total;
  }

  pose(s: number): Pose {
    const jarak = Math.min(Math.max(s, 0), this.panjang);
    let i = 1;
    while (i < this.titik.length - 1 && this.kumulatif[i]! < jarak) i++;
    const [x0, y0] = this.titik[i - 1]!;
    const [x1, y1] = this.titik[i]!;
    const awal = this.kumulatif[i - 1]!;
    const panjangSeg = this.kumulatif[i]! - awal;
    const t = panjangSeg === 0 ? 0 : (jarak - awal) / panjangSeg;
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, sudut: Math.atan2(y1 - y0, x1 - x0) };
  }
}

export function bezier(p0: Titik, p1: Titik, p2: Titik, p3: Titik, langkah = 24): Titik[] {
  const hasil: Titik[] = [];
  for (let i = 0; i <= langkah; i++) {
    const t = i / langkah;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    hasil.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return hasil;
}

/** Gabungkan potongan lintasan, membuang titik sambungan yang dobel. */
export function sambung(...bagian: readonly Titik[][]): Titik[] {
  const hasil: Titik[] = [];
  for (const b of bagian) {
    for (const t of b) {
      const akhir = hasil[hasil.length - 1];
      if (!akhir || Math.hypot(akhir[0] - t[0], akhir[1] - t[1]) > 1e-6) hasil.push(t);
    }
  }
  return hasil;
}

/**
 * Kurva S untuk pindah lajur/masuk/keluar: berangkat dan tiba dengan arah +x,
 * bergeser mulus dari y awal ke y tujuan.
 */
export function lintasanS(dari: Titik, ke: Titik): Titik[] {
  const dx = ke[0] - dari[0];
  return bezier(dari, [dari[0] + dx * 0.5, dari[1]], [ke[0] - dx * 0.5, ke[1]], ke);
}
