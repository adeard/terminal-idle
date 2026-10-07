/**
 * Gerak kamera mode sinema (murni, tanpa three.js): orbit pelan mengelilingi
 * titik pandang saat mode dimulai, dengan zoom, kemiringan, dan geser titik
 * pandang (sepanjang terminal) yang "bernapas" pelan. Mulai tepat dari pose
 * awal tanpa lompatan, dan putarannya dipercepat halus di detik-detik pertama.
 * adegan.ts yang menerapkannya (koordinat bola three.js: theta = arah
 * mengelilingi sumbu tegak, phi = sudut dari atas).
 */
export interface PoseSinema {
  /** Titik pandang di tanah (x, z dunia). */
  readonly x: number;
  readonly z: number;
  readonly jarak: number;
  readonly theta: number;
  readonly phi: number;
}

/** Satu putaran penuh tiap sekian detik nyata. */
export const DETIK_PUTARAN = 150;
/** Lama putaran dipercepat dari diam sampai kecepatan penuh. */
const DETIK_AWALAN = 2;
/** Besar gerak "bernapas": zoom ±10 %, miring ±0,06 rad, geser ±12 % jarak. */
const NAPAS = { zoom: 0.1, miring: 0.06, geser: 0.12 } as const;

const gelombang = (t: number, periode: number): number => Math.sin((2 * Math.PI * t) / periode);

/**
 * Pose kamera `t` detik setelah mode sinema dimulai dari pose `awal`.
 * Periode gelombang sengaja tidak sebanding supaya geraknya tidak cepat berulang.
 */
export function poseSinema(t: number, awal: PoseSinema, phiMin: number, phiMaks: number): PoseSinema {
  const tt = Math.max(0, t);
  // Kecepatan sudut naik linear selama awalan: sudut = ω·t²/(2T), lalu ω·(t − T/2).
  const jalan = tt < DETIK_AWALAN ? (tt * tt) / (2 * DETIK_AWALAN) : tt - DETIK_AWALAN / 2;
  return {
    x: awal.x + NAPAS.geser * awal.jarak * gelombang(tt, 97),
    z: awal.z,
    jarak: awal.jarak * (1 - NAPAS.zoom * gelombang(tt, 47)),
    theta: awal.theta + (2 * Math.PI * jalan) / DETIK_PUTARAN,
    phi: Math.min(phiMaks, Math.max(phiMin, awal.phi + NAPAS.miring * gelombang(tt, 71))),
  };
}
