/**
 * Kembang api peresmian perluasan terminal (murni, tanpa three.js): rangkaian
 * ledakan di atas area proyek yang baru selesai. Tiap ledakan menyebarkan
 * partikel ke segala arah dari satu titik, lalu partikel melambat, jatuh pelan,
 * dan memudar. proyek3d.ts hanya menggambar partikel yang hidup. Berjalan
 * dengan waktu nyata (tidak ikut dipercepat 2×/3×).
 */
import { acakBerbenih } from './dunia-visual';

export interface PartikelKembangApi {
  x: number;
  y: number;
  h: number;
  vx: number;
  vy: number;
  vh: number;
  /** Detik sejak meledak, dan lama hidupnya. */
  umur: number;
  readonly lama: number;
  /** Indeks warna (WARNA_KEMBANG_API). */
  readonly warna: number;
}

/** Warna ledakan (hex); adegan menggambarnya lebih terang dari 1 supaya berpendar (bloom). */
export const WARNA_KEMBANG_API: readonly number[] = [0xffd447, 0xff4d4d, 0x4ade80, 0x38bdf8, 0xf472b6, 0xffffff];

const PARTIKEL_PER_LEDAKAN = 56;
/** Paling banyak partikel hidup bersamaan (ukuran InstancedMesh). */
export const MAKS_PARTIKEL = 320;
const GRAVITASI = 1.8;
const HAMBATAN = 1.4;

interface Ledakan {
  readonly t: number;
  readonly x: number;
  readonly y: number;
  readonly h: number;
  readonly warna: number;
}

export class KembangApi {
  readonly partikel: PartikelKembangApi[] = [];
  private readonly jadwal: Ledakan[] = [];
  private waktu = 0;
  private acak = acakBerbenih(1);

  /** Ada ledakan yang terjadwal atau partikel yang masih hidup. */
  get aktif(): boolean {
    return this.jadwal.length > 0 || this.partikel.length > 0;
  }

  /** Tujuh ledakan berwarna di sekitar (x, y) setinggi ±h selama ±4 detik (cukup besar untuk terlihat dari kamera awal). */
  rayakan(x: number, y: number, h: number, benih = 7): void {
    this.acak = acakBerbenih(benih);
    for (let i = 0; i < 7; i++) {
      this.jadwal.push({
        t: this.waktu + 0.15 + i * 0.55 + this.acak() * 0.2,
        x: x + (this.acak() - 0.5) * 8,
        y: y + (this.acak() - 0.5) * 6,
        h: h + (this.acak() - 0.5) * 1.2,
        warna: Math.floor(this.acak() * WARNA_KEMBANG_API.length),
      });
    }
  }

  perbarui(dt: number): void {
    if (!(dt > 0)) return;
    this.waktu += dt;
    for (let i = this.jadwal.length - 1; i >= 0; i--) {
      const l = this.jadwal[i]!;
      if (l.t > this.waktu) continue;
      this.jadwal.splice(i, 1);
      this.ledakkan(l);
    }
    const redam = Math.exp(-HAMBATAN * dt);
    for (let i = this.partikel.length - 1; i >= 0; i--) {
      const p = this.partikel[i]!;
      p.umur += dt;
      if (p.umur >= p.lama) {
        this.partikel.splice(i, 1);
        continue;
      }
      p.vx *= redam;
      p.vy *= redam;
      p.vh = p.vh * redam - GRAVITASI * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.h = Math.max(0.05, p.h + p.vh * dt);
    }
  }

  private ledakkan(l: Ledakan): void {
    for (let i = 0; i < PARTIKEL_PER_LEDAKAN && this.partikel.length < MAKS_PARTIKEL; i++) {
      // Arah merata di permukaan bola, laju sedikit bervariasi (bentuk bunga yang bulat).
      const z = 2 * this.acak() - 1;
      const sudut = this.acak() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      const laju = 4.0 + this.acak() * 1.2;
      this.partikel.push({
        x: l.x,
        y: l.y,
        h: l.h,
        vx: r * Math.cos(sudut) * laju,
        vy: r * Math.sin(sudut) * laju,
        vh: z * laju,
        umur: 0,
        lama: 1.5 + this.acak() * 0.7,
        // Sebagian partikel berwarna kedua supaya ledakan tidak polos.
        warna: this.acak() < 0.8 ? l.warna : (l.warna + 3) % WARNA_KEMBANG_API.length,
      });
    }
  }
}
