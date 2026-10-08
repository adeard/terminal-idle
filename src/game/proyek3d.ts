/**
 * Proyek perluasan terminal di adegan (lokasi & logika di perluasan-adegan.ts):
 * selama proyek tahap berikutnya berjalan, area-nya dipagari seng berpapan
 * proyek, ada crane menara yang lengannya berputar pelan, tumpukan material,
 * perancah, dan papan penutup jendela loket yang sedang dibangun. Pekerja
 * berompi digambar terminal3d.ts lewat Kerumunan3D. Saat tahap selesai,
 * kembang api meledak di atas area itu (kembang-api.ts).
 *
 * Geometri tiap tahap dibangun sekali saat pertama dibutuhkan (Kumpulan per
 * grup), lalu hanya ditukar visibilitasnya. Material sederhana tanpa tekstur
 * dipakai bersama semua tahap.
 */
import * as THREE from 'three';
import { kotak, Kumpulan, persegiTegak, silinder } from './geometri';
import { KembangApi, MAKS_PARTIKEL, WARNA_KEMBANG_API } from './kembang-api';
import type { PustakaMaterial } from './material3d';
import { lokasiProyek, type CraneProyek, type LokasiProyek } from './perluasan-adegan';
import { LOKET, TINGGI_LANTAI_GEDUNG, X_LOKET, type Persegi, type Titik } from './tata-letak';

/** Tinggi pagar seng & jarak tiang pagar. */
const PAGAR = { tinggi: 0.5, jarakTiang: 1.2, tebal: 0.025 } as const;
/** Laju putar lengan crane (radian/detik main). */
const PUTAR_CRANE = 0.07;
/** Kecerahan partikel kembang api (di atas 1 supaya berpendar oleh bloom). */
const TERANG_KEMBANG_API = 3.2;

interface GrupProyek {
  readonly grup: THREE.Group;
  readonly lengan: THREE.Group | null;
  readonly crane: CraneProyek | null;
}

export class ProyekPerluasan {
  readonly objek = new THREE.Group();
  private readonly grup = new Map<number, GrupProyek>();
  private aktif: number | null = null;
  private waktu = 0;
  private readonly seng = new THREE.MeshStandardMaterial({ color: 0xa3adb8, roughness: 0.45, metalness: 0.55 });
  private readonly kuning = new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.5, metalness: 0.2 });
  private readonly pasir = new THREE.MeshStandardMaterial({ color: 0xd8b77a, roughness: 0.95 });
  private readonly kembangApi = new KembangApi();
  private readonly partikel: THREE.InstancedMesh;
  private readonly matriks = new THREE.Matrix4();
  private readonly warna = new THREE.Color();
  private readonly palet = WARNA_KEMBANG_API.map((c) => new THREE.Color(c));

  constructor(private readonly m: PustakaMaterial) {
    this.partikel = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.15, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), MAKS_PARTIKEL);
    this.partikel.frustumCulled = false;
    // instanceColor dibuat sekarang supaya shader tidak dikompilasi ulang saat kembang api pertama.
    this.partikel.setColorAt(0, this.warna.setRGB(1, 1, 1));
    this.partikel.count = 0;
    this.objek.add(this.partikel);
  }

  /** Rute pekerja proyek yang sedang berjalan (kosong bila tidak ada proyek). */
  get lokasi(): LokasiProyek | null {
    return this.aktif === null ? null : lokasiProyek(this.aktif);
  }

  /**
   * @param tahap tahap perluasan yang sedang dibangun (1-based), null = tidak ada proyek
   * @param dt detik main sejak frame lalu (crane ikut dipercepat)
   * @param dtNyata detik nyata (kembang api tidak ikut dipercepat)
   */
  perbarui(tahap: number | null, dt: number, dtNyata: number): void {
    this.waktu += dt;
    const t = tahap !== null && lokasiProyek(tahap) ? tahap : null;
    if (t !== this.aktif) {
      if (this.aktif !== null) this.grup.get(this.aktif)!.grup.visible = false;
      if (t !== null) this.ambilGrup(t).grup.visible = true;
      this.aktif = t;
    }
    if (this.aktif !== null) {
      const g = this.grup.get(this.aktif)!;
      if (g.lengan && g.crane) g.lengan.rotation.y = g.crane.arah + Math.sin(this.waktu * PUTAR_CRANE) * 1.4;
    }
    this.perbaruiKembangApi(dtNyata);
  }

  /** Kembang api peresmian di atas area tahap yang baru selesai. */
  rayakan(tahap: number): void {
    const l = lokasiProyek(tahap);
    if (!l) return;
    this.kembangApi.rayakan(l.pusat[0], l.pusat[1], l.tinggiKembangApi, 11 + tahap);
  }

  private perbaruiKembangApi(dt: number): void {
    if (!this.kembangApi.aktif && this.partikel.count === 0) return;
    this.kembangApi.perbarui(dt);
    const daftar = this.kembangApi.partikel;
    let n = 0;
    for (const p of daftar) {
      const sisa = 1 - p.umur / p.lama;
      const s = 0.35 + 0.65 * sisa;
      this.matriks.makeScale(s, s, s);
      this.matriks.setPosition(p.x, p.h, p.y);
      this.partikel.setMatrixAt(n, this.matriks);
      this.warna.copy(this.palet[p.warna]!).multiplyScalar(TERANG_KEMBANG_API * sisa);
      this.partikel.setColorAt(n, this.warna);
      n++;
    }
    this.partikel.count = n;
    this.partikel.instanceMatrix.needsUpdate = true;
    if (this.partikel.instanceColor) this.partikel.instanceColor.needsUpdate = true;
  }

  private ambilGrup(tahap: number): GrupProyek {
    const ada = this.grup.get(tahap);
    if (ada) return ada;
    const l = lokasiProyek(tahap)!;
    const grup = new THREE.Group();
    const k = new Kumpulan();
    for (const p of l.pagar) this.pagar(k, p, tahap);
    if (l.perancah) this.perancah(k, l.perancah.area, l.perancah.tinggi);
    l.material.forEach((titik, i) => this.material(k, titik, i));
    for (const i of l.jendela) this.penutupJendela(k, i);
    let lengan: THREE.Group | null = null;
    if (l.crane) {
      this.tiangCrane(k, l.crane);
      lengan = this.lenganCrane(l.crane);
      grup.add(lengan);
    }
    k.bangun(grup);
    grup.visible = false;
    this.objek.add(grup);
    const hasil = { grup, lengan, crane: l.crane };
    this.grup.set(tahap, hasil);
    return hasil;
  }

  /** Pagar seng keliling persegi, bertiang, dengan papan proyek di sisi selatan & utara. */
  private pagar(k: Kumpulan, p: Persegi, tahap: number): void {
    const { tinggi, tebal } = PAGAR;
    k.tambah(this.seng, kotak(p.x0, p.y0 - tebal, p.x1, p.y0 + tebal, 0, tinggi));
    k.tambah(this.seng, kotak(p.x0, p.y1 - tebal, p.x1, p.y1 + tebal, 0, tinggi));
    k.tambah(this.seng, kotak(p.x0 - tebal, p.y0, p.x0 + tebal, p.y1, 0, tinggi));
    k.tambah(this.seng, kotak(p.x1 - tebal, p.y0, p.x1 + tebal, p.y1, 0, tinggi));
    const tiang = (x: number, y: number): void => k.tambah(this.m.besiGelap, kotak(x - 0.03, y - 0.03, x + 0.03, y + 0.03, 0, tinggi + 0.04));
    for (let x = p.x0; x <= p.x1 + 1e-6; x += PAGAR.jarakTiang) {
      tiang(x, p.y0);
      tiang(x, p.y1);
    }
    for (let y = p.y0 + PAGAR.jarakTiang; y < p.y1; y += PAGAR.jarakTiang) {
      tiang(p.x0, y);
      tiang(p.x1, y);
    }
    // Papan proyek: menghadap kamera (selatan) dan ke arah sebaliknya.
    const papan = this.m.teks(`PROYEK PERLUASAN TERMINAL · TAHAP ${tahap}`, { lebar: 512, tinggi: 64, latar: '#1e3a8a', warna: '#fde047', ukuranHuruf: 26 });
    const cx = (p.x0 + p.x1) / 2;
    const w = Math.min(2.4, (p.x1 - p.x0) / 2 - 0.2);
    k.tambah(papan.material, persegiTegak([cx - w, p.y1 + tebal], [cx + w, p.y1 + tebal], tinggi * 0.3, tinggi * 0.85, papan.uv, 0.004), { bayangan: false });
    k.tambah(papan.material, persegiTegak([cx + w, p.y0 - tebal], [cx - w, p.y0 - tebal], tinggi * 0.3, tinggi * 0.85, papan.uv, 0.004), { bayangan: false });
  }

  /** Perancah pipa keliling bangunan: tiang tiap 0,9, palang tiga tingkat, papan pijakan di tengah. */
  private perancah(k: Kumpulan, a: Persegi, tinggi: number): void {
    const g = 0.14;
    const [x0, y0, x1, y1] = [a.x0 - g, a.y0 - g, a.x1 + g, a.y1 + g];
    const pipa = 0.014;
    const tiang = (x: number, y: number): void => k.tambah(this.m.besi, kotak(x - pipa, y - pipa, x + pipa, y + pipa, 0, tinggi));
    for (let x = x0; x <= x1 + 1e-6; x += 0.9) {
      tiang(x, y0);
      tiang(x, y1);
    }
    for (let y = y0 + 0.9; y < y1; y += 0.9) {
      tiang(x0, y);
      tiang(x1, y);
    }
    for (const h of [0.7, 1.4, tinggi - 0.03]) {
      k.tambah(this.m.besi, kotak(x0, y0 - pipa, x1, y0 + pipa, h - pipa, h + pipa));
      k.tambah(this.m.besi, kotak(x0, y1 - pipa, x1, y1 + pipa, h - pipa, h + pipa));
      k.tambah(this.m.besi, kotak(x0 - pipa, y0, x0 + pipa, y1, h - pipa, h + pipa));
      k.tambah(this.m.besi, kotak(x1 - pipa, y0, x1 + pipa, y1, h - pipa, h + pipa));
    }
    // Papan pijakan kayu di luar perancah.
    const hp = 1.4;
    k.tambah(this.m.kayu, kotak(x0 - 0.16, y1, x1 + 0.16, y1 + 0.16, hp - 0.03, hp));
    k.tambah(this.m.kayu, kotak(x0 - 0.16, y0 - 0.16, x1 + 0.16, y0, hp - 0.03, hp));
  }

  /** Tumpukan material bergantian: bata, gundukan pasir, ikatan besi. */
  private material(k: Kumpulan, [x, y]: Titik, i: number): void {
    switch (i % 3) {
      case 0:
        for (let a = 0; a < 3; a++) {
          for (let b = 0; b < 2; b++) {
            for (let c = 0; c < 3 - a; c++) {
              const x0 = x - 0.3 + c * 0.2 + a * 0.1;
              const y0 = y - 0.12 + b * 0.13;
              k.tambah(this.m.bata, kotak(x0, y0, x0 + 0.18, y0 + 0.11, a * 0.08, a * 0.08 + 0.075));
            }
          }
        }
        break;
      case 1:
        k.tambah(this.pasir, silinder(x, y, 0, 0.32, 0.45, 0.05, 12));
        break;
      default:
        for (let b = 0; b < 5; b++) k.tambah(this.m.besiGelap, kotak(x - 0.6, y - 0.12 + b * 0.05, x + 0.6, y - 0.1 + b * 0.05, 0.02, 0.05 + (b % 2) * 0.03));
        k.tambah(this.m.kayu, kotak(x - 0.45, y - 0.16, x - 0.38, y + 0.16, 0, 0.03));
        k.tambah(this.m.kayu, kotak(x + 0.38, y - 0.16, x + 0.45, y + 0.16, 0, 0.03));
    }
  }

  /** Papan kayu penutup jendela loket yang sedang dibangun, bertulisan SEDANG DIBANGUN. */
  private penutupJendela(k: Kumpulan, i: number): void {
    const x = X_LOKET[i]!;
    const w = LOKET.setengahLebar - 0.03;
    const y = LOKET.yMeja + 0.05;
    const h0 = TINGGI_LANTAI_GEDUNG;
    k.tambah(this.m.kayu, kotak(x - w, y - 0.012, x + w, y + 0.012, h0, h0 + 0.68));
    const tulisan = this.m.teks('SEDANG DIBANGUN', { lebar: 256, tinggi: 64, latar: '#facc15', warna: '#111827', ukuranHuruf: 26 });
    k.tambah(tulisan.material, persegiTegak([x - w + 0.04, y + 0.014], [x + w - 0.04, y + 0.014], h0 + 0.36, h0 + 0.5, tulisan.uv, 0.002), { bayangan: false });
  }

  /** Tiang crane menara: empat batang sudut dengan palang tiap 0,5, di atas pondasi beton. */
  private tiangCrane(k: Kumpulan, c: CraneProyek): void {
    const s = 0.15;
    const b = 0.022;
    k.tambah(this.m.beton, kotak(c.x - 0.32, c.y - 0.32, c.x + 0.32, c.y + 0.32, 0, 0.1));
    for (const dx of [-s, s]) for (const dy of [-s, s]) k.tambah(this.kuning, kotak(c.x + dx - b, c.y + dy - b, c.x + dx + b, c.y + dy + b, 0.1, c.tinggi));
    for (let h = 0.45; h < c.tinggi; h += 0.5) {
      k.tambah(this.kuning, kotak(c.x - s, c.y - s - 0.012, c.x + s, c.y - s + 0.012, h - 0.012, h + 0.012));
      k.tambah(this.kuning, kotak(c.x - s, c.y + s - 0.012, c.x + s, c.y + s + 0.012, h - 0.012, h + 0.012));
      k.tambah(this.kuning, kotak(c.x - s - 0.012, c.y - s, c.x - s + 0.012, c.y + s, h - 0.012, h + 0.012));
      k.tambah(this.kuning, kotak(c.x + s - 0.012, c.y - s, c.x + s + 0.012, c.y + s, h - 0.012, h + 0.012));
    }
  }

  /**
   * Bagian crane yang berputar (meja putar, lengan, lengan penyeimbang & bebannya,
   * kabin, troli & kait yang membawa ikatan besi), dibangun di sekitar titik asal
   * lalu diletakkan di puncak tiang.
   */
  private lenganCrane(c: CraneProyek): THREE.Group {
    const g = new THREE.Group();
    const k = new Kumpulan();
    k.tambah(this.kuning, kotak(-0.2, -0.2, 0.2, 0.2, 0, 0.14));
    // Lengan: batang bawah & atas dengan tegak sekat tiap 0,6.
    k.tambah(this.kuning, kotak(0, -0.09, c.lengan, 0.09, 0.14, 0.2));
    k.tambah(this.kuning, kotak(0, -0.02, c.lengan * 0.92, 0.02, 0.38, 0.42));
    for (let x = 0.3; x < c.lengan * 0.92; x += 0.6) k.tambah(this.kuning, kotak(x - 0.012, -0.012, x + 0.012, 0.012, 0.2, 0.38));
    // Puncak tiang & lengan penyeimbang dengan beban beton.
    k.tambah(this.kuning, kotak(-0.05, -0.05, 0.05, 0.05, 0.14, 0.75));
    k.tambah(this.kuning, kotak(-1.3, -0.09, 0, 0.09, 0.14, 0.2));
    k.tambah(this.m.beton, kotak(-1.3, -0.16, -0.95, 0.16, -0.05, 0.3));
    // Kabin operator.
    k.tambah(this.m.besiGelap, kotak(0.12, 0.12, 0.42, 0.36, -0.06, 0.18));
    // Troli, kabel, & kait yang membawa ikatan besi.
    const xt = c.lengan * 0.62;
    const turun = Math.max(0.6, c.tinggi - 1.6);
    k.tambah(this.m.besiGelap, kotak(xt - 0.08, -0.08, xt + 0.08, 0.08, 0.08, 0.14));
    k.tambah(this.m.besiGelap, kotak(xt - 0.006, -0.006, xt + 0.006, 0.006, -turun, 0.08));
    k.tambah(this.kuning, kotak(xt - 0.05, -0.05, xt + 0.05, 0.05, -turun - 0.08, -turun));
    k.tambah(this.m.besi, kotak(xt - 0.45, -0.07, xt + 0.45, 0.07, -turun - 0.2, -turun - 0.1));
    k.bangun(g);
    g.position.set(c.x, c.tinggi, c.y);
    return g;
  }
}
