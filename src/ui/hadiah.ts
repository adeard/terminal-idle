/**
 * Tombol hadiah di atas adegan: tombol boost ⚡ (kolom kontrol, dengan sisa
 * waktu boost) dan penanda "Bus Emas!" yang berdenyut selama Bus Emas bisa
 * diketuk. Keduanya hanya tampil kalau iklan berhadiah tersedia.
 */
import type { PembacaState } from '../app/pengendali';
import { busEmasAktif, type GameState } from '../sim/state';
import { IKON_BOOST, IKON_BUS_EMAS } from './popup-hadiah';
import { TEKS } from './teks';

export interface KendaliHadiah {
  /** Perbarui tampilan (dipanggil tiap state berubah). */
  perbarui(state: GameState): void;
}

/** "29m", "1j12" — sisa boost singkat untuk lencana tombol. */
export function sisaSingkat(detik: number): string {
  const menit = Math.ceil(detik / 60);
  if (menit < 60) return `${menit}m`;
  return `${Math.floor(menit / 60)}j${String(menit % 60).padStart(2, '0')}`;
}

export function pasangTombolBoost(induk: HTMLElement, iklanSiap: () => boolean, saatKetuk: () => void): KendaliHadiah {
  const tombol = document.createElement('button');
  tombol.type = 'button';
  tombol.className = 'tombol-boost';
  tombol.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${IKON_BOOST}</svg>`;
  const lencana = document.createElement('span');
  lencana.className = 'lencana-boost';
  tombol.append(lencana);
  tombol.addEventListener('click', saatKetuk);
  induk.append(tombol);
  let teksLalu = '';
  return {
    perbarui(state) {
      const siap = iklanSiap();
      const aktif = state.hadiah.boostDetik > 0;
      tombol.hidden = !siap && !aktif;
      tombol.classList.toggle('aktif', aktif);
      const teks = aktif ? sisaSingkat(state.hadiah.boostDetik) : '';
      if (teks !== teksLalu) {
        teksLalu = teks;
        lencana.textContent = teks;
        lencana.hidden = !aktif;
        const label = aktif ? TEKS.boostTombolAktif(teks) : TEKS.boostTombol;
        tombol.title = label;
        tombol.setAttribute('aria-label', label);
      }
    },
  };
}

export function pasangPenandaBusEmas(induk: HTMLElement, pembaca: PembacaState, iklanSiap: () => boolean, saatKetuk: () => void): KendaliHadiah {
  const tombol = document.createElement('button');
  tombol.type = 'button';
  tombol.className = 'penanda-bus-emas';
  tombol.hidden = true;
  tombol.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${IKON_BUS_EMAS}</svg>`;
  const teks = document.createElement('span');
  teks.textContent = TEKS.busEmasPenanda;
  tombol.append(teks);
  tombol.setAttribute('aria-label', TEKS.busEmasPenanda);
  tombol.addEventListener('click', () => {
    if (busEmasAktif(pembaca.state)) saatKetuk();
  });
  induk.append(tombol);
  return {
    perbarui(state) {
      tombol.hidden = !(busEmasAktif(state) && iklanSiap());
    },
  };
}
