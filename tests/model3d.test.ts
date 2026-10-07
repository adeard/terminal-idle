import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { geometriBadanBus } from '../src/game/kendaraan3d';
import { buatPenampilan, Kerumunan3D, type Penampilan } from '../src/game/orang3d';

const bagian = (k: Kerumunan3D) => {
  const [kaki, lengan, badan, kepala, rambut, jilbab, gamis, ransel] = k.objek.children as THREE.InstancedMesh[];
  return { kaki: kaki!, lengan: lengan!, badan: badan!, kepala: kepala!, rambut: rambut!, jilbab: jilbab!, gamis: gamis!, ransel: ransel! };
};

const matriks = (mesh: THREE.InstancedMesh, i: number): THREE.Matrix4 => {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  return m;
};

const polos = (jilbab: boolean): Penampilan => ({
  kulit: new THREE.Color(0xc68642),
  baju: new THREE.Color(0x2563eb),
  celana: new THREE.Color(0x1f2937),
  rambut: new THREE.Color(0x111111),
  jilbab: jilbab ? new THREE.Color(0xbe185d) : null,
  ransel: null,
  koper: null,
  topi: false,
  skala: 1,
});

describe('orang 3D', () => {
  it('menghadap arah jalan dan mengayunkan kaki saat bergerak, kaki rapat saat diam', () => {
    const k = new Kerumunan3D(4);
    const b = bagian(k);
    let x = 0;
    for (let i = 0; i < 40; i++) {
      x += 0.03; // berjalan ke +x dunia
      k.mulai();
      k.tambah({ id: 1, x, y: 5, h: 0, penampilan: polos(false) }, 1 / 30);
      k.selesai();
    }
    // Sumbu depan badan (+x lokal) harus mengarah ke +x dunia.
    const depan = new THREE.Vector3(1, 0, 0).transformDirection(matriks(b.badan, 0));
    expect(depan.x).toBeGreaterThan(0.95);
    // Kedua kaki berayun berlawanan: arah kaki kiri ≠ kanan.
    const arahKaki = (i: number) => new THREE.Vector3(0, -1, 0).transformDirection(matriks(b.kaki, i));
    expect(arahKaki(0).distanceTo(arahKaki(1))).toBeGreaterThan(0.05);

    for (let i = 0; i < 60; i++) {
      k.mulai();
      k.tambah({ id: 1, x, y: 5, h: 0, penampilan: polos(false) }, 1 / 30);
      k.selesai();
    }
    expect(arahKaki(0).distanceTo(arahKaki(1))).toBeLessThan(0.01);
  });

  it('berjilbab: jilbab + gamis, tanpa rambut; tidak berjilbab: rambut saja', () => {
    const k = new Kerumunan3D(4);
    const b = bagian(k);
    k.mulai();
    k.tambah({ id: 1, x: 0, y: 0, h: 0, penampilan: polos(true) }, 0.016);
    k.tambah({ id: 2, x: 1, y: 0, h: 0, penampilan: polos(false) }, 0.016);
    k.selesai();
    expect(b.badan.count).toBe(2);
    expect(b.kaki.count).toBe(4);
    expect(b.jilbab.count).toBe(1);
    expect(b.gamis.count).toBe(1);
    expect(b.rambut.count).toBe(1);
  });

  it('kapasitas tidak terlampaui dan status orang yang hilang dibuang', () => {
    const k = new Kerumunan3D(2);
    const b = bagian(k);
    k.mulai();
    for (let i = 0; i < 5; i++) k.tambah({ id: i, x: i, y: 0, h: 0, penampilan: polos(false) }, 0.016);
    k.selesai();
    expect(b.badan.count).toBe(2);
  });

  it('tabel penampilan beragam: ada yang berjilbab, ada yang tidak, tinggi bervariasi', () => {
    const p = buatPenampilan(64);
    const jilbab = p.filter((x) => x.jilbab).length;
    expect(jilbab).toBeGreaterThan(8);
    expect(jilbab).toBeLessThan(40);
    expect(Math.max(...p.map((x) => x.skala)) - Math.min(...p.map((x) => x.skala))).toBeGreaterThan(0.1);
  });
});

describe('badan bus 3D', () => {
  const g = geometriBadanBus();
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  const idx = g.getIndex()!;

  it('UV di dalam sel livery (0..1)', () => {
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0);
      expect(uv.getX(i)).toBeLessThanOrEqual(1);
      expect(uv.getY(i)).toBeGreaterThanOrEqual(0);
      expect(uv.getY(i)).toBeLessThanOrEqual(1);
    }
  });

  it('lilitan setiap segitiga searah normalnya (tidak ter-cull dari luar)', () => {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(pos, idx.getX(i));
      b.fromBufferAttribute(pos, idx.getX(i + 1));
      c.fromBufferAttribute(pos, idx.getX(i + 2));
      const geo = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      if (geo.lengthSq() < 1e-12) continue;
      n.fromBufferAttribute(nor, idx.getX(i));
      expect(geo.dot(n)).toBeGreaterThan(0);
    }
  });

  it('muat dalam balok satuan (atap melengkung tidak melebihi tinggi & lebar)', () => {
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    expect(bb.min.y).toBeCloseTo(0, 6);
    expect(bb.max.y).toBeCloseTo(1, 6);
    expect(bb.max.x).toBeLessThanOrEqual(0.51);
    expect(Math.abs(bb.max.z)).toBeLessThanOrEqual(0.56); // spion sedikit menonjol
  });
});
