/**
 * Gambar efek "+Rp" (isinya dari kas-visual.ts): label DOM kecil yang muncul
 * di tempat transaksi, naik perlahan, lalu memudar. Tetap menempel di titik
 * dunianya walau kamera bergeser, dan mengecil saat kamera menjauh seperti
 * label lain. Juga dipakai untuk "TELOLET!" di atas bus yang diketuk.
 */
import { formatAngka } from '../ui/format';
import type { PopUang, JenisPopUang } from './kas-visual';
import { IKON_TIKET, skalaJarak } from './label-bus3d';
import { TINGGI_LANTAI_GEDUNG, tinggiLantai } from './tata-letak';
import type { Proyektor } from './zona3d';

const NS_SVG = 'http://www.w3.org/2000/svg';
/** Sumber uang, atau klakson telolet. */
type JenisPop = JenisPopUang | 'telolet';
/** Ikon tiap jenis (viewBox 24, fill-rule evenodd). */
const IKON: Readonly<Record<JenisPop, string>> = {
  tiket: IKON_TIKET,
  // Bus tampak depan: kaca & dua lampu berlubang.
  retribusi: 'M6 3h12a3 3 0 0 1 3 3v11a1 1 0 0 1-1 1h-1v2.5h-3V18H8v2.5H5V18H4a1 1 0 0 1-1-1V6a3 3 0 0 1 3-3zM5.5 6.5v5h13v-5zM6 14v1.6h3V14zM15 14v1.6h3V14z',
  // Rambu parkir "P".
  parkir: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 7v10h2.4v-3.2h2.1a3.4 3.4 0 0 0 0-6.8zM11.4 9.2v2.4h1.9a1.2 1.2 0 0 0 0-2.4z',
  // Tas belanja.
  belanja: 'M5.2 8h13.6l1 13H4.2zM8.4 8V7a3.6 3.6 0 0 1 7.2 0v1h-1.8V7a1.8 1.8 0 0 0-3.6 0v1z',
  // Kios berkanopi dengan pintu.
  sewa: 'M4 4h16l1 5a2.6 2.6 0 0 1-4.6 1.6A2.6 2.6 0 0 1 12 10.6a2.6 2.6 0 0 1-4.4 0A2.6 2.6 0 0 1 3 9zM5 12.4h14V20H5zM10.2 15v5h3.6v-5z',
  // Not balok.
  telolet: 'M10 3.5l8.5 2.6v3.6L12 7.8V17a3.4 3 0 1 1-2-2.8z',
};
/** Umur efek (detik nyata); sewa kios harian lebih lama & lebih besar. */
const UMUR: Readonly<Record<JenisPop, number>> = { tiket: 1.5, retribusi: 1.8, parkir: 1.5, belanja: 1.5, sewa: 3.6, telolet: 1.8 };
/** Naik sejauh ini (px CSS, sebelum skala) selama umurnya. */
const NAIK_PX = 26;
const MUNCUL_DETIK = 0.15;
/** Mulai memudar setelah porsi umur ini. */
const MULAI_PUDAR = 0.6;
/** Efek bersamaan paling banyak; yang tertua dibuang dulu. */
const MAKS_POP = 32;
/**
 * Ketinggian jangkar (unit dunia) & geser ke atas (px) supaya tidak menutupi
 * cincin loket / cincin cuci bus di titik yang sama.
 */
const H_KEPALA = 0.45;
const JANGKAR: Readonly<Record<JenisPop, { readonly h: number | null; readonly geserPx: number }>> = {
  tiket: { h: TINGGI_LANTAI_GEDUNG + 0.5, geserPx: 30 },
  retribusi: { h: 1.02, geserPx: 30 },
  parkir: { h: null, geserPx: 0 },
  belanja: { h: null, geserPx: 0 },
  sewa: { h: null, geserPx: 12 },
  telolet: { h: 1.02, geserPx: 30 },
};

interface PopDom {
  readonly el: HTMLElement;
  readonly jenis: JenisPop;
  x: number;
  y: number;
  readonly h: number;
  /** Posisi terbaru benda yang diikuti (mis. bus yang melaju); null = sudah hilang, tetap di tempat terakhir. */
  readonly ikuti: (() => readonly [number, number] | null) | null;
  umur: number;
  tampil: boolean;
}

function buatEl(jenis: JenisPop, isi: string): HTMLElement {
  const e = document.createElement('div');
  e.className = `pop-uang pu-${jenis}`;
  const svg = document.createElementNS(NS_SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS(NS_SVG, 'path');
  path.setAttribute('d', IKON[jenis]);
  path.setAttribute('fill-rule', 'evenodd');
  svg.append(path);
  const teks = document.createElement('span');
  teks.textContent = isi;
  e.append(svg, teks);
  return e;
}

const pelan = (t: number): number => 1 - (1 - t) * (1 - t);

export class PopUang3D {
  private readonly aktif: PopDom[] = [];
  private readonly gerakPelan = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private readonly wadah: HTMLElement) {}

  tambah(daftar: readonly PopUang[]): void {
    for (const p of daftar) this.tambahSatu(p.jenis, p.x, p.y, `+Rp ${formatAngka(p.jumlah, { desimalKecil: 0 })}`);
  }

  /** "TELOLET!" di atas bus yang membunyikan klakson telolet (ikut bergerak bersama busnya). */
  tambahTelolet(x: number, y: number, teks: string, ikuti: () => readonly [number, number] | null): void {
    this.tambahSatu('telolet', x, y, teks, ikuti);
  }

  private tambahSatu(jenis: JenisPop, x: number, y: number, isi: string, ikuti: PopDom['ikuti'] = null): void {
    const h = JANGKAR[jenis].h ?? (tinggiLantai(x, y) ?? 0) + (jenis === 'sewa' ? 0.9 : H_KEPALA);
    const el = buatEl(jenis, isi);
    el.hidden = true;
    this.wadah.append(el);
    this.aktif.push({ el, jenis, x, y, h, ikuti, umur: 0, tampil: false });
    while (this.aktif.length > MAKS_POP) this.aktif.shift()!.el.remove();
  }

  /** @param dt detik nyata (efek tidak ikut dipercepat). */
  perbarui(dt: number, kamera: Proyektor, lebar: number, tinggi: number, jarakKamera: number): void {
    const skala = skalaJarak(jarakKamera);
    for (let i = this.aktif.length - 1; i >= 0; i--) {
      const p = this.aktif[i]!;
      p.umur += dt;
      const umur = UMUR[p.jenis];
      if (p.umur >= umur) {
        p.el.remove();
        this.aktif.splice(i, 1);
        continue;
      }
      const pos = p.ikuti?.();
      if (pos) [p.x, p.y] = pos;
      const q = kamera.proyeksi(p.x, p.y, p.h);
      const tampil = q.terlihat && q.x > -60 && q.x < lebar + 60 && q.y > 0 && q.y < tinggi + 60;
      if (tampil !== p.tampil) {
        p.tampil = tampil;
        p.el.hidden = !tampil;
      }
      if (!tampil) continue;
      const t = p.umur / umur;
      const naik = this.gerakPelan ? 0 : NAIK_PX * pelan(t);
      const dy = (JANGKAR[p.jenis].geserPx + naik) * skala;
      const muncul = Math.min(1, p.umur / MUNCUL_DETIK);
      const pudar = t < MULAI_PUDAR ? 1 : 1 - (t - MULAI_PUDAR) / (1 - MULAI_PUDAR);
      p.el.style.transform = `translate(${q.x.toFixed(1)}px, ${(q.y - dy).toFixed(1)}px) translate(-50%, -100%) scale(${(skala * (0.8 + 0.2 * muncul)).toFixed(3)})`;
      p.el.style.opacity = Math.min(muncul, pudar).toFixed(2);
    }
  }
}
