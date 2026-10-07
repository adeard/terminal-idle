/**
 * Bagian terminal yang belum dibangun (terminal "tumbuh" seiring jalur bus &
 * jurusan dibuka): kerucut & palang merah-putih di tepi peron kedatangan dan
 * peron keberangkatan milik jalur yang belum dibangun (gerbangnya tertutup
 * pintu gulung, lihat malam3d.ts), dan barikade di mulut tiap petak parkir
 * kelompok jurusan yang belum dibuka (bus tidak parkir di sana, lihat
 * DuniaVisual.pilihPetak). Tiap bagian satu grup mesh yang ditukar
 * visibilitasnya.
 */
import * as THREE from 'three';
import { kotak, Kumpulan, silinder } from './geometri';
import { GERBANG_X, HALTE_DATANG_X, KELOMPOK_PARKIR, PARKIR_SERONG, PERON, PERON_BERANGKAT, PINTU_BUS, TINGGI_PERON } from './tata-letak';

interface Bagian {
  readonly grup: THREE.Group;
  readonly tutup: (jalur: number, jurusanBuka: number) => boolean;
}

/** Kerucut lalu lintas (unit): tinggi, jari-jari bawah & atas, alas persegi. */
const KERUCUT = { tinggi: 0.16, bawah: 0.038, atas: 0.006, alas: 0.045 } as const;
/** Jarak kerucut ke tengah pagar tepi peron; palang di antaranya. */
const LEBAR_PAGAR = 0.34;

export class PembangunanTerminal {
  readonly objek = new THREE.Group();
  private readonly bagian: Bagian[] = [];
  private kunciLalu = '';
  private readonly oranye = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.55 });
  private readonly putih = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });

  constructor() {
    // Halte kedatangan jalur ke-(k+1): pagar di tepi peron, tepat di depan pintu bus. Jalur 1 selalu ada.
    HALTE_DATANG_X.forEach((x, k) => {
      if (k > 0) this.tambah((jalur) => jalur <= k, (kp) => this.pagarTepi(kp, x + PINTU_BUS, PERON.y0 + 0.14));
    });
    GERBANG_X.forEach((x, k) => {
      if (k > 0) this.tambah((jalur) => jalur <= k, (kp) => this.pagarTepi(kp, x, PERON_BERANGKAT.y0 + 0.14));
    });
    // Mulut petak parkir kelompok jurusan yang belum dibuka (posisi pita warna kelompok).
    const { pusatY, sudut } = PARKIR_SERONG;
    const c = Math.cos(sudut);
    const sn = Math.sin(sudut);
    for (const g of KELOMPOK_PARKIR) {
      const pertama = Math.min(...g.tujuan);
      this.tambah(
        (_, jurusanBuka) => jurusanBuka <= pertama,
        (kp) => {
          for (const petak of g.petak) {
            const sx = PARKIR_SERONG.pusatX[petak]!;
            const x = sx - 0.95 * c;
            const y = pusatY - 0.95 * sn;
            const badan = new THREE.BoxGeometry(0.09, 0.11, 0.52);
            badan.rotateY(-sudut);
            badan.translate(x, 0.075, y);
            kp.tambah(this.oranye, badan);
            const garis = new THREE.BoxGeometry(0.094, 0.028, 0.522);
            garis.rotateY(-sudut);
            garis.translate(x, 0.1, y);
            kp.tambah(this.putih, garis);
          }
        },
      );
    }
  }

  /** @param jurusanBuka banyaknya jurusan terbuka (kelompok parkir). */
  perbarui(jalur: number, jurusanBuka: number): void {
    const kunci = `${jalur}|${jurusanBuka}`;
    if (kunci === this.kunciLalu) return;
    this.kunciLalu = kunci;
    for (const b of this.bagian) b.grup.visible = b.tutup(jalur, jurusanBuka);
  }

  private tambah(tutup: Bagian['tutup'], bangun: (k: Kumpulan) => void): void {
    const grup = new THREE.Group();
    const k = new Kumpulan();
    bangun(k);
    k.bangun(grup);
    grup.visible = false;
    this.objek.add(grup);
    this.bagian.push({ grup, tutup });
  }

  /** Dua kerucut & palang bergaris merah-putih sejajar tepi peron. */
  private pagarTepi(k: Kumpulan, x: number, y: number): void {
    const h0 = TINGGI_PERON;
    for (const dx of [-LEBAR_PAGAR, LEBAR_PAGAR]) this.kerucut(k, x + dx, y, h0);
    const n = 5;
    const w = (2 * LEBAR_PAGAR - 0.08) / n;
    const x0 = x - LEBAR_PAGAR + 0.04;
    for (let i = 0; i < n; i++) k.tambah(i % 2 === 0 ? this.oranye : this.putih, kotak(x0 + i * w, y - 0.009, x0 + (i + 1) * w, y + 0.009, h0 + 0.1, h0 + 0.128));
  }

  private kerucut(k: Kumpulan, x: number, y: number, h0: number): void {
    const { tinggi, bawah, atas, alas } = KERUCUT;
    k.tambah(this.oranye, kotak(x - alas, y - alas, x + alas, y + alas, h0, h0 + 0.012));
    k.tambah(this.oranye, silinder(x, y, h0 + 0.012, h0 + tinggi, bawah, atas, 10));
    // Pita putih memantul di tengah kerucut.
    k.tambah(this.putih, silinder(x, y, h0 + 0.07, h0 + 0.1, 0.027, 0.021, 10));
  }
}
