/**
 * Helper geometri dunia 3D. Koordinat tata-letak (x, y, tinggi) → three.js
 * (X = x, Y = tinggi, Z = y). Geometri statis dikumpulkan per material lalu
 * digabung (mergeGeometries) supaya jumlah draw call tetap kecil di HP.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Titik2 = readonly [number, number];

export const v3 = (x: number, y: number, h = 0): THREE.Vector3 => new THREE.Vector3(x, h, y);

/**
 * UV "proyeksi kotak" berskala dunia: tiap verteks memakai bidang sumbu yang
 * paling dekat dengan normalnya, jadi tekstur berulang dengan ukuran sama di
 * semua sisi (bata, plester, paving) tanpa peregangan.
 */
export function uvDunia(g: THREE.BufferGeometry, skala: number): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = x;
      v = -z;
    } else if (ax >= az) {
      u = nor.getX(i) > 0 ? -z : z;
      v = y;
    } else {
      u = nor.getZ(i) > 0 ? x : -x;
      v = y;
    }
    uv[i * 2] = u / skala;
    uv[i * 2 + 1] = v / skala;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Balok [x0,x1]×[y0,y1] setinggi h0..h1. */
export function kotak(x0: number, y0: number, x1: number, y1: number, h0: number, h1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(h1 - h0), Math.abs(y1 - y0));
  g.translate((x0 + x1) / 2, (h0 + h1) / 2, (y0 + y1) / 2);
  return g;
}

/** Bidang datar (menghadap atas) [x0,x1]×[y0,y1] pada ketinggian h. */
export function bidang(x0: number, y0: number, x1: number, y1: number, h: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0));
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, h, (y0 + y1) / 2);
  return g;
}

/** Bidang datar berputar (mis. garis petak parkir serong): pusat (x, y), panjang × lebar, sudut di bidang x–y. */
export function bidangPutar(x: number, y: number, panjang: number, lebar: number, sudut: number, h: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(panjang, lebar);
  g.rotateX(-Math.PI / 2);
  g.rotateY(-sudut);
  g.translate(x, h, y);
  return g;
}

/** Silinder tegak (tiang, batang pohon, tong). */
export function silinder(x: number, y: number, h0: number, h1: number, rBawah: number, rAtas = rBawah, segmen = 10): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rAtas, rBawah, h1 - h0, segmen);
  g.translate(x, (h0 + h1) / 2, y);
  return g;
}

/** Pita datar sepanjang polyline (jalan setapak), UV: u melintang, v sepanjang pita. */
export function pita(titik: readonly Titik2[], lebar: number, h: number, skalaV = 1): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let panjang = 0;
  for (let i = 0; i < titik.length; i++) {
    const p = titik[i]!;
    const a = titik[Math.max(0, i - 1)]!;
    const b = titik[Math.min(titik.length - 1, i + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d;
    const ny = dx / d;
    if (i > 0) panjang += Math.hypot(p[0] - titik[i - 1]![0], p[1] - titik[i - 1]![1]);
    pos.push(p[0] + (nx * lebar) / 2, h, p[1] + (ny * lebar) / 2, p[0] - (nx * lebar) / 2, h, p[1] - (ny * lebar) / 2);
    uv.push(0, panjang / skalaV, 1, panjang / skalaV);
    if (i > 0) {
      const k = (i - 1) * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Pastikan menghadap atas apa pun arah lilitannya.
  const n = g.getAttribute('normal');
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

/**
 * Segitiga-segitiga dengan UV "genteng": u sepanjang garis emperan, v naik
 * sepanjang kemiringan. Tiap sisi atap dikirim sebagai poligon cembung
 * (titik dunia) + arah emperan, lalu dipecah jadi kipas segitiga.
 */
function sisiAtap(pos: number[], uv: number[], titik: readonly THREE.Vector3[], arahEmperan: THREE.Vector3, skala: number): void {
  const o = titik[0]!;
  const n = new THREE.Vector3().subVectors(titik[1]!, o).cross(new THREE.Vector3().subVectors(titik[2]!, o)).normalize();
  // Pastikan normal menghadap ke atas.
  const balik = n.y < 0;
  const u = arahEmperan.clone().normalize();
  const vArah = new THREE.Vector3().crossVectors(balik ? n.clone().negate() : n, u).normalize();
  if (vArah.y < 0) vArah.negate();
  const koordinat = (p: THREE.Vector3): [number, number] => {
    const d = new THREE.Vector3().subVectors(p, o);
    return [d.dot(u) / skala, d.dot(vArah) / skala];
  };
  for (let i = 1; i < titik.length - 1; i++) {
    const tri = balik ? [titik[0]!, titik[i + 1]!, titik[i]!] : [titik[0]!, titik[i]!, titik[i + 1]!];
    for (const p of tri) {
      pos.push(p.x, p.y, p.z);
      uv.push(...koordinat(p));
    }
  }
}

function geometriDari(pos: number[], uv: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Atap limas (perisai): emperan [x0,x1]×[y0,y1] pada hEmper, bubungan sejajar sumbu x pada hBubungan. */
export function atapLimas(x0: number, y0: number, x1: number, y1: number, hEmper: number, hBubungan: number, skala = 0.6): THREE.BufferGeometry {
  const yc = (y0 + y1) / 2;
  const setengah = (y1 - y0) / 2;
  const r0 = Math.min(x0 + setengah, (x0 + x1) / 2);
  const r1 = Math.max(x1 - setengah, (x0 + x1) / 2);
  const e = (x: number, y: number) => v3(x, y, hEmper);
  const r = (x: number) => v3(x, yc, hBubungan);
  const pos: number[] = [];
  const uv: number[] = [];
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  sisiAtap(pos, uv, [e(x0, y1), e(x1, y1), r(r1), r(r0)], X, skala); // depan (+y)
  sisiAtap(pos, uv, [e(x1, y0), e(x0, y0), r(r0), r(r1)], X, skala); // belakang
  sisiAtap(pos, uv, [e(x1, y1), e(x1, y0), r(r1)], Z, skala); // ujung +x
  sisiAtap(pos, uv, [e(x0, y0), e(x0, y1), r(r0)], Z, skala); // ujung −x
  return geometriDari(pos, uv);
}

/** Atap terpancung (tingkat bawah joglo): cincin trapesium dari persegi luar O (hO) ke persegi dalam I (hI). */
export function atapPancung(
  O: { x0: number; y0: number; x1: number; y1: number },
  I: { x0: number; y0: number; x1: number; y1: number },
  hO: number,
  hI: number,
  skala = 0.6,
): THREE.BufferGeometry {
  const o = (x: number, y: number) => v3(x, y, hO);
  const i = (x: number, y: number) => v3(x, y, hI);
  const pos: number[] = [];
  const uv: number[] = [];
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  sisiAtap(pos, uv, [o(O.x0, O.y1), o(O.x1, O.y1), i(I.x1, I.y1), i(I.x0, I.y1)], X, skala);
  sisiAtap(pos, uv, [o(O.x1, O.y0), o(O.x0, O.y0), i(I.x0, I.y0), i(I.x1, I.y0)], X, skala);
  sisiAtap(pos, uv, [o(O.x1, O.y1), o(O.x1, O.y0), i(I.x1, I.y0), i(I.x1, I.y1)], Z, skala);
  sisiAtap(pos, uv, [o(O.x0, O.y0), o(O.x0, O.y1), i(I.x0, I.y1), i(I.x0, I.y0)], Z, skala);
  return geometriDari(pos, uv);
}

/** Atap pelana (kanopi peron): bubungan sejajar sumbu x. */
export function atapPelana(x0: number, y0: number, x1: number, y1: number, hEmper: number, hBubungan: number, skala = 1): THREE.BufferGeometry {
  const yc = (y0 + y1) / 2;
  const pos: number[] = [];
  const uv: number[] = [];
  const X = new THREE.Vector3(1, 0, 0);
  sisiAtap(pos, uv, [v3(x0, y1, hEmper), v3(x1, y1, hEmper), v3(x1, yc, hBubungan), v3(x0, yc, hBubungan)], X, skala);
  sisiAtap(pos, uv, [v3(x1, y0, hEmper), v3(x0, y0, hEmper), v3(x0, yc, hBubungan), v3(x1, yc, hBubungan)], X, skala);
  return geometriDari(pos, uv);
}

/**
 * Persegi vertikal bertekstur di atas garis dunia A→B (fasad, papan nama).
 * UV memetakan [u0,u1]×[v0,v1] tekstur ke seluruh persegi; normal menghadap
 * ke kanan dari arah A→B (untuk A→B searah +x, normal = +y dunia).
 */
export function persegiTegak(a: Titik2, b: Titik2, h0: number, h1: number, uvRect: { u0: number; v0: number; u1: number; v1: number }, geser = 0.004): THREE.BufferGeometry {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  const nx = -dy / d;
  const ny = dx / d;
  const ax = a[0] + nx * geser;
  const ay = a[1] + ny * geser;
  const bx = b[0] + nx * geser;
  const by = b[1] + ny * geser;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([ax, h0, ay, bx, h0, by, bx, h1, by, ax, h1, ay], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([uvRect.u0, uvRect.v0, uvRect.u1, uvRect.v0, uvRect.u1, uvRect.v1, uvRect.u0, uvRect.v1], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([nx, 0, ny, nx, 0, ny, nx, 0, ny, nx, 0, ny], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

// ---------------------------------------------------------------------------
// Atap lengkung (busur lingkaran): gedung utama, ruang tunggu, kanopi peron

/**
 * Penampang busur lingkaran dari tepi b0 ke b1 (keduanya setinggi hTepi) dengan
 * puncak hPuncak di tengah. Parameter t ∈ [0, 1] menyusuri busur dari b0 ke b1.
 */
export class Busur {
  readonly pusat: number;
  readonly r: number;
  readonly hPusat: number;
  readonly sudutMaks: number;

  constructor(
    readonly b0: number,
    readonly b1: number,
    readonly hTepi: number,
    readonly hPuncak: number,
  ) {
    const s = (b1 - b0) / 2;
    const naik = hPuncak - hTepi;
    this.pusat = (b0 + b1) / 2;
    this.r = (s * s + naik * naik) / (2 * naik);
    this.hPusat = hPuncak - this.r;
    this.sudutMaks = Math.asin(s / this.r);
  }

  private sudut(t: number): number {
    return -this.sudutMaks + t * 2 * this.sudutMaks;
  }

  /** Titik [b, h] di parameter t; `geser` menambah jari-jari (+ ke luar). */
  titik(t: number, geser = 0): [number, number] {
    const a = this.sudut(t);
    return [this.pusat + (this.r + geser) * Math.sin(a), this.hPusat + (this.r + geser) * Math.cos(a)];
  }

  /** Normal ke luar [nb, nh] di parameter t. */
  normal(t: number): [number, number] {
    const a = this.sudut(t);
    return [Math.sin(a), Math.cos(a)];
  }

  /** Tinggi busur di posisi b. */
  tinggi(b: number): number {
    const d = b - this.pusat;
    return this.hPusat + Math.sqrt(Math.max(0, this.r * this.r - d * d));
  }

  /** Parameter t untuk posisi b. */
  tDari(b: number): number {
    return (Math.asin(Math.max(-1, Math.min(1, (b - this.pusat) / this.r))) + this.sudutMaks) / (2 * this.sudutMaks);
  }

  /** Panjang busur dari t = 0 sampai t. */
  panjang(t: number): number {
    return t * 2 * this.sudutMaks * this.r;
  }
}

/** Sumbu memanjang atap lengkung di bidang tata letak. */
export type Sumbu = 'x' | 'y';

/** (a sepanjang sumbu, b melintang, h tinggi) → koordinat three.js. */
function keDunia(sumbu: Sumbu, a: number, b: number, h: number): [number, number, number] {
  return sumbu === 'x' ? [a, h, b] : [b, h, a];
}

interface Verteks {
  readonly p: readonly [number, number, number];
  readonly n: readonly [number, number, number];
  readonly uv: readonly [number, number];
}

/**
 * Deretan pasangan verteks (baris[i] = [kiri, kanan]) → pita segitiga. Lilitan
 * tiap segitiga diputuskan dari normal verteksnya, jadi selalu menghadap luar.
 */
function pitaVerteks(baris: readonly (readonly [Verteks, Verteks])[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const segitiga = (a: Verteks, b: Verteks, c: Verteks): void => {
    e1.set(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]);
    e2.set(c.p[0] - a.p[0], c.p[1] - a.p[1], c.p[2] - a.p[2]);
    e1.cross(e2);
    if (e1.lengthSq() < 1e-14) return;
    const n = [(a.n[0] + b.n[0] + c.n[0]) / 3, (a.n[1] + b.n[1] + c.n[1]) / 3, (a.n[2] + b.n[2] + c.n[2]) / 3];
    const urut = e1.x * n[0]! + e1.y * n[1]! + e1.z * n[2]! >= 0 ? [a, b, c] : [a, c, b];
    for (const v of urut) {
      pos.push(...v.p);
      nor.push(...v.n);
      uv.push(...v.uv);
    }
  };
  for (let i = 0; i + 1 < baris.length; i++) {
    const [a, b] = baris[i]!;
    const [c, d] = baris[i + 1]!;
    segitiga(a, b, c);
    segitiga(b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

export interface OpsiLengkung {
  readonly t0?: number;
  readonly t1?: number;
  readonly segmen?: number;
  /** Satuan dunia per ulangan tekstur sepanjang sumbu (u) dan sepanjang busur (v). */
  readonly skalaU?: number;
  readonly skalaV?: number;
  /** Tambahan jari-jari (lapisan di atas kulit atap, mis. pita kaca skylight). */
  readonly geser?: number;
}

/** Kulit atap lengkung: busur (t0..t1) diulur sepanjang sumbu dari a0 ke a1, normal ke luar. */
export function atapLengkung(sumbu: Sumbu, a0: number, a1: number, busur: Busur, opsi: OpsiLengkung = {}): THREE.BufferGeometry {
  const { t0 = 0, t1 = 1, segmen = 16, skalaU = 1, skalaV = 1, geser = 0 } = opsi;
  const baris: [Verteks, Verteks][] = [];
  for (let i = 0; i <= segmen; i++) {
    const t = t0 + ((t1 - t0) * i) / segmen;
    const [b, h] = busur.titik(t, geser);
    const [nb, nh] = busur.normal(t);
    const n = keDunia(sumbu, 0, nb, nh);
    const v = busur.panjang(t) / skalaV;
    baris.push([
      { p: keDunia(sumbu, a0, b, h), n, uv: [a0 / skalaU, v] },
      { p: keDunia(sumbu, a1, b, h), n, uv: [a1 / skalaU, v] },
    ]);
  }
  return pitaVerteks(baris);
}

/**
 * Dinding tegak di posisi a (melintang sumbu) yang tepi atasnya mengikuti busur,
 * dari b = bAwal ke bAkhir dengan alas di hBawah. arah +1: normal ke +sumbu.
 * UV proyeksi dunia (u = b, v = h) dibagi skala.
 */
export function dindingBusur(sumbu: Sumbu, a: number, bAwal: number, bAkhir: number, hBawah: number, busur: Busur, arah: 1 | -1, skala = 1, segmen = 12): THREE.BufferGeometry {
  const n = keDunia(sumbu, arah, 0, 0);
  const baris: [Verteks, Verteks][] = [];
  for (let i = 0; i <= segmen; i++) {
    const b = bAwal + ((bAkhir - bAwal) * i) / segmen;
    const h = busur.tinggi(b);
    const u = (b * arah * (sumbu === 'x' ? -1 : 1)) / skala;
    baris.push([
      { p: keDunia(sumbu, a, b, hBawah), n, uv: [u, hBawah / skala] },
      { p: keDunia(sumbu, a, b, h), n, uv: [u, h / skala] },
    ]);
  }
  return pitaVerteks(baris);
}

/**
 * Rusuk lengkung berpenampang persegi yang mengikuti busur di posisi a:
 * selebar `lebar` sepanjang sumbu, dari jari-jari r + geserDalam ke r + geserLuar.
 */
export function rusukBusur(sumbu: Sumbu, a: number, busur: Busur, lebar: number, geserDalam: number, geserLuar: number, segmen = 16, t0 = 0, t1 = 1): THREE.BufferGeometry {
  const sisi = (pilih: (t: number) => [Verteks, Verteks]): THREE.BufferGeometry => {
    const baris: [Verteks, Verteks][] = [];
    for (let i = 0; i <= segmen; i++) baris.push(pilih(t0 + ((t1 - t0) * i) / segmen));
    return pitaVerteks(baris);
  };
  const w = lebar / 2;
  const vt = (aa: number, t: number, geser: number, n: [number, number, number]): Verteks => {
    const [b, h] = busur.titik(t, geser);
    return { p: keDunia(sumbu, aa, b, h), n, uv: [0, 0] };
  };
  const radial = (t: number, k: number): [number, number, number] => {
    const [nb, nh] = busur.normal(t);
    return keDunia(sumbu, 0, nb * k, nh * k);
  };
  const bagian = [
    sisi((t) => [vt(a - w, t, geserLuar, radial(t, 1)), vt(a + w, t, geserLuar, radial(t, 1))]),
    sisi((t) => [vt(a - w, t, geserDalam, radial(t, -1)), vt(a + w, t, geserDalam, radial(t, -1))]),
    sisi((t) => [vt(a - w, t, geserDalam, keDunia(sumbu, -1, 0, 0)), vt(a - w, t, geserLuar, keDunia(sumbu, -1, 0, 0))]),
    sisi((t) => [vt(a + w, t, geserDalam, keDunia(sumbu, 1, 0, 0)), vt(a + w, t, geserLuar, keDunia(sumbu, 1, 0, 0))]),
  ];
  const g = mergeGeometries(bagian, false);
  for (const b of bagian) b.dispose();
  if (!g) throw new Error('gagal membuat rusuk lengkung');
  return g;
}

/**
 * Bayangan kontak dipanggang (ambient occlusion murah): persegi gelap seukuran
 * alas objek yang memudar ke luar sejauh `pudar` lewat alpha per verteks.
 * Dipakai di semua tingkat kualitas; di perangkat kuat N8AO menambah detailnya.
 */
export function bayanganKontak(x0: number, y0: number, x1: number, y1: number, pudar = 0.3, alpha = 0.32, h = 0.024): THREE.BufferGeometry {
  const dalam = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  const luar = [
    [x0 - pudar, y0 - pudar],
    [x1 + pudar, y0 - pudar],
    [x1 + pudar, y1 + pudar],
    [x0 - pudar, y1 + pudar],
  ];
  const pos: number[] = [];
  const warna: number[] = [];
  for (const [x, y] of dalam) {
    pos.push(x!, h, y!);
    warna.push(0, 0, 0, alpha);
  }
  for (const [x, y] of luar) {
    pos.push(x!, h, y!);
    warna.push(0, 0, 0, 0);
  }
  // Isi dalam + empat sisi cincin (lilitan menghadap atas).
  const idx = [0, 3, 2, 0, 2, 1];
  for (let i = 0; i < 4; i++) {
    const a = i;
    const b = (i + 1) % 4;
    idx.push(a, b, 4 + b, a, 4 + b, 4 + a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(8).fill([0, 1, 0]).flat(), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(warna, 4));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------

export interface OpsiMesh {
  readonly bayangan?: boolean;
  readonly terimaBayangan?: boolean;
  readonly urutan?: number;
  /** Untuk material ber-alphaTest: bayangan mengikuti bentuk tekstur, bukan persegi. */
  readonly materialKedalaman?: THREE.Material;
}

/** Mengumpulkan geometri per material lalu menggabungkannya menjadi satu Mesh per material. */
export class Kumpulan {
  private readonly isi = new Map<THREE.Material, { daftar: THREE.BufferGeometry[]; opsi: OpsiMesh }>();

  tambah(material: THREE.Material, g: THREE.BufferGeometry, opsi: OpsiMesh = {}): void {
    let e = this.isi.get(material);
    if (!e) {
      e = { daftar: [], opsi };
      this.isi.set(material, e);
    }
    e.daftar.push(g.index ? g.toNonIndexed() : g);
    if (g.index) g.dispose();
  }

  bangun(induk: THREE.Object3D): void {
    for (const [material, { daftar, opsi }] of this.isi) {
      // mergeGeometries butuh atribut yang sama: pakai irisan atribut semua anggota.
      const atribut = Object.keys(daftar[0]!.attributes).filter((n) => daftar.every((g) => n in g.attributes));
      for (const g of daftar) for (const nama of Object.keys(g.attributes)) if (!atribut.includes(nama)) g.deleteAttribute(nama);
      const gabung = mergeGeometries(daftar, false);
      for (const g of daftar) g.dispose();
      if (!gabung) throw new Error('gagal menggabungkan geometri');
      const mesh = new THREE.Mesh(gabung, material);
      mesh.castShadow = opsi.bayangan ?? true;
      mesh.receiveShadow = opsi.terimaBayangan ?? true;
      if (opsi.urutan !== undefined) mesh.renderOrder = opsi.urutan;
      if (opsi.materialKedalaman) mesh.customDepthMaterial = opsi.materialKedalaman;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      induk.add(mesh);
    }
    this.isi.clear();
  }
}
