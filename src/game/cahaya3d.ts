/**
 * Genangan cahaya malam di tanah: lingkaran hangat di bawah lampu jalan, lampu
 * taman, dan lampu sorot pos cuci, serta sorot lampu depan bus di aspal. Satu
 * InstancedMesh berbahan aditif yang kekuatannya mengikuti tingkat malam; jauh
 * lebih murah daripada lampu sungguhan (tanpa PointLight, tanpa bayangan).
 */
import * as THREE from 'three';
import type { BusVisual } from './dunia-visual';
import { BUS } from './tata-letak';

export interface TitikCahaya {
  readonly x: number;
  readonly y: number;
  /** Jari-jari genangan cahaya. */
  readonly r: number;
}

/** Sedikit di atas marka jalan (0,026) supaya tidak z-fighting. */
const H_GENANGAN = 0.032;
const KAPASITAS_BUS = 64;

function teksturBundar(): THREE.CanvasTexture {
  const U = 128;
  const c = document.createElement('canvas');
  c.width = U;
  c.height = U;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia');
  const g = ctx.createRadialGradient(U / 2, U / 2, 0, U / 2, U / 2, U / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, U, U);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class CahayaMalam {
  readonly objek: THREE.InstancedMesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly jumlahTetap: number;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly sumbuY = new THREE.Vector3(0, 1, 0);
  private readonly warnaLampu = new THREE.Color(1, 0.74, 0.44);
  private readonly warnaSorot = new THREE.Color(0.95, 0.92, 0.8);

  constructor(titik: readonly TitikCahaya[]) {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    this.material = new THREE.MeshBasicMaterial({ map: teksturBundar(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.objek = new THREE.InstancedMesh(g, this.material, titik.length + KAPASITAS_BUS * 2);
    this.objek.frustumCulled = false;
    this.objek.renderOrder = 4;
    this.objek.visible = false;
    titik.forEach((t, i) => {
      this.m.compose(this.p.set(t.x, H_GENANGAN, t.y), this.q.identity(), this.s.set(t.r * 2, 1, t.r * 2));
      this.objek.setMatrixAt(i, this.m);
      this.objek.setColorAt(i, this.warnaLampu);
    });
    this.jumlahTetap = titik.length;
    this.objek.count = titik.length;
  }

  /** @param malam 0 = siang (tak terlihat), 1 = malam penuh. */
  perbarui(malam: number, bus: readonly BusVisual[]): void {
    this.objek.visible = malam > 0.02;
    if (!this.objek.visible) return;
    this.material.opacity = 0.7 * malam;
    let n = this.jumlahTetap;
    const batas = this.jumlahTetap + KAPASITAS_BUS * 2;
    // Sorot lampu depan: elips memanjang di depan tiap bus yang mesinnya hidup.
    for (const b of bus) {
      if (b.fase === 'parkir' || n >= batas) continue;
      const c = Math.cos(b.sudut);
      const s = Math.sin(b.sudut);
      const maju = BUS.panjang / 2 + 0.9;
      this.q.setFromAxisAngle(this.sumbuY, -b.sudut);
      this.m.compose(this.p.set(b.x + c * maju, H_GENANGAN + 0.002, b.y + s * maju), this.q, this.s.set(2.0, 1, 1.05));
      this.objek.setMatrixAt(n, this.m);
      this.objek.setColorAt(n, this.warnaSorot);
      n++;
    }
    this.objek.count = n;
    this.objek.instanceMatrix.needsUpdate = true;
    if (this.objek.instanceColor) this.objek.instanceColor.needsUpdate = true;
  }
}
