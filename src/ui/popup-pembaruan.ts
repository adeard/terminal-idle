/**
 * Popup "Versi baru tersedia": versi lama → baru, catatan "Yang baru", tombol
 * "Perbarui sekarang" dan "Nanti" (tidak ada bila pembaruan wajib). Setelah
 * "Nanti", tombol kecil berpanah di pojok adegan tetap tersedia untuk
 * memperbarui kapan saja (lihat pasangTombolPembaruan).
 *
 * Kalau popup lain (mis. "Selama kamu pergi…") sedang terbuka, popup ini
 * menunggu sampai popup itu ditutup supaya tidak saling menumpuk.
 */
import type { InfoRilis } from '../app/pembaruan';
import { pembaruanWajib, teksPerubahanVersi } from '../app/pembaruan';
import { TEKS } from './teks';

export type PilihanPembaruan = 'perbarui' | 'nanti';

export interface OpsiPopupPembaruan {
  readonly versiSekarang: string;
  readonly info: InfoRilis | null;
  /** Dipanggil saat pemain memilih "Perbarui": simpan progres lalu muat ulang. */
  perbarui(): Promise<void>;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

/** Tunggu sampai tidak ada popup lain di `akar`, selain yang cocok dengan selektor `kecuali`. */
export function tungguPopupLain(akar: HTMLElement, kecuali?: string): Promise<void> {
  const selektor = kecuali ? `.popup-latar:not(${kecuali})` : '.popup-latar';
  if (!akar.querySelector(selektor)) return Promise.resolve();
  return new Promise((selesai) => {
    const pengamat = new MutationObserver(() => {
      if (akar.querySelector(selektor)) return;
      pengamat.disconnect();
      selesai();
    });
    pengamat.observe(akar, { childList: true });
  });
}

export async function tampilkanPopupPembaruan(akar: HTMLElement, opsi: OpsiPopupPembaruan): Promise<PilihanPembaruan> {
  await tungguPopupLain(akar);
  const wajib = pembaruanWajib(opsi.versiSekarang, opsi.info);

  const latar = el('div', 'popup-latar');
  const kotak = el('div', 'popup popup-pembaruan');
  kotak.setAttribute('role', 'dialog');
  kotak.setAttribute('aria-modal', 'true');
  kotak.setAttribute('aria-labelledby', 'popup-pembaruan-judul');

  const ikon = el('div', 'pembaruan-ikon');
  ikon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 9.5l5-5.5 5 5.5M5 19.5h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const judul = el('h2', undefined, wajib ? TEKS.pembaruanJudulWajib : TEKS.pembaruanJudul);
  judul.id = 'popup-pembaruan-judul';
  kotak.append(ikon, judul);

  const versi = teksPerubahanVersi(opsi.versiSekarang, opsi.info);
  if (versi) kotak.append(el('p', 'pembaruan-versi', versi));

  const catatan = opsi.info?.catatan ?? [];
  if (catatan.length > 0) {
    const daftar = el('ul', 'pembaruan-daftar');
    for (const c of catatan) daftar.append(el('li', undefined, c));
    kotak.append(el('p', 'pembaruan-subjudul', TEKS.pembaruanYangBaru), daftar);
  }
  kotak.append(el('p', 'popup-catatan', wajib ? TEKS.pembaruanCatatanWajib : TEKS.pembaruanCatatan));

  const perbarui = el('button', 'tombol tombol-upgrade popup-tombol', TEKS.pembaruanPerbarui);
  perbarui.type = 'button';
  kotak.append(perbarui);
  const nanti = wajib ? null : el('button', 'pembaruan-nanti', TEKS.pembaruanNanti);
  if (nanti) {
    nanti.type = 'button';
    kotak.append(nanti);
  }
  latar.append(kotak);
  akar.append(latar);
  perbarui.focus();

  return new Promise((selesai) => {
    let tertutup = false;
    const tutup = (pilihan: PilihanPembaruan): void => {
      if (tertutup) return;
      tertutup = true;
      window.removeEventListener('keydown', saatTombol);
      if (pilihan === 'nanti') latar.remove();
      selesai(pilihan);
    };
    const saatTombol = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !wajib) tutup('nanti');
    };
    perbarui.addEventListener('click', () => {
      // Tetap terbuka sampai halaman dimuat ulang; cegah ketukan ganda.
      perbarui.disabled = true;
      perbarui.textContent = TEKS.pembaruanMemperbarui;
      if (nanti) nanti.disabled = true;
      tutup('perbarui');
      void opsi.perbarui();
    });
    nanti?.addEventListener('click', () => tutup('nanti'));
    latar.addEventListener('click', (e) => {
      if (e.target === latar && !wajib) tutup('nanti');
    });
    window.addEventListener('keydown', saatTombol);
  });
}

/**
 * Tombol kecil berpanah (dengan titik merah) di pojok adegan, muncul setelah
 * pemain memilih "Nanti"; mengetuknya membuka popup pembaruan lagi.
 */
export function pasangTombolPembaruan(induk: HTMLElement, saatKetuk: () => void): { hapus(): void } {
  const tombol = el('button', 'tombol-pembaruan');
  tombol.type = 'button';
  tombol.title = TEKS.pembaruanTombol;
  tombol.setAttribute('aria-label', TEKS.pembaruanTombol);
  tombol.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v10M7.5 9.5 12 5l4.5 4.5M6 19h12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  tombol.addEventListener('click', saatKetuk);
  induk.prepend(tombol);
  return { hapus: () => tombol.remove() };
}
