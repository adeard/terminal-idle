/**
 * Papan di aula loket & pangkalan yang mengikuti mitra PO: papan nama PO
 * (warna livery) di atas tiap jendela loket yang dipakai PO itu (lihat
 * jendelaPo di perluasan-adegan.ts), dan papan jurusan di pulau tiap kelompok
 * parkir yang sudah dibangun dan jurusannya dilayani. Jendela yang tidak
 * dipakai & kelompok yang belum dibuka menampilkan "SEGERA DIBUKA"; papan
 * pulau mendapat baris kedua berikon kapal untuk rute antarpulau kelompoknya
 * yang dilayani, dan rambu pelabuhan muncul di median jalan raya
 * (antarpulau3d.ts). Tiap papan punya beberapa tampilan (grup mesh) yang
 * dibangun sekali saat pertama dibutuhkan, lalu ditukar visibilitasnya.
 */
import * as THREE from 'three';
import { LIVERY_PO } from '../config/livery.config';
import { PO_IDS, type PoId } from '../sim/fitur';
import { RambuPelabuhan } from './antarpulau3d';
import { Kumpulan, persegiTegak, type Titik2 } from './geometri';
import type { PustakaMaterial } from './material3d';
import { GEDUNG, KELOMPOK_PARKIR, kunciPapanPulau, PARKIR_SERONG, PULAU_JURUSAN, TINGGI_LANTAI_GEDUNG, TUJUAN_BUS, X_LOKET } from './tata-letak';

/** Papan jurusan di pulau parkir (bawah & atas, lebar); tiang & bingkainya di lingkungan3d.ts. */
export const PAPAN_JURUSAN = { bawah: 1.12, atas: 1.72, lebar: 2.3 } as const;

const TEKS_TUTUP = 'SEGERA DIBUKA';
const WARNA_TUTUP = '#475569';

/** Keadaan yang menentukan tampilan papan. */
export interface KeadaanPapan {
  /** Jurusan yang dilayani mitra PO (bitmask, lihat MASK_SEMUA_JURUSAN). */
  readonly mask: number;
  /** Pemilik tiap jendela loket (indeks X_LOKET; null = tidak dipakai). */
  readonly jendela: readonly (PoId | null)[];
  /** Kelompok parkir yang sudah dibangun (urut KELOMPOK_PARKIR). */
  readonly kelompok: number;
}

interface Varian {
  /** Kunci tampilan; 0 = tutup. */
  readonly kunci: (k: KeadaanPapan) => number;
  readonly isi: (k: Kumpulan, kunci: number) => void;
  readonly grup: Map<number, THREE.Group>;
  aktif: number;
}

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

export class PapanJurusan {
  readonly objek = new THREE.Group();
  private readonly varian: Varian[] = [];
  private readonly rambu: RambuPelabuhan;
  private maskLalu = -1;
  private kelompokLalu = -1;
  private readonly jendelaLalu: (PoId | null)[] = X_LOKET.map(() => null);

  constructor(m: PustakaMaterial) {
    this.papanLoket(m);
    this.papanPangkalan(m);
    this.rambu = new RambuPelabuhan(m);
    this.objek.add(this.rambu.objek);
  }

  perbarui(k: KeadaanPapan): void {
    const sama = k.mask === this.maskLalu && k.kelompok === this.kelompokLalu && this.jendelaLalu.every((p, i) => p === (k.jendela[i] ?? null));
    if (sama) return;
    this.maskLalu = k.mask;
    this.kelompokLalu = k.kelompok;
    this.jendelaLalu.forEach((_, i) => (this.jendelaLalu[i] = k.jendela[i] ?? null));
    for (const v of this.varian) {
      const kunci = v.kunci(k);
      if (kunci === v.aktif) continue;
      const lama = v.grup.get(v.aktif);
      if (lama) lama.visible = false;
      let g = v.grup.get(kunci);
      if (!g) {
        g = new THREE.Group();
        const kp = new Kumpulan();
        v.isi(kp, kunci);
        kp.bangun(g);
        this.objek.add(g);
        v.grup.set(kunci, g);
      }
      g.visible = true;
      v.aktif = kunci;
    }
    this.rambu.perbarui(k.mask);
  }

  private tambahVarian(kunci: Varian['kunci'], isi: Varian['isi']): void {
    this.varian.push({ kunci, isi, grup: new Map(), aktif: -1 });
  }

  /** Papan nama PO (warna livery) di dinding atas tiap jendela loket, menghadap selatan. */
  private papanLoket(m: PustakaMaterial): void {
    const yDinding = GEDUNG.y0 + 0.06;
    const h = TINGGI_LANTAI_GEDUNG;
    X_LOKET.forEach((x, i) => {
      this.tambahVarian(
        (k) => {
          const po = k.jendela[i];
          return po ? PO_IDS.indexOf(po) + 1 : 0;
        },
        (k, kunci) => {
          const po = PO_IDS[kunci - 1];
          const l = po ? LIVERY_PO[po] : null;
          const papan = l
            ? m.teks(l.papan, { lebar: 256, tinggi: 64, latar: hex(l.warna), warna: hex(l.teks ?? l.aksen), ukuranHuruf: 30 })
            : m.teks(TEKS_TUTUP, { lebar: 256, tinggi: 64, latar: WARNA_TUTUP, warna: '#e2e8f0', ukuranHuruf: 26 });
          k.tambah(papan.material, persegiTegak([x - 0.32, yDinding], [x + 0.32, yDinding], h + 0.76, h + 0.92, papan.uv, 0.004), { bayangan: false });
        },
      );
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
      this.tambahVarian(
        (k) => (i < k.kelompok ? kunciPapanPulau(g.tujuan, g.antarpulau, k.mask) : 0),
        (k, kunci) => {
          // Baris kedua: kota antarpulau kelompok ini yang dilayani.
          const kota = g.antarpulau
            .filter((_, b) => Math.floor((kunci - 1) / 2 ** b) % 2 === 1)
            .map((t) => TUJUAN_BUS[t]!)
            .join(' · ');
          const latar = '#' + g.warna.toString(16).padStart(6, '0');
          const papan =
            kunci === 0
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
        },
      );
    });
  }
}
