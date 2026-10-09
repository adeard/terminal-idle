/**
 * Rolling door yang turun saat toko/kios/loket tutup (lihat jam buka di
 * kehidupan-malam.ts): apotek di aula (minimarket buka 24 jam), tiga kios di
 * ruang tunggu, dan jendela loket yang tidak dipakai mitra PO atau tutup di
 * malam hari. Tiap toko aula & kios juga tertutup selama unitnya belum
 * dibangun (lihat fasilitasAdegan), begitu juga gerbang ruang tunggu milik
 * jalur yang belum dibangun (dengan papan SEGERA DIBUKA di kedua sisi). Tiap
 * pintu satu grup mesh yang ditukar visibilitasnya.
 */
import * as THREE from 'three';
import { tokoDibangun, type FasilitasAdegan } from './fasilitas-adegan';
import { kotak, Kumpulan, persegiTegak } from './geometri';
import { loketBuka, tokoBuka, type JenisToko } from './kehidupan-malam';
import type { PustakaMaterial } from './material3d';
import { GERBANG_X, KIOS_TUNGGU, LOKET, RUANG_TUNGGU, TINGGI_LANTAI_GEDUNG, TINGGI_PERON, TOKO_AULA, X_LOKET, X_MUKA_KIOS, Y_MUKA_TOKO } from './tata-letak';

const PENUH = { u0: 0, v0: 0, u1: 1, v1: 1 } as const;

/** Tekstur pintu gulung: lembaran seng bergelombang mendatar. */
function teksturRolling(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia');
  const g = ctx.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, '#c9ced4');
  g.addColorStop(0.45, '#aeb4bb');
  g.addColorStop(0.55, '#8d949c');
  g.addColorStop(1, '#c2c7cd');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 7);
  return t;
}

/** Keadaan terminal yang menentukan pintu mana yang tertutup. */
interface KeadaanPintu {
  readonly jam: number;
  /** Jendela loket yang dipakai mitra PO di siang hari (lihat jendelaDipakai di perluasan-adegan.ts). */
  readonly jendela: number;
  /** Kios & toko yang sudah dibangun (per unit). */
  readonly fasilitas: Pick<FasilitasAdegan, 'kios' | 'toko'>;
  /** Jalur bus yang sudah dibangun (gerbang JALUR 1 … jalur terbuka). */
  readonly jalur: number;
}

interface Pintu {
  readonly grup: THREE.Group;
  readonly tutup: (k: KeadaanPintu) => boolean;
}

export class RollingDoor {
  readonly objek = new THREE.Group();
  private readonly pintu: Pintu[] = [];
  private readonly material: THREE.MeshStandardMaterial;

  constructor(m: PustakaMaterial) {
    this.material = new THREE.MeshStandardMaterial({ map: teksturRolling(), roughness: 0.55, metalness: 0.45 });
    const h0 = TINGGI_LANTAI_GEDUNG;
    // Toko di aula (menghadap selatan).
    for (const t of TOKO_AULA) {
      const jenis: JenisToko = t.nama === 'MINIMARKET' ? 'minimarket' : 'apotek';
      this.tambah(
        (k) => !tokoDibangun(k.fasilitas, jenis) || !tokoBuka(jenis, k.jam),
        (k) => {
          const y = Y_MUKA_TOKO + 0.035;
          k.tambah(this.material, persegiTegak([t.x0 + 0.01, y], [t.x1 - 0.01, y], h0, h0 + 0.61, PENUH, 0));
          k.tambah(m.besiGelap, kotak(t.x0, y - 0.01, t.x1, y + 0.04, h0 + 0.6, h0 + 0.66));
        },
      );
    }
    // Kios di ruang tunggu (menghadap timur).
    KIOS_TUNGGU.forEach(([ya, yb], i) => {
      this.tambah(
        (k) => k.fasilitas.kios <= i || !tokoBuka('kios', k.jam),
        (k) => {
          const x = X_MUKA_KIOS;
          k.tambah(this.material, persegiTegak([x, yb - 0.02], [x, ya + 0.02], TINGGI_PERON, TINGGI_PERON + 0.5, PENUH, 0));
          k.tambah(m.besiGelap, kotak(x - 0.03, ya, x + 0.02, yb, TINGGI_PERON + 0.49, TINGGI_PERON + 0.53));
        },
      );
    });
    // Jendela loket: rolling door di balik kaca (sisi pembeli) dengan tulisan TUTUP.
    const tulisan = m.teks('TUTUP', { lebar: 128, tinggi: 48, latar: '#b91c1c', warna: '#ffffff', ukuranHuruf: 32 });
    X_LOKET.forEach((x, i) => {
      this.tambah(
        (k) => !loketBuka(k.jam, k.jendela).includes(i),
        (k) => {
          const w = LOKET.setengahLebar;
          const y = LOKET.yMeja - 0.085;
          const hMeja = h0 + 0.2;
          k.tambah(this.material, persegiTegak([x - w + 0.03, y], [x + w - 0.03, y], hMeja + 0.025, h0 + 0.45, PENUH, 0));
          k.tambah(tulisan.material, persegiTegak([x - 0.12, y + 0.004], [x + 0.12, y + 0.004], hMeja + 0.1, hMeja + 0.19, tulisan.uv, 0), { bayangan: false });
        },
      );
    });
    // Gerbang JALUR yang belum dibangun: pintu gulung di ambang gerbang, bertulisan di kedua sisi.
    const papanTutup = m.teks('SEGERA DIBUKA', { lebar: 256, tinggi: 64, latar: '#475569', warna: '#e2e8f0', ukuranHuruf: 26 });
    const hPintu = TINGGI_PERON + 0.61;
    GERBANG_X.forEach((g, i) => {
      if (i === 0) return; // jalur 1 selalu ada
      this.tambah(
        (k) => k.jalur <= i,
        (k) => {
          const y = RUANG_TUNGGU.y0;
          for (const arah of [1, -1]) {
            const yy = y + arah * 0.014;
            const [a, b] = arah > 0 ? ([g - 0.19, g + 0.19] as const) : ([g + 0.19, g - 0.19] as const);
            k.tambah(this.material, persegiTegak([a, yy], [b, yy], TINGGI_PERON, hPintu, PENUH, 0));
            const [pa, pb] = arah > 0 ? ([g - 0.15, g + 0.15] as const) : ([g + 0.15, g - 0.15] as const);
            k.tambah(papanTutup.material, persegiTegak([pa, yy + arah * 0.004], [pb, yy + arah * 0.004], TINGGI_PERON + 0.3, TINGGI_PERON + 0.375, papanTutup.uv, 0), { bayangan: false });
          }
          k.tambah(m.besiGelap, kotak(g - 0.21, y - 0.03, g + 0.21, y + 0.03, hPintu - 0.01, hPintu + 0.035));
        },
      );
    });
  }

  /**
   * @param jam jam terminal (0–24)
   * @param jendela jendela loket yang dipakai mitra PO di siang hari: jendela lain tertutup
   * @param fasilitas kios & toko yang sudah dibangun: unit lain tertutup
   * @param jalur jalur bus yang sudah dibangun: gerbang jalur lain tertutup
   */
  perbarui(jam: number, jendela: number, fasilitas: Pick<FasilitasAdegan, 'kios' | 'toko'>, jalur = GERBANG_X.length): void {
    const k: KeadaanPintu = { jam, jendela, fasilitas, jalur };
    for (const p of this.pintu) p.grup.visible = p.tutup(k);
  }

  private tambah(tutup: (k: KeadaanPintu) => boolean, bangun: (k: Kumpulan) => void): void {
    const grup = new THREE.Group();
    const k = new Kumpulan();
    bangun(k);
    k.bangun(grup);
    grup.visible = false;
    this.objek.add(grup);
    this.pintu.push({ grup, tutup });
  }
}
