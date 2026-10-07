/**
 * Orang 3D low-poly beranimasi. Tiap bagian tubuh (kaki, lengan, badan,
 * kepala, rambut, jilbab, gamis, ransel, koper, payung, sapu, kotak asongan)
 * adalah satu InstancedMesh untuk semua orang, jadi seluruh kerumunan cukup
 * 12 draw call. Matriks tiap bagian
 * dihitung di CPU: orang menghadap arah jalannya, kaki & lengan berayun
 * sesuai jarak tempuh, tubuh sedikit naik-turun saat melangkah.
 *
 * Satuan dunia: tinggi dewasa ≈ 0,38 unit (sedikit di atas skala nyata supaya
 * kerumunan tetap terbaca dari kamera maket).
 */
import * as THREE from 'three';
import { acakBerbenih } from './dunia-visual';

/** Proporsi tubuh (unit, skala 1). Pinggul = pangkal kaki, bahu = pangkal lengan. */
const T = {
  pinggul: 0.17,
  kakiPanjang: 0.17,
  bahu: 0.295,
  lenganPanjang: 0.13,
  badanBawah: 0.165,
  badanAtas: 0.3,
  kepala: 0.335,
} as const;
/**
 * Satu siklus langkah (dua langkah) per jarak tempuh ini: panjang langkah
 * ±0,45 × tinggi badan, jadi pada laju jalan biasa (0,45 petak/dtk) kaki
 * melangkah ±2,6 kali/detik dan jejaknya tidak tergelincir.
 */
const SIKLUS_LANGKAH = 0.34;
const AYUN_MAKS = 0.55;

export type Pose = 'jalan' | 'duduk';

export interface Penampilan {
  readonly kulit: THREE.Color;
  readonly baju: THREE.Color;
  readonly celana: THREE.Color;
  readonly rambut: THREE.Color;
  readonly jilbab: THREE.Color | null;
  readonly ransel: THREE.Color | null;
  /** Koper beroda yang ditarik (miring saat berjalan, tegak saat berhenti). */
  readonly koper: THREE.Color | null;
  readonly topi: boolean;
  readonly skala: number;
}

const KULIT = [0xf1c27d, 0xe0ac69, 0xc68642, 0xa86b3c, 0x8d5524, 0xd8a47a].map((c) => new THREE.Color(c));
const BAJU = [0xdc2626, 0x2563eb, 0x16a34a, 0xf5f5f4, 0x111827, 0xf59e0b, 0x7c3aed, 0x0891b2, 0x9ca3af, 0xbe185d, 0x65a30d, 0x78350f, 0xfacc15, 0x1e3a8a].map((c) => new THREE.Color(c));
const CELANA = [0x1f2937, 0x334155, 0x1e3a8a, 0x44403c, 0x3f3f46, 0x57534e, 0x0f172a].map((c) => new THREE.Color(c));
const RAMBUT = [0x1c1410, 0x2b1d14, 0x3b2a1e, 0x151515].map((c) => new THREE.Color(c));
const JILBAB = [0xbe185d, 0x0f766e, 0x7c3aed, 0x1d4ed8, 0xf59e0b, 0xf5f5f4, 0x111827, 0xdb2777, 0x92400e].map((c) => new THREE.Color(c));
const RANSEL = [0x111827, 0x374151, 0x7f1d1d, 0x1e3a8a, 0x064e3b].map((c) => new THREE.Color(c));
const KOPER = [0x1f2937, 0x7f1d1d, 0x1e40af, 0x6b7280, 0x0f766e, 0x9d174d, 0x374151, 0xb45309].map((c) => new THREE.Color(c));

/** Tabel penampilan acak berbenih; varian orang (DuniaVisual) memilih salah satunya. */
export function buatPenampilan(jumlah: number, benih = 131): Penampilan[] {
  const acak = acakBerbenih(benih);
  const pilih = <T>(d: readonly T[]): T => d[Math.floor(acak() * d.length)]!;
  return Array.from({ length: jumlah }, () => {
    const jilbab = acak() < 0.32 ? pilih(JILBAB) : null;
    const ransel = acak() < 0.22 ? pilih(RANSEL) : null;
    return {
      kulit: pilih(KULIT),
      baju: pilih(BAJU),
      celana: pilih(CELANA),
      rambut: pilih(RAMBUT),
      jilbab,
      ransel,
      koper: !ransel && acak() < 0.24 ? pilih(KOPER) : null,
      topi: !jilbab && acak() < 0.12,
      skala: 0.9 + acak() * 0.18,
    };
  });
}

/** Penampilan anak-anak (lebih kecil, tanpa bawaan). */
export function buatPenampilanAnak(jumlah: number, benih = 717): Penampilan[] {
  return buatPenampilan(jumlah, benih).map((p, i) => ({ ...p, ransel: null, koper: null, topi: false, skala: 0.58 + ((i * 0.618) % 1) * 0.12 }));
}

export interface DataOrang {
  /** Id unik & stabil (untuk arah hadap & fase langkah antar-frame). */
  readonly id: number;
  readonly x: number;
  readonly y: number;
  /** Ketinggian pijakan (lantai/peron). */
  readonly h: number;
  readonly penampilan: Penampilan;
  readonly pose?: Pose;
  /** Arah hadap tetap (radian dunia) untuk orang yang diam, mis. satpam. */
  readonly hadap?: number;
  /** Warna payung yang sedang dipakai (saat hujan di luar atap), null/kosong = tanpa payung. */
  readonly payung?: THREE.Color | null;
  /** Melambaikan tangan kanan; nilai = ayunan sekarang (−1…1). */
  readonly lambai?: number;
  /** Menyapu lantai; nilai = ayunan sapu sekarang (−1…1). */
  readonly sapu?: number;
  /** Membawa kotak dagangan asongan di depan badan (warna dagangannya). */
  readonly baki?: THREE.Color;
}

/** Warna payung (dipilih per orang oleh pemanggil). */
export const WARNA_PAYUNG: readonly THREE.Color[] = [0x111827, 0x1e3a8a, 0xb91c1c, 0x0f766e, 0x7c3aed, 0xf59e0b, 0x334155, 0xdb2777, 0x15803d].map((c) => new THREE.Color(c));

interface StatusOrang {
  x: number;
  y: number;
  hadap: number;
  fase: number;
  ayun: number;
  hidup: boolean;
}

// ---------------------------------------------------------------------------
// Geometri bagian tubuh (satuan orang, depan = +x, samping = z)

function warnai(g: THREE.BufferGeometry, pilih: (p: THREE.Vector3) => THREE.Color | null): THREE.BufferGeometry {
  const nd = g.index ? g.toNonIndexed() : g;
  const pos = nd.getAttribute('position');
  const w = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const c = pilih(p);
    w[i * 3] = c ? c.r : 1;
    w[i * 3 + 1] = c ? c.g : 1;
    w[i * 3 + 2] = c ? c.b : 1;
  }
  nd.setAttribute('color', new THREE.BufferAttribute(w, 3));
  nd.deleteAttribute('uv');
  return nd;
}

const SEPATU = new THREE.Color(0.08, 0.08, 0.09);

/** Kaki: pangkal (pinggul) di titik asal, menjulur ke −y; ujung bawah = sepatu gelap. */
function geoKaki(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(0.036, T.kakiPanjang, 0.034);
  g.translate(0.004, -T.kakiPanjang / 2, 0);
  return warnai(g, (p) => (p.y < -T.kakiPanjang + 0.022 ? SEPATU : null));
}

function geoLengan(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(0.024, T.lenganPanjang, 0.024);
  g.translate(0, -T.lenganPanjang / 2, 0);
  return warnai(g, () => null);
}

function geoBadan(): THREE.BufferGeometry {
  // Badan meruncing sedikit ke pinggang.
  const g = new THREE.CylinderGeometry(0.052, 0.042, T.badanAtas - T.badanBawah, 6, 1);
  g.scale(0.62, 1, 1);
  g.translate(0, (T.badanAtas + T.badanBawah) / 2, 0);
  return warnai(g, () => null);
}

function geoKepala(): THREE.BufferGeometry {
  // Poligon hemat: kepala hanya beberapa piksel di layar.
  const g = new THREE.SphereGeometry(0.03, 7, 5);
  g.scale(0.95, 1.08, 0.9);
  return warnai(g, () => null);
}

function geoRambut(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.032, 7, 3, 0, Math.PI * 2, 0, Math.PI * 0.55);
  g.scale(1, 0.95, 0.96);
  g.translate(-0.004, 0.004, 0);
  return warnai(g, () => null);
}

function geoJilbab(): THREE.BufferGeometry {
  // Menutup kepala & leher, melebar ke bahu; wajah tetap terlihat dari depan.
  // phi = π menghadap +x (depan): celah wajah dipusatkan di sana.
  const g = new THREE.SphereGeometry(0.036, 7, 5, Math.PI * 1.12, Math.PI * 1.76, 0, Math.PI * 0.8);
  g.scale(1, 1.25, 1.05);
  g.translate(-0.006, -0.006, 0);
  return warnai(g, () => null);
}

function geoGamis(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.042, 0.06, T.badanAtas - 0.02, 6, 1, true);
  g.translate(0, 0.02 + (T.badanAtas - 0.02) / 2, 0);
  return warnai(g, () => null);
}

function geoRansel(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(0.03, 0.075, 0.062);
  g.translate(-0.042, 0.245, 0);
  return warnai(g, () => null);
}

/** Koper beroda: badan kotak, roda gelap di bawah, gagang tarik ke atas. Titik asal = poros roda. */
function geoKoper(): THREE.BufferGeometry {
  const badan = new THREE.BoxGeometry(0.036, 0.085, 0.052);
  badan.translate(0, 0.012 + 0.0425, 0);
  const roda = new THREE.BoxGeometry(0.03, 0.012, 0.046);
  roda.translate(0, 0.006, 0);
  const gagang = new THREE.BoxGeometry(0.006, 0.075, 0.006);
  gagang.translate(0, 0.097 + 0.0375, 0);
  return warnai(gabung([badan, roda, gagang]), (p) => (p.y < 0.012 || p.y > 0.098 ? GAGANG_PAYUNG : null));
}

/** Payung terbuka: kubah rendah 8 sisi di atas kepala + gagang gelap ke tangan. */
function geoPayung(): THREE.BufferGeometry {
  const kubah = new THREE.ConeGeometry(0.12, 0.05, 8, 1, true);
  kubah.translate(0, 0.445, 0);
  const gagang = new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4, 1);
  gagang.translate(0.02, 0.36, 0);
  const g = gabung([kubah, gagang]);
  return warnai(g, (p) => (p.y < 0.43 ? GAGANG_PAYUNG : null));
}

const GAGANG_PAYUNG = new THREE.Color(0.12, 0.12, 0.13);
const KAYU = new THREE.Color(0.55, 0.38, 0.22);
const IJUK = new THREE.Color(0.22, 0.16, 0.1);
const KARDUS = new THREE.Color(0.72, 0.56, 0.36);

/** Sapu ijuk bergagang panjang: pangkal gagang di tangan (titik asal), kepala sapu di lantai di depan. */
function geoSapu(): THREE.BufferGeometry {
  // Gagang 0,25 condong 0,55 rad: ujung bawahnya di (0,131; −0,213) dari tangan.
  const gagang = new THREE.CylinderGeometry(0.005, 0.005, 0.25, 4, 1);
  gagang.translate(0, -0.125, 0);
  gagang.rotateZ(0.55);
  const kepala = new THREE.BoxGeometry(0.03, 0.03, 0.09);
  kepala.translate(0.131, -0.205, 0);
  const g = gabung([gagang, kepala]);
  return warnai(g, (p) => (p.y < -0.19 ? IJUK : KAYU));
}

/** Kotak dagangan asongan: kotak kardus terbuka dengan dagangan (diwarnai per instans) di atasnya. */
function geoBaki(): THREE.BufferGeometry {
  const kotak = new THREE.BoxGeometry(0.07, 0.035, 0.1);
  kotak.translate(0, 0, 0);
  const isi = new THREE.BoxGeometry(0.06, 0.02, 0.085);
  isi.translate(0, 0.026, 0);
  return warnai(gabung([kotak, isi]), (p) => (p.y < 0.016 ? KARDUS : null));
}

/** Gabungkan geometri non-indeks (posisi & normal saja). */
function gabung(daftar: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nd = daftar.map((g) => (g.index ? g.toNonIndexed() : g));
  const n = nd.reduce((a, g) => a + g.getAttribute('position').count, 0);
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of nd) {
    pos.set(g.getAttribute('position').array as Float32Array, o * 3);
    nor.set(g.getAttribute('normal').array as Float32Array, o * 3);
    o += g.getAttribute('position').count;
  }
  const hasil = new THREE.BufferGeometry();
  hasil.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  hasil.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return hasil;
}

// ---------------------------------------------------------------------------

export class Kerumunan3D {
  readonly objek = new THREE.Group();
  private readonly kaki: THREE.InstancedMesh;
  private readonly lengan: THREE.InstancedMesh;
  private readonly badan: THREE.InstancedMesh;
  private readonly kepala: THREE.InstancedMesh;
  private readonly rambut: THREE.InstancedMesh;
  private readonly jilbab: THREE.InstancedMesh;
  private readonly gamis: THREE.InstancedMesh;
  private readonly ransel: THREE.InstancedMesh;
  private readonly payung: THREE.InstancedMesh;
  private readonly koper: THREE.InstancedMesh;
  private readonly sapu: THREE.InstancedMesh;
  private readonly baki: THREE.InstancedMesh;
  private readonly status = new Map<number, StatusOrang>();
  private n = 0;
  private nKaki = 0;
  private nLengan = 0;
  private nRambut = 0;
  private nJilbab = 0;
  private nGamis = 0;
  private nRansel = 0;
  private nPayung = 0;
  private nKoper = 0;
  private nSapu = 0;
  private nBaki = 0;
  private readonly mOrang = new THREE.Matrix4();
  private readonly mBagian = new THREE.Matrix4();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly satu = new THREE.Vector3(1, 1, 1);
  private readonly sumbuY = new THREE.Vector3(0, 1, 0);
  private readonly sumbuZ = new THREE.Vector3(0, 0, 1);
  private readonly qNol = new THREE.Quaternion();
  private readonly qLengan = new THREE.Quaternion();
  private readonly putih = new THREE.Color(1, 1, 1);
  private readonly e = new THREE.Euler(0, 0, 0, 'XYZ');

  constructor(private readonly kapasitas: number) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const buat = (g: THREE.BufferGeometry, jumlah: number, bayangan = true): THREE.InstancedMesh => {
      const m = new THREE.InstancedMesh(g, material, jumlah);
      m.castShadow = bayangan;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      this.objek.add(m);
      return m;
    };
    this.kaki = buat(geoKaki(), kapasitas * 2);
    this.lengan = buat(geoLengan(), kapasitas * 2);
    this.badan = buat(geoBadan(), kapasitas);
    this.kepala = buat(geoKepala(), kapasitas);
    this.rambut = buat(geoRambut(), kapasitas, false);
    this.jilbab = buat(geoJilbab(), kapasitas);
    this.gamis = buat(geoGamis(), kapasitas);
    this.ransel = buat(geoRansel(), kapasitas, false);
    this.koper = buat(geoKoper(), kapasitas);
    this.payung = buat(geoPayung(), kapasitas);
    // Sedikit orang yang menyapu / berjualan: cukup kapasitas kecil.
    this.sapu = buat(geoSapu(), 16);
    this.baki = buat(geoBaki(), 16);
    // Kubah payung terlihat dari bawah juga (kamera rendah).
    this.payung.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
  }

  mulai(): void {
    this.n = this.nKaki = this.nLengan = this.nRambut = this.nJilbab = this.nGamis = this.nRansel = this.nPayung = this.nKoper = this.nSapu = this.nBaki = 0;
    for (const st of this.status.values()) st.hidup = false;
  }

  /** Bagian tubuh: matriks orang × (geser lokal, putar di sumbu samping). */
  private bagian(mesh: THREE.InstancedMesh, i: number, lx: number, ly: number, lz: number, putar: number, warna: THREE.Color): void {
    this.q.setFromAxisAngle(this.sumbuZ, putar);
    this.bagianQ(mesh, i, lx, ly, lz, putar === 0 ? this.qNol : this.q, warna);
  }

  /** Bagian tubuh dengan rotasi lokal bebas. */
  private bagianQ(mesh: THREE.InstancedMesh, i: number, lx: number, ly: number, lz: number, q: THREE.Quaternion, warna: THREE.Color): void {
    if (i >= mesh.instanceMatrix.count) return;
    this.mBagian.compose(this.p.set(lx, ly, lz), q, this.satu);
    this.m.multiplyMatrices(this.mOrang, this.mBagian);
    mesh.setMatrixAt(i, this.m);
    mesh.setColorAt(i, warna);
  }

  tambah(o: DataOrang, dt: number): void {
    if (this.n >= this.kapasitas) return;
    let st = this.status.get(o.id);
    if (!st) {
      st = { x: o.x, y: o.y, hadap: o.hadap ?? Math.PI / 4 + ((o.id * 2.39) % 1.2) - 0.6, fase: (o.id * 1.7) % (Math.PI * 2), ayun: 0, hidup: true };
      this.status.set(o.id, st);
    }
    st.hidup = true;
    const dx = o.x - st.x;
    const dy = o.y - st.y;
    const jarak = Math.hypot(dx, dy);
    st.x = o.x;
    st.y = o.y;
    const bergerak = jarak > 1e-4 && jarak < 1;
    if (bergerak) {
      const target = Math.atan2(dy, dx);
      let beda = target - st.hadap;
      beda = Math.atan2(Math.sin(beda), Math.cos(beda));
      st.hadap += beda * Math.min(1, dt * 10);
      st.fase += (jarak / SIKLUS_LANGKAH) * Math.PI * 2;
    } else if (o.hadap !== undefined) {
      st.hadap = o.hadap;
    }
    const ap = o.penampilan;
    const bergamis = ap.jilbab !== null;
    const ayunTarget = bergerak ? (bergamis ? AYUN_MAKS * 0.5 : AYUN_MAKS) : 0;
    st.ayun += (ayunTarget - st.ayun) * Math.min(1, dt * 8);
    const duduk = o.pose === 'duduk';
    const langkah = Math.sin(st.fase) * st.ayun;
    const naik = duduk ? 0 : Math.abs(Math.sin(st.fase)) * 0.006 * (st.ayun / AYUN_MAKS);

    // Matriks orang: posisi, menghadap arah jalan (sumbu y), skala tinggi badan.
    this.q.setFromAxisAngle(this.sumbuY, -st.hadap);
    const turun = duduk ? T.pinggul - 0.095 : 0; // pinggul setinggi dudukan bangku
    this.s.setScalar(ap.skala);
    this.mOrang.compose(this.p.set(o.x, o.h + naik - turun * ap.skala, o.y), this.q, this.s);

    const sudutKaki = duduk ? 1.35 : 0;
    this.bagian(this.kaki, this.nKaki++, 0, T.pinggul, -0.021, sudutKaki + langkah, ap.celana);
    this.bagian(this.kaki, this.nKaki++, 0, T.pinggul, 0.021, sudutKaki - langkah, ap.celana);
    // Lengan: memegang sapu / kotak dagangan (keduanya ke depan), atau berayun biasa.
    const pegang = o.sapu !== undefined ? 0.75 : o.baki ? 1.15 : null;
    const sudutLengan = pegang ?? (duduk ? 0.35 : 0);
    const ayunLengan = pegang === null ? langkah * 0.8 : 0;
    this.bagian(this.lengan, this.nLengan++, 0, T.bahu, -0.056, sudutLengan - ayunLengan, ap.baju);
    if (o.lambai !== undefined) {
      // Tangan kanan terangkat ke samping-atas, berayun kiri-kanan.
      this.e.set(-(2.45 + 0.35 * o.lambai), 0, 0.25);
      this.qLengan.setFromEuler(this.e);
      this.bagianQ(this.lengan, this.nLengan++, 0, T.bahu, 0.056, this.qLengan, ap.baju);
    } else {
      this.bagian(this.lengan, this.nLengan++, 0, T.bahu, 0.056, sudutLengan + ayunLengan, ap.baju);
    }
    if (o.sapu !== undefined) {
      // Sapu di tangan, disapukan ke kiri-kanan di depan kaki.
      this.qLengan.setFromAxisAngle(this.sumbuY, 0.45 * o.sapu);
      this.bagianQ(this.sapu, this.nSapu++, 0.09, 0.21, 0, this.qLengan, this.putih);
    }
    if (o.baki) this.bagian(this.baki, this.nBaki++, 0.1, T.bahu - 0.07, 0, 0, o.baki);
    this.bagian(this.badan, this.n, 0, 0, 0, 0, ap.baju);
    this.bagian(this.kepala, this.n, 0.003, T.kepala, 0, 0, ap.kulit);
    if (ap.jilbab) {
      this.bagian(this.jilbab, this.nJilbab++, 0, T.kepala, 0, 0, ap.jilbab);
      if (!duduk) this.bagian(this.gamis, this.nGamis++, 0, 0, 0, 0, ap.baju);
    } else {
      this.bagian(this.rambut, this.nRambut++, 0, T.kepala, 0, 0, ap.topi ? ap.baju : ap.rambut);
    }
    if (ap.ransel) this.bagian(this.ransel, this.nRansel++, 0, 0, 0, 0, ap.ransel);
    // Koper: ditarik miring di belakang-kanan saat berjalan, berdiri tegak di samping saat berhenti.
    if (ap.koper) {
      const tarik = duduk ? 0 : st.ayun / AYUN_MAKS;
      const lx = duduk ? 0.07 : -0.012 - 0.09 * tarik;
      const lz = duduk ? 0.085 : 0.078;
      this.bagian(this.koper, this.nKoper++, lx, duduk ? turun : 0, lz, -0.55 * tarik, ap.koper);
    }
    // Payung sedikit condong ke depan saat berjalan.
    if (o.payung) this.bagian(this.payung, this.nPayung++, 0, 0, 0, bergerak ? -0.1 : 0, o.payung);
    this.n++;
  }

  selesai(): void {
    for (const [id, st] of this.status) if (!st.hidup) this.status.delete(id);
    const set = (mesh: THREE.InstancedMesh, jumlah: number): void => {
      mesh.count = jumlah;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    set(this.kaki, this.nKaki);
    set(this.lengan, this.nLengan);
    set(this.badan, this.n);
    set(this.kepala, this.n);
    set(this.rambut, this.nRambut);
    set(this.jilbab, this.nJilbab);
    set(this.gamis, this.nGamis);
    set(this.ransel, this.nRansel);
    set(this.payung, this.nPayung);
    set(this.koper, this.nKoper);
    set(this.sapu, Math.min(this.nSapu, this.sapu.instanceMatrix.count));
    set(this.baki, Math.min(this.nBaki, this.baki.instanceMatrix.count));
  }
}
