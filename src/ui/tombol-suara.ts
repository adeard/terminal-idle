/**
 * Tombol suara nyala/mati, melayang di pojok kanan atas area adegan.
 * Pilihannya disimpan oleh mesin suara (platform/suara.ts).
 */
import { TEKS } from './teks';

const SVG_SPEAKER = '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>';
const SVG_NYALA = `${SVG_SPEAKER}<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
const SVG_MATI = `${SVG_SPEAKER}<path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;

export interface PengaturSuara {
  readonly nyala: boolean;
  aturNyala(nyala: boolean): void;
}

export function pasangTombolSuara(induk: HTMLElement, suara: PengaturSuara): void {
  const tombol = document.createElement('button');
  tombol.type = 'button';
  tombol.className = 'tombol-suara';
  const tampilkan = (): void => {
    const nyala = suara.nyala;
    tombol.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${nyala ? SVG_NYALA : SVG_MATI}</svg>`;
    tombol.classList.toggle('mati', !nyala);
    const label = nyala ? TEKS.suaraNyala : TEKS.suaraMati;
    tombol.title = label;
    tombol.setAttribute('aria-label', label);
  };
  tombol.addEventListener('click', () => {
    suara.aturNyala(!suara.nyala);
    tampilkan();
  });
  tampilkan();
  induk.append(tombol);
}
