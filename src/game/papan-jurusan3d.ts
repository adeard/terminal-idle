/**
 * Papan jurusan yang mengikuti jurusan yang sudah dibuka pemain: papan kota di
 * atas tiap jendela loket dan papan jurusan di pulau tiap kelompok parkir.
 * Jurusan yang belum dibuka menampilkan "SEGERA DIBUKA"; papan pulau mendapat
 * baris kedua berikon kapal saat rute antarpulau kelompoknya dibuka, dan rambu
 * pelabuhan muncul di median jalan raya (antarpulau3d.ts). Tiap papan punya
 * beberapa tingkat (grup mesh) yang ditukar visibilitasnya, tanpa membangun
 * ulang geometri.
 */
import * as THREE from 'three';
import { RambuPelabuhan } from './antarpulau3d';
import { Kumpulan, persegiTegak, type Titik2 } from './geometri';
import type { PustakaMaterial } from './material3d';
import { GEDUNG, JURUSAN_JENDELA, KELOMPOK_PARKIR, PARKIR_SERONG, PULAU_JURUSAN, TINGGI_LANTAI_GEDUNG, TUJUAN_BUS, X_LOKET } from './tata-letak';

/** Papan jurusan di pulau parkir (bawah & atas, lebar); tiang & bingkainya di lingkungan3d.ts. */
export const PAPAN_JURUSAN = { bawah: 1.12, atas: 1.72, lebar: 2.3 } as const;

const TEKS_TUTUP = 'SEGERA DIBUKA';
const WARNA_TUTUP = '#475569';

interface Varian {
  /** Grup per tingkat: [0] = tutup; tingkat k tampil bila ambang[0 … k − 1] sudah dibuka. */
  readonly tingkat: readonly THREE.Group[];
  /** Indeks jurusan (urut naik) yang membuka tingkat berikutnya. */
  readonly ambang: readonly number[];
}

export class PapanJurusan {
  readonly objek = new THREE.Group();
  private readonly varian: Varian[] = [];
  private readonly rambu: RambuPelabuhan;
  private bukaLalu = -1;

  constructor(m: PustakaMaterial) {
    this.papanLoket(m);
    this.papanPangkalan(m);
    this.rambu = new RambuPelabuhan(m);
    this.objek.add(this.rambu.objek);
  }

  /** @param jurusanBuka banyaknya jurusan terbuka (urut TUJUAN_BUS). */
  perbarui(jurusanBuka: number): void {
    if (jurusanBuka === this.bukaLalu) return;
    this.bukaLalu = jurusanBuka;
    for (const v of this.varian) {
      const t = v.ambang.filter((i) => i < jurusanBuka).length;
      v.tingkat.forEach((g, k) => (g.visible = k === t));
    }
    this.rambu.perbarui(jurusanBuka);
  }

  private tambahVarian(ambang: readonly number[], isi: (k: Kumpulan, tingkat: number) => void): void {
    const tingkat = Array.from({ length: ambang.length + 1 }, (_, t) => {
      const g = new THREE.Group();
      const k = new Kumpulan();
      isi(k, t);
      k.bangun(g);
      this.objek.add(g);
      return g;
    });
    this.varian.push({ tingkat, ambang });
  }

  /** Papan kota di dinding atas tiap jendela loket (menghadap selatan). */
  private papanLoket(m: PustakaMaterial): void {
    const yDinding = GEDUNG.y0 + 0.06;
    const h = TINGGI_LANTAI_GEDUNG;
    X_LOKET.forEach((x, i) => {
      const j = JURUSAN_JENDELA[i]!;
      this.tambahVarian([j], (k, tingkat) => {
        const papan = tingkat === 0
          ? m.teks(TEKS_TUTUP, { lebar: 256, tinggi: 64, latar: WARNA_TUTUP, warna: '#e2e8f0', ukuranHuruf: 26 })
          : m.teks(TUJUAN_BUS[j]!, { lebar: 256, tinggi: 64, latar: '#0f172a', warna: '#fbbf24', ukuranHuruf: 36 });
        k.tambah(papan.material, persegiTegak([x - 0.32, yDinding], [x + 0.32, yDinding], h + 0.76, h + 0.92, papan.uv, 0.004), { bayangan: false });
      });
    });
  }

  /** Tulisan di keempat muka papan bersilang tiap pulau jurusan di pangkalan. */
  private papanPangkalan(m: PustakaMaterial): void {
    const { pusatY, sudut } = PARKIR_SERONG;
    const c = Math.cos(sudut);
    const sn = Math.sin(sudut);
    const { bawah, atas, lebar } = PAPAN_JURUSAN;
    KELOMPOK_PARKIR.forEach((g, i) => {
      const px = PULAU_JURUSAN[i]!;
      const darat = g.tujuan.filter((t) => !g.antarpulau.includes(t));
      this.tambahVarian([Math.min(...darat), ...g.antarpulau], (k, tingkat) => {
        // Tingkat 2 dst.: kota antarpulau yang sudah dibuka di baris kedua.
        const kota = g.antarpulau
          .slice(0, tingkat - 1)
          .map((t) => TUJUAN_BUS[t]!)
          .join(' · ');
        const latar = '#' + g.warna.toString(16).padStart(6, '0');
        const papan =
          tingkat === 0
            ? m.teks(TEKS_TUTUP, { lebar: 640, tinggi: 160, latar: WARNA_TUTUP, warna: '#e2e8f0', ukuranHuruf: 56 })
            : m.teks(g.nama, { lebar: 640, tinggi: 160, latar, warna: '#ffffff', ukuranHuruf: 60, ...(kota ? { barisKapal: kota } : {}) });
        for (const [dx, dy] of [
          [c, sn],
          [c, -sn],
        ] as const) {
          const a: Titik2 = [px - (dx * lebar) / 2, pusatY - (dy * lebar) / 2];
          const b: Titik2 = [px + (dx * lebar) / 2, pusatY + (dy * lebar) / 2];
          k.tambah(papan.material, persegiTegak(a, b, bawah, atas, papan.uv, 0.028), { bayangan: false });
          k.tambah(papan.material, persegiTegak(b, a, bawah, atas, papan.uv, 0.028), { bayangan: false });
        }
      });
    });
  }
}
