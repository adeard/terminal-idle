/**
 * Rotasi kamera, bagian murni: pengenal gerakan pelintir dua jari dan
 * batas-batas sudut. Tanpa three.js supaya bisa dites; adegan.ts yang
 * menerapkannya ke kamera.
 *
 * Konvensi: sudut putar positif = isi layar berputar searah jarum jam
 * (mengikuti jari yang dipelintir searah jarum jam).
 */

/** Batas elevasi kamera (radian dari tanah): tidak menembus tanah, tidak melihat tepi dunia. */
export const ELEVASI_MIN = (25 * Math.PI) / 180;
export const ELEVASI_MAKS = (75 * Math.PI) / 180;
/**
 * Pelintiran baru dianggap memutar setelah sudut antarjari berubah sejauh ini,
 * supaya cubit zoom yang sedikit miring tidak ikut memutar peta.
 */
export const AMBANG_PELINTIR = (9 * Math.PI) / 180;

/** Selisih sudut b − a, dibungkus ke (−π, π]. */
export function selisihSudut(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

interface Titik2 {
  readonly x: number;
  readonly y: number;
}

/**
 * Pelacak pelintir dua jari (koordinat layar, y ke bawah): sudut garis antar
 * dua sentuhan naik saat jari dipelintir searah jarum jam.
 */
export class PelacakPelintir {
  private readonly jari = new Map<number, Titik2>();
  private sudutLalu: number | null = null;
  private tertunda = 0;
  private memutar = false;

  turun(id: number, x: number, y: number): void {
    this.jari.set(id, { x, y });
    this.mulaiUlang();
  }

  angkat(id: number): void {
    if (this.jari.delete(id)) this.mulaiUlang();
  }

  /** @returns sudut putar (radian) yang harus diterapkan sekarang; 0 kalau belum/tidak memelintir. */
  gerak(id: number, x: number, y: number): number {
    if (!this.jari.has(id)) return 0;
    this.jari.set(id, { x, y });
    if (this.jari.size !== 2) return 0;
    const [a, b] = [...this.jari.values()] as [Titik2, Titik2];
    const sudut = Math.atan2(b.y - a.y, b.x - a.x);
    const lalu = this.sudutLalu;
    this.sudutLalu = sudut;
    if (lalu === null) return 0;
    const d = selisihSudut(lalu, sudut);
    if (this.memutar) return d;
    this.tertunda += d;
    if (Math.abs(this.tertunda) < AMBANG_PELINTIR) return 0;
    // Lewat ambang: putaran yang tertunda diterapkan sekaligus, lalu mengikuti jari.
    this.memutar = true;
    return this.tertunda;
  }

  private mulaiUlang(): void {
    this.sudutLalu = null;
    this.tertunda = 0;
    this.memutar = false;
  }
}
