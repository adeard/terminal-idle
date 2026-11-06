/**
 * Hiasan per level di adegan (logika & letak di hiasan-level.ts): pohon peneduh
 * plaza, kanopi antar-jemput, dua baliho PO di atap ruang tunggu, pohon di teras
 * Sayap 2 Lantai, menara jam, dan monumen bus. Gedung kota yang meninggi ada di
 * mesh gabungan utama (lingkungan3d.ts).
 *
 * Satu KumpulanUnit berbahan daun: vertex color, sudah dipakai mesh utama (tanpa
 * kompilasi shader baru), dan melempar bayangan, karena benda tanpa bayangan tampak
 * tertempel di siang hari. Jadi dua draw call berapa pun hiasan yang tampil. Dibangun
 * saat hiasan pertama dibutuhkan (Lv 5), jadi sesi awal tidak menanggungnya.
 * Warna baliho mengikuti livery PO terdaftar: hanya atribut warnanya yang ditulis ulang.
 */
import * as THREE from 'three';
import { LIVERY_PO } from '../config/livery.config';
import type { PoId } from '../sim/fitur';
import { acakBerbenih } from './dunia-visual';
import { Busur, KumpulanUnit, persegiTegak, silinder } from './geometri';
import { H_TERAS, HIASAN_LEVEL, POHON_ATAP, POHON_PLAZA, type IdHiasan, type KotakHiasan } from './hiasan-level';
import type { PustakaMaterial } from './material3d';
import { balok, warnai } from './sayap2-3d';
import { ATAP } from './tata-letak';

const PENUH = { u0: 0, v0: 0, u1: 1, v1: 1 } as const;
/** Unit tiap hiasan di KumpulanUnit; bagian baliho yang diwarnai livery punya unit sendiri supaya warnanya bisa ditulis ulang. */
const UNIT: Readonly<Partial<Record<IdHiasan, number>>> = { pohonPlaza: 0, kanopi: 1, baliho1: 2, baliho2: 3, pohonAtap: 4, menaraJam: 5, monumen: 6 };
const UNIT_WARNA_BALIHO = [10, 11] as const;
const UNIT_AKSEN_BALIHO = [20, 21] as const;
/** Indeks baliho ke-1 & ke-2 (konstanta modul: perbarui dipanggil tiap frame tanpa membuat larik). */
const BALIHO_KE = [0, 1] as const;
/** Warna baliho tanpa PO: biru terminal dan putih. */
const BALIHO_TERMINAL = { warna: 0x1d4ed8, aksen: 0xffffff } as const;

const HEX = {
  batang: 0x6b4a30,
  pot: 0x9a5b3c,
  besiGelap: 0x3b4149,
  besi: 0x9aa3ad,
  putih: 0xf8fafc,
  biruTerminal: 0x1d4ed8,
  batu: 0xb8b2a6,
  batuMuda: 0xd6cfc1,
  krem: 0xece3cf,
  bata: 0x7c2d12,
  hijauAtap: 0x2f5d50,
  hitam: 0x111827,
  merahBus: 0xb91c1c,
  kremBus: 0xf1e3c3,
  kacaBus: 0x1e293b,
} as const;

/** Bilangan semu 0..1 dari posisi: verteks yang berimpit mendapat nilai sama (permukaan tidak retak). */
function hashPosisi(x: number, y: number, z: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

/** Pohon rindang ala lingkungan3d (batang + dua bola daun bergerigi), seluruhnya vertex color supaya muat satu bahan. */
function pohon(k: KumpulanUnit, unit: number, bahan: THREE.Material, x: number, y: number, h0: number, skala: number, benih: number): void {
  const acak = acakBerbenih(benih);
  k.tambah(unit, bahan, warnai(silinder(x, y, h0, h0 + 0.55 * skala, 0.06 * skala, 0.045 * skala, 6), HEX.batang));
  const hijau = new THREE.Color().setHSL(0.26 + acak() * 0.06, 0.45 + acak() * 0.15, 0.26 + acak() * 0.08);
  for (let i = 0; i < 2; i++) {
    const r = (0.36 + acak() * 0.1) * skala;
    const g = new THREE.IcosahedronGeometry(r, 1);
    const pos = g.getAttribute('position');
    const geser = acak() * 10;
    for (let j = 0; j < pos.count; j++) {
      const f = 1 + (hashPosisi(pos.getX(j) + geser, pos.getY(j), pos.getZ(j)) - 0.5) * 0.3;
      pos.setXYZ(j, pos.getX(j) * f, pos.getY(j) * f * 0.85, pos.getZ(j) * f);
    }
    g.computeVertexNormals();
    const hPusat = h0 + (0.75 + i * 0.18) * skala;
    g.translate(x + (acak() - 0.5) * 0.16 * skala, hPusat, y + (acak() - 0.5) * 0.16 * skala);
    const warna = new Float32Array(pos.count * 3);
    for (let j = 0; j < pos.count; j++) {
      // Lebih terang di atas (cahaya langit), gelap di bawah.
      const t = 0.8 + (pos.getY(j) - hPusat) * 0.5 + (hashPosisi(pos.getX(j), pos.getY(j) * 3, pos.getZ(j)) - 0.5) * 0.14;
      warna.set([hijau.r * t, hijau.g * t, hijau.b * t], j * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(warna, 3));
    g.deleteAttribute('uv');
    k.tambah(unit, bahan, g);
  }
}

/** Muka tegak berwarna menghadap selatan (+y) di garis y. */
const mukaSelatan = (x0: number, x1: number, y: number, h0: number, h1: number, hex: number, geser: number): THREE.BufferGeometry => warnai(persegiTegak([x0, y], [x1, y], h0, h1, PENUH, geser), hex);

/** Lingkaran tegak (muka jam) berpusat (x, y, h), menghadap +y (selatan) atau +x (timur). */
function lingkaran(x: number, y: number, h: number, r: number, hadap: 'selatan' | 'timur', hex: number): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(r, 12);
  if (hadap === 'timur') g.rotateY(Math.PI / 2);
  g.translate(x, h, y);
  return warnai(g, hex);
}

export class HiasanLevel3D {
  readonly objek = new THREE.Group();
  private readonly unit = new KumpulanUnit();
  private readonly bahan: THREE.Material;
  private tampilLalu: ReadonlySet<IdHiasan> | null = null;
  private readonly poLalu: (PoId | null | undefined)[] = [undefined, undefined];
  private readonly warna = new THREE.Color();

  constructor(m: PustakaMaterial) {
    this.bahan = m.daun;
    const k = this.unit;
    const kotak = (id: IdHiasan): KotakHiasan => HIASAN_LEVEL.find((h) => h.id === id)!.kotak;
    POHON_PLAZA.forEach(([x, y], i) => pohon(k, UNIT.pohonPlaza!, this.bahan, x, y, 0, 1.05, 50 + i));
    this.kanopi(kotak('kanopi'));
    this.baliho(kotak('baliho1'), 0, UNIT.baliho1!);
    this.baliho(kotak('baliho2'), 1, UNIT.baliho2!);
    POHON_ATAP.forEach(([x, y], i) => {
      k.tambah(UNIT.pohonAtap!, this.bahan, balok(x - 0.15, y - 0.15, x + 0.15, y + 0.15, H_TERAS, H_TERAS + 0.2, HEX.pot));
      // Skala 0,85: tajuk tiap pohon ≥ 6 px lebar di 360×575 dan 667×420 (AC-GFX-13).
      pohon(k, UNIT.pohonAtap!, this.bahan, x, y, H_TERAS + 0.2, 0.85, 70 + i);
    });
    this.menaraJam(kotak('menaraJam'));
    this.monumen(kotak('monumen'));
    k.bangun(this.objek);
  }

  /**
   * @param tampil hiasan yang tampil (lihat hiasanLevel); objek yang sama = tidak berubah
   * @param po PO yang warnanya dipasang di baliho ke-1 & ke-2 (lihat poBaliho)
   */
  perbarui(tampil: ReadonlySet<IdHiasan>, po: readonly [PoId | null, PoId | null]): void {
    if (tampil !== this.tampilLalu) {
      this.tampilLalu = tampil;
      const unit = new Set<number>();
      for (const id of tampil) {
        const u = UNIT[id];
        if (u !== undefined) unit.add(u);
      }
      if (tampil.has('baliho1')) unit.add(UNIT_WARNA_BALIHO[0]).add(UNIT_AKSEN_BALIHO[0]);
      if (tampil.has('baliho2')) unit.add(UNIT_WARNA_BALIHO[1]).add(UNIT_AKSEN_BALIHO[1]);
      this.unit.tampilkan((u) => unit.has(u));
    }
    for (const i of BALIHO_KE) {
      const id = po[i];
      if (id === this.poLalu[i]) continue;
      this.poLalu[i] = id;
      const livery = id ? LIVERY_PO[id] : BALIHO_TERMINAL;
      this.warnaiUnit(UNIT_WARNA_BALIHO[i], livery.warna);
      this.warnaiUnit(UNIT_AKSEN_BALIHO[i], livery.aksen);
    }
  }

  /** Tulis ulang warna verteks satu unit (hanya saat PO baliho berganti). */
  private warnaiUnit(unit: number, hex: number): void {
    const v = this.unit.verteksUnit(this.bahan, unit);
    if (!v) return;
    const c = v.geometri.getAttribute('color') as THREE.BufferAttribute;
    this.warna.setHex(hex);
    for (let i = v.mulai; i < v.mulai + v.jumlah; i++) c.setXYZ(i, this.warna.r, this.warna.g, this.warna.b);
    c.needsUpdate = true;
  }

  /** Kanopi antar-jemput di atas mobil golf: empat tiang di luar badan mobil, atap biru terminal berlis putih. */
  private kanopi(p: KotakHiasan): void {
    const k = this.unit;
    const u = UNIT.kanopi!;
    const hAtap = 0.95;
    for (const x of [p.x0 + 0.08, p.x1 - 0.08]) for (const y of [p.y0 + 0.07, p.y1 - 0.07]) k.tambah(u, this.bahan, warnai(silinder(x, y, 0, hAtap, 0.03, 0.03, 6), HEX.besi));
    k.tambah(u, this.bahan, balok(p.x0, p.y0, p.x1, p.y1, hAtap, hAtap + 0.08, HEX.biruTerminal));
    k.tambah(u, this.bahan, balok(p.x0 - 0.02, p.y1 - 0.02, p.x1 + 0.02, p.y1 + 0.02, hAtap - 0.03, p.h1, HEX.putih));
  }

  /**
   * Baliho di atap ruang tunggu menghadap kamera, tanpa tulisan: latar warna badan PO, dua pita
   * aksen, dan kotak putih. Dua kaki dari atap lengkung, titian di bawah panel.
   */
  private baliho(p: KotakHiasan, i: 0 | 1, u: number): void {
    const k = this.unit;
    const y = (p.y0 + p.y1) / 2;
    const a = ATAP.tunggu;
    const hAtap = new Busur(a.y0, a.y1, a.hTepi, a.hPuncak).tinggi(y);
    const [h0, h1] = [2.2, p.h1];
    for (const x of [p.x0 + 0.6, p.x1 - 0.6]) k.tambah(u, this.bahan, balok(x - 0.05, y - 0.05, x + 0.05, y + 0.05, hAtap - 0.05, h0, HEX.besiGelap));
    // Titian sempit: tetap di dalam kotak bendanya (y1), di luar cadangan Antarpulau.
    k.tambah(u, this.bahan, balok(p.x0, y, p.x1, p.y1, h0 - 0.08, h0 - 0.04, HEX.besi));
    k.tambah(u, this.bahan, balok(p.x0, y - 0.05, p.x1, y + 0.05, h0, h1, HEX.besiGelap));
    const yMuka = y + 0.05;
    const [xa, xb] = [p.x0 + 0.06, p.x1 - 0.06];
    k.tambah(UNIT_WARNA_BALIHO[i], this.bahan, mukaSelatan(xa, xb, yMuka, h0 + 0.06, h1 - 0.06, BALIHO_TERMINAL.warna, 0.004));
    k.tambah(UNIT_AKSEN_BALIHO[i], this.bahan, mukaSelatan(xa, xb, yMuka, h0 + 0.2, h0 + 0.36, BALIHO_TERMINAL.aksen, 0.008));
    k.tambah(UNIT_AKSEN_BALIHO[i], this.bahan, mukaSelatan(xa, xb, yMuka, h0 + 0.44, h0 + 0.5, BALIHO_TERMINAL.aksen, 0.008));
    k.tambah(u, this.bahan, mukaSelatan(xb - 1.2, xb - 0.25, yMuka, h0 + 0.6, h1 - 0.16, HEX.putih, 0.008));
  }

  /** Menara jam plaza: alas batu, badan krem, kepala bata dengan muka jam di selatan & timur, atap limas hijau. */
  private menaraJam(p: KotakHiasan): void {
    const k = this.unit;
    const u = UNIT.menaraJam!;
    const [cx, cy] = [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2];
    const hKepala = [3.55, 4.15] as const;
    k.tambah(u, this.bahan, balok(p.x0, p.y0, p.x1, p.y1, 0, 0.25, HEX.batu));
    k.tambah(u, this.bahan, balok(cx - 0.23, cy - 0.23, cx + 0.23, cy + 0.23, 0.25, hKepala[0], HEX.krem));
    k.tambah(u, this.bahan, balok(cx - 0.29, cy - 0.29, cx + 0.29, cy + 0.29, hKepala[0], hKepala[1], HEX.bata));
    const hJam = (hKepala[0] + hKepala[1]) / 2;
    k.tambah(u, this.bahan, lingkaran(cx, cy + 0.293, hJam, 0.24, 'selatan', HEX.hitam));
    k.tambah(u, this.bahan, lingkaran(cx, cy + 0.296, hJam, 0.21, 'selatan', HEX.putih));
    k.tambah(u, this.bahan, lingkaran(cx + 0.293, cy, hJam, 0.24, 'timur', HEX.hitam));
    k.tambah(u, this.bahan, lingkaran(cx + 0.296, cy, hJam, 0.21, 'timur', HEX.putih));
    // Jarum pukul tiga: menit tegak, jam mendatar.
    k.tambah(u, this.bahan, warnai(persegiTegak([cx - 0.015, cy + 0.3], [cx + 0.015, cy + 0.3], hJam, hJam + 0.17, PENUH, 0), HEX.hitam));
    k.tambah(u, this.bahan, warnai(persegiTegak([cx, cy + 0.3], [cx + 0.12, cy + 0.3], hJam - 0.015, hJam + 0.015, PENUH, 0), HEX.hitam));
    k.tambah(u, this.bahan, warnai(persegiTegak([cx + 0.3, cy + 0.015], [cx + 0.3, cy - 0.015], hJam, hJam + 0.17, PENUH, 0), HEX.hitam));
    k.tambah(u, this.bahan, warnai(persegiTegak([cx + 0.3, cy], [cx + 0.3, cy - 0.12], hJam - 0.015, hJam + 0.015, PENUH, 0), HEX.hitam));
    const atap = new THREE.ConeGeometry(0.43, p.h1 - hKepala[1], 4);
    atap.rotateY(Math.PI / 4);
    atap.translate(cx, (hKepala[1] + p.h1) / 2, cy);
    k.tambah(u, this.bahan, warnai(atap, HEX.hijauAtap));
  }

  /** Monumen bus: replika bus lama merah-krem di atas alas berundak. */
  private monumen(p: KotakHiasan): void {
    const k = this.unit;
    const u = UNIT.monumen!;
    k.tambah(u, this.bahan, balok(p.x0, p.y0, p.x1, p.y1, 0, 0.12, HEX.batu));
    k.tambah(u, this.bahan, balok(p.x0 + 0.15, p.y0 + 0.08, p.x1 - 0.15, p.y1 - 0.08, 0.12, 0.3, HEX.batuMuda));
    const [x0, x1, y0, y1] = [p.x0 + 0.25, p.x1 - 0.25, p.y0 + 0.04, p.y1 - 0.04];
    k.tambah(u, this.bahan, balok(x0, y0, x1, y1, 0.38, 0.72, HEX.merahBus));
    k.tambah(u, this.bahan, balok(x0 + 0.02, y0 + 0.005, x1 - 0.02, y1 - 0.005, 0.72, 0.9, HEX.kacaBus));
    k.tambah(u, this.bahan, balok(x0, y0, x1, y1, 0.9, 0.98, HEX.kremBus));
    k.tambah(u, this.bahan, mukaSelatan(x0 + 0.02, x1 - 0.02, y1, 0.52, 0.6, HEX.kremBus, 0.003));
    for (const x of [x0 + 0.35, x1 - 0.35]) {
      for (const y of [y0, y1]) {
        const roda = new THREE.CylinderGeometry(0.09, 0.09, 0.06, 8);
        roda.rotateX(Math.PI / 2);
        roda.translate(x, 0.39, y);
        k.tambah(u, this.bahan, warnai(roda, HEX.hitam));
      }
    }
  }
}
