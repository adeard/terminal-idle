/**
 * Papan jadwal keberangkatan (aula & papan digital ruang tunggu) yang isinya
 * diambil dari bus yang benar-benar ada (lihat jadwal.ts): kanvas digambar ulang
 * hanya saat isinya berubah, lalu dipasang sebagai tekstur material jadwal
 * yang sudah ada (tidak ada shader baru).
 */
import * as THREE from 'three';
import type { BarisJadwal, StatusJadwal } from './jadwal';
import type { PustakaMaterial } from './material3d';

const W = 512;
const H = 288;
const WARNA_STATUS: Readonly<Record<StatusJadwal, string>> = {
  NAIK: '#4ade80',
  SIAP: '#38bdf8',
  PERSIAPAN: '#fbbf24',
  BERANGKAT: '#94a3b8',
  TERLAMBAT: '#f87171',
};

export class PapanJadwal {
  private readonly kanvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tekstur: THREE.CanvasTexture;
  private kunciLalu = '';

  constructor(m: PustakaMaterial) {
    this.kanvas.width = W;
    this.kanvas.height = H;
    const ctx = this.kanvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D tidak tersedia');
    this.ctx = ctx;
    this.tekstur = new THREE.CanvasTexture(this.kanvas);
    this.tekstur.colorSpace = THREE.SRGBColorSpace;
    const mat = m.jadwal as THREE.MeshStandardMaterial;
    mat.map = this.tekstur;
    mat.emissiveMap = this.tekstur;
  }

  /** @param jam jam terminal sekarang "HH.MM" (di pojok kanan atas papan) */
  perbarui(baris: readonly BarisJadwal[], jam: string): void {
    const kunci = jam + baris.map((b) => `${b.jam}${b.tujuan}${b.jalur}${b.status}`).join('|');
    if (kunci === this.kunciLalu) return;
    this.kunciLalu = kunci;
    const ctx = this.ctx;
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 0, W, 50);
    ctx.textBaseline = 'middle';
    ctx.font = '800 26px system-ui, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText('KEBERANGKATAN', 16, 27);
    ctx.textAlign = 'right';
    ctx.font = '700 26px ui-monospace, Consolas, monospace';
    ctx.fillText(jam, W - 14, 27);
    // Kepala kolom.
    ctx.font = '700 15px ui-monospace, Consolas, monospace';
    ctx.fillStyle = '#93a1b1';
    ctx.textAlign = 'left';
    ctx.fillText('JAM', 16, 64);
    ctx.fillText('TUJUAN', 104, 64);
    ctx.fillText('JLR', 298, 64);
    ctx.fillText('STATUS', 350, 64);
    ctx.font = '700 23px ui-monospace, Consolas, monospace';
    if (baris.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.fillText('BELUM ADA JADWAL', 16, 110);
    }
    baris.forEach((b, i) => {
      const y = 98 + i * 38;
      if (i % 2 === 1) {
        ctx.fillStyle = '#111a30';
        ctx.fillRect(0, y - 19, W, 38);
      }
      ctx.fillStyle = b.status === 'BERANGKAT' ? '#94a3b8' : '#fbbf24';
      ctx.fillText(b.jam, 16, y);
      ctx.fillText(b.tujuan.slice(0, 11), 104, y);
      ctx.fillText(b.jalur, 306, y);
      ctx.fillStyle = WARNA_STATUS[b.status];
      ctx.fillText(b.status, 350, y);
    });
    this.tekstur.needsUpdate = true;
  }
}
