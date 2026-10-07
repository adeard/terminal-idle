/**
 * Konfirmasi naik kelas terminal (prestige): bonus yang didapat, apa yang
 * diulang dari awal, apa yang tetap, dan hadiah mitra PO. Naik kelas tidak
 * bisa dibatalkan, jadi tombol di tab Target selalu lewat popup ini.
 */
import type { ModelKelas } from './model';
import { namaKelas, NAMA_KELAS_BUS, NAMA_PO, TEKS } from './teks';

const IKON_BINTANG = '<path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z" fill="currentColor"/>';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

const persen = (x: number): number => Math.round(x * 100);

/** @returns true kalau pemain memilih naik kelas. */
export function tampilkanPopupKelas(akar: HTMLElement, m: ModelKelas): Promise<boolean> {
  akar.querySelector('.popup-latar.latar-kelas')?.remove();
  const berikut = namaKelas(m.kelas + 1);
  const latar = el('div', 'popup-latar latar-kelas');
  const kotak = el('div', 'popup popup-kelas');
  kotak.setAttribute('role', 'dialog');
  kotak.setAttribute('aria-modal', 'true');
  kotak.setAttribute('aria-labelledby', 'popup-kelas-judul');
  const ikon = el('div', 'kelas-ikon');
  ikon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${IKON_BINTANG}</svg>`;
  const judul = el('h2', undefined, TEKS.kelasPopupJudul(berikut));
  judul.id = 'popup-kelas-judul';
  const teks = el('p', 'popup-catatan kelas-teks', TEKS.kelasPopupTeks(berikut));
  const bonus = el('div', 'kelas-bonus-besar', TEKS.kelasPopupBonus(persen(m.bonus), persen(m.bonusSetelah)));
  const daftar = el('ul', 'kelas-daftar');
  daftar.append(el('li', 'kelas-reset', TEKS.kelasPopupReset), el('li', 'kelas-tetap', TEKS.kelasPopupTetap));
  if (m.poHadiah) daftar.append(el('li', 'kelas-hadiah', TEKS.kelasPopupHadiah(NAMA_PO[m.poHadiah].nama)));
  for (const k of m.kelasBusTerbuka) daftar.append(el('li', 'kelas-hadiah', TEKS.kelasPopupKelasBus(NAMA_KELAS_BUS[k].nama)));
  const ya = el('button', 'tombol tombol-hijau popup-tombol', TEKS.naikKelas);
  ya.type = 'button';
  const nanti = el('button', 'pembaruan-nanti', TEKS.kelasPopupNanti);
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
