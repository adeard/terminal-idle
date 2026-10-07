/**
 * Popup hadiah iklan berhadiah (boost pendapatan, Bus Emas): ikon, judul,
 * penjelasan, besar hadiah, tombol "Tonton iklan" dan "Nanti". Hadiah hanya
 * diberikan pemanggil kalau iklan selesai ditonton; kalau dilewati, popup tetap
 * terbuka dengan keterangan supaya pemain bisa mencoba lagi atau menolak.
 */
import { TEKS } from './teks';

export interface OpsiPopupHadiah {
  /** Kelas tambahan kotak popup (warna tema). */
  readonly kelas: string;
  /** Isi SVG ikon (viewBox 24). */
  readonly ikon: string;
  readonly judul: string;
  readonly teks: string;
  /** Besar hadiah, mis. "+30 menit" atau "+Rp 12 rb". */
  readonly hadiah: string;
  /** Keterangan kecil di bawah hadiah (mis. sisa boost), boleh kosong. */
  readonly catatan?: string;
  /** Label tombol iklan; `bisa` false = tombol nonaktif (mis. boost penuh). */
  readonly tombol: string;
  readonly bisa: boolean;
  /** Putar iklan; true = selesai ditonton (hadiah sudah diberikan pemanggil). */
  tonton(): Promise<boolean>;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

/** @returns true kalau hadiah diterima, false kalau pemain memilih "Nanti". */
export function tampilkanPopupHadiah(akar: HTMLElement, o: OpsiPopupHadiah): Promise<boolean> {
  akar.querySelector('.popup-latar.latar-hadiah')?.remove();
  const latar = el('div', 'popup-latar latar-hadiah');
  const kotak = el('div', `popup popup-hadiah ${o.kelas}`);
  kotak.setAttribute('role', 'dialog');
  kotak.setAttribute('aria-modal', 'true');
  kotak.setAttribute('aria-labelledby', 'popup-hadiah-judul');
  const ikon = el('div', 'hadiah-ikon');
  ikon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${o.ikon}</svg>`;
  const judul = el('h2', undefined, o.judul);
  judul.id = 'popup-hadiah-judul';
  const teks = el('p', 'popup-catatan hadiah-teks', o.teks);
  const jumlah = el('div', 'popup-jumlah hadiah-jumlah', o.hadiah);
  const catatan = el('p', 'hadiah-catatan', o.catatan ?? '');
  const pesan = el('p', 'hadiah-pesan');
  const tonton = el('button', 'tombol tombol-iklan popup-tombol');
  tonton.type = 'button';
  tonton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${IKON_PUTAR}</svg>`;
  tonton.append(el('span', undefined, o.tombol));
  tonton.disabled = !o.bisa;
  const nanti = el('button', 'pembaruan-nanti', TEKS.hadiahNanti);
  nanti.type = 'button';
  kotak.append(ikon, judul, teks, jumlah);
  if (o.catatan) kotak.append(catatan);
  kotak.append(tonton, pesan, nanti);
  latar.append(kotak);
  akar.append(latar);

  return new Promise((selesai) => {
    let sibuk = false;
    const tutup = (diterima: boolean): void => {
      window.removeEventListener('keydown', saatTombol);
      latar.remove();
      selesai(diterima);
    };
    const saatTombol = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !sibuk) tutup(false);
    };
    tonton.addEventListener('click', () => {
      if (sibuk) return;
      sibuk = true;
      tonton.disabled = true;
      nanti.disabled = true;
      pesan.textContent = '';
      void o.tonton().then(
        (ok) => {
          sibuk = false;
          if (ok) return tutup(true);
          tonton.disabled = !o.bisa;
          nanti.disabled = false;
          pesan.textContent = TEKS.iklanTanpaHadiah;
        },
        () => {
          sibuk = false;
          tonton.disabled = !o.bisa;
          nanti.disabled = false;
          pesan.textContent = TEKS.iklanGagal;
        },
      );
    });
    nanti.addEventListener('click', () => tutup(false));
    latar.addEventListener('click', (e) => {
      if (e.target === latar && !sibuk) tutup(false);
    });
    window.addEventListener('keydown', saatTombol);
  });
}

/** Ikon "putar iklan" (segitiga dalam layar). */
export const IKON_PUTAR = '<rect x="2.5" y="4.5" width="19" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>';
/** Ikon petir (boost). */
export const IKON_BOOST = '<path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.2z" fill="currentColor"/>';
/** Ikon bus (Bus Emas). */
export const IKON_BUS_EMAS =
  '<rect x="3.5" y="3" width="17" height="15" rx="3" fill="currentColor"/><rect x="5.5" y="5.5" width="13" height="5.5" rx="1" fill="#0b1117" opacity="0.45"/><circle cx="8" cy="14.5" r="1.4" fill="#0b1117" opacity="0.5"/><circle cx="16" cy="14.5" r="1.4" fill="#0b1117" opacity="0.5"/><rect x="5.5" y="18" width="3" height="3" rx="1" fill="currentColor"/><rect x="15.5" y="18" width="3" height="3" rx="1" fill="currentColor"/>';
