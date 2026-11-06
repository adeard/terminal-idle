import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bangunGedung } from '../src/game/gedung3d';
import type { Kumpulan } from '../src/game/geometri';
import { lintasanS } from '../src/game/jalur';
import { KENDARAAN_PER_LAJUR_BELAKANG, LaluLintas } from '../src/game/lalu-lintas';
import { arahKamera, bingkaiAwal, FOV_KAMERA } from '../src/game/kamera';
import { cangkangTerlihat, type LantaiGedung } from '../src/game/lantai-adegan';
import { bangunLantai } from '../src/game/lantai3d';
import { bangunLingkungan } from '../src/game/lingkungan3d';
import type { PustakaMaterial } from '../src/game/material3d';
import { AMBANG_MOBIL_PARKIR, JARAK_AMAN_PARKIR, kapasitasLaluLintas3D, KUNCI, LaluLintasParkir, mobilParkirTerlihat, poseJalur, RUAS_PARKIR, UKURAN_MOBIL, X_MUNCUL_PARKIR, type MobilParkir, type RuasParkir } from '../src/game/mobil-parkir';
import { bangunSekitar } from '../src/game/sekitar3d';
import { KELUAR, LAJUR, TITIK_INTI, TITIK_INTI_POTRET, type Titik } from '../src/game/tata-letak';

const DT = 0.05;
const ujung = (r: RuasParkir, i: number): [number, number] => [r.x[i]!, r.y[i]!];
const jalurDari = (m: MobilParkir): readonly RuasParkir[] => (m.tujuan === 3 ? RUAS_PARKIR.dek3 : RUAS_PARKIR.dek2);
const ruasDari = (m: MobilParkir): RuasParkir => jalurDari(m)[m.ruas]!;

/** Kunci zona yang sedang ditempati badan mobil: ruas tengahnya, ditambah ruas sebelumnya selama buntutnya belum keluar. */
function zonaBadan(m: MobilParkir): number {
  const jalur = jalurDari(m);
  const kini = jalur[m.ruas]!.kunci;
  const sebelum = m.ruas > 0 && m.s < UKURAN_MOBIL.panjang / 2 ? jalur[m.ruas - 1]!.kunci : 0;
  const depan = m.ruas + 1 < jalur.length && m.s > jalur[m.ruas]!.panjang - UKURAN_MOBIL.panjang / 2 ? jalur[m.ruas + 1]!.kunci : 0;
  return kini | sebelum | depan;
}

/** Persegi badan dua mobil (denah) bertumpuk, pada tinggi yang sama. */
function bertabrakan(a: MobilParkir, b: MobilParkir): boolean {
  if (Math.abs(a.h - b.h) > 0.3) return false;
  const sumbu = (m: MobilParkir): [[number, number], [number, number]] => [
    [Math.cos(m.hadap), Math.sin(m.hadap)],
    [-Math.sin(m.hadap), Math.cos(m.hadap)],
  ];
  const pojok = (m: MobilParkir): [number, number][] => {
    const [d, l] = sumbu(m);
    return [-1, 1].flatMap((i) => [-1, 1].map((j): [number, number] => [m.x + (d[0] * i * UKURAN_MOBIL.panjang) / 2 + (l[0] * j * UKURAN_MOBIL.lebar) / 2, m.y + (d[1] * i * UKURAN_MOBIL.panjang) / 2 + (l[1] * j * UKURAN_MOBIL.lebar) / 2]));
  };
  for (const s of [...sumbu(a), ...sumbu(b)]) {
    const pa = pojok(a).map(([x, y]) => x * s[0] + y * s[1]);
    const pb = pojok(b).map(([x, y]) => x * s[0] + y * s[1]);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}

function simulasi(lantai: number, kepadatan: number, detik: number, amati?: (l: LaluLintasParkir, t: number) => void): LaluLintasParkir {
  const l = new LaluLintasParkir();
  l.kepadatan = kepadatan;
  l.atur(lantai, 2 * lantai + 2);
  for (let t = 0; t < detik; t += DT) {
    l.perbarui(DT);
    amati?.(l, t);
  }
  return l;
}

describe('jalur mobil gedung parkir (rancangan 6.7)', () => {
  it('ruas bersambung; jalur mulai di titik muncul pelataran SPBU dan kembali ke sana; lajur kiri di jalan samping', () => {
    for (const jalur of [RUAS_PARKIR.dek2, RUAS_PARKIR.dek3]) {
      for (let i = 1; i < jalur.length; i++) {
        const a = jalur[i - 1]!;
        const [x0, y0] = ujung(a, a.x.length - 1);
        const [x1, y1] = ujung(jalur[i]!, 0);
        expect(Math.hypot(x1 - x0, y1 - y0), `${a.nama} → ${jalur[i]!.nama}`).toBeLessThan(1e-6);
      }
      const awal = jalur[0]!;
      const akhir = jalur[jalur.length - 1]!;
      expect(ujung(awal, 0)).toEqual([X_MUNCUL_PARKIR, 5.1]);
      expect(ujung(akhir, akhir.x.length - 1)).toEqual([X_MUNCUL_PARKIR, 4.7]);
      // Sampel rapat, tanpa lompatan tinggi.
      for (const r of jalur)
        for (let i = 1; i < r.x.length; i++) {
          expect(Math.hypot(r.x[i]! - r.x[i - 1]!, r.y[i]! - r.y[i - 1]!), r.nama).toBeLessThan(0.08);
          expect(Math.abs(r.h[i]! - r.h[i - 1]!), r.nama).toBeLessThan(0.03);
        }
    }
    // Ke barat di sisi selatan (y 5,1), ke timur di sisi utara (y 4,7) jalan samping 4,5–5,3.
    expect(RUAS_PARKIR.dek2[0]!.nama).toBe('asal-samping');
    expect(RUAS_PARKIR.dek2[RUAS_PARKIR.dek2.length - 1]!.nama).toBe('pulang-samping');
  });

  it('dek 2 dan dek 3 dicapai: tinggi alas di lorong dek = tinggi dek; zona ramp & ruang putar berkunci', () => {
    const tinggi = (nama: string): number => {
      const r = [...RUAS_PARKIR.dek3].find((x) => x.nama === nama)!;
      return r.h[Math.floor(r.h.length / 2)]!;
    };
    expect(tinggi('dek2-timur')).toBeCloseTo(1.057, 3);
    expect(tinggi('dek3-timur')).toBeCloseTo(2.107, 3);
    const kunci = Object.fromEntries([...RUAS_PARKIR.dek3].map((r) => [r.nama, r.kunci]));
    expect(kunci['ramp1-naik']).toBe(KUNCI.aNaik);
    expect(kunci['ramp1-turun']).toBe(KUNCI.aTurun);
    expect(kunci['ramp2-naik']).toBe(KUNCI.bNaik);
    expect(kunci['ramp2-turun']).toBe(KUNCI.bTurun);
    expect(kunci['ramp2-sambung-naik']).toBe(KUNCI.bNaik | KUNCI.putar2);
    expect(kunci['ramp2-sambung-turun']).toBe(KUNCI.bTurun | KUNCI.putar2);
    expect(kunci['dek3-putar']).toBe(KUNCI.putar3);
    expect(RUAS_PARKIR.dek2.find((r) => r.nama === 'dek2-putar')!.kunci).toBe(KUNCI.putar2);
  });
});

describe('mobil bergerak: bergantian, tidak macet, berjarak (AC-GFX-10)', () => {
  it('4 mobil, kepadatan 1, 10 menit: zona ramp tidak pernah berisi dua arah, ruang putar satu mobil, tidak bertabrakan, jarak searah ≥ 0,5', () => {
    let langkah = 0;
    let palingLamaDiam = 0;
    const diam = new Map<number, number>();
    const l = simulasi(2, 1, 600, (l) => {
      langkah++;
      const aktif = l.mobil.filter((m) => m.aktif);
      const zona = aktif.map(zonaBadan);
      const ada = (k: number): number => zona.filter((z) => (z & k) !== 0).length;
      expect(ada(KUNCI.aNaik) > 0 && ada(KUNCI.aTurun) > 0, `langkah ${langkah}`).toBe(false);
      expect(ada(KUNCI.bNaik) > 0 && ada(KUNCI.bTurun) > 0, `langkah ${langkah}`).toBe(false);
      expect(ada(KUNCI.putar2), `langkah ${langkah}`).toBeLessThanOrEqual(1);
      expect(ada(KUNCI.putar3), `langkah ${langkah}`).toBeLessThanOrEqual(1);
      expect(ada(KUNCI.simpangSamping), `langkah ${langkah}`).toBeLessThanOrEqual(1);
      expect(ada(KUNCI.simpangLorong), `langkah ${langkah}`).toBeLessThanOrEqual(1);
      for (let i = 0; i < aktif.length; i++)
        for (let j = i + 1; j < aktif.length; j++) {
          const [a, b] = [aktif[i]!, aktif[j]!];
          expect(bertabrakan(a, b), `langkah ${langkah}: mobil ${a.id} ${ruasDari(a).nama} ${a.s.toFixed(2)} & ${b.id} ${ruasDari(b).nama} ${b.s.toFixed(2)}`).toBe(false);
          if (ruasDari(a) === ruasDari(b)) expect(Math.abs(a.s - b.s) - UKURAN_MOBIL.panjang).toBeGreaterThanOrEqual(JARAK_AMAN_PARKIR - 1e-9);
        }
      for (const m of aktif) {
        const d = m.v < 0.01 ? (diam.get(m.id) ?? 0) + DT : 0;
        diam.set(m.id, d);
        palingLamaDiam = Math.max(palingLamaDiam, d);
      }
    });
    expect(l.mobil.map((m) => m.tujuan).sort()).toEqual([2, 2, 3, 3]);
    // Satu putaran ±100 satuan: tiap mobil menyelesaikan beberapa putaran, tidak ada yang tertahan lama.
    for (const m of l.mobil) expect(m.putaran, `mobil ${m.id}`).toBeGreaterThanOrEqual(3);
    expect(palingLamaDiam).toBeLessThan(30);
  });

  it('lantai 2 saja: paling banyak 3 mobil, semua ke dek 2; jumlah mengikuti kepadatan dengan ambang 0 / 0,4 / 0,65 / 0,85', () => {
    expect(AMBANG_MOBIL_PARKIR).toEqual([0, 0.4, 0.65, 0.85]);
    const jumlah = (lantai: number, k: number): number => {
      const l = simulasi(lantai, k, 240);
      return l.mobil.filter((m) => m.aktif || m.putaran > 0).length;
    };
    expect([0.25, 0.5, 0.7, 1].map((k) => jumlah(1, k))).toEqual([1, 2, 3, 3]);
    expect([0.25, 0.5, 0.7, 0.9].map((k) => jumlah(2, k))).toEqual([1, 2, 3, 4]);
    const l = simulasi(1, 1, 120);
    expect(l.mobil.filter((m) => m.aktif).every((m) => m.tujuan === 2)).toBe(true);
  });

  it('langsung tersebar di jalur saat dibeli/dimuat: di luar zona berkunci, berjarak; tanpa lahan parkir tidak ada mobil', () => {
    const l = new LaluLintasParkir();
    l.kepadatan = 1;
    l.atur(2, 6);
    const aktif = l.mobil.filter((m) => m.aktif);
    expect(aktif).toHaveLength(4);
    for (const m of aktif) expect(ruasDari(m).kunci, ruasDari(m).nama).toBe(0);
    for (const a of aktif) for (const b of aktif) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(UKURAN_MOBIL.panjang + JARAK_AMAN_PARKIR);
    // Lantai 3 dibeli sesudah lantai 2: hanya mobil ke-4 yang langsung masuk, yang lain tidak dipindah.
    const l2 = simulasi(1, 1, 60);
    const sebelum = l2.mobil.map((m) => [m.x, m.y]);
    l2.atur(2, 6);
    expect(l2.mobil.slice(0, 3).map((m) => [m.x, m.y])).toEqual(sebelum.slice(0, 3));
    expect(l2.mobil[3]!.aktif).toBe(true);
    const kosong = new LaluLintasParkir();
    kosong.atur(2, 0);
    for (let t = 0; t < 60; t += DT) kosong.perbarui(DT);
    expect(kosong.mobil.some((m) => m.aktif)).toBe(false);
  });

  it('ikut atau berhenti hanya di titik muncul: saat kepadatan turun, mobil menyelesaikan putarannya dulu', () => {
    const l = simulasi(2, 1, 100);
    l.kepadatan = 0.25;
    const lalu = new Map(l.mobil.map((m) => [m.id, m.aktif]));
    const ruasLalu = new Map(l.mobil.map((m) => [m.id, m.ruas]));
    for (let t = 0; t < 300; t += DT) {
      l.perbarui(DT);
      for (const m of l.mobil) {
        // Berhenti (aktif → tidak) hanya sesudah ruas terakhir.
        if (lalu.get(m.id) && !m.aktif) expect(ruasLalu.get(m.id)).toBe(jalurDari(m).length - 1);
        lalu.set(m.id, m.aktif);
        ruasLalu.set(m.id, m.ruas);
      }
    }
    expect(l.mobil.filter((m) => m.aktif).map((m) => m.id)).toEqual([0]);
  });

  it('kapasitas LaluLintas3D = semua kendaraan jalan belakang + semua mobil gedung parkir = 54, cukup pada kepadatan 1', () => {
    const jalan = new LaluLintas({ x0: -64, x1: 100, lajurTimur: 20.75, lajurBarat: 21.45, jumlahPerLajur: KENDARAAN_PER_LAJUR_BELAKANG });
    const parkir = simulasi(2, 1, 60);
    jalan.aturKepadatanSegera(1);
    for (let t = 0; t < 60; t += DT) jalan.perbarui(DT);
    expect(kapasitasLaluLintas3D(jalan, parkir)).toBe(54);
    const aktif = jalan.kendaraan.filter((k) => k.aktif).length + parkir.mobil.filter((m) => m.aktif).length;
    expect(aktif).toBe(54);
  });

  it('mode lantai Gedung parkir: Lantai 1 tanpa mobil bergerak, Lantai 2 hanya bertujuan dek 2, Lantai 3 semua; gedung lain tidak berpengaruh', () => {
    const m2 = { aktif: true, tujuan: 2 } as MobilParkir;
    const m3 = { aktif: true, tujuan: 3 } as MobilParkir;
    const lihat = (gedung: string, lantai: number) => ({ gedung, lantai });
    expect([m2, m3].map((m) => mobilParkirTerlihat(m, null))).toEqual([true, true]);
    expect([m2, m3].map((m) => mobilParkirTerlihat(m, lihat('parkir', 1)))).toEqual([false, false]);
    expect([m2, m3].map((m) => mobilParkirTerlihat(m, lihat('parkir', 2)))).toEqual([true, false]);
    expect([m2, m3].map((m) => mobilParkirTerlihat(m, lihat('parkir', 3)))).toEqual([true, true]);
    expect([m2, m3].map((m) => mobilParkirTerlihat(m, lihat('ruangTunggu', 2)))).toEqual([true, true]);
    expect(mobilParkirTerlihat({ aktif: false, tujuan: 2 } as MobilParkir, null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sapuan badan mobil terhadap geometri adegan (three.js hanya di tes)

/** Pustaka bahan palsu: tiap nama satu bahan (larik untuk bahan bervariasi). */
function bahanPalsu(): PustakaMaterial {
  const simpan = new Map<string, unknown>();
  const LARIK = new Set(['kios', 'kotaFasad', 'rukoDinding', 'atapRumah', 'kursi', 'kelompokParkir']);
  return new Proxy(
    {},
    {
      get: (_, p: string) => {
        if (!simpan.has(p)) {
          if (p === 'teks') {
            const atlas = new THREE.MeshBasicMaterial();
            simpan.set(p, () => ({ material: atlas, uv: { u0: 0, v0: 0, u1: 1, v1: 1 } }));
          } else simpan.set(p, LARIK.has(p) ? Array.from({ length: 6 }, () => new THREE.MeshBasicMaterial()) : new THREE.MeshBasicMaterial());
        }
        return simpan.get(p);
      },
    },
  ) as PustakaMaterial;
}

interface Rekaman {
  readonly sumber: string;
  readonly bagian: string;
  readonly unit: number;
  readonly g: THREE.BufferGeometry;
}

/** Perekam pengganti Kumpulan: menyimpan tiap geometri bersama bagian & unit lantainya. */
function perekam(sumber: string, daftar: Rekaman[]): Kumpulan {
  const k = {
    bagian: 'dasar',
    unitLantai: 0,
    level: 0,
    tambah(_: THREE.Material, g: THREE.BufferGeometry) {
      daftar.push({ sumber, bagian: this.bagian, unit: this.unitLantai, g });
    },
  };
  return k as unknown as Kumpulan;
}

/** Semua geometri adegan di sekitar jalur mobil: lantai tambahan, gedung, lingkungan, sekitar (SPBU, mobil tanah). */
const REKAMAN: Rekaman[] = (() => {
  const daftar: Rekaman[] = [];
  const m = bahanPalsu();
  bangunLantai(perekam('lantai', daftar), m);
  bangunGedung(perekam('gedung', daftar), m);
  bangunLingkungan(perekam('lingkungan', daftar), m);
  bangunSekitar(perekam('sekitar', daftar), m, new THREE.Group(), [perekam('baris1', daftar), perekam('baris2', daftar)]);
  return daftar;
})();

/** Segitiga (9 angka per segitiga) dari rekaman yang lolos saring, di sekitar jalur (x 29–65, y 3–18). */
function segitiga(saring: (r: Rekaman) => boolean): Float32Array {
  const hasil: number[] = [];
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (const r of REKAMAN) {
    if (!saring(r)) continue;
    const pos = r.g.getAttribute('position');
    const idx = r.g.getIndex();
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      for (let j = 0; j < 3; j++) v[j]!.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j);
      const x0 = Math.min(v[0]!.x, v[1]!.x, v[2]!.x);
      const x1 = Math.max(v[0]!.x, v[1]!.x, v[2]!.x);
      const z0 = Math.min(v[0]!.z, v[1]!.z, v[2]!.z);
      const z1 = Math.max(v[0]!.z, v[1]!.z, v[2]!.z);
      if (x1 < 29 || x0 > 65 || z1 < 3 || z0 > 18) continue;
      for (const p of v) hasil.push(p.x, p.y, p.z);
    }
  }
  return new Float32Array(hasil);
}

/** Lantai tambahan yang terlihat bersama mobil bertujuan dek ini (tampilan biasa, dan mode lantai yang menampilkannya). */
function saringState(lantai: LantaiGedung, tujuan: 2 | 3): (r: Rekaman) => boolean {
  const lihat = [null, ...(tujuan === 2 ? [{ gedung: 'parkir' as const, lantai: 2 }] : [{ gedung: 'parkir' as const, lantai: 3 }])];
  return (r) => {
    if (r.sumber === 'lantai') return lihat.some((l) => cangkangTerlihat(r.unit, lantai, l));
    // Mobil tanah baris 2 di bawah ramp tersembunyi selama gedung parkir ada.
    if (r.sumber === 'baris2') return r.bagian !== 'lahan';
    return true;
  };
}

interface Tabrak {
  readonly ruas: string;
  readonly s: number;
  readonly x: number;
  readonly y: number;
  readonly h: number;
}

/** Kotak badan mobil (tanpa roda, toleransi 0,02) disapu sepanjang jalur tiap 0,05: titik yang menabrak segitiga mana pun. */
function sapu(jalur: readonly RuasParkir[], tri: Float32Array): Tabrak[] {
  const tol = 0.02;
  const kotakLokal = new THREE.Box3(new THREE.Vector3(-UKURAN_MOBIL.panjang / 2 + tol, 0.05 + tol, -UKURAN_MOBIL.lebar / 2 + tol), new THREE.Vector3(UKURAN_MOBIL.panjang / 2 - tol, 0.33, UKURAN_MOBIL.lebar / 2 - tol));
  const pose = { x: 0, y: 0, h: 0, hadap: 0, angguk: 0 };
  const bantu = { x: 0, y: 0, h: 0, hadap: 0 };
  const mat = new THREE.Matrix4();
  const balik = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const qa = new THREE.Quaternion();
  const t = new THREE.Triangle();
  const hasil: Tabrak[] = [];
  jalur.forEach((r, k) => {
    for (let s = 0; s <= r.panjang; s += 0.05) {
      poseJalur(jalur, k, s, bantu, pose);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -pose.hadap).multiply(qa.setFromAxisAngle(new THREE.Vector3(0, 0, 1), pose.angguk));
      mat.compose(new THREE.Vector3(pose.x, pose.h, pose.y), q, new THREE.Vector3(1, 1, 1));
      balik.copy(mat).invert();
      for (let i = 0; i < tri.length; i += 9) {
        // Saring cepat: segitiga jauh dari mobil.
        if (Math.min(tri[i]!, tri[i + 3]!, tri[i + 6]!) > pose.x + 0.6 || Math.max(tri[i]!, tri[i + 3]!, tri[i + 6]!) < pose.x - 0.6) continue;
        if (Math.min(tri[i + 2]!, tri[i + 5]!, tri[i + 8]!) > pose.y + 0.6 || Math.max(tri[i + 2]!, tri[i + 5]!, tri[i + 8]!) < pose.y - 0.6) continue;
        t.a.set(tri[i]!, tri[i + 1]!, tri[i + 2]!).applyMatrix4(balik);
        t.b.set(tri[i + 3]!, tri[i + 4]!, tri[i + 5]!).applyMatrix4(balik);
        t.c.set(tri[i + 6]!, tri[i + 7]!, tri[i + 8]!).applyMatrix4(balik);
        if (kotakLokal.intersectsTriangle(t)) {
          hasil.push({ ruas: r.nama, s: +s.toFixed(2), x: +pose.x.toFixed(2), y: +pose.y.toFixed(2), h: +pose.h.toFixed(2) });
          break;
        }
      }
    }
  });
  return hasil;
}

describe('mobil bergerak bisa lewat (tes sapuan, AC-GFX-10)', () => {
  const LANTAI2: LantaiGedung = { parkir: 1, ruangTunggu: 1, sayapBarat: 1, aula: 1 };
  const LANTAI3: LantaiGedung = { parkir: 2, ruangTunggu: 1, sayapBarat: 1, aula: 1 };

  it('ada rekaman dari tiap sumber (gedung parkir, gapura, mobil tanah, SPBU)', () => {
    for (const s of ['lantai', 'gedung', 'lingkungan', 'sekitar', 'baris1', 'baris2']) expect(REKAMAN.some((r) => r.sumber === s), s).toBe(true);
  });

  it('lantai parkir 2 saja: kotak 0,36 × 0,90 sepanjang jalur dek 2 tidak memotong geometri yang terlihat', () => {
    expect(sapu(RUAS_PARKIR.dek2, segitiga(saringState(LANTAI2, 2))).slice(0, 8)).toEqual([]);
  });

  it('lantai parkir 3: jalur dek 2 (juga di mode Lantai 2) dan jalur dek 3 tidak memotong geometri yang terlihat', () => {
    expect(sapu(RUAS_PARKIR.dek2, segitiga(saringState(LANTAI3, 2))).slice(0, 8)).toEqual([]);
    expect(sapu(RUAS_PARKIR.dek3, segitiga(saringState(LANTAI3, 3))).slice(0, 8)).toEqual([]);
  });

  it('berjarak ≥ 0,46 dari lintasan bus keluar (kurva KELUAR dan lajur sirkulasi menuju ke sana)', () => {
    const bus = [[44, LAJUR.sirkulasi] as Titik, ...lintasanS(KELUAR.dari, KELUAR.ke)];
    const jarakRuas = (px: number, py: number, a: Titik, b: Titik): number => {
      const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
      const u = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(px - a[0] - u * dx, py - a[1] - u * dy);
    };
    let min = Infinity;
    for (const r of RUAS_PARKIR.dek3) for (let i = 0; i < r.x.length; i++) for (let j = 1; j < bus.length; j++) min = Math.min(min, jarakRuas(r.x[i]!, r.y[i]!, bus[j - 1]!, bus[j]!));
    expect(min).toBeGreaterThanOrEqual(0.46);
  });

  it('titik muncul dan hilang di luar bingkai kamera awal di kelima layar', () => {
    const LAYAR: readonly [number, number][] = [
      [540, 583],
      [412, 627],
      [360, 549],
      [434, 420],
      [667, 420],
    ];
    for (const [w, h] of LAYAR) {
      const b = bingkaiAwal(w > h ? TITIK_INTI : TITIK_INTI_POTRET, TITIK_INTI, w, h);
      const kamera = new THREE.PerspectiveCamera(FOV_KAMERA, w / h, 1, 700);
      const arah = arahKamera(b.azimut);
      kamera.position.set(b.x + arah[0] * b.jarak, arah[1] * b.jarak, b.y + arah[2] * b.jarak);
      kamera.lookAt(b.x, 0, b.y);
      kamera.updateMatrixWorld();
      for (const y of [5.1, 4.7]) {
        // Pojok badan mobil di titik muncul/hilang: semuanya di luar layar.
        for (const dx of [-0.45, 0.45])
          for (const dy of [-0.18, 0.18])
            for (const dh of [0, 0.33]) {
              const p = new THREE.Vector3(X_MUNCUL_PARKIR + dx, dh, y + dy).project(kamera);
              expect(Math.abs(p.x) > 1 || Math.abs(p.y) > 1, `${w}×${h}`).toBe(true);
            }
      }
    }
  });
});
