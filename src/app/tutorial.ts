/**
 * Tutorial terpandu untuk pemain baru (murni). Empat langkah yang selesai
 * dengan sendirinya begitu syaratnya terpenuhi di state, dalam urutan apa pun:
 * pemain tidak pernah dihalangi, UI hanya menyorot tombol yang dituju
 * (ui/tutorial.ts). Langkah yang ditampilkan = langkah pertama yang belum
 * terpenuhi. Terminal sudah berjalan sendiri sejak awal, jadi langkah pertama
 * langsung membelanjakan uang yang masuk.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { biayaKepala } from '../sim/economy';
import { FASILITAS_IDS, type FasilitasId } from '../sim/fitur';
import Decimal from 'break_infinity.js';
import { biayaFasilitas, biayaJalurBerikutnya, biayaUpgradeState, tahapBottleneck, type GameState } from '../sim/state';
import { TAHAP_IDS, type TahapId } from '../sim/tahap';

export type IdLangkahTutorial = 'upgrade' | 'kepala' | 'fasilitas' | 'jalur';
/** Diakhiri tujuan pertama yang terlihat di adegan: Jalur 2 (bus tidak lagi antre di jalan raya). */
export const LANGKAH_TUTORIAL: readonly IdLangkahTutorial[] = ['upgrade', 'kepala', 'fasilitas', 'jalur'];

/** Disimpan per perangkat: tutorial sedang berjalan, sudah tamat, atau dilewati pemain. */
export type StatusTutorial = 'aktif' | 'selesai' | 'dilewati';
export const STATUS_TUTORIAL: readonly StatusTutorial[] = ['aktif', 'selesai', 'dilewati'];

/** Fasilitas yang disarankan tutorial: Kios & Minimarket (langsung terlihat ramai di adegan). */
export const FASILITAS_TUTORIAL: FasilitasId = 'kios';

export function langkahTerpenuhi(id: IdLangkahTutorial, s: GameState): boolean {
  switch (id) {
    case 'upgrade':
      return TAHAP_IDS.some((t) => s.terminal.tahap[t].level > 1);
    case 'kepala':
      return TAHAP_IDS.some((t) => s.terminal.tahap[t].kepala.direkrut);
    case 'fasilitas':
      return FASILITAS_IDS.some((f) => s.terminal.fasilitas[f] > 0);
    case 'jalur':
      return s.terminal.jalur > 1;
  }
}

/** Langkah yang sedang ditampilkan, atau null bila semua sudah terpenuhi. */
export function langkahBerikut(s: GameState): IdLangkahTutorial | null {
  return LANGKAH_TUTORIAL.find((id) => !langkahTerpenuhi(id, s)) ?? null;
}

/**
 * Game yang benar-benar baru (belum membeli apa pun, belum pernah prestige):
 * tutorial dimulai. Pemain lama yang pertama kali menerima versi bertutorial
 * tidak diganggu.
 */
export function cocokUntukTutorial(s: GameState): boolean {
  return s.prestige.poin.lte(0) && LANGKAH_TUTORIAL.every((id) => !langkahTerpenuhi(id, s));
}

/** Tombol yang dituju langkah ini, dan biayanya (untuk kemajuan "uang / biaya"). */
export type SasaranTutorial =
  | { readonly jenis: 'upgrade'; readonly tahap: TahapId; readonly biaya: Decimal }
  | { readonly jenis: 'kepala'; readonly tahap: TahapId; readonly biaya: Decimal }
  | { readonly jenis: 'fasilitas'; readonly fasilitas: FasilitasId; readonly biaya: Decimal }
  | { readonly jenis: 'jalur'; readonly biaya: Decimal };

export function sasaranLangkah(id: IdLangkahTutorial, s: GameState, cfg: KonfigEkonomi = EKONOMI): SasaranTutorial {
  switch (id) {
    case 'upgrade': {
      // Tahap paling lambat: upgrade di sana yang langsung menaikkan arus penumpang.
      const tahap = tahapBottleneck(s, cfg);
      return { jenis: 'upgrade', tahap, biaya: biayaUpgradeState(s, tahap, cfg) };
    }
    case 'kepala': {
      // Kepala termurah dulu: paling cepat terjangkau.
      const belum = TAHAP_IDS.filter((t) => !s.terminal.tahap[t].kepala.direkrut);
      const tahap = belum.length > 0 ? belum.reduce((a, b) => (biayaKepala(b, cfg).lt(biayaKepala(a, cfg)) ? b : a)) : TAHAP_IDS[0]!;
      return { jenis: 'kepala', tahap, biaya: biayaKepala(tahap, cfg) };
    }
    case 'fasilitas':
      return { jenis: 'fasilitas', fasilitas: FASILITAS_TUTORIAL, biaya: biayaFasilitas(s, FASILITAS_TUTORIAL, cfg) };
    case 'jalur':
      return { jenis: 'jalur', biaya: biayaJalurBerikutnya(s, cfg) ?? new Decimal(0) };
  }
}
