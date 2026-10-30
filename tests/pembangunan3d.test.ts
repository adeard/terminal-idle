import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PembangunanTerminal } from '../src/game/pembangunan3d';
import { GERBANG_X, HALTE_DATANG_X, KELOMPOK_PARKIR, PERON, PERON_BERANGKAT, PINTU_BUS } from '../src/game/tata-letak';

/** Mesh di grup yang sedang tampil (tiap mesh = satu draw call). */
function meshTampil(p: PembangunanTerminal): THREE.Mesh[] {
  return p.objek.children.filter((g) => g.visible).flatMap((g) => g.children as THREE.Mesh[]);
}

/** Ada pagar tampil di sekitar (x, y) denah: titik sudut geometri dalam ±0,5 petak. */
function adaPagar(p: PembangunanTerminal, x: number, y: number): boolean {
  return meshTampil(p).some((m) => {
    const pos = m.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getX(i) - x) < 0.5 && Math.abs(pos.getZ(i) - y) < 0.5) return true;
    return false;
  });
}

describe('pembangunan terminal: pagar jalur yang belum dibangun', () => {
  it('halte kedatangan dan gerbang keberangkatan sama banyak (satu grup per jalur)', () => {
    expect(GERBANG_X.length).toBe(HALTE_DATANG_X.length);
  });

  for (let jalur = 1; jalur <= HALTE_DATANG_X.length; jalur++) {
    it(`${jalur} jalur dibangun: pagar halte & gerbang tampil tepat untuk jalur yang belum dibangun`, () => {
      const p = new PembangunanTerminal();
      p.perbarui({ jalur, kelompok: KELOMPOK_PARKIR.length });
      for (let k = 1; k < HALTE_DATANG_X.length; k++) {
        const tutup = jalur <= k;
        expect(adaPagar(p, HALTE_DATANG_X[k]! + PINTU_BUS, PERON.y0 + 0.14), `halte jalur ${k + 1}`).toBe(tutup);
        expect(adaPagar(p, GERBANG_X[k]!, PERON_BERANGKAT.y0 + 0.14), `gerbang jalur ${k + 1}`).toBe(tutup);
      }
      // Jalur 1 tidak pernah berpagar.
      expect(adaPagar(p, HALTE_DATANG_X[0]! + PINTU_BUS, PERON.y0 + 0.14)).toBe(false);
      expect(adaPagar(p, GERBANG_X[0]!, PERON_BERANGKAT.y0 + 0.14)).toBe(false);
    });
  }

  it('draw call: 2 per jalur yang belum dibangun (oranye + putih) dan 2 per kelompok parkir yang belum dibangun', () => {
    const p = new PembangunanTerminal();
    for (let jalur = 1; jalur <= HALTE_DATANG_X.length; jalur++) {
      for (let kelompok = 0; kelompok <= KELOMPOK_PARKIR.length; kelompok++) {
        p.perbarui({ jalur, kelompok });
        const mesh = meshTampil(p);
        expect(mesh.length).toBe(2 * (HALTE_DATANG_X.length - jalur) + 2 * (KELOMPOK_PARKIR.length - kelompok));
        // Satu mesh per material per grup (Kumpulan): tidak ada material ganda di satu grup.
        for (const g of p.objek.children) expect(new Set(g.children.map((m) => (m as THREE.Mesh).material)).size).toBe(g.children.length);
      }
    }
  });

  it('bangunan berubah hanya menukar visibilitas: grup, mesh, dan geometri tetap yang sama (tidak dibangun ulang, tidak bocor)', () => {
    const p = new PembangunanTerminal();
    expect(p.objek.children.length).toBe(HALTE_DATANG_X.length - 1 + KELOMPOK_PARKIR.length);
    const geometriAwal = p.objek.children.flatMap((g) => g.children.map((m) => (m as THREE.Mesh).geometry));
    for (let ulang = 0; ulang < 3; ulang++) {
      for (let jalur = 1; jalur <= HALTE_DATANG_X.length; jalur++) {
        for (let kelompok = 0; kelompok <= KELOMPOK_PARKIR.length; kelompok++) p.perbarui({ jalur, kelompok });
      }
    }
    const geometriAkhir = p.objek.children.flatMap((g) => g.children.map((m) => (m as THREE.Mesh).geometry));
    expect(geometriAkhir.length).toBe(geometriAwal.length);
    geometriAkhir.forEach((g, i) => expect(g).toBe(geometriAwal[i]));
  });
});
