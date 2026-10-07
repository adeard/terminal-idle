/**
 * Mode sinema untuk merekam video promosi (TikTok/Reels) dengan perekam layar
 * HP. Tombol film di kolom kontrol membuka pilihan kecepatan waktu & cuaca;
 * setelah "Mulai", semua tampilan & label disembunyikan (adegan memenuhi layar,
 * lihat bingkai.ts), kamera berputar pelan, dan hanya ada tanda kecil
 * bustation.games berjam di pojok. Ketuk layar atau Esc untuk keluar. Hanya
 * tampilan yang berubah: ekonomi tetap berjalan normal.
 */
import type { Analitik } from '../app/analitik';
import { TEKS } from './teks';

export type WaktuSinema = 'cepat' | 'sedang' | 'asli';
export type CuacaSinema = 'jadwal' | 'cerah' | 'hujan';

export interface PengaturanSinema {
  readonly waktu: WaktuSinema;
  readonly cuaca: CuacaSinema;
}

export interface OpsiTombolSinema {
  /** #akar: diberi kelas `sinema` (menyembunyikan #ui & label) dan tempat tanda pojok. */
  readonly akar: HTMLElement;
  /** Tempat popup pilihan (overlay UI). */
  readonly ui: HTMLElement;
  readonly mulai: (p: PengaturanSinema) => void;
  readonly selesai: () => void;
  /** Jam tampilan adegan (0–24), untuk jam di tanda pojok. */
  readonly jam: () => number;
  readonly analitik: Analitik;
}

const WAKTU: readonly WaktuSinema[] = ['cepat', 'sedang', 'asli'];
const CUACA: readonly CuacaSinema[] = ['jadwal', 'cerah', 'hujan'];
/** Papan klapper film (viewBox 24). */
const IKON_FILM =
  '<path d="M4 9.6h16V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" fill="currentColor"/><path d="M4.1 8.2 18.5 4.3l.7 2.4L4.8 10.6z" fill="currentColor"/><path d="M7.5 7.3l2.2 2.4M11.3 6.3l2.2 2.4M15.1 5.2l2.2 2.4" stroke="#0b1117" stroke-width="1.3"/><path d="M10.4 12.4v5.2l4.4-2.6z" fill="#0b1117"/>';
/** Tampilan di pojok hanya selama ini setelah mode dimulai. */
const LAMA_PETUNJUK_MS = 2500;
/** Ketukan yang memulai mode tidak boleh langsung mengakhirinya. */
const JEDA_KELUAR_MS = 300;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

/** "HH:MM" dari jam desimal. */
export function teksJam(jam: number): string {
  const menit = Math.floor((((jam % 24) + 24) % 24) * 60);
  return `${String(Math.floor(menit / 60)).padStart(2, '0')}:${String(menit % 60).padStart(2, '0')}`;
}

export function pasangTombolSinema(induk: HTMLElement, o: OpsiTombolSinema): void {
  const b = el('button', 'tombol-kamera tombol-sinema');
  b.type = 'button';
  b.title = TEKS.sinemaTombol;
  b.setAttribute('aria-label', TEKS.sinemaTombol);
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${IKON_FILM}</svg>`;
  // Pilihan terakhir diingat selama sesi (merekam beberapa klip berturut-turut).
  let pilihan: PengaturanSinema = { waktu: 'cepat', cuaca: 'jadwal' };
  b.addEventListener('click', () => {
    void tanyaPengaturan(o.ui, pilihan).then((p) => {
      if (!p) return;
      pilihan = p;
      masuk(o, p);
    });
  });
  induk.append(b);
}

/** Popup pilihan sebelum mulai. @returns null kalau dibatalkan. */
function tanyaPengaturan(akar: HTMLElement, awal: PengaturanSinema): Promise<PengaturanSinema | null> {
  akar.querySelector('.popup-latar.latar-sinema')?.remove();
  let waktu = awal.waktu;
  let cuaca = awal.cuaca;
  const latar = el('div', 'popup-latar latar-sinema');
  const kotak = el('div', 'popup popup-sinema');
  kotak.setAttribute('role', 'dialog');
  kotak.setAttribute('aria-modal', 'true');
  kotak.setAttribute('aria-labelledby', 'popup-sinema-judul');
  const ikon = el('div', 'sinema-ikon');
  ikon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${IKON_FILM}</svg>`;
  const judul = el('h2', undefined, TEKS.sinemaJudul);
  judul.id = 'popup-sinema-judul';
  const teks = el('p', 'popup-catatan', TEKS.sinemaTeks);
  const grup = <K extends string>(label: string, nilai: readonly K[], nama: Readonly<Record<K, string>>, dipilih: K, saat: (k: K) => void): HTMLElement => {
    const g = el('div', 'sinema-grup');
    const baris = el('div', 'sinema-pilihan');
    baris.setAttribute('role', 'group');
    baris.setAttribute('aria-label', label);
    const tombol = nilai.map((k) => {
      const t = el('button', 'sinema-opsi', nama[k]);
      t.type = 'button';
      t.classList.toggle('aktif', k === dipilih);
      t.setAttribute('aria-pressed', String(k === dipilih));
      t.addEventListener('click', () => {
        saat(k);
        for (const [i, x] of tombol.entries()) {
          x.classList.toggle('aktif', nilai[i] === k);
          x.setAttribute('aria-pressed', String(nilai[i] === k));
        }
      });
      return t;
    });
    baris.append(...tombol);
    g.append(el('div', 'sinema-label', label), baris);
    return g;
  };
  const grupWaktu = grup(TEKS.sinemaWaktu, WAKTU, TEKS.sinemaPilihanWaktu, waktu, (k) => (waktu = k));
  const grupCuaca = grup(TEKS.sinemaCuaca, CUACA, TEKS.sinemaPilihanCuaca, cuaca, (k) => (cuaca = k));
  const mulai = el('button', 'tombol tombol-hijau popup-tombol', TEKS.sinemaMulai);
  mulai.type = 'button';
  const catatan = el('p', 'popup-catatan sinema-catatan', TEKS.sinemaCatatan);
  const batal = el('button', 'pembaruan-nanti', TEKS.sinemaBatal);
  batal.type = 'button';
  kotak.append(ikon, judul, teks, grupWaktu, grupCuaca, mulai, catatan, batal);
  latar.append(kotak);
  akar.append(latar);
  return new Promise((selesai) => {
    const tutup = (hasil: PengaturanSinema | null): void => {
      window.removeEventListener('keydown', saatTombol);
      latar.remove();
      selesai(hasil);
    };
    const saatTombol = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') tutup(null);
    };
    mulai.addEventListener('click', () => tutup({ waktu, cuaca }));
    batal.addEventListener('click', () => tutup(null));
    latar.addEventListener('click', (e) => {
      if (e.target === latar) tutup(null);
    });
    window.addEventListener('keydown', saatTombol);
  });
}

/** Masuk mode sinema sampai layar diketuk atau Esc ditekan. */
function masuk(o: OpsiTombolSinema, p: PengaturanSinema): void {
  const akar = o.akar;
  akar.classList.add('sinema');
  const tanda = el('div', 'sinema-tanda');
  const logo = el('img');
  logo.src = 'ikon-192.png';
  logo.alt = '';
  const jam = el('span', 'sinema-jam', teksJam(o.jam()));
  tanda.append(logo, el('span', 'sinema-situs', TEKS.sinemaSitus), jam);
  const petunjuk = el('div', 'sinema-petunjuk', TEKS.sinemaPetunjuk);
  akar.append(tanda, petunjuk);
  o.mulai(p);
  o.analitik.catat('mode_sinema', { waktu: p.waktu, cuaca: p.cuaca });
  // Tanpa overlay, adegan memenuhi layar (tata letak dihitung ulang).
  window.dispatchEvent(new Event('resize'));
  let aktif = true;
  const detak = window.setInterval(() => {
    const t = teksJam(o.jam());
    if (jam.textContent !== t) jam.textContent = t;
  }, 250);
  const sembunyi = window.setTimeout(() => petunjuk.classList.add('hilang'), LAMA_PETUNJUK_MS);
  const keluar = (): void => {
    if (!aktif) return;
    aktif = false;
    window.clearInterval(detak);
    window.clearTimeout(sembunyi);
    akar.removeEventListener('pointerdown', saatKetuk, true);
    window.removeEventListener('keydown', saatTombol);
    tanda.remove();
    petunjuk.remove();
    akar.classList.remove('sinema');
    o.selesai();
    window.dispatchEvent(new Event('resize'));
  };
  // Ketukan keluar tidak diteruskan ke adegan (tidak menggeser kamera / membunyikan telolet).
  const saatKetuk = (e: PointerEvent): void => {
    e.stopPropagation();
    e.preventDefault();
    keluar();
  };
  const saatTombol = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') keluar();
  };
  window.setTimeout(() => {
    if (!aktif) return;
    akar.addEventListener('pointerdown', saatKetuk, true);
    window.addEventListener('keydown', saatTombol);
  }, JEDA_KELUAR_MS);
}
