/**
 * Spanduk kardus "OM TELOLET OM" yang dibentangkan anak-anak di trotoar
 * seberang jalan raya (posisi & jam hadir di telolet.ts). Satu grup mesh yang
 * ditampilkan hanya selama anak-anaknya ada.
 */
import * as THREE from 'three';
import { kotak, Kumpulan, persegiTegak } from './geometri';
import type { PustakaMaterial } from './material3d';
import { SPANDUK_TELOLET } from './telolet';

const PENUH = { u0: 0, v0: 0, u1: 1, v1: 1 } as const;

export class SpandukTelolet {
  readonly objek = new THREE.Group();

  constructor(m: PustakaMaterial) {
    const s = SPANDUK_TELOLET;
    const k = new Kumpulan();
    // Muka bertulisan menghadap jalan (+y); punggung kardus polos.
    const tulisan = m.teks('OM TELOLET OM', { lebar: 256, tinggi: 44, latar: '#eadcb8', warna: '#b91c1c', ukuranHuruf: 30 });
    k.tambah(tulisan.material, persegiTegak([s.x0, s.y], [s.x1, s.y], s.h0, s.h1, tulisan.uv, 0), { bayangan: false });
    k.tambah(m.kayu, persegiTegak([s.x1, s.y - 0.006], [s.x0, s.y - 0.006], s.h0, s.h1, PENUH, 0), { bayangan: false });
    // Dua tongkat pegangan di ujung spanduk.
    for (const x of [s.x0 + 0.03, s.x1 - 0.03]) k.tambah(m.kayu, kotak(x - 0.008, s.y - 0.016, x + 0.008, s.y - 0.004, s.h0 - 0.1, s.h1 + 0.01));
    k.bangun(this.objek);
    this.objek.visible = false;
  }

  perbarui(tampil: boolean): void {
    this.objek.visible = tampil;
  }
}
