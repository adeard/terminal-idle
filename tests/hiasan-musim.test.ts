import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PAPAN_MUSIM, SERAGAM_MUSIM, SPANDUK_MUSIM } from '../src/config/hiasan-musim';
import type { SlotHiasan } from '../src/config/musim.config';
import { HiasanEvent } from '../src/game/event3d';
import { HiasanKelas } from '../src/game/kelas3d';
import type { PustakaMaterial } from '../src/game/material3d';
import { bajuMusim, papanMusim, seragamMusim, spandukMusim } from '../src/game/musim-adegan';
import { semuaHiasan, slotHiasan } from '../src/sim/musim';

type Pakai = Record<SlotHiasan, string | null>;
const TANPA: Pakai = { spanduk: null, seragam: null, papan: null, bingkai: null };
const SEMUA_HUJAN: Pakai = { spanduk: 'spanduk-hujan', seragam: 'seragam-hujan', papan: 'papan-hujan', bingkai: 'bingkai-hujan' };

/** Pustaka bahan tiruan: satu bahan untuk semua, teks() mencatat panggilannya dan memberi bahan sendiri per tulisan. */
function pustaka(): { m: PustakaMaterial; teks: { isi: string; latar: string; warna: string; baris2: string | undefined; bahan: THREE.Material }[] } {
  const teks: { isi: string; latar: string; warna: string; baris2: string | undefined; bahan: THREE.Material }[] = [];
  const umum = new THREE.MeshStandardMaterial();
  const m = new Proxy({} as PustakaMaterial, {
    get: (_, kunci) =>
      kunci === 'teks'
        ? (isi: string, o: { latar: string; warna: string; baris2?: string }) => {
            const bahan = new THREE.MeshBasicMaterial();
            teks.push({ isi, latar: o.latar, warna: o.warna, baris2: o.baris2, bahan });
            return { material: bahan, uv: { u0: 0, v0: 0, u1: 1, v1: 1 } };
          }
        : umum,
  });
  return { m, teks };
}

const terlihat = (o: THREE.Object3D): THREE.Mesh[] => {
  const hasil: THREE.Mesh[] = [];
  o.traverseVisible((x) => {
    if (x instanceof THREE.Mesh) hasil.push(x);
  });
  return hasil;
};
const kotakMesh = (mesh: THREE.Mesh): number[] => {
  mesh.geometry.computeBoundingBox();
  const b = mesh.geometry.boundingBox!;
  return [...b.min.toArray(), ...b.max.toArray()].map((v) => +v.toFixed(4));
};

describe('data hiasan musim di adegan', () => {
  it('tiap spanduk, seragam, dan papan dari tabel hadiah punya data adegan, dan tidak ada id lain', () => {
    const id = (slot: SlotHiasan): string[] => semuaHiasan().filter((x) => slotHiasan(x) === slot).sort();
    expect(Object.keys(SPANDUK_MUSIM).sort()).toEqual(id('spanduk'));
    expect(Object.keys(SERAGAM_MUSIM).sort()).toEqual(id('seragam'));
    expect(Object.keys(PAPAN_MUSIM).sort()).toEqual(id('papan'));
    expect(id('spanduk')).toEqual(['spanduk-hujan', 'spanduk-imlek', 'spanduk-mudik']);
  });

  it('spanduk musim Hujan sesuai dokumen 17 bagian 4.1; teks spanduk muat seperti spanduk event', () => {
    expect(SPANDUK_MUSIM['spanduk-hujan']!.teks).toBe('SELAMAT DATANG · HATI-HATI JALAN LICIN');
    for (const s of Object.values(SPANDUK_MUSIM)) expect(s.teks.length).toBeLessThanOrEqual(41);
  });

  it('gapura tidak menjadi satu blok warna: spanduk musim beda latar dari papan temanya, papan musim beda dari spanduk event', () => {
    for (const t of ['hujan', 'imlek', 'mudik']) expect(SPANDUK_MUSIM[`spanduk-${t}`]!.latar).not.toBe(PAPAN_MUSIM[`papan-${t}`]!.latar);
    // Latar spanduk event dibaca dari teks yang dilukis HiasanEvent (event menang di bawah papan musim).
    const { m, teks } = pustaka();
    new HiasanEvent(m);
    const latarEvent = teks.map((t) => t.latar);
    expect(latarEvent).toHaveLength(3);
    for (const p of Object.values(PAPAN_MUSIM)) expect(latarEvent).not.toContain(p.latar);
  });

  it('seragam musim hanya untuk petugas peron & gerbang', () => {
    for (const s of Object.values(SERAGAM_MUSIM)) expect([...s.peran].sort()).toEqual(['gerbang', 'peron']);
  });
});

describe('hiasan musim yang tampil', () => {
  it('spanduk musim tampil bila dipakai dan tidak ada event; event selalu menang', () => {
    expect(spandukMusim(TANPA, null)).toBeNull();
    expect(spandukMusim(SEMUA_HUJAN, null)).toBe('spanduk-hujan');
    expect(spandukMusim(SEMUA_HUJAN, 'mudikLebaran')).toBeNull();
    expect(spandukMusim(SEMUA_HUJAN, 'nataru')).toBeNull();
    // Id tanpa data adegan = tampilan bawaan.
    expect(spandukMusim({ ...TANPA, spanduk: 'bingkai-hujan' }, null)).toBeNull();
  });

  it('papan & seragam musim: id yang dipakai, null = bawaan', () => {
    expect(papanMusim(TANPA)).toBeNull();
    expect(papanMusim(SEMUA_HUJAN)).toBe('papan-hujan');
    expect(seragamMusim(TANPA)).toBeNull();
    expect(seragamMusim(SEMUA_HUJAN)).toBe('seragam-hujan');
    expect(papanMusim({ ...TANPA, papan: 'tidak-ada' })).toBeNull();
  });

  it('warna baju musim hanya untuk peron & gerbang; satpam, juru parkir, petugas toilet tetap', () => {
    expect(bajuMusim('peron', 'seragam-hujan')).toBe(0xfacc15);
    expect(bajuMusim('gerbang', 'seragam-hujan')).toBe(0xfacc15);
    for (const peran of ['satpam', 'juruParkir', 'petugasToilet', 'petugasRetribusi', 'kebersihan'] as const) expect(bajuMusim(peran, 'seragam-hujan')).toBeNull();
    expect(bajuMusim('peron', null)).toBeNull();
  });
});

describe('spanduk musim di gapura (event3d)', () => {
  it('tempat & ukuran sama dengan spanduk event, dua draw call tanpa bayangan, dibangun saat pertama dipakai', () => {
    const { m, teks } = pustaka();
    const h = new HiasanEvent(m);
    const grupAwal = h.objek.children.length;
    h.perbarui('hutRi');
    const tulisanEvent = terlihat(h.objek).find((x) => x.material === teks.find((t) => t.isi.startsWith('DIRGAHAYU'))!.bahan)!;
    expect(h.objek.children.length).toBe(grupAwal);

    h.perbarui(null, 'spanduk-hujan');
    expect(h.objek.children.length).toBe(grupAwal + 1);
    const tulisan = teks.find((t) => t.isi === SPANDUK_MUSIM['spanduk-hujan']!.teks)!;
    expect([tulisan.latar, tulisan.warna]).toEqual([SPANDUK_MUSIM['spanduk-hujan']!.latar, SPANDUK_MUSIM['spanduk-hujan']!.warna]);
    const mesh = terlihat(h.objek);
    // Tulisan + tali: dua mesh, tidak membuang bayangan.
    expect(mesh).toHaveLength(2);
    expect(mesh.some((x) => x.castShadow)).toBe(false);
    expect(kotakMesh(mesh.find((x) => x.material === tulisan.bahan)!)).toEqual(kotakMesh(tulisanEvent));

    // Dipakai lagi: grup yang sama, tidak dibangun ulang.
    h.perbarui(null, null);
    h.perbarui(null, 'spanduk-hujan');
    expect(h.objek.children.length).toBe(grupAwal + 1);
  });

  it('minggu event: hanya spanduk event; melepas hiasan: tidak ada spanduk sama sekali', () => {
    const { m, teks } = pustaka();
    const h = new HiasanEvent(m);
    h.perbarui(null, 'spanduk-hujan');
    h.perbarui('nataru', spandukMusim(SEMUA_HUJAN, 'nataru'));
    const bahanMusim = teks.find((t) => t.isi === SPANDUK_MUSIM['spanduk-hujan']!.teks)!.bahan;
    expect(terlihat(h.objek).some((x) => x.material === bahanMusim)).toBe(false);
    expect(terlihat(h.objek).some((x) => x.material === teks.find((t) => t.isi.startsWith('SELAMAT NATAL'))!.bahan)).toBe(true);
    h.perbarui(null, null);
    expect(terlihat(h.objek)).toHaveLength(0);
  });
});

describe('papan gapura musim (kelas3d)', () => {
  it('papan bawaan: warna musim, tulisan sama; dilepas kembali ke papan bawaan yang sama', () => {
    const { m, teks } = pustaka();
    const h = new HiasanKelas(m);
    h.perbarui(1);
    const bawaan = terlihat(h.objek).map((x) => x.material);
    h.perbarui(1, '', 'papan-hujan');
    const t = teks.at(-1)!;
    expect([t.isi, t.latar, t.warna, t.baris2]).toEqual(['TERMINAL TIPE B', PAPAN_MUSIM['papan-hujan']!.latar, PAPAN_MUSIM['papan-hujan']!.warna, undefined]);
    const musim = terlihat(h.objek);
    expect(musim.some((x) => x.material === t.bahan)).toBe(true);
    // Banyaknya mesh terlihat tetap: papan musim menggantikan papan bawaan (0 draw call).
    expect(musim).toHaveLength(bawaan.length);
    h.perbarui(1, '', null);
    expect(terlihat(h.objek).map((x) => x.material)).toEqual(bawaan);
  });

  it('papan bernama ikut warna musim, nama & kelas di baris kedua tetap, bintang Terpadu tetap', () => {
    const { m, teks } = pustaka();
    const h = new HiasanKelas(m);
    h.perbarui(4, 'Sentosa');
    const bintang = terlihat(h.objek).filter((x) => !(x.material instanceof THREE.MeshBasicMaterial) && x.geometry.type === 'ExtrudeGeometry').length;
    h.perbarui(4, 'Sentosa', 'papan-hujan');
    const t = teks.at(-1)!;
    expect([t.isi, t.baris2, t.latar]).toEqual(['TERMINAL SENTOSA', 'TERPADU', PAPAN_MUSIM['papan-hujan']!.latar]);
    expect(terlihat(h.objek).filter((x) => x.geometry.type === 'ExtrudeGeometry')).toHaveLength(bintang);
    expect(bintang).toBe(2);
  });
});
