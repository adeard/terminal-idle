/**
 * Rambu penunjuk arah pelabuhan di median jalan raya, timur pintu keluar bus:
 * muncul setelah rute antarpulau dibuka (← MERAK ke Sumatra, PADANGBAI → ke
 * Nusa Tenggara lewat Bali; lihat antarpulau.ts). Hijau berbingkai putih
 * seperti rambu petunjuk jalan, bertulisan di kedua muka dengan panah yang
 * mengikuti sisi pembaca. Tiap keadaan satu grup mesh yang dibangun sekali,
 * hanya ditukar visibilitasnya.
 */
import * as THREE from 'three';
import { PELABUHAN_FERI, pelabuhanTerbuka } from './antarpulau';
import { Kumpulan, kotak, persegiTegak, silinder } from './geometri';
import type { PustakaMaterial } from './material3d';
import { HURUF_PAPAN, ikonKapal } from './tekstur3d';
import { MEDIAN } from './tata-letak';

/** Di median antara umbul-umbul (x 56,4 & 59,6) dan tiang lampu jalan (x 60), di bawah lampu hias. */
const RAMBU = { x: 58, y: (MEDIAN.y0 + MEDIAN.y1) / 2, lebar: 1.7, bawah: 0.84, atas: 1.42 } as const;
const TEKSTUR = { w: 512, h: 176 } as const;
const HIJAU = '#0a6b3a';

interface Baris {
  readonly nama: string;
  /** Panah di kiri (pelabuhan di kiri pembaca) atau kanan. */
  readonly kiri: boolean;
}

/** Satu muka rambu: latar hijau, bingkai putih, satu baris per pelabuhan (ikon kapal, nama, panah). */
function lukisMuka(ctx: CanvasRenderingContext2D, y0: number, baris: readonly Baris[]): void {
  const { w, h } = TEKSTUR;
  ctx.fillStyle = HIJAU;
  ctx.fillRect(0, y0, w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7;
  ctx.strokeRect(9, y0 + 9, w - 18, h - 18);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  const t = 40;
  baris.forEach((b, i) => {
    const y = y0 + (h * (i + 1)) / (baris.length + 1);
    // Panah tebal.
    const xp = b.kiri ? 58 : w - 58;
    const arah = b.kiri ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(xp + arah * 30, y);
    ctx.lineTo(xp - arah * 2, y - 24);
    ctx.lineTo(xp - arah * 2, y - 9);
    ctx.lineTo(xp - arah * 34, y - 9);
    ctx.lineTo(xp - arah * 34, y + 9);
    ctx.lineTo(xp - arah * 2, y + 9);
    ctx.lineTo(xp - arah * 2, y + 24);
    ctx.closePath();
    ctx.fill();
    // Ikon kapal & nama pelabuhan di antara panah.
    ctx.font = `800 ${t}px ${HURUF_PAPAN}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const teks = `PELABUHAN ${b.nama}`;
    const lebarTeks = Math.min(ctx.measureText(teks).width, w - 250);
    const ikon = t * 1.3;
    const x0 = w / 2 - (ikon + 12 + lebarTeks) / 2;
    ikonKapal(ctx, x0 + ikon / 2, y - 2, t * 0.8);
    ctx.fillText(teks, x0 + ikon + 12, y + 2, w - 250);
  });
}

export class RambuPelabuhan {
  readonly objek = new THREE.Group();
  /** Grup per keadaan, kunci "barat|timur" (nama pelabuhan atau kosong). */
  private readonly grup = new Map<string, THREE.Group>();

  constructor(m: PustakaMaterial) {
    const pelabuhan = Object.values(PELABUHAN_FERI);
    const barat = [null, ...new Set(pelabuhan.filter((p) => p.barat).map((p) => p.nama))];
    const timur = [null, ...new Set(pelabuhan.filter((p) => !p.barat).map((p) => p.nama))];
    const keadaan = barat.flatMap((b) => timur.map((t) => [b, t] as const)).filter(([b, t]) => b !== null || t !== null);
    // Satu kanvas berisi kedua muka tiap keadaan (baris ke bawah).
    const kanvas = document.createElement('canvas');
    kanvas.width = TEKSTUR.w;
    kanvas.height = TEKSTUR.h * keadaan.length * 2;
    const ctx = kanvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D tidak tersedia');
    const peta = new THREE.CanvasTexture(kanvas);
    peta.colorSpace = THREE.SRGBColorSpace;
    peta.anisotropy = 4;
    const bahan = new THREE.MeshStandardMaterial({ map: peta, roughness: 0.4, metalness: 0.1 });
    const H = kanvas.height;
    const uvBaris = (i: number): { u0: number; u1: number; v0: number; v1: number } => ({
      u0: 0.5 / TEKSTUR.w,
      u1: 1 - 0.5 / TEKSTUR.w,
      v0: 1 - (TEKSTUR.h * (i + 1) - 0.5) / H,
      v1: 1 - (TEKSTUR.h * i + 0.5) / H,
    });
    const { x, y, lebar, bawah, atas } = RAMBU;
    const x0 = x - lebar / 2;
    const x1 = x + lebar / 2;
    keadaan.forEach(([b, t], i) => {
      // Muka ke terminal (+y): barat di kiri pembaca. Muka ke kota (−y): barat di kanan.
      const ke = (kiriBarat: boolean): Baris[] => [
        ...(b ? [{ nama: b, kiri: kiriBarat }] : []),
        ...(t ? [{ nama: t, kiri: !kiriBarat }] : []),
      ];
      lukisMuka(ctx, TEKSTUR.h * (2 * i), ke(true));
      lukisMuka(ctx, TEKSTUR.h * (2 * i + 1), ke(false));
      const g = new THREE.Group();
      const k = new Kumpulan();
      for (const xt of [x0 + 0.16, x1 - 0.16]) k.tambah(m.besiGelap, silinder(xt, y, 0, atas + 0.02, 0.028, 0.028, 8));
      k.tambah(m.besiGelap, kotak(x0 - 0.02, y - 0.015, x1 + 0.02, y + 0.015, bawah - 0.02, atas + 0.02));
      k.tambah(bahan, persegiTegak([x0, y + 0.016], [x1, y + 0.016], bawah, atas, uvBaris(2 * i)), { bayangan: false });
      k.tambah(bahan, persegiTegak([x1, y - 0.016], [x0, y - 0.016], bawah, atas, uvBaris(2 * i + 1)), { bayangan: false });
      k.bangun(g);
      g.visible = false;
      this.grup.set(`${b ?? ''}|${t ?? ''}`, g);
      this.objek.add(g);
    });
  }

  /** @param jurusanBuka banyaknya jurusan terbuka: rambu menunjuk pelabuhan rute antarpulau yang sudah dibuka. */
  perbarui(jurusanBuka: number): void {
    const p = pelabuhanTerbuka(jurusanBuka);
    const kunci = `${p.barat ?? ''}|${p.timur ?? ''}`;
    for (const [k, g] of this.grup) g.visible = k === kunci;
  }
}
