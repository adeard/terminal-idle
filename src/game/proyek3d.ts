/**
 * Proyek perluasan terminal di adegan (lokasi & logika di perluasan-adegan.ts):
 * selama proyek tahap berikutnya berjalan, area-nya dipagari seng berpapan
 * proyek, ada crane menara yang lengannya berputar pelan, tumpukan material,
 * dan papan penutup jendela loket yang sedang dibangun. Pekerja berompi digambar
 * terminal3d.ts lewat Kerumunan3D. Saat tahap selesai, kembang api meledak di
 * atas area itu (kembang-api.ts).
 *
 * Geometri tiap tahap dibangun sekali saat pertama dibutuhkan (satu mesh per
 * material dalam satu grup), lalu hanya ditukar visibilitasnya. Material
 * sederhana tanpa tekstur dipakai bersama semua tahap. Proyek Sayap 2 Lantai juga
 * menampilkan bangunan yang tumbuh per fase (faseProyekSayap di bentuk-adegan.ts);
 * benda kecil tidak membuang bayangan supaya beban proyek ini tidak di atas proyek lama.
 */
import * as THREE from 'three';
import { TAHAP_SAYAP } from './bentuk-adegan';
import { bidang, kotak, Kumpulan, KumpulanUnit, persegiTegak, rusukBusur, silinder } from './geometri';
import { KembangApi, MAKS_PARTIKEL, WARNA_KEMBANG_API } from './kembang-api';
import type { PustakaMaterial } from './material3d';
import { lokasiProyek, type CraneProyek, type LokasiProyek } from './perluasan-adegan';
import { BUSUR_A1 } from './sayap2-3d';
import { H_DINDING_L2, H_LANTAI_2, LOKET, SAYAP_DUA, TINGGI_LANTAI_GEDUNG, X_LOKET, type Persegi, type Titik } from './tata-letak';

/** Tinggi pagar seng & jarak tiang pagar. */
const PAGAR = { tinggi: 0.5, jarakTiang: 1.2, tebal: 0.025 } as const;
/** Laju putar lengan crane (radian/detik main). */
const PUTAR_CRANE = 0.07;
/**
 * Kecerahan partikel kembang api: malam di atas 1 supaya berpendar oleh bloom; siang
 * apa adanya, karena ×3,2 di siang hari diputihkan tone mapping jadi pastel pucat.
 */
const TERANG_KEMBANG_API = { siang: 1.0, malam: 3.2 } as const;
/** Jari-jari partikel kembang api: ±3 px di layar 412 pada kamera normal. */
const R_PARTIKEL = 0.26;
/** Jaring pengaman fase 2: lajur tegak selebar ini dengan celah, sedikit di luar muka bangunan. */
const JARING = { lajur: 0.8, celah: 0.2, geser: 0.1 } as const;
const POLOS = { bayangan: false } as const;
const PENUH = { u0: 0, v0: 0, u1: 1, v1: 1 } as const;

/** Tempat geometri lokasi proyek: semuanya masuk unit 0 KumpulanUnit, jadi berbagi mesh dengan bangunan fase. */
type Penampung = Pick<Kumpulan, 'tambah'>;

interface GrupProyek {
  readonly grup: THREE.Group;
  readonly lengan: THREE.Group | null;
  readonly crane: CraneProyek | null;
  /** Isi lokasi; unit 0 selalu terlihat, unit 1–2 = bangunan Sayap 2 Lantai fase itu. */
  readonly isi: KumpulanUnit;
}

/** Ruas sepanjang sisi [a0, a1] yang berada di luar rentang-rentang lain. */
function ruasDiLuar(a0: number, a1: number, potong: readonly (readonly [number, number])[]): [number, number][] {
  let ruas: [number, number][] = [[a0, a1]];
  for (const [p0, p1] of potong) {
    ruas = ruas.flatMap(([b0, b1]): [number, number][] => {
      if (p1 <= b0 || p0 >= b1) return [[b0, b1]];
      const sisa: [number, number][] = [];
      if (p0 > b0) sisa.push([b0, p0]);
      if (p1 < b1) sisa.push([p1, b1]);
      return sisa;
    });
  }
  return ruas;
}

export class ProyekPerluasan {
  readonly objek = new THREE.Group();
  private readonly grup = new Map<number, GrupProyek>();
  private aktif: number | null = null;
  private faseLalu = -1;
  private waktu = 0;
  private readonly seng = new THREE.MeshStandardMaterial({ color: 0xa3adb8, roughness: 0.45, metalness: 0.55 });
  private readonly kuning = new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.5, metalness: 0.2 });
  private readonly pasir = new THREE.MeshStandardMaterial({ color: 0xd8b77a, roughness: 0.95 });
  private readonly kembangApi = new KembangApi();
  private readonly partikel: THREE.InstancedMesh;
  private readonly matriks = new THREE.Matrix4();
  private readonly warna = new THREE.Color();
  private readonly palet = WARNA_KEMBANG_API.map((c) => new THREE.Color(c));
  private terang: number = TERANG_KEMBANG_API.siang;
  private malam = 0;

  constructor(private readonly m: PustakaMaterial) {
    this.partikel = new THREE.InstancedMesh(new THREE.OctahedronGeometry(R_PARTIKEL, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), MAKS_PARTIKEL);
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
   * @param fase fase bangunan proyek Sayap 2 Lantai (tahap lain mengabaikannya)
   * @param dt detik main sejak frame lalu (crane ikut dipercepat)
   * @param dtNyata detik nyata (kembang api tidak ikut dipercepat)
   * @param malam tingkat gelap langit (0 siang – 1 malam): kecerahan kembang api
   */
  perbarui(tahap: number | null, fase: number, dt: number, dtNyata: number, malam = 0): void {
    this.waktu += dt;
    this.malam = malam;
    this.terang = TERANG_KEMBANG_API.siang + (TERANG_KEMBANG_API.malam - TERANG_KEMBANG_API.siang) * malam;
    const t = tahap !== null && lokasiProyek(tahap) ? tahap : null;
    if (t !== this.aktif) {
      if (this.aktif !== null) this.grup.get(this.aktif)!.grup.visible = false;
      if (t !== null) this.ambilGrup(t).grup.visible = true;
      this.aktif = t;
      this.faseLalu = -1;
    }
    if (this.aktif !== null) {
      const g = this.grup.get(this.aktif)!;
      if (g.lengan && g.crane) g.lengan.rotation.y = g.crane.arah + Math.sin(this.waktu * PUTAR_CRANE) * 1.4;
      if (fase !== this.faseLalu) {
        this.faseLalu = fase;
        g.isi.tampilkan((u) => u <= fase);
      }
    }
    this.perbaruiKembangApi(dtNyata);
  }

  /** Kembang api peresmian di atas area tahap yang baru selesai. */
  rayakan(tahap: number): void {
    const l = lokasiProyek(tahap);
    if (!l) return;
    this.kembangApi.rayakan(l.pusat[0], l.pusat[1], l.tinggiKembangApi, 11 + tahap);
  }

  /** Kembang api kecil di titik hiasan level yang baru muncul (InstancedMesh yang sama, tanpa draw call baru). */
  rayakanTitik(x: number, y: number, h: number, benih?: number): void {
    this.kembangApi.rayakanKecil(x, y, h, benih);
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
      // Malam memudar ke gelap; siang hanya mengecil, karena warna yang meredup tampak seperti jelaga di langit terang.
      this.warna.copy(this.palet[p.warna]!).multiplyScalar(this.terang * (1 - (1 - sisa) * this.malam));
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
    const isi = new KumpulanUnit();
    const k: Penampung = { tambah: (material, g, opsi) => isi.tambah(0, material, g, opsi) };
    l.pagar.forEach((p, i) => this.pagar(k, p, tahap, l.pagar.filter((_, j) => j !== i)));
    l.material.forEach((titik, i) => this.material(k, titik, i));
    for (const i of l.jendela) this.penutupJendela(k, i);
    let lengan: THREE.Group | null = null;
    if (l.crane) {
      this.tiangCrane(k, l.crane);
      lengan = this.lenganCrane(l.crane);
      grup.add(lengan);
    }
    if (tahap === TAHAP_SAYAP) this.bangunanFase(isi);
    isi.bangun(grup);
    grup.visible = false;
    this.objek.add(grup);
    const hasil = { grup, lengan, crane: l.crane, isi };
    this.grup.set(tahap, hasil);
    return hasil;
  }

  /**
   * Bangunan Sayap 2 Lantai setengah jadi. Unit 0 fondasi (tanah galian, sloof keliling,
   * besi stek), 1 rangka lantai dasar & pelat, 2 rangka lantai 2 & rusuk atap tanpa kaca,
   * berjaring pengaman kuning. Sengaja bukan cangkang akhirnya: lantai dalamnya masih
   * tanah, tempat pekerja & material. Rangka fase 2 lebih tebal dan berjaring supaya
   * terbaca sebagai langkah baru di HP (tiang 0,06 di bawah 1 px).
   */
  private bangunanFase(k: KumpulanUnit): void {
    const { a1, a2a, a2b } = SAYAP_DUA;
    const tiang = (unit: number, x: number, y: number, h0: number, h1: number, r = 0.03): void => k.tambah(unit, this.m.besi, kotak(x - r, y - r, x + r, y + r, h0, h1));
    const keliling = (p: Persegi, aksi: (x: number, y: number) => void): void => {
      for (let x = p.x0; x <= p.x1 + 1e-6; x += 1) {
        aksi(x, p.y0);
        aksi(x, p.y1);
      }
      for (let y = p.y0 + 1; y < p.y1 - 1e-6; y += 1) {
        aksi(p.x0, y);
        aksi(p.x1, y);
      }
    };
    for (const p of [a1, a2a, a2b]) {
      k.tambah(0, this.pasir, bidang(p.x0, p.y0, p.x1, p.y1, 0.03), POLOS);
      for (const [x0, y0, x1, y1] of [
        [p.x0, p.y0, p.x1, p.y0 + 0.08],
        [p.x0, p.y1 - 0.08, p.x1, p.y1],
        [p.x0, p.y0, p.x0 + 0.08, p.y1],
        [p.x1 - 0.08, p.y0, p.x1, p.y1],
      ] as const) {
        k.tambah(0, this.m.beton, kotak(x0, y0, x1, y1, 0, 0.12));
      }
      keliling(p, (x, y) => tiang(0, x, y, 0.12, 0.34));
      keliling(p, (x, y) => tiang(1, x, y, 0.34, 1.28));
      k.tambah(1, this.m.beton, kotak(p.x0, p.y0, p.x1, p.y1, p === a1 ? 1.28 : 1.25, H_LANTAI_2));
    }
    keliling(a1, (x, y) => tiang(2, x, y, H_LANTAI_2, BUSUR_A1.tinggi(x), 0.07));
    const [tA, tB] = [BUSUR_A1.tDari(a1.x0), BUSUR_A1.tDari(a1.x1)];
    for (let y = a1.y0; y <= a1.y1 + 1e-6; y += 1) k.tambah(2, this.m.besi, rusukBusur('y', y, BUSUR_A1, 0.12, -0.085, 0.012, 8, tA, tB));
    this.jaring(k, a1);
  }

  /**
   * Jaring pengaman kuning di keempat muka lantai 2: lajur tegak bercelah (tetap terbaca
   * sebagai jaring, bukan dinding), dari pelat sampai tepi dinding, di muka timur & barat
   * sampai busur atap. Dua muka per lajur: dari dalam bangunan yang belum beratap muka
   * jauhnya juga terlihat. Bahan kuning crane sudah ada di proyek, jadi tanpa draw call baru.
   */
  private jaring(k: KumpulanUnit, p: Persegi): void {
    const { lajur, celah, geser } = JARING;
    const lajurDi = (a0: number, a1: number, pasang: (b0: number, b1: number) => void): void => {
      const n = Math.floor((a1 - a0 + celah) / (lajur + celah));
      const tepi = (a1 - a0 - n * lajur - (n - 1) * celah) / 2;
      for (let i = 0; i < n; i++) pasang(a0 + tepi + i * (lajur + celah), a0 + tepi + i * (lajur + celah) + lajur);
    };
    const muka = (a: Titik, b: Titik, h1: number): void => {
      k.tambah(2, this.kuning, persegiTegak(a, b, H_LANTAI_2, h1, PENUH, 0));
      k.tambah(2, this.kuning, persegiTegak(b, a, H_LANTAI_2, h1, PENUH, 0));
    };
    const [hBarat, hTimur] = [BUSUR_A1.tinggi(p.x0), BUSUR_A1.tinggi(p.x1)];
    lajurDi(p.x0, p.x1, (b0, b1) => {
      muka([b0, p.y1 + geser], [b1, p.y1 + geser], H_DINDING_L2);
      muka([b1, p.y0 - geser], [b0, p.y0 - geser], H_DINDING_L2);
    });
    lajurDi(p.y0, p.y1, (b0, b1) => {
      muka([p.x1 + geser, b1], [p.x1 + geser, b0], hTimur);
      muka([p.x0 - geser, b0], [p.x0 - geser, b1], hBarat);
    });
  }

  /**
   * Pagar seng keliling persegi, bertiang, dengan papan proyek di sisi selatan & utara.
   * @param lain persegi pagar lain di lokasi ini: pagar berhenti di tepinya, jadi tidak melintang di tengah proyek
   */
  private pagar(k: Penampung, p: Persegi, tahap: number, lain: readonly Persegi[]): void {
    const { tinggi, tebal } = PAGAR;
    const diLuar = (x: number, y: number): boolean => !lain.some((q) => x > q.x0 && x < q.x1 && y > q.y0 && y < q.y1);
    for (const y of [p.y0, p.y1]) {
      const potong = lain.filter((q) => y > q.y0 && y < q.y1).map((q): [number, number] => [q.x0, q.x1]);
      for (const [a, b] of ruasDiLuar(p.x0, p.x1, potong)) k.tambah(this.seng, kotak(a, y - tebal, b, y + tebal, 0, tinggi));
    }
    for (const x of [p.x0, p.x1]) {
      const potong = lain.filter((q) => x > q.x0 && x < q.x1).map((q): [number, number] => [q.y0, q.y1]);
      for (const [a, b] of ruasDiLuar(p.y0, p.y1, potong)) k.tambah(this.seng, kotak(x - tebal, a, x + tebal, b, 0, tinggi));
    }
    const tiang = (x: number, y: number): void => {
      if (diLuar(x, y)) k.tambah(this.m.besiGelap, kotak(x - 0.03, y - 0.03, x + 0.03, y + 0.03, 0, tinggi + 0.04), POLOS);
    };
    for (let x = p.x0; x <= p.x1 + 1e-6; x += PAGAR.jarakTiang) {
      tiang(x, p.y0);
      tiang(x, p.y1);
    }
    for (let y = p.y0 + PAGAR.jarakTiang; y < p.y1; y += PAGAR.jarakTiang) {
      tiang(p.x0, y);
      tiang(p.x1, y);
    }
    // Papan proyek: menghadap kamera (selatan) dan ke arah sebaliknya, hanya di sisi yang tidak tertimpa persegi lain.
    const papan = this.m.teks(`PROYEK PERLUASAN TERMINAL · TAHAP ${tahap}`, { lebar: 512, tinggi: 64, latar: '#1e3a8a', warna: '#fde047', ukuranHuruf: 26 });
    const cx = (p.x0 + p.x1) / 2;
    const w = Math.min(2.4, (p.x1 - p.x0) / 2 - 0.2);
    if (diLuar(cx - w, p.y1) && diLuar(cx + w, p.y1)) k.tambah(papan.material, persegiTegak([cx - w, p.y1 + tebal], [cx + w, p.y1 + tebal], tinggi * 0.3, tinggi * 0.85, papan.uv, 0.004), { bayangan: false });
    if (diLuar(cx - w, p.y0) && diLuar(cx + w, p.y0)) k.tambah(papan.material, persegiTegak([cx + w, p.y0 - tebal], [cx - w, p.y0 - tebal], tinggi * 0.3, tinggi * 0.85, papan.uv, 0.004), { bayangan: false });
  }

  /** Tumpukan material bergantian: bata, gundukan pasir, ikatan besi. Rendah, jadi tanpa bayangan. */
  private material(k: Penampung, [x, y]: Titik, i: number): void {
    switch (i % 3) {
      case 0:
        for (let a = 0; a < 3; a++) {
          for (let b = 0; b < 2; b++) {
            for (let c = 0; c < 3 - a; c++) {
              const x0 = x - 0.3 + c * 0.2 + a * 0.1;
              const y0 = y - 0.12 + b * 0.13;
              k.tambah(this.m.bata, kotak(x0, y0, x0 + 0.18, y0 + 0.11, a * 0.08, a * 0.08 + 0.075), POLOS);
            }
          }
        }
        break;
      case 1:
        k.tambah(this.pasir, silinder(x, y, 0, 0.32, 0.45, 0.05, 12), POLOS);
        break;
      default:
        for (let b = 0; b < 5; b++) k.tambah(this.m.besiGelap, kotak(x - 0.6, y - 0.12 + b * 0.05, x + 0.6, y - 0.1 + b * 0.05, 0.02, 0.05 + (b % 2) * 0.03), POLOS);
        k.tambah(this.m.besiGelap, kotak(x - 0.45, y - 0.16, x - 0.38, y + 0.16, 0, 0.03), POLOS);
        k.tambah(this.m.besiGelap, kotak(x + 0.38, y - 0.16, x + 0.45, y + 0.16, 0, 0.03), POLOS);
    }
  }

  /** Papan kayu penutup jendela loket yang sedang dibangun, bertulisan SEDANG DIBANGUN. */
  private penutupJendela(k: Penampung, i: number): void {
    const x = X_LOKET[i]!;
    const w = LOKET.setengahLebar - 0.03;
    const y = LOKET.yMeja + 0.05;
    const h0 = TINGGI_LANTAI_GEDUNG;
    k.tambah(this.m.kayu, kotak(x - w, y - 0.012, x + w, y + 0.012, h0, h0 + 0.68));
    const tulisan = this.m.teks('SEDANG DIBANGUN', { lebar: 256, tinggi: 64, latar: '#facc15', warna: '#111827', ukuranHuruf: 26 });
    k.tambah(tulisan.material, persegiTegak([x - w + 0.04, y + 0.014], [x + w - 0.04, y + 0.014], h0 + 0.36, h0 + 0.5, tulisan.uv, 0.002), { bayangan: false });
  }

  /** Tiang crane menara: empat batang sudut dengan palang tiap 0,5, di atas pondasi beton. */
  private tiangCrane(k: Penampung, c: CraneProyek): void {
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
    k.tambah(this.m.besiGelap, kotak(xt - 0.45, -0.07, xt + 0.45, 0.07, -turun - 0.2, -turun - 0.1));
    k.bangun(g);
    g.position.set(c.x, c.tinggi, c.y);
    return g;
  }
}
