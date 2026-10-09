/**
 * Penanda area di dunia 3D: sorotan merah berdenyut + garis tepi di tanah
 * (area yang membatasi arus jam sibuk), dan label DOM (nama area, "⚠ PALING
 * LAMBAT") yang mengikuti proyeksi kamera. Label DOM dipilih supaya teks tetap
 * tajam di semua zoom. Label hanya penanda (tidak bisa diketuk).
 */
import * as THREE from 'three';
import { WARNA, WARNA_TAHAP, keHexCss } from '../config/tema';
import { bottleneckState, type GameState } from '../sim/state';
import { TAHAP_IDS, type TahapId } from '../sim/tahap';
import { NAMA_TAHAP, TEKS } from '../ui/teks';
import { bidang, kotak } from './geometri';
import { ZONA } from './tata-letak';

export interface Proyektor {
  proyeksi(x: number, y: number, h: number): { x: number; y: number; terlihat: boolean };
}

interface TampilanZona {
  readonly sorotan: THREE.Mesh;
  readonly tepi: THREE.Mesh;
  readonly label: HTMLElement;
  readonly lambat: HTMLElement;
  /** Lebar label terakhir (px) dan isi yang tampil saat diukur; diukur ulang hanya bila isinya berubah. */
  lebarLabel: number;
  kunciLabel: string;
}

function el(kelas: string, teks?: string): HTMLElement {
  const e = document.createElement('div');
  e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

export class ZonaTahap {
  private readonly zona = {} as Record<TahapId, TampilanZona>;
  private readonly matSorotan = new THREE.MeshBasicMaterial({ color: WARNA.bottleneck, transparent: true, opacity: 0.15, depthWrite: false });
  private readonly matTepi = new THREE.MeshBasicMaterial({ color: WARNA.bottleneck, toneMapped: false });

  constructor(induk: THREE.Object3D, wadahLabel: HTMLElement) {
    for (const id of TAHAP_IDS) {
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
      label.style.setProperty('--warna', keHexCss(WARNA_TAHAP[id]));
      const lambat = el('lz-lambat', `⚠ ${TEKS.palingLambat}`);
      const baris = el('lz-baris');
      const nama = el('lz-nama');
      nama.append(el('lz-teks', NAMA_TAHAP[id].toUpperCase()));
      baris.append(nama);
      label.append(lambat, baris);
      wadahLabel.append(label);
      this.zona[id] = { sorotan, tepi, label, lambat, lebarLabel: 0, kunciLabel: '' };
    }
  }

  perbarui(state: GameState, waktu: number, kamera: Proyektor, lebar: number, tinggi: number): void {
    const lambat = bottleneckState(state);
    const denyut = 0.5 + 0.5 * Math.sin(waktu * 5.9);
    this.matSorotan.opacity = 0.12 + 0.2 * denyut;
    for (const id of TAHAP_IDS) {
      const z = this.zona[id];
      const isLambat = lambat === id;
      z.sorotan.visible = isLambat;
      z.tepi.visible = isLambat && denyut > 0.25;
      z.lambat.hidden = !isLambat;

      const [x, y, h] = ZONA[id].label;
      const p = kamera.proyeksi(x, y, h);
      z.label.hidden = !p.terlihat;
      if (p.terlihat) {
        // Tetap di dalam layar supaya label di tepi tidak terpotong. Membaca offsetWidth
        // tiap frame memaksa layout ulang seluruh halaman, jadi lebar disimpan per isi label.
        const kunci = String(isLambat);
        if (kunci !== z.kunciLabel || z.lebarLabel === 0) {
          z.kunciLabel = kunci;
          z.lebarLabel = z.label.offsetWidth;
        }
        const setengah = z.lebarLabel / 2 + 4;
        const lx = Math.min(Math.max(p.x, setengah), lebar - setengah);
        const ly = Math.min(Math.max(p.y, 56), tinggi - 4);
        z.label.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) translate(-50%, -100%)`;
      }
    }
  }
}
