/**
 * Kendaraan kecil low-poly: mobil, angkot, motor (dengan pengendara).
 * Geometri ber-vertex-color: bagian putih diwarnai per instans (cat badan,
 * baju pengendara), kaca/roda tetap gelap. Satu InstancedMesh per jenis
 * untuk lalu lintas, dan geometri yang sama untuk mobil parkir (statis).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { teksturKolong } from './kendaraan3d';
import type { JenisKendaraanKecil, LaluLintas } from './lalu-lintas';

const PUTIH = new THREE.Color(1, 1, 1);
const KACA = new THREE.Color(0.1, 0.14, 0.2);
const HITAM = new THREE.Color(0.05, 0.05, 0.06);
const LAMPU = new THREE.Color(1, 0.95, 0.8);
const MERAH = new THREE.Color(0.7, 0.05, 0.05);

export const WARNA_MOBIL = [0xf2f2f0, 0xb8bcc2, 0x2a2d33, 0xb3261e, 0x1f4e9c, 0x5c6168, 0x6d1f2a, 0xd8cfb8].map((c) => new THREE.Color(c));
export const WARNA_ANGKOT = [0x2563eb, 0x16a34a, 0xeab308, 0xf97316, 0x38bdf8, 0x16a34a, 0x2563eb, 0xeab308].map((c) => new THREE.Color(c));
export const WARNA_BAJU = [0xdc2626, 0x2563eb, 0x16a34a, 0xf5f5f4, 0x111827, 0xf59e0b, 0x7c3aed, 0x0891b2].map((c) => new THREE.Color(c));

function warnai(g: THREE.BufferGeometry, pilih: (n: THREE.Vector3, p: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const nd = g.index ? g.toNonIndexed() : g;
  const pos = nd.getAttribute('position');
  const nor = nd.getAttribute('normal');
  const warna = new Float32Array(pos.count * 3);
  const n = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(nor, i);
    p.fromBufferAttribute(pos, i);
    const c = pilih(n, p);
    warna[i * 3] = c.r;
    warna[i * 3 + 1] = c.g;
    warna[i * 3 + 2] = c.b;
  }
  nd.setAttribute('color', new THREE.BufferAttribute(warna, 3));
  nd.deleteAttribute('uv');
  return nd;
}

function balok(x0: number, x1: number, y0: number, y1: number, lebar: number, pilih: (n: THREE.Vector3, p: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, lebar);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  return warnai(g, pilih);
}

function roda(x: number, z: number, r: number, tebal: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, tebal, 10);
  g.rotateX(Math.PI / 2);
  g.translate(x, r, z);
  return warnai(g, () => HITAM);
}

const gabung = (daftar: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const g = mergeGeometries(daftar, false);
  if (!g) throw new Error('gagal menggabungkan geometri kendaraan');
  return g;
};

/** Sedan: +x = depan, alas y = 0. */
export function geometriMobil(): THREE.BufferGeometry {
  const L = 0.9;
  const W = 0.36;
  const bagian = [
    balok(-L / 2, L / 2, 0.05, 0.2, W, (n, p) => (n.x > 0.9 && p.y > 0.12 && Math.abs(p.z) > 0.1 ? LAMPU : n.x < -0.9 && p.y > 0.12 && Math.abs(p.z) > 0.1 ? MERAH : PUTIH)),
    balok(-0.26, 0.2, 0.2, 0.33, W * 0.86, (n) => (n.y > 0.5 ? PUTIH : KACA)),
  ];
  for (const x of [-0.29, 0.29]) for (const z of [-W / 2, W / 2]) bagian.push(roda(x, z, 0.06, 0.05));
  return gabung(bagian);
}

/** Angkot (minibus kota): badan tinggi dengan pita kaca di seluruh sisi. */
export function geometriAngkot(): THREE.BufferGeometry {
  const L = 0.8;
  const W = 0.36;
  const bagian = [
    balok(-L / 2, L / 2, 0.05, 0.24, W, () => PUTIH),
    balok(-L / 2, L / 2 - 0.05, 0.24, 0.36, W * 0.97, (n) => (n.y > 0.5 ? PUTIH : KACA)),
  ];
  for (const x of [-0.26, 0.26]) for (const z of [-W / 2, W / 2]) bagian.push(roda(x, z, 0.06, 0.05));
  return gabung(bagian);
}

/** Motor + pengendara berhelm (baju diwarnai per instans). */
export function geometriMotor(): THREE.BufferGeometry {
  const bagian = [
    roda(-0.14, 0, 0.045, 0.03),
    roda(0.14, 0, 0.045, 0.03),
    balok(-0.17, 0.17, 0.05, 0.12, 0.07, () => HITAM),
    balok(-0.08, 0.04, 0.12, 0.27, 0.1, () => PUTIH),
    balok(-0.06, 0.02, 0.27, 0.34, 0.075, () => HITAM),
  ];
  return gabung(bagian);
}

/** Lalu lintas jalan lingkungan: satu InstancedMesh per jenis kendaraan. */
export class LaluLintas3D {
  readonly objek = new THREE.Group();
  private readonly mesh: Record<JenisKendaraanKecil, THREE.InstancedMesh>;
  private readonly kolong: THREE.InstancedMesh;
  private readonly qDatar = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  private readonly ukuranKolong = new THREE.Vector3();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly sumbuY = new THREE.Vector3(0, 1, 0);

  constructor(kapasitas: number) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 });
    const buat = (g: THREE.BufferGeometry): THREE.InstancedMesh => {
      const m = new THREE.InstancedMesh(g, material, kapasitas);
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      m.setColorAt(0, PUTIH);
      this.objek.add(m);
      return m;
    };
    this.mesh = { mobil: buat(geometriMobil()), angkot: buat(geometriAngkot()), motor: buat(geometriMotor()) };
    this.kolong = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: teksturKolong(), transparent: true, depthWrite: false, opacity: 0.5 }), kapasitas);
    this.kolong.frustumCulled = false;
    this.kolong.renderOrder = 1;
    this.kolong.count = 0;
    this.objek.add(this.kolong);
  }

  perbarui(model: LaluLintas): void {
    const n: Record<JenisKendaraanKecil, number> = { mobil: 0, angkot: 0, motor: 0 };
    let nKolong = 0;
    for (const k of model.kendaraan) {
      if (!k.aktif) continue;
      const mesh = this.mesh[k.jenis];
      const i = n[k.jenis]++;
      this.q.setFromAxisAngle(this.sumbuY, k.arah === 1 ? 0 : Math.PI);
      this.p.set(k.x, 0.02, k.y);
      this.m.compose(this.p, this.q, this.s);
      mesh.setMatrixAt(i, this.m);
      const palet = k.jenis === 'mobil' ? WARNA_MOBIL : k.jenis === 'angkot' ? WARNA_ANGKOT : WARNA_BAJU;
      mesh.setColorAt(i, palet[k.warna % palet.length]!);
      this.q.multiply(this.qDatar);
      this.ukuranKolong.set(k.panjang * 1.3, k.jenis === 'motor' ? 0.22 : 0.62, 1);
      this.m.compose(this.p.set(k.x, 0.024, k.y), this.q, this.ukuranKolong);
      this.kolong.setMatrixAt(nKolong++, this.m);
    }
    this.kolong.count = nKolong;
    this.kolong.instanceMatrix.needsUpdate = true;
    for (const jenis of Object.keys(this.mesh) as JenisKendaraanKecil[]) {
      const mesh = this.mesh[jenis];
      mesh.count = n[jenis];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}

/** Salinan geometri kendaraan dengan warna badan dipanggang (untuk parkir statis). */
export function kendaraanDiwarnai(g: THREE.BufferGeometry, warna: THREE.Color, x: number, y: number, sudut: number): THREE.BufferGeometry {
  const salin = g.clone();
  const c = salin.getAttribute('color');
  for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * warna.r, c.getY(i) * warna.g, c.getZ(i) * warna.b);
  salin.rotateY(-sudut);
  salin.translate(x, 0.02, y);
  return salin;
}
