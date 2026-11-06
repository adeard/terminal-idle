/**
 * Kamera, bagian murni: arah & bingkai awal (portrait dan landscape), pengenal
 * gerakan pelintir dua jari, dan batas-batas sudut. Tanpa three.js supaya bisa
 * dites; adegan.ts yang menerapkannya ke kamera.
 *
 * Konvensi: sudut putar positif = isi layar berputar searah jarum jam
 * (mengikuti jari yang dipelintir searah jarum jam).
 */

/** Batas elevasi kamera (radian dari tanah): tidak menembus tanah, tidak melihat tepi dunia. */
export const ELEVASI_MIN = (25 * Math.PI) / 180;
export const ELEVASI_MAKS = (75 * Math.PI) / 180;
/** Elevasi kamera awal (radian): sedikit lebih tegak dari isometrik supaya terminal mengisi layar potret. */
export const ELEVASI_KAMERA = (42 * Math.PI) / 180;
/** Sudut pandang tegak kamera (derajat): sempit, kesan foto maket. */
export const FOV_KAMERA = 26;
/** Azimut kamera awal landscape (radian; 0 = dari selatan/+y denah, π/2 = dari timur/+x): dari tenggara. */
export const AZIMUT_LANSKAP = Math.PI / 4;
/**
 * Azimut kamera awal portrait: diputar 10° lebih ke timur supaya pita terminal (barat–timur)
 * lebih tegak di layar sempit. Dengan begitu kamera ±1,3× lebih dekat sementara label
 * PERON, LOKET, dan KEBERANGKATAN tetap utuh; dari 45° keduanya tidak bisa sekaligus
 * (documents/14 bagian 4.3, jalur cadangan). Di sekitar 55° kedua sumbu layar sama-sama
 * pas, jadi ini yang terdekat dengan aula paling tinggi; lebih jauh diputar, aula turun.
 */
export const AZIMUT_POTRET = (55 * Math.PI) / 180;

/** Jendela layar tempat titik inti ditaruh: tepi kiri, kanan, atas dalam px CSS; bawah = bagian tinggi adegan. */
export interface JendelaLayar {
  readonly kiri: number;
  readonly kanan: number;
  readonly atas: number;
  readonly bawah: number;
}

/**
 * Jendela portrait: kiri/kanan ± setengah lebar label PERON / KEBERANGKATAN supaya label tidak
 * dijepit ke tepi, atas = batas label di zona3d.ts (y ≥ 56), dan 22% bawah adegan dikosongkan
 * untuk gelembung tutorial.
 */
export const JENDELA_POTRET: JendelaLayar = { kiri: 40, kanan: 70, atas: 56, bawah: 0.22 };

/** Arah dari titik pandang ke kamera (x, tinggi, y denah) untuk azimut & elevasi. */
export function arahKamera(azimut: number, elevasi = ELEVASI_KAMERA): [number, number, number] {
  const c = Math.cos(elevasi);
  return [c * Math.sin(azimut), Math.sin(elevasi), c * Math.cos(azimut)];
}

/** Titik pandang kamera di tanah (x, y denah) dan jarak kamera darinya. */
export interface BingkaiKamera {
  readonly x: number;
  readonly y: number;
  readonly jarak: number;
}

/** Langkah penyelesaian bingkaiJendela; hasilnya sudah tetap setelah ±10 langkah (dites). */
const LANGKAH_BINGKAI = 24;

/**
 * Bingkai kamera dari `azimut` (elevasi ELEVASI_KAMERA, FOV_KAMERA) supaya semua titik
 * (x, y, tinggi) muat di jendela layar adegan berukuran lebar × tinggi px CSS, sedekat
 * mungkin. Sisi yang masih longgar dipakai untuk membawa titik berat titik-titik ke tengah
 * jendela. Perspektif dihitung penuh, jadi diselesaikan berulang.
 */
export function bingkaiJendela(
  titik: readonly (readonly [number, number, number])[],
  azimut: number,
  lebar: number,
  tinggi: number,
  jendela: JendelaLayar,
): BingkaiKamera {
  const sa = Math.sin(azimut);
  const ca = Math.cos(azimut);
  const se = Math.sin(ELEVASI_KAMERA);
  const ce = Math.cos(ELEVASI_KAMERA);
  const tanV = Math.tan((FOV_KAMERA * Math.PI) / 360);
  const tanH = (tanV * lebar) / tinggi;
  // Jendela dalam koordinat layar ternormalisasi (−1…1; u ke kanan, v ke atas).
  const u0 = (2 * jendela.kiri) / lebar - 1;
  const u1 = 1 - (2 * jendela.kanan) / lebar;
  const v0 = 2 * jendela.bawah - 1;
  const v1 = 1 - (2 * jendela.atas) / tinggi;
  let x = 0;
  let y = 0;
  for (const [tx, ty] of titik) {
    x += tx / titik.length;
    y += ty / titik.length;
  }
  let jarak = 100;
  for (let i = 0; i < LANGKAH_BINGKAI; i++) {
    let uMin = Infinity;
    let uMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    let uBerat = 0;
    let vBerat = 0;
    for (const [tx, ty, h] of titik) {
      // Basis kamera: kanan (ca, 0, −sa), atas (−se·sa, ce, −se·ca), arah ke kamera (ce·sa, se, ce·ca).
      const maju = (tx - x) * sa + (ty - y) * ca;
      const dalam = jarak - maju * ce - h * se;
      const u = ((tx - x) * ca - (ty - y) * sa) / (dalam * tanH);
      const v = (h * ce - maju * se) / (dalam * tanV);
      uMin = Math.min(uMin, u);
      uMax = Math.max(uMax, u);
      vMin = Math.min(vMin, v);
      vMax = Math.max(vMax, v);
      uBerat += u / titik.length;
      vBerat += v / titik.length;
    }
    // Titik pandang digeser di tanah: ke kanan layar (isi bergeser ke kiri) dan menjauhi kamera (isi turun).
    const geserKanan = geserJendela(uMin, uMax, uBerat, u0, u1) * jarak * tanH;
    const geserJauh = (geserJendela(vMin, vMax, vBerat, v0, v1) * jarak * tanV) / se;
    x += geserKanan * ca - geserJauh * sa;
    y -= geserKanan * sa + geserJauh * ca;
    jarak *= Math.max((uMax - uMin) / (u1 - u0), (vMax - vMin) / (v1 - v0));
  }
  return { x, y, jarak };
}

/**
 * Geseran isi layar (satuan layar) supaya rentang [min, max] masuk [a, b], dengan titik berat
 * sedekat mungkin ke tengah. Rentang yang belum muat ditengahkan (jaraknya dibesarkan sesudahnya).
 */
function geserJendela(min: number, max: number, berat: number, a: number, b: number): number {
  const geserMin = max - b;
  const geserMaks = min - a;
  if (geserMin > geserMaks) return (geserMin + geserMaks) / 2;
  return Math.min(geserMaks, Math.max(geserMin, berat - (a + b) / 2));
}

/**
 * Jarak kamera supaya semua titik (x, y, tinggi) muat di layar berasio `aspek` bila kamera
 * menatap titik tanah (x, y) dari `azimut`; `margin` < 1 menyisakan tepi. Minimal 10.
 */
export function jarakMuat(
  titik: readonly (readonly [number, number, number])[],
  x: number,
  y: number,
  azimut: number,
  aspek: number,
  margin: number,
): number {
  const [dx, dh, dy] = arahKamera(azimut);
  // Basis kamera seperti three.js: kanan = maju × atas dunia, atas = kanan × maju.
  const kx = Math.cos(azimut);
  const ky = -Math.sin(azimut);
  const ax = -dh * Math.sin(azimut);
  const ah = Math.cos(ELEVASI_KAMERA);
  const ay = -dh * Math.cos(azimut);
  const tanV = Math.tan((FOV_KAMERA * Math.PI) / 360) * margin;
  const tanH = tanV * aspek;
  let jarak = 10;
  for (const [tx, ty, h] of titik) {
    const qx = tx - x;
    const qy = ty - y;
    const dalam = qx * dx + h * dh + qy * dy;
    jarak = Math.max(jarak, dalam + Math.abs(qx * kx + qy * ky) / tanH, dalam + Math.abs(qx * ax + h * ah + qy * ay) / tanV);
  }
  return jarak;
}

/** Bingkai landscape (sama dengan 0.3.1): titik pandang di tengah kotak titik-titik, jarak supaya semuanya muat. */
export function bingkaiTengah(titik: readonly (readonly [number, number, number])[], azimut: number, aspek: number, margin: number): BingkaiKamera {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of titik) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const x = (x0 + x1) / 2;
  const y = (y0 + y1) / 2;
  return { x, y, jarak: jarakMuat(titik, x, y, azimut, aspek, margin) };
}

/** Bingkai kamera awal beserta azimutnya dan batas zoom keluar. */
export interface BingkaiAwal extends BingkaiKamera {
  readonly azimut: number;
  readonly jarakMaks: number;
}

/**
 * Bingkai kamera awal untuk adegan lebar × tinggi px CSS. Landscape: dari AZIMUT_LANSKAP,
 * titik di tengah (tidak berubah sejak 0.3.1). Portrait: dari AZIMUT_POTRET, titik ditaruh
 * di JENDELA_POTRET. Batas zoom keluar dipisah dari jarak awal: dari titik pandang awal,
 * zoom keluar selalu bisa memuat seluruh terminal (`terminal`, biasanya TITIK_INTI).
 * @param azimut azimut pengganti per orientasi (mis. mode lantai aula); bawaan AZIMUT_LANSKAP & AZIMUT_POTRET.
 */
export function bingkaiAwal(
  titik: readonly (readonly [number, number, number])[],
  terminal: readonly (readonly [number, number, number])[],
  lebar: number,
  tinggi: number,
  margin = 0.94,
  azimutGanti: { readonly lanskap?: number; readonly potret?: number } = {},
): BingkaiAwal {
  const potret = lebar <= tinggi;
  const azimut = potret ? (azimutGanti.potret ?? AZIMUT_POTRET) : (azimutGanti.lanskap ?? AZIMUT_LANSKAP);
  const aspek = lebar / tinggi;
  const b = potret ? bingkaiJendela(titik, azimut, lebar, tinggi, JENDELA_POTRET) : bingkaiTengah(titik, azimut, aspek, margin);
  const jarakTerminal = jarakMuat(terminal, b.x, b.y, azimut, aspek, margin);
  return { ...b, azimut, jarakMaks: Math.max(b.jarak, jarakTerminal) * 1.25 };
}
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
