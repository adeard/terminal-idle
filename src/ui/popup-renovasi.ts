/**
 * Konfirmasi Renovasi (pengganti prestige): bonus yang didapat, apa yang
 * diulang dari awal, dan apa yang tetap. Renovasi tidak bisa dibatalkan,
 * jadi tombol di tab Terminal selalu lewat popup ini.
 */
import type { ModelRenovasi } from './model';
import { TEKS } from './teks';

const IKON_PALU = '<path d="M13.2 2.8l8 8-2.8 2.8-1.8-1.8-9.4 9.4a2 2 0 0 1-2.8 0l-.6-.6a2 2 0 0 1 0-2.8l9.4-9.4-1.8-1.8z" fill="currentColor"/>';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

const persen = (x: number): number => Math.round(x * 100);

/** @returns true kalau pemain memilih Renovasi. */
export function tampilkanPopupRenovasi(akar: HTMLElement, m: ModelRenovasi): Promise<boolean> {
  akar.querySelector('.popup-latar.latar-renovasi')?.remove();
  const latar = el('div', 'popup-latar latar-renovasi');
  const kotak = el('div', 'popup popup-kelas popup-renovasi');
  kotak.setAttribute('role', 'dialog');
  kotak.setAttribute('aria-modal', 'true');
  kotak.setAttribute('aria-labelledby', 'popup-renovasi-judul');
  const ikon = el('div', 'kelas-ikon');
  ikon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${IKON_PALU}</svg>`;
  const judul = el('h2', undefined, TEKS.renovasiPopupJudul);
  judul.id = 'popup-renovasi-judul';
  const teks = el('p', 'popup-catatan kelas-teks', TEKS.renovasiPopupTeks);
  const bonus = el('div', 'kelas-bonus-besar', TEKS.renovasiPopupBonus(persen(m.bonus), persen(m.bonusSetelah)));
  const daftar = el('ul', 'kelas-daftar');
  daftar.append(el('li', 'kelas-reset', TEKS.renovasiPopupReset), el('li', 'kelas-tetap', TEKS.renovasiPopupTetap));
  const ya = el('button', 'tombol tombol-hijau popup-tombol', TEKS.renovasi);
  ya.type = 'button';
  const nanti = el('button', 'pembaruan-nanti', TEKS.renovasiNanti);
  nanti.type = 'button';
  kotak.append(ikon, judul, teks, bonus, daftar, ya, nanti);
  latar.append(kotak);
  akar.append(latar);

  return new Promise((selesai) => {
    const tutup = (pilih: boolean): void => {
      window.removeEventListener('keydown', saatTombol);
      latar.remove();
      selesai(pilih);
    };
    const saatTombol = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') tutup(false);
    };
    ya.addEventListener('click', () => tutup(true));
    nanti.addEventListener('click', () => tutup(false));
    latar.addEventListener('click', (e) => {
      if (e.target === latar) tutup(false);
    });
    window.addEventListener('keydown', saatTombol);
  });
}
