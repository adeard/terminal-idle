/**
 * Tanda kelas terminal di adegan (kelas = banyaknya naik kelas, lihat
 * sim/state.ts kelasTerminal):
 *   - papan nama gapura: TERMINAL TIPE C → TIPE B → TIPE A → TERMINAL TERPADU,
 *     atau nama terminal pilihan pemain dengan kelasnya di baris kedua;
 *   - umbul-umbul warna-warni di median jalan raya (mulai Tipe B);
 *   - lampu hias di antara umbul-umbul yang menyala di malam hari (mulai Tipe A);
 *   - bintang emas di atas gapura, satu per bintang kelas Terpadu (maks. 5).
 * Tiap bagian satu grup mesh yang dibangun sekali lalu hanya ditukar visibilitasnya.
 */
import * as THREE from 'three';
import { GAPURA } from './gedung3d';
import { Kumpulan, persegiTegak, silinder } from './geometri';
import { LAMPU_JALAN_X } from './lingkungan3d';
import type { PustakaMaterial } from './material3d';
import { BUKAAN_MEDIAN, JALAN, MEDIAN } from './tata-letak';

/** Papan gapura per kelas: 0 = Tipe C, 1 = Tipe B, 2 = Tipe A, 3 = Terpadu (kelas ≥ 3). */
const PAPAN_KELAS: readonly { readonly teks: string; readonly singkat: string; readonly latar: string; readonly warna: string }[] = [
  { teks: 'TERMINAL TIPE C', singkat: 'TIPE C', latar: '#3f4650', warna: '#e5e7eb' },
  { teks: 'TERMINAL TIPE B', singkat: 'TIPE B', latar: '#1e3a8a', warna: '#ffffff' },
  { teks: 'TERMINAL TIPE A', singkat: 'TIPE A', latar: '#2a3038', warna: '#f6d27a' },
  { teks: 'TERMINAL TERPADU', singkat: 'TERPADU', latar: '#7a5410', warna: '#fff4cf' },
];
const MAKS_BINTANG = 5;
/** Umbul-umbul di tepi selatan median (sisi terminal), tiap sekian petak. */
const Y_UMBUL = MEDIAN.y0 + 0.1;
const JARAK_UMBUL = 3.2;
const UMBUL = { tinggiTiang: 2.2, lebar: 0.24, atas: 2.08, bawah: 0.8, gelombang: 0.035 } as const;
const WARNA_UMBUL = [0xdc2626, 0xfacc15, 0x2563eb, 0x16a34a, 0xf97316] as const;
/** Lampu hias bergantung di antara tiang umbul-umbul yang berdekatan. */
const LAMPU_HIAS = { tinggi: 2.02, lendut: 0.24, jarak: 0.4, jari: 0.03 } as const;

/** Posisi x tiang umbul-umbul: sepanjang median, tidak di bukaan masuk/keluar dan tidak di tiang lampu jalan. */
export function titikUmbul(): number[] {
  const xs: number[] = [];
  for (let x = JALAN.x0 + 4; x < JALAN.x1 - 4; x += JARAK_UMBUL) {
    if (BUKAAN_MEDIAN.some(([a, b]) => x > a - 1.2 && x < b + 1.2)) continue;
    if (LAMPU_JALAN_X.some((l) => Math.abs(l - x) < 0.7)) continue;
    xs.push(x);
  }
  return xs;
}

function geoBintang(r: number, tebal: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: tebal, bevelEnabled: false });
  g.translate(0, 0, -tebal / 2);
  return g;
}

/** Kain umbul-umbul menggantung dari tiang, sedikit bergelombang (menghadap ±y). */
function geoKain(x: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(UMBUL.lebar, UMBUL.atas - UMBUL.bawah, 1, 8);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + (UMBUL.atas - UMBUL.bawah) / 2) / (UMBUL.atas - UMBUL.bawah);
    pos.setZ(i, Math.sin(t * Math.PI * 2.2) * UMBUL.gelombang * (1 - t * 0.5));
  }
  g.computeVertexNormals();
  g.translate(x + 0.025 + UMBUL.lebar / 2, (UMBUL.atas + UMBUL.bawah) / 2, Y_UMBUL);
  return g;
}

export class HiasanKelas {
  readonly objek = new THREE.Group();
  private readonly papan: THREE.Group[] = [];
  private readonly umbul = new THREE.Group();
  private readonly lampuHias = new THREE.Group();
  private readonly bintang: THREE.Mesh[] = [];
  private kelas = -1;
  private nama = '';
  /** Papan gapura bernama (dibuat saat nama/kelas berubah; nama bebas, jadi tidak disiapkan di awal). */
  private papanNama: { readonly grup: THREE.Group; readonly kunci: string } | null = null;

  constructor(private readonly m: PustakaMaterial) {
    const P = GAPURA;
    for (const p of PAPAN_KELAS) {
      const grup = new THREE.Group();
      const k = new Kumpulan();
      const tulisan = m.teks(p.teks, { lebar: 1024, tinggi: 120, latar: p.latar, warna: p.warna, ukuranHuruf: 80 });
      k.tambah(tulisan.material, persegiTegak([P.x0 + 0.05, P.y1], [P.x1 - 0.05, P.y1], P.tinggi - 0.56, P.tinggi - 0.06, tulisan.uv, 0.006), { bayangan: false });
      k.bangun(grup);
      grup.visible = false;
      this.papan.push(grup);
      this.objek.add(grup);
    }

    // Umbul-umbul: tiang + kain warna bergantian.
    const xs = titikUmbul();
    const kain = WARNA_UMBUL.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, side: THREE.DoubleSide }));
    const ku = new Kumpulan();
    xs.forEach((x, i) => {
      ku.tambah(m.besi, silinder(x, Y_UMBUL, 0.07, UMBUL.tinggiTiang, 0.024, 0.016, 6), { bayangan: false });
      ku.tambah(kain[i % kain.length]!, geoKain(x), { bayangan: false });
    });
    ku.bangun(this.umbul);
    this.umbul.visible = false;
    this.objek.add(this.umbul);

    // Lampu hias: bola lampu kecil melendut di antara tiang yang berdekatan (menyala saat malam).
    const kl = new Kumpulan();
    const bola = new THREE.IcosahedronGeometry(LAMPU_HIAS.jari, 0);
    for (let i = 0; i + 1 < xs.length; i++) {
      const a = xs[i]!;
      const b = xs[i + 1]!;
      if (b - a > JARAK_UMBUL * 1.5) continue;
      const n = Math.max(2, Math.round((b - a) / LAMPU_HIAS.jarak));
      for (let j = 1; j < n; j++) {
        const t = j / n;
        const g = bola.clone();
        g.translate(a + (b - a) * t, LAMPU_HIAS.tinggi - LAMPU_HIAS.lendut * 4 * t * (1 - t), Y_UMBUL);
        kl.tambah(m.lampuMenyala, g, { bayangan: false });
      }
    }
    bola.dispose();
    kl.bangun(this.lampuHias);
    this.lampuHias.visible = false;
    this.objek.add(this.lampuHias);

    // Bintang emas di atas balok gapura.
    const geo = geoBintang(0.17, 0.05);
    for (let i = 0; i < MAKS_BINTANG; i++) {
      const b = new THREE.Mesh(geo, m.emas);
      b.castShadow = true;
      b.visible = false;
      this.bintang.push(b);
      this.objek.add(b);
    }
  }

  /**
   * @param kelas kelas terminal (0 = Tipe C). Hanya berubah saat naik kelas.
   * @param nama nama terminal pilihan pemain; kosong = papan bawaan.
   */
  perbarui(kelas: number, nama = ''): void {
    if (kelas === this.kelas && nama === this.nama) return;
    this.kelas = kelas;
    this.nama = nama;
    const indeks = Math.min(kelas, PAPAN_KELAS.length - 1);
    this.papan.forEach((g, i) => (g.visible = !nama && i === indeks));
    this.aturPapanNama(indeks, nama);
    this.umbul.visible = kelas >= 1;
    this.lampuHias.visible = kelas >= 2;
    const n = Math.max(0, Math.min(MAKS_BINTANG, kelas - 2));
    const P = GAPURA;
    const cx = (P.x0 + P.x1) / 2;
    this.bintang.forEach((b, i) => {
      b.visible = i < n;
      b.position.set(cx + (i - (n - 1) / 2) * 0.46, P.tinggi + 0.26, (P.y0 + P.y1) / 2);
    });
  }

  /** Papan gapura "TERMINAL <NAMA>" berwarna kelasnya, kelas di baris kedua. */
  private aturPapanNama(indeks: number, nama: string): void {
    const kunci = nama ? `${indeks}|${nama}` : '';
    if (this.papanNama?.kunci === kunci) return;
    if (this.papanNama) {
      this.objek.remove(this.papanNama.grup);
      this.papanNama.grup.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      this.papanNama = null;
    }
    if (!nama) return;
    const p = PAPAN_KELAS[indeks]!;
    const P = GAPURA;
    const grup = new THREE.Group();
    const k = new Kumpulan();
    const tulisan = this.m.teks(`TERMINAL ${nama.toUpperCase()}`, { lebar: 1024, tinggi: 120, latar: p.latar, warna: p.warna, ukuranHuruf: 80, baris2: p.singkat });
    k.tambah(tulisan.material, persegiTegak([P.x0 + 0.05, P.y1], [P.x1 - 0.05, P.y1], P.tinggi - 0.56, P.tinggi - 0.06, tulisan.uv, 0.006), { bayangan: false });
    k.bangun(grup);
    this.objek.add(grup);
    this.papanNama = { grup, kunci };
  }
}
