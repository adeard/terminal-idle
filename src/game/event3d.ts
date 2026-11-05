/**
 * Hiasan event musiman di adegan (event yang berlangsung: state.event.aktif):
 *   - spanduk ucapan di antara pilar gapura, di bawah papan nama;
 *   - Mudik Lebaran: ketupat bergantung di kiri-kanan spanduk;
 *   - HUT RI: bendera merah-putih kecil di sepanjang median jalan raya;
 *   - Nataru: lampu warna-warni di sepanjang tepi bawah balok gapura.
 * Tiap event satu grup mesh yang dibangun sekali; hanya visibilitasnya ditukar.
 * Spanduk Musim Terminal (config/hiasan-musim.ts) memakai tempat & geometri spanduk event; grupnya dibangun
 * saat pertama dipakai. Event menang (lihat spandukMusim di musim-adegan.ts), jadi keduanya tidak tampil bersamaan.
 */
import * as THREE from 'three';
import { SPANDUK_MUSIM, type SpandukMusim } from '../config/hiasan-musim';
import type { EventId } from '../sim/fitur';
import { GAPURA } from './gedung3d';
import { kotak, Kumpulan, persegiTegak, silinder } from './geometri';
import { titikUmbul } from './kelas3d';
import type { PustakaMaterial } from './material3d';
import { MEDIAN } from './tata-letak';

/** Keramaian terminal paling sepi selama event (orang mudik & liburan memenuhi terminal sepanjang hari). */
export const RAMAI_EVENT: Readonly<Record<EventId, number>> = { mudikLebaran: 0.9, hutRi: 0.6, nataru: 0.75 };

const SPANDUK: Readonly<Record<EventId, { readonly teks: string; readonly latar: string; readonly warna: string }>> = {
  mudikLebaran: { teks: 'SELAMAT MUDIK · MOHON MAAF LAHIR & BATIN', latar: '#166534', warna: '#fde047' },
  hutRi: { teks: 'DIRGAHAYU REPUBLIK INDONESIA', latar: '#dc2626', warna: '#ffffff' },
  nataru: { teks: 'SELAMAT NATAL & TAHUN BARU', latar: '#1e1b4b', warna: '#fde68a' },
};
/** Spanduk: di antara pilar (sisakan tempat ketupat), di bawah balok gapura, sedikit di depannya. */
const H_SPANDUK = { bawah: 2.3, atas: 2.66 } as const;
const WARNA_LAMPU = [0xef4444, 0x22c55e, 0x3b82f6, 0xfacc15, 0xec4899] as const;

const bahan = (warna: number, opsi: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: warna, roughness: 0.7, ...opsi });

export class HiasanEvent {
  readonly objek = new THREE.Group();
  private readonly grup = new Map<EventId, THREE.Group>();
  /** Spanduk musim per id hiasan, dibangun saat pertama dipakai. */
  private readonly grupMusim = new Map<string, THREE.Group>();
  private aktif: EventId | null | undefined = undefined;
  private musimAktif: string | null | undefined = undefined;

  constructor(private readonly m: PustakaMaterial) {
    for (const id of Object.keys(SPANDUK) as EventId[]) {
      const g = new THREE.Group();
      const k = new Kumpulan();
      this.spanduk(k, SPANDUK[id]);
      if (id === 'mudikLebaran') this.ketupat(k, m);
      if (id === 'hutRi') this.bendera(k, m);
      if (id === 'nataru') this.lampu(k);
      k.bangun(g);
      g.visible = false;
      this.grup.set(id, g);
      this.objek.add(g);
    }
  }

  /** Spanduk bertulisan di antara pilar gapura dengan tali pengikat ke pilar (event & musim memakai yang sama). */
  private spanduk(k: Kumpulan, sp: SpandukMusim): void {
    const P = GAPURA;
    const xa = P.x0 + P.pilar + 0.36;
    const xb = P.x1 - P.pilar - 0.36;
    const yDepan = P.y1 + 0.03;
    const tulisan = this.m.teks(sp.teks, { lebar: 1024, tinggi: 96, latar: sp.latar, warna: sp.warna, ukuranHuruf: 52 });
    k.tambah(tulisan.material, persegiTegak([xa, yDepan], [xb, yDepan], H_SPANDUK.bawah, H_SPANDUK.atas, tulisan.uv, 0), { bayangan: false });
    for (const [x0, x1] of [
      [P.x0 + P.pilar, xa],
      [xb, P.x1 - P.pilar],
    ] as const) {
      for (const h of [H_SPANDUK.bawah + 0.02, H_SPANDUK.atas - 0.02]) k.tambah(this.m.besiGelap, kotak(x0, yDepan - 0.005, x1, yDepan + 0.005, h - 0.006, h + 0.006), { bayangan: false });
    }
  }

  /** Dua untai ketupat (hijau, anyaman kuning) bergantung dari balok gapura di kiri-kanan spanduk. */
  private ketupat(k: Kumpulan, m: PustakaMaterial): void {
    const P = GAPURA;
    const hijau = bahan(0x15803d);
    const kuning = bahan(0xfacc15);
    const bawahBalok = P.tinggi - 0.62;
    const y = P.y1 + 0.08;
    for (const x of [P.x0 + P.pilar + 0.18, P.x1 - P.pilar - 0.18]) {
      k.tambah(m.besiGelap, kotak(x - 0.004, y - 0.004, x + 0.004, y + 0.004, bawahBalok - 0.62, bawahBalok), { bayangan: false });
      for (let i = 0; i < 3; i++) {
        const h = bawahBalok - 0.16 - i * 0.2;
        const badan = new THREE.OctahedronGeometry(0.075, 0);
        badan.scale(1, 1.25, 0.6);
        badan.rotateY(Math.PI / 4);
        badan.translate(x, h, y);
        k.tambah(hijau, badan);
        // Pita anyaman kuning melintang.
        k.tambah(kuning, kotak(x - 0.055, y - 0.03, x + 0.055, y + 0.03, h - 0.012, h + 0.012), { bayangan: false });
      }
    }
  }

  /** Bendera merah-putih kecil bertiang di sepanjang median, di sela umbul-umbul. */
  private bendera(k: Kumpulan, m: PustakaMaterial): void {
    const merah = bahan(0xdc2626, { side: THREE.DoubleSide });
    const putih = bahan(0xf8fafc, { side: THREE.DoubleSide });
    const y = MEDIAN.y0 + 0.14;
    const xs = titikUmbul();
    for (let i = 0; i + 1 < xs.length; i++) {
      const x = (xs[i]! + xs[i + 1]!) / 2;
      if (xs[i + 1]! - xs[i]! > 5) continue;
      k.tambah(m.besi, silinder(x, y, 0.07, 1.35, 0.012, 0.01, 5), { bayangan: false });
      k.tambah(merah, persegiTegak([x + 0.012, y], [x + 0.34, y], 1.23, 1.34, { u0: 0, v0: 0, u1: 1, v1: 1 }, 0), { bayangan: false });
      k.tambah(putih, persegiTegak([x + 0.012, y], [x + 0.34, y], 1.12, 1.23, { u0: 0, v0: 0, u1: 1, v1: 1 }, 0), { bayangan: false });
    }
  }

  /** Lampu warna-warni (berpendar) di sepanjang tepi bawah balok gapura. */
  private lampu(k: Kumpulan): void {
    const P = GAPURA;
    const bahanLampu = WARNA_LAMPU.map((c) => bahan(c, { emissive: c, emissiveIntensity: 1.6 }));
    const h = P.tinggi - 0.66;
    const y = P.y1 + 0.03;
    const bola = new THREE.IcosahedronGeometry(0.035, 0);
    let i = 0;
    for (let x = P.x0 - 0.05; x <= P.x1 + 0.05; x += 0.16, i++) {
      const g = bola.clone();
      g.translate(x, h - 0.03 * Math.abs(Math.sin(i * 0.9)), y);
      k.tambah(bahanLampu[i % bahanLampu.length]!, g, { bayangan: false });
    }
    bola.dispose();
  }

  /**
   * @param id event yang sedang berlangsung, null = tidak ada.
   * @param spandukMusim id spanduk musim yang tampil (lihat spandukMusim, sudah null selama event), null = tidak ada.
   */
  perbarui(id: EventId | null, spandukMusim: string | null = null): void {
    if (id === this.aktif && spandukMusim === this.musimAktif) return;
    this.aktif = id;
    this.musimAktif = spandukMusim;
    for (const [e, g] of this.grup) g.visible = e === id;
    const sp = spandukMusim === null ? undefined : SPANDUK_MUSIM[spandukMusim];
    if (spandukMusim !== null && sp && !this.grupMusim.has(spandukMusim)) {
      const g = new THREE.Group();
      const k = new Kumpulan();
      this.spanduk(k, sp);
      k.bangun(g);
      this.grupMusim.set(spandukMusim, g);
      this.objek.add(g);
    }
    for (const [s, g] of this.grupMusim) g.visible = s === spandukMusim;
  }
}
