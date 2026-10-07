/**
 * Bingkai peta bayangan matahari yang mengikuti pandangan kamera (murni, tanpa
 * three.js): titik-titik jejak pandangan di tanah diproyeksikan ke bidang tegak
 * lurus arah cahaya lalu dibungkus persegi. Sisinya dibulatkan per langkah
 * (tidak berubah tiap frame saat zoom) dan pusatnya ke kelipatan texel, jadi
 * tepi bayangan tidak berkilau saat kamera bergeser sedikit.
 *
 * Koordinat dunia three.js: X timur, Y atas, Z selatan (lihat langit.ts).
 */
import type { Vektor3 } from './langit';

export interface OpsiBingkaiBayangan {
  /** Sisi peta bayangan (px). */
  readonly ukuranPeta: number;
  /** Batas setengah sisi (unit). */
  readonly min: number;
  readonly maks: number;
  /** Setengah sisi dibulatkan ke atas per langkah ini (unit). */
  readonly langkah: number;
  /** Tambahan di sekeliling jejak (unit): atap tinggi di tepi layar yang kakinya di luar pandangan. */
  readonly margin: number;
}

export interface BingkaiBayangan {
  /** Titik yang dituju cahaya (pusat peta bayangan), koordinat dunia. */
  readonly pusat: Vektor3;
  /** Setengah sisi persegi peta bayangan (unit). */
  readonly setengah: number;
  /** Lebar satu texel peta bayangan (unit). */
  readonly texel: number;
}

const titik = (a: Vektor3, b: Vektor3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Sumbu bidang peta bayangan untuk cahaya dari arah `w` (menuju sumber cahaya,
 * ternormalisasi): `u` mendatar, `v = w × u`; sama dengan sumbu x/y kamera
 * bayangan three.js yang menatap searah −w dengan atas +Y.
 */
export function sumbuCahaya(w: Vektor3): { readonly u: Vektor3; readonly v: Vektor3 } {
  // u = normal(atas × w) dengan atas = (0, 1, 0).
  const panjang = Math.hypot(w[2], w[0]) || 1;
  const u: Vektor3 = [w[2] / panjang, 0, -w[0] / panjang];
  const v: Vektor3 = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
  return { u, v };
}

/**
 * @param jejak titik-titik tanah yang terlihat kamera (mis. pojok layar di tanah)
 * @param w arah menuju sumber cahaya, ternormalisasi
 * @param acuan titik pandang kamera: kedalaman pusat sepanjang cahaya dibulatkan dari sini
 */
export function bingkaiBayangan(jejak: readonly Vektor3[], w: Vektor3, acuan: Vektor3, opsi: OpsiBingkaiBayangan): BingkaiBayangan {
  const { u, v } = sumbuCahaya(w);
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const p of jejak) {
    const pu = titik(p, u);
    const pv = titik(p, v);
    u0 = Math.min(u0, pu);
    u1 = Math.max(u1, pu);
    v0 = Math.min(v0, pv);
    v1 = Math.max(v1, pv);
  }
  const perlu = Math.max(u1 - u0, v1 - v0) / 2 + opsi.margin;
  const setengah = Math.min(opsi.maks, Math.max(opsi.min, Math.ceil(perlu / opsi.langkah) * opsi.langkah));
  const texel = (2 * setengah) / opsi.ukuranPeta;
  const cu = Math.round((u0 + u1) / 2 / texel) * texel;
  const cv = Math.round((v0 + v1) / 2 / texel) * texel;
  const cw = Math.round(titik(acuan, w));
  const pusat: Vektor3 = [u[0] * cu + v[0] * cv + w[0] * cw, u[1] * cu + v[1] * cv + w[1] * cw, u[2] * cu + v[2] * cv + w[2] * cw];
  return { pusat, setengah, texel };
}
