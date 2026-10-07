/**
 * Tombol akun bulat di kolom kontrol adegan; membuka menu akun (popup-akun.ts).
 * Titik hijau = sedang login.
 */
import { TEKS } from './teks';

const SVG_ORANG = '<circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 20.5a8 8 0 0 1 16 0z" fill="currentColor"/>';

export function pasangTombolAkun(induk: HTMLElement, masuk: boolean, saatKetuk: () => void): void {
  const tombol = document.createElement('button');
  tombol.type = 'button';
  tombol.className = 'tombol-akun';
  tombol.classList.toggle('masuk', masuk);
  tombol.title = TEKS.akunTombol;
  tombol.setAttribute('aria-label', TEKS.akunTombol);
  tombol.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SVG_ORANG}</svg>`;
  tombol.addEventListener('click', saatKetuk);
  induk.append(tombol);
}
