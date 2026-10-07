/**
 * Perlengkapan modernisasi terminal yang tampil setelah dibeli pemain (lihat
 * TEKNOLOGI di economy.config.ts): rambu bernomor di tiap halte kedatangan,
 * mesin tiket mandiri di plaza, papan e-tiket di depan pintu masuk, papan jadwal
 * digital di ruang tunggu, dan gate e-boarding di tiap gerbang keberangkatan.
 * Petugas pengatur bus (orang) diatur di terminal3d.ts.
 */
import * as THREE from 'three';
import { TEKNOLOGI_IDS, type TeknologiId } from '../sim/fitur';
import { kotak, Kumpulan, persegiTegak, silinder } from './geometri';
import { mesinTiket } from './lingkungan3d';
import type { PustakaMaterial } from './material3d';
import { GERBANG_X, HALTE_DATANG_X, PERON, PINTU_MASUK, RUANG_TUNGGU, TINGGI_PERON } from './tata-letak';

const PENUH = { u0: 0, v0: 0, u1: 1, v1: 1 } as const;

export class Modernisasi {
  readonly objek = new THREE.Group();
  private readonly grup = {} as Record<TeknologiId, THREE.Group>;
  private kunciLalu = '';

  constructor(m: PustakaMaterial) {
    const bangun: Readonly<Record<TeknologiId, (k: Kumpulan) => void>> = {
      rambuHalte: (k) => rambuHalte(k, m),
      pengaturBus: () => undefined,
      mesinTiket: (k) => {
        mesinTiket(k, m, 21.05, 15.6, m.plester);
        mesinTiket(k, m, 21.5, 15.6, m.biruPos);
        mesinTiket(k, m, 22.45, 15.6, m.plester);
      },
      eTiket: (k) => papanETiket(k, m),
      jadwalDigital: (k) => jadwalDigital(k, m),
      gateOtomatis: (k) => gateOtomatis(k, m),
    };
    for (const id of TEKNOLOGI_IDS) {
      const g = new THREE.Group();
      const k = new Kumpulan();
      bangun[id](k);
      k.bangun(g);
      g.visible = false;
      this.grup[id] = g;
      this.objek.add(g);
    }
  }

  perbarui(teknologi: Readonly<Record<TeknologiId, boolean>>): void {
    const kunci = TEKNOLOGI_IDS.map((id) => (teknologi[id] ? 1 : 0)).join('');
    if (kunci === this.kunciLalu) return;
    this.kunciLalu = kunci;
    for (const id of TEKNOLOGI_IDS) this.grup[id].visible = teknologi[id];
  }
}

/** Tiang rambu bernomor di belakang tiap halte kedatangan (di luar jalur turun penumpang). */
function rambuHalte(k: Kumpulan, m: PustakaMaterial): void {
  const h0 = TINGGI_PERON;
  const y = PERON.y0 + 0.14;
  HALTE_DATANG_X.forEach((xHalte, i) => {
    const x = xHalte - 0.95;
    k.tambah(m.besiGelap, silinder(x, y, h0, h0 + 0.78, 0.016, 0.016, 6));
    const papan = m.teks(`A${i + 1}`, { lebar: 128, tinggi: 128, latar: '#0f766e', warna: '#ffffff', ukuranHuruf: 60, garisTepi: '#ffffff' });
    k.tambah(papan.material, persegiTegak([x - 0.11, y + 0.018], [x + 0.11, y + 0.018], h0 + 0.56, h0 + 0.78, papan.uv), { bayangan: false });
    k.tambah(papan.material, persegiTegak([x + 0.11, y + 0.014], [x - 0.11, y + 0.014], h0 + 0.56, h0 + 0.78, papan.uv), { bayangan: false });
    // Marka kuning berhenti di lantai peron.
    k.tambah(m.markaKuning, kotak(xHalte - 1.25, PERON.y0 + 0.2, xHalte + 1.25, PERON.y0 + 0.24, h0, h0 + 0.004), { bayangan: false });
  });
}

/** Papan berdiri "E-TIKET · SCAN QR" di selasar depan pintu masuk, menghadap plaza. */
function papanETiket(k: Kumpulan, m: PustakaMaterial): void {
  const x = PINTU_MASUK[0] - 1.0;
  const y = 15.25;
  k.tambah(m.besiGelap, kotak(x - 0.16, y - 0.05, x + 0.16, y + 0.05, 0.012, 0.03));
  k.tambah(m.besiGelap, silinder(x, y, 0.03, 0.2, 0.012, 0.012, 6));
  k.tambah(m.panel, kotak(x - 0.15, y - 0.012, x + 0.15, y + 0.012, 0.2, 0.52));
  const papan = m.teks('E-TIKET', { lebar: 256, tinggi: 96, latar: '#7c3aed', warna: '#ffffff', ukuranHuruf: 52 });
  k.tambah(papan.material, persegiTegak([x - 0.14, y + 0.014], [x + 0.14, y + 0.014], 0.38, 0.5, papan.uv, 0.002), { bayangan: false });
  const qr = m.teks('SCAN QR', { lebar: 256, tinggi: 96, latar: '#ffffff', warna: '#111827', ukuranHuruf: 44 });
  k.tambah(qr.material, persegiTegak([x - 0.12, y + 0.014], [x + 0.12, y + 0.014], 0.23, 0.36, qr.uv, 0.002), { bayangan: false });
}

/** Papan jadwal digital di kedua ujung zona gerbang ruang tunggu, menghadap selatan. */
function jadwalDigital(k: Kumpulan, m: PustakaMaterial): void {
  const R = RUANG_TUNGGU;
  const h0 = TINGGI_PERON;
  for (const x of [R.x0 + 0.9, R.x1 - 0.6]) {
    const y = R.y0 + 0.5;
    for (const dx of [-0.28, 0.28]) k.tambah(m.besiGelap, silinder(x + dx, y, h0, h0 + 0.62, 0.014, 0.014, 6));
    k.tambah(m.besiGelap, kotak(x - 0.36, y - 0.025, x + 0.36, y + 0.015, h0 + 0.36, h0 + 0.8));
    k.tambah(m.jadwal, persegiTegak([x - 0.34, y + 0.016], [x + 0.34, y + 0.016], h0 + 0.38, h0 + 0.78, PENUH, 0.002), { bayangan: false });
  }
}

/** Gate e-boarding: dua tiang pemindai di kiri-kanan tiap gerbang (penumpang lewat di tengah). */
function gateOtomatis(k: Kumpulan, m: PustakaMaterial): void {
  const h0 = TINGGI_PERON;
  const y = RUANG_TUNGGU.y0 + 0.12;
  for (const g of GERBANG_X) {
    for (const s of [-1, 1]) {
      const x = g + s * 0.15;
      k.tambah(m.panel, kotak(x - 0.025, y - 0.08, x + 0.025, y + 0.08, h0, h0 + 0.24));
      k.tambah(m.layar, kotak(x - 0.027, y - 0.03, x + 0.027, y + 0.03, h0 + 0.18, h0 + 0.23), { bayangan: false });
    }
  }
}
