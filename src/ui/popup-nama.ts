/**
 * Popup ubah nama terminal (dari tombol ✎ di kartu kelas, tab Target): kolom
 * nama dengan pratinjau tulisan papan gapura. Nama dirapikan sim/profil.ts.
 */
import { MAKS_NAMA_TERMINAL, rapikanNamaTerminal } from '../sim/profil';
import { TEKS } from './teks';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

/** @returns nama baru yang sudah dirapikan (kosong = bawaan), atau null kalau dibatalkan. */
export function tanyaNamaTerminal(akar: HTMLElement, sekarang: string, kelas: string): Promise<string | null> {
  akar.querySelector('.popup-latar.latar-nama')?.remove();
  const latar = el('div', 'popup-latar latar-nama');
  const kotak = el('div', 'popup popup-nama');
  kotak.setAttribute('role', 'dialog');
  kotak.setAttribute('aria-modal', 'true');
  kotak.setAttribute('aria-labelledby', 'popup-nama-judul');
  const judul = el('h2', undefined, TEKS.namaJudul);
  judul.id = 'popup-nama-judul';
  const teks = el('p', 'popup-catatan', TEKS.namaTeks);
  const masukan = el('input', 'nama-masukan');
  masukan.type = 'text';
  masukan.value = sekarang;
  masukan.maxLength = MAKS_NAMA_TERMINAL + 9; // ruang untuk "Terminal " yang nanti dibuang
  masukan.placeholder = TEKS.namaContoh;
  masukan.autocomplete = 'off';
  masukan.spellcheck = false;
  masukan.enterKeyHint = 'done';
  masukan.setAttribute('aria-label', TEKS.namaJudul);
  const pratinjau = el('div', 'nama-pratinjau');
  const perbaruiPratinjau = (): void => {
    pratinjau.textContent = TEKS.namaPratinjau(rapikanNamaTerminal(masukan.value), kelas);
  };
  perbaruiPratinjau();
  masukan.addEventListener('input', perbaruiPratinjau);
  const simpan = el('button', 'tombol tombol-hijau popup-tombol', TEKS.namaSimpan);
  simpan.type = 'button';
  const batal = el('button', 'pembaruan-nanti', TEKS.namaBatal);
  batal.type = 'button';
  kotak.append(judul, teks, masukan, pratinjau, simpan, batal);
  latar.append(kotak);
  akar.append(latar);
  masukan.focus();
  masukan.select();
  return new Promise((selesai) => {
    const tutup = (hasil: string | null): void => {
      window.removeEventListener('keydown', saatTombol);
      latar.remove();
      selesai(hasil);
    };
    const saatTombol = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') tutup(null);
    };
    simpan.addEventListener('click', () => tutup(rapikanNamaTerminal(masukan.value)));
    masukan.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') tutup(rapikanNamaTerminal(masukan.value));
    });
    batal.addEventListener('click', () => tutup(null));
    latar.addEventListener('click', (e) => {
      if (e.target === latar) tutup(null);
    });
    window.addEventListener('keydown', saatTombol);
  });
}
