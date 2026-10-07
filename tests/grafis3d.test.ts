import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { atapLengkung, atapLimas, atapPancung, atapPelana, bidang, Busur, dindingBusur, kotak, persegiTegak, pita, rusukBusur, uvDunia } from '../src/game/geometri';
import { hitungTataLetakLayar, SISI_DASAR } from '../src/ui/bingkai';

/** Semua segitiga menghadap ke atas: normal geometris (dari lilitan) punya komponen y positif. */
function semuaMenghadapAtas(g: THREE.BufferGeometry): boolean {
  const nd = g.index ? g.toNonIndexed() : g;
  const p = nd.getAttribute('position');
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.y <= 0) return false;
  }
  return true;
}

describe('geometri dunia (koordinat petak x, y → three.js X, Z)', () => {
  it('kotak & bidang menempati rentang yang diminta', () => {
    const g = kotak(1, 2, 3, 5, 0.1, 0.9);
    g.computeBoundingBox();
    expect(g.boundingBox!.min.toArray().map((v) => +v.toFixed(6))).toEqual([1, 0.1, 2]);
    expect(g.boundingBox!.max.toArray().map((v) => +v.toFixed(6))).toEqual([3, 0.9, 5]);
    expect(semuaMenghadapAtas(bidang(0, 0, 4, 2, 0.02))).toBe(true);
  });

  it('atap limas, pancung, dan pelana: semua sisi menghadap ke atas (tidak ter-cull dari kamera)', () => {
    expect(semuaMenghadapAtas(atapLimas(0, 0, 5, 2, 1, 1.6))).toBe(true);
    expect(semuaMenghadapAtas(atapPancung({ x0: 0, y0: 0, x1: 4, y1: 3 }, { x0: 1, y0: 1, x1: 3, y1: 2 }, 1, 1.5))).toBe(true);
    expect(semuaMenghadapAtas(atapPelana(0, 0, 6, 2, 1, 1.3))).toBe(true);
  });

  it('atap limas punya 4 sisi: 2 trapesium + 2 segitiga = 6 segitiga', () => {
    expect(atapLimas(0, 0, 5, 2, 1, 1.6).getAttribute('position').count).toBe(18);
  });

  it('pita jalan setapak menghadap atas ke arah mana pun lilitannya', () => {
    expect(semuaMenghadapAtas(pita([[0, 0], [2, 1], [4, 0], [4, -3]], 0.4, 0.02))).toBe(true);
  });

  it('persegi tegak menghadap ke kanan arah A→B (fasad depan menghadap +y dunia)', () => {
    const g = persegiTegak([0, 5], [4, 5], 0, 1, { u0: 0, v0: 0, u1: 1, v1: 1 });
    const nd = g.toNonIndexed();
    const p = nd.getAttribute('position');
    const a = new THREE.Vector3().fromBufferAttribute(p, 0);
    const b = new THREE.Vector3().fromBufferAttribute(p, 1);
    const c = new THREE.Vector3().fromBufferAttribute(p, 2);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    expect(n.z).toBeCloseTo(1, 6); // +y dunia = +Z three.js
    expect(g.getAttribute('normal').getZ(0)).toBeCloseTo(1, 6);
  });

  it('uvDunia: tekstur berulang sesuai skala di semua sisi balok', () => {
    const g = uvDunia(kotak(0, 0, 2, 2, 0, 2), 0.5);
    const uv = g.getAttribute('uv');
    let maks = 0;
    for (let i = 0; i < uv.count; i++) maks = Math.max(maks, Math.abs(uv.getX(i)), Math.abs(uv.getY(i)));
    expect(maks).toBeCloseTo(4, 6); // 2 unit / 0,5 = 4 ulangan
  });
});

/** Lilitan tiap segitiga searah normal verteksnya (tidak ter-cull dari sisi yang dimaksud). */
function lilitanSearahNormal(g: THREE.BufferGeometry): boolean {
  const nd = g.index ? g.toNonIndexed() : g;
  const p = nd.getAttribute('position');
  const nor = nd.getAttribute('normal');
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    const geo = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    n.fromBufferAttribute(nor, i).add(new THREE.Vector3().fromBufferAttribute(nor, i + 1)).add(new THREE.Vector3().fromBufferAttribute(nor, i + 2));
    if (geo.dot(n) <= 0) return false;
  }
  return true;
}

describe('atap lengkung (gedung utama, ruang tunggu, kanopi)', () => {
  const busur = new Busur(10, 14, 1.9, 2.9);

  it('busur: tepi setinggi hTepi, puncak di tengah, t ↔ b bolak-balik', () => {
    expect(busur.tinggi(10)).toBeCloseTo(1.9, 9);
    expect(busur.tinggi(14)).toBeCloseTo(1.9, 9);
    expect(busur.tinggi(12)).toBeCloseTo(2.9, 9);
    expect(busur.titik(0)[0]).toBeCloseTo(10, 9);
    expect(busur.titik(1)[0]).toBeCloseTo(14, 9);
    expect(busur.titik(busur.tDari(11.3))[1]).toBeCloseTo(busur.tinggi(11.3), 9);
  });

  it('kulit atap, dinding ujung, dan rusuk menghadap keluar di kedua arah sumbu', () => {
    for (const sumbu of ['x', 'y'] as const) {
      const kulit = atapLengkung(sumbu, 0, 5, busur);
      expect(lilitanSearahNormal(kulit)).toBe(true);
      expect(semuaMenghadapAtas(kulit)).toBe(true);
      for (const arah of [1, -1] as const) expect(lilitanSearahNormal(dindingBusur(sumbu, 0, 10, 14, 0.1, busur, arah))).toBe(true);
      expect(lilitanSearahNormal(rusukBusur(sumbu, 2, busur, 0.05, -0.07, 0.01))).toBe(true);
    }
  });

  it('dinding ujung tepat di bawah kulit atap (tanpa celah) dan normalnya ke arah yang diminta', () => {
    const g = dindingBusur('x', 3, 10.5, 13.5, 0.12, busur, 1);
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      expect(p.getX(i)).toBe(3);
      expect(p.getY(i)).toBeLessThanOrEqual(busur.tinggi(p.getZ(i)) + 1e-5);
      expect(n.getX(i)).toBe(1);
    }
  });
});

describe('bingkai layar (portrait & landscape, mengisi layar penuh)', () => {
  it('HP portrait: lebar logis 720, tinggi mengikuti layar (tanpa pita kosong)', () => {
    const t = hitungTataLetakLayar(390, 844);
    expect(t.orientasi).toBe('potret');
    expect(t.skala).toBeCloseTo(390 / SISI_DASAR, 9);
    expect(t.lebarLogis).toBeCloseTo(SISI_DASAR, 9);
    expect(t.tinggiLogis * t.skala).toBeCloseTo(844, 9);
  });

  it('HP landscape: tinggi logis 720, lebar mengikuti layar', () => {
    const t = hitungTataLetakLayar(844, 390);
    expect(t.orientasi).toBe('lanskap');
    expect(t.tinggiLogis).toBeCloseTo(SISI_DASAR, 9);
    expect(t.lebarLogis * t.skala).toBeCloseTo(844, 9);
  });

  it('layar desktop besar: skala dibatasi, sisa ruang dipakai tata letak', () => {
    const t = hitungTataLetakLayar(1920, 1080);
    expect(t.orientasi).toBe('lanskap');
    expect(t.skala).toBeLessThanOrEqual(1.1);
    expect(t.lebarLogis * t.skala).toBeCloseTo(1920, 9);
    expect(t.tinggiLogis * t.skala).toBeCloseTo(1080, 9);
    // Hampir persegi → portrait.
    expect(hitungTataLetakLayar(800, 800).orientasi).toBe('potret');
  });
});
