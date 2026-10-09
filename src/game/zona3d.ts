/**
 * Penanda area di dunia 3D: sorotan merah berdenyut + garis tepi di tanah
 * (area yang membatasi arus jam sibuk), dan label DOM nama area yang mengikuti
 * proyeksi kamera. Label DOM dipilih supaya teks tetap tajam di semua zoom.
 * Label pangkalan hanya tampil saat pangkalan paling lambat. Label bisa
 * diketuk (lihat areaDiKetuk): lapisan label tidak menerima
 * pointer, jadi geser kamera tetap jalan, dan ketukan di kanvas dicocokkan
 * dengan kotak label terakhir.
 */
import * as THREE from 'three';
import { WARNA, WARNA_AREA, keHexCss } from '../config/tema';
import { AREA_IDS, type AreaId } from '../sim/operasi';
import { bottleneckState, type GameState } from '../sim/state';
import { NAMA_AREA } from '../ui/teks';
import { bidang, kotak } from './geometri';
import { ZONA } from './tata-letak';

export interface Proyektor {
  proyeksi(x: number, y: number, h: number): { x: number; y: number; terlihat: boolean };
}

/** Kotak label yang tampil (piksel CSS di wadah label), untuk mencocokkan ketukan. */
interface KotakLabel {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface TampilanZona {
  readonly sorotan: THREE.Mesh;
  readonly tepi: THREE.Mesh;
  readonly label: HTMLElement;
  /** Ukuran label (px), diukur sekali saat pertama tampil: isinya tetap. */
  lebarLabel: number;
  tinggiLabel: number;
  /** Kotak label frame terakhir; null = tidak tampil. */
  kotak: KotakLabel | null;
}

/** Kelonggaran kotak ketuk di sekitar label (px CSS): label kecil tetap mudah diketuk jari. */
const LONGGAR_KETUK = 10;

function el(kelas: string, teks?: string): HTMLElement {
  const e = document.createElement('div');
  e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

export class ZonaArea {
  private readonly zona = {} as Record<AreaId, TampilanZona>;
  private readonly matSorotan = new THREE.MeshBasicMaterial({ color: WARNA.bottleneck, transparent: true, opacity: 0.15, depthWrite: false });
  private readonly matTepi = new THREE.MeshBasicMaterial({ color: WARNA.bottleneck, toneMapped: false });

  constructor(induk: THREE.Object3D, wadahLabel: HTMLElement) {
    for (const id of AREA_IDS) {
      const z = ZONA[id];
      const lantai: THREE.BufferGeometry[] = [];
      const garis: THREE.BufferGeometry[] = [];
      for (const b of z.balok) {
        // Lantai & garis sorotan hanya untuk area yang lantainya terlihat (terbuka atau beratap kaca).
        if (!(b.sorot ?? b.tinggi <= 2)) continue;
        const hl = b.hLantai ?? 0;
        lantai.push(bidang(b.x0, b.y0, b.x1, b.y1, hl + 0.04));
        const t = 0.07;
        const h0 = hl + 0.035;
        const h1 = hl + 0.06;
        garis.push(
          kotak(b.x0, b.y0, b.x1, b.y0 + t, h0, h1),
          kotak(b.x0, b.y1 - t, b.x1, b.y1, h0, h1),
          kotak(b.x0, b.y0, b.x0 + t, b.y1, h0, h1),
          kotak(b.x1 - t, b.y0, b.x1, b.y1, h0, h1),
        );
      }
      const gabung = (daftar: THREE.BufferGeometry[]): THREE.BufferGeometry => {
        const g = new THREE.BufferGeometry();
        const pos: number[] = [];
        for (const d of daftar) {
          const nd = d.toNonIndexed();
          pos.push(...(nd.getAttribute('position').array as Float32Array));
          nd.dispose();
          d.dispose();
        }
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        return g;
      };
      const sorotan = new THREE.Mesh(gabung(lantai), this.matSorotan);
      const tepi = new THREE.Mesh(gabung(garis), this.matTepi);
      for (const mesh of [sorotan, tepi]) {
        mesh.renderOrder = 5;
        mesh.visible = false;
        induk.add(mesh);
      }

      const label = el('label-zona');
      label.style.setProperty('--warna', keHexCss(WARNA_AREA[id]));
      const baris = el('lz-baris');
      const nama = el('lz-nama');
      // Panah kecil: label bisa diketuk untuk membuka tab Bangun area ini.
      nama.append(el('lz-teks', NAMA_AREA[id].toUpperCase()), el('lz-panah', '›'));
      baris.append(nama);
      label.append(baris);
      label.hidden = true;
      wadahLabel.append(label);
      this.zona[id] = { sorotan, tepi, label, lebarLabel: 0, tinggiLabel: 0, kotak: null };
    }
  }

  perbarui(state: GameState, waktu: number, kamera: Proyektor, lebar: number, tinggi: number): void {
    const lambat = bottleneckState(state);
    const denyut = 0.5 + 0.5 * Math.sin(waktu * 5.9);
    this.matSorotan.opacity = 0.12 + 0.2 * denyut;
    for (const id of AREA_IDS) {
      const z = this.zona[id];
      const isLambat = lambat === id;
      z.sorotan.visible = isLambat;
      z.tepi.visible = isLambat && denyut > 0.25;

      const [x, y, h] = ZONA[id].label;
      const p = kamera.proyeksi(x, y, h);
      // Pangkalan tidak punya label tetap (sudah ada papan PANGKALAN BUS): hanya saat paling lambat.
      const tampil = p.terlihat && (id !== 'pangkalan' || isLambat);
      z.label.hidden = !tampil;
      if (!tampil) {
        z.kotak = null;
        continue;
      }
      // Tetap di dalam layar supaya label di tepi tidak terpotong. Membaca offsetWidth
      // tiap frame memaksa layout ulang seluruh halaman, jadi ukuran label disimpan.
      if (z.lebarLabel === 0) {
        z.lebarLabel = z.label.offsetWidth;
        z.tinggiLabel = z.label.offsetHeight;
      }
      const setengah = z.lebarLabel / 2 + 4;
      const lx = Math.min(Math.max(p.x, setengah), lebar - setengah);
      const ly = Math.min(Math.max(p.y, 56), tinggi - 4);
      z.label.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) translate(-50%, -100%)`;
      const k = z.kotak ?? (z.kotak = { x0: 0, y0: 0, x1: 0, y1: 0 });
      k.x0 = lx - z.lebarLabel / 2;
      k.x1 = lx + z.lebarLabel / 2;
      k.y0 = ly - z.tinggiLabel;
      k.y1 = ly;
    }
  }

  /**
   * Area yang labelnya diketuk di (x, y) piksel CSS (relatif wadah label = kanvas),
   * dengan kelonggaran untuk jari; bila beberapa, yang pusatnya terdekat. null = tidak ada.
   */
  areaDiKetuk(x: number, y: number): AreaId | null {
    let terbaik: AreaId | null = null;
    let jarakTerbaik = Number.POSITIVE_INFINITY;
    for (const id of AREA_IDS) {
      const k = this.zona[id].kotak;
      if (!k) continue;
      if (x < k.x0 - LONGGAR_KETUK || x > k.x1 + LONGGAR_KETUK || y < k.y0 - LONGGAR_KETUK || y > k.y1 + LONGGAR_KETUK) continue;
      const jarak = Math.hypot(x - (k.x0 + k.x1) / 2, y - (k.y0 + k.y1) / 2);
      if (jarak < jarakTerbaik) {
        jarakTerbaik = jarak;
        terbaik = id;
      }
    }
    return terbaik;
  }
}
