/**
 * Di luar pagar terminal: pangkalan ojek di mulut gang gerbang KELUAR (gubuk
 * beratap dengan bangku dan papan "PANGKALAN OJEK", ojek menunggu penumpang
 * turun) dan pengemudi ojol berjaket hijau yang menunggu di mulut gang gerbang
 * MASUK. Motor + pengendara satu InstancedMesh; jumlah yang menunggu mengikuti
 * jam dan keramaian.
 */
import * as THREE from 'three';
import { bayanganKontak, kotak, Kumpulan, persegiTegak, silinder } from './geometri';
import { dalamRentang } from './kehidupan-malam';
import type { PustakaMaterial } from './material3d';
import { geometriMotor } from './mobil3d';
import { GERBANG_KELUAR_X, GERBANG_MASUK_X, type Titik } from './tata-letak';

/** Tempat motor menunggu di sisi gang (di antara jalan paving gang dan dinding ruko), menghadap jalan. */
export const MOTOR_OJEK: readonly Titik[] = [
  [GERBANG_KELUAR_X + 0.86, 18.55],
  [GERBANG_KELUAR_X + 0.86, 19.0],
  [GERBANG_KELUAR_X + 0.86, 19.45],
];
export const MOTOR_OJOL: readonly Titik[] = [
  [GERBANG_MASUK_X + 0.86, 18.6],
  [GERBANG_MASUK_X - 0.86, 18.85],
  [GERBANG_MASUK_X + 0.86, 19.1],
];
/** Gubuk pangkalan ojek di sisi barat gang KELUAR (x tengah, y awal–akhir). */
export const GUBUK_OJEK = { x: GERBANG_KELUAR_X - 0.83, y0: 18.35, y1: 19.35 } as const;

const WARNA_OJEK = [0x7f1d1d, 0x1f2937, 0x1e3a8a].map((c) => new THREE.Color(c));
const WARNA_OJOL = [0x16a34a, 0x15803d, 0x16a34a].map((c) => new THREE.Color(c));
/** Jam ojek pangkalan menunggu penuh (di luar itu tinggal satu yang berjaga). */
const JAM_OJEK: readonly [number, number] = [5, 23];

export class LuarTerminal {
  readonly objek = new THREE.Group();
  private readonly motor: THREE.InstancedMesh;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly p = new THREE.Vector3();
  private kunciLalu = '';

  constructor(m: PustakaMaterial) {
    const k = new Kumpulan();
    gubukOjek(k, m);
    k.bangun(this.objek);
    this.motor = new THREE.InstancedMesh(geometriMotor(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 }), MOTOR_OJEK.length + MOTOR_OJOL.length);
    this.motor.castShadow = true;
    this.motor.receiveShadow = true;
    this.motor.frustumCulled = false;
    this.motor.setColorAt(0, new THREE.Color(1, 1, 1));
    this.motor.count = 0;
    this.objek.add(this.motor);
  }

  /** Banyaknya ojek pangkalan & ojol yang menunggu pada jam & keramaian ini. */
  static jumlah(jam: number, keramaian: number): { readonly ojek: number; readonly ojol: number } {
    const ojek = dalamRentang(jam, JAM_OJEK) ? MOTOR_OJEK.length : 1;
    const ojol = Math.min(MOTOR_OJOL.length, Math.round(MOTOR_OJOL.length * Math.min(1, keramaian * 1.3)));
    return { ojek, ojol };
  }

  perbarui(jam: number, keramaian: number): void {
    const { ojek, ojol } = LuarTerminal.jumlah(jam, keramaian);
    const kunci = `${ojek}/${ojol}`;
    if (kunci === this.kunciLalu) return;
    this.kunciLalu = kunci;
    let n = 0;
    const pasang = (t: Titik, warna: THREE.Color): void => {
      this.m4.compose(this.p.set(t[0], 0.035, t[1]), this.q, this.s);
      this.motor.setMatrixAt(n, this.m4);
      this.motor.setColorAt(n, warna);
      n++;
    };
    MOTOR_OJEK.slice(0, ojek).forEach((t, i) => pasang(t, WARNA_OJEK[i % WARNA_OJEK.length]!));
    MOTOR_OJOL.slice(0, ojol).forEach((t, i) => pasang(t, WARNA_OJOL[i % WARNA_OJOL.length]!));
    this.motor.count = n;
    this.motor.instanceMatrix.needsUpdate = true;
    if (this.motor.instanceColor) this.motor.instanceColor.needsUpdate = true;
  }
}

/** Gubuk beratap seng dengan bangku panjang dan papan "PANGKALAN OJEK" menghadap jalan. */
function gubukOjek(k: Kumpulan, m: PustakaMaterial): void {
  const { x, y0, y1 } = GUBUK_OJEK;
  // Setengah lebar 0,2 + tritisan 0,04: tetap di celah gang (ruko mulai 1,1 dari garis gerbang).
  const [xa, xb] = [x - 0.2, x + 0.2];
  const h = 0.62;
  for (const px of [xa + 0.02, xb - 0.02]) for (const py of [y0 + 0.02, y1 - 0.02]) k.tambah(m.kayu, silinder(px, py, 0.035, h, 0.014, 0.014, 5));
  k.tambah(m.atapRumah[4]!, kotak(xa - 0.04, y0 - 0.06, xb + 0.04, y1 + 0.06, h, h + 0.03));
  k.tambah(m.kontak, bayanganKontak(xa, y0, xb, y1, 0.12, 0.3), { bayangan: false, terimaBayangan: false });
  // Bangku kayu panjang.
  k.tambah(m.kayu, kotak(x - 0.1, y0 + 0.1, x + 0.06, y1 - 0.1, 0.12, 0.145));
  for (const py of [y0 + 0.15, y1 - 0.15]) k.tambah(m.besiGelap, kotak(x - 0.08, py - 0.01, x + 0.04, py + 0.01, 0.035, 0.12));
  // Papan nama di tepi atap, menghadap jalan (+y) dan menghadap gang (+x).
  const papan = m.teks('PANGKALAN OJEK', { lebar: 512, tinggi: 96, latar: '#f59e0b', warna: '#1f2937', ukuranHuruf: 60 });
  k.tambah(papan.material, persegiTegak([xa - 0.02, y1 + 0.07], [xb + 0.02, y1 + 0.07], h - 0.02, h + 0.14, papan.uv, 0.002), { bayangan: false });
  k.tambah(papan.material, persegiTegak([xb + 0.07, y1 - 0.05], [xb + 0.07, y0 + 0.05], h + 0.03, h + 0.17, papan.uv, 0.002), { bayangan: false });
}
