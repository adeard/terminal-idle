/**
 * Popup "Selama kamu pergi…". Penghasilan offline SUDAH ditambahkan ke state
 * sebelum popup muncul, jadi menutup popup (atau app mati saat popup terbuka)
 * tidak menghilangkan uang. Ditutup lewat tombol "Ambil", mengetuk area gelap
 * di luar kotak, atau tombol Esc.
 */
import { EKONOMI } from '../config/economy.config';
import type { LaporanOffline } from '../sim/state';
import { formatDurasi, formatUang } from './format';
import { IKON_PUTAR } from './popup-hadiah';
import { TEKS } from './teks';

/**
 * @param ganda kalau ada: tombol "Ambil 2×" lewat iklan berhadiah; true = iklan
 *   selesai & bonus sudah diberikan pemanggil.
 */
export function tampilkanPopupOffline(akar: HTMLElement, laporan: LaporanOffline, semuaOtomatis: boolean, ganda?: () => Promise<boolean>): Promise<void> {
  akar.querySelector('.popup-latar.latar-offline')?.remove();

  const latar = document.createElement('div');
  latar.className = 'popup-latar latar-offline';

  const kotak = document.createElement('div');
  kotak.className = 'popup';
  kotak.setAttribute('role', 'dialog');
  kotak.setAttribute('aria-modal', 'true');
  kotak.setAttribute('aria-labelledby', 'popup-offline-judul');

  const judul = document.createElement('h2');
  judul.id = 'popup-offline-judul';
  judul.textContent = TEKS.offlineJudul;

  const durasi = document.createElement('p');
  durasi.className = 'popup-durasi';
  durasi.textContent = TEKS.offlineDurasi(formatDurasi(laporan.detik), laporan.dibatasi);

  const jumlah = document.createElement('div');
  jumlah.className = 'popup-jumlah';
  jumlah.textContent = `+${formatUang(laporan.pendapatan)}`;

  const catatan = document.createElement('p');
  catatan.className = 'popup-catatan';
  catatan.textContent = semuaOtomatis
    ? TEKS.offlineCatatan(Math.round(EKONOMI.efisiensiOffline * 100), formatDurasi(EKONOMI.batasOfflineDetik))
    : TEKS.offlineButuhKepala;

  const tombol = document.createElement('button');
  tombol.type = 'button';
  tombol.className = ganda ? 'pembaruan-nanti' : 'tombol tombol-upgrade popup-tombol';
  tombol.textContent = TEKS.offlineAmbil;

  const boost = document.createElement('p');
  boost.className = 'popup-catatan offline-boost';
  boost.textContent = laporan.detikBoost > 0 ? TEKS.offlineBoost(formatDurasi(laporan.detikBoost)) : '';
  const tombolGanda = document.createElement('button');
  tombolGanda.type = 'button';
  tombolGanda.className = 'tombol tombol-iklan popup-tombol';
  tombolGanda.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${IKON_PUTAR}</svg>`;
  const teksGanda = document.createElement('span');
  teksGanda.textContent = TEKS.offlineAmbilGanda(formatUang(laporan.pendapatan.times(2)));
  tombolGanda.append(teksGanda);
  const pesan = document.createElement('p');
  pesan.className = 'hadiah-pesan';

  kotak.append(judul, durasi, jumlah);
  if (laporan.detikBoost > 0) kotak.append(boost);
  kotak.append(catatan);
  if (ganda) kotak.append(tombolGanda, pesan);
  kotak.append(tombol);
  latar.append(kotak);
  akar.append(latar);
  tombol.focus();

  return new Promise((selesai) => {
    let tertutup = false;
    const tutup = (): void => {
      if (tertutup) return;
      tertutup = true;
      window.removeEventListener('keydown', saatTombol);
      latar.remove();
      selesai();
    };
    const saatTombol = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') tutup();
    };
    tombol.addEventListener('click', tutup);
    tombolGanda.addEventListener('click', () => {
      if (!ganda || tombolGanda.disabled) return;
      tombolGanda.disabled = true;
      tombol.disabled = true;
      pesan.textContent = '';
      void ganda().then(
        (ok) => {
          if (ok) {
            jumlah.textContent = `+${formatUang(laporan.pendapatan.times(2))}`;
            jumlah.classList.add('ganda');
            setTimeout(tutup, 900);
            return;
          }
          tombolGanda.disabled = false;
          tombol.disabled = false;
          pesan.textContent = TEKS.iklanTanpaHadiah;
        },
        () => {
          tombolGanda.disabled = false;
          tombol.disabled = false;
          pesan.textContent = TEKS.iklanGagal;
        },
      );
    });
    latar.addEventListener('click', (e) => {
      if (e.target === latar) tutup();
    });
    window.addEventListener('keydown', saatTombol);
  });
}
