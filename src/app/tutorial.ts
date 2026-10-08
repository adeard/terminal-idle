/**
 * Tutorial terpandu untuk pemain baru (murni). Empat langkah yang selesai
 * dengan sendirinya begitu syaratnya terpenuhi di state, dalam urutan apa pun:
 * pemain tidak pernah dihalangi, UI hanya menyorot tombol yang dituju
 * (ui/tutorial.ts). Langkah yang ditampilkan = langkah pertama yang belum
 * terpenuhi. Terminal sudah berjalan sendiri sejak awal, jadi langkah pertama
 * langsung membelanjakan uang yang masuk (lihat documents/12 bagian 18).
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { biayaKepala } from '../sim/economy';
import { PO_IDS, type PoId } from '../sim/fitur';
import { biayaDaftarPo } from '../sim/mitra';
import Decimal from 'break_infinity.js';
import { biayaJalurBerikutnya, biayaUpgradeState, poTujuanLoket, syaratDaftarPoKurang, tahapBottleneck, type GameState } from '../sim/state';
import { TAHAP_IDS, type TahapId } from '../sim/tahap';

export type IdLangkahTutorial = 'upgrade' | 'po' | 'kepala' | 'jalur';
/**
 * Upgrade tahap paling lambat (di awal: bangun loket untuk PO pertama),
 * daftarkan PO kedua (jurusan baru), rekrut Kepala, lalu tujuan pertama yang
 * terlihat di adegan: Jalur 2 (bus tidak lagi antre di jalan raya).
 */
export const LANGKAH_TUTORIAL: readonly IdLangkahTutorial[] = ['upgrade', 'po', 'kepala', 'jalur'];

/** Disimpan per perangkat: tutorial sedang berjalan, sudah tamat, atau dilewati pemain. */
export type StatusTutorial = 'aktif' | 'selesai' | 'dilewati';
export const STATUS_TUTORIAL: readonly StatusTutorial[] = ['aktif', 'selesai', 'dilewati'];

export function langkahTerpenuhi(id: IdLangkahTutorial, s: GameState): boolean {
  switch (id) {
    case 'upgrade':
      return TAHAP_IDS.some((t) => s.terminal.tahap[t].level > 1);
    case 'po':
      return s.mitra.terdaftar.length >= 2;
    case 'kepala':
      return TAHAP_IDS.some((t) => s.terminal.tahap[t].kepala.direkrut);
    case 'jalur':
      return s.terminal.jalur > 1;
  }
}

/** Langkah yang sedang ditampilkan, atau null bila semua sudah terpenuhi. */
export function langkahBerikut(s: GameState): IdLangkahTutorial | null {
  return LANGKAH_TUTORIAL.find((id) => !langkahTerpenuhi(id, s)) ?? null;
}

/**
 * Game yang benar-benar baru (belum membeli apa pun, belum pernah Renovasi):
 * tutorial dimulai. Pemain lama yang pertama kali menerima versi bertutorial
 * tidak diganggu.
 */
export function cocokUntukTutorial(s: GameState): boolean {
  return s.renovasi.jumlah === 0 && s.renovasi.poin.lte(0) && LANGKAH_TUTORIAL.every((id) => !langkahTerpenuhi(id, s));
}

/** Tombol yang dituju langkah ini, dan biayanya (untuk kemajuan "uang / biaya"). */
export type SasaranTutorial =
  /** po: PO yang menerima loket baru bila tahapnya Loket (null untuk tahap lain). */
  | { readonly jenis: 'upgrade'; readonly tahap: TahapId; readonly po: PoId | null; readonly biaya: Decimal }
  | { readonly jenis: 'po'; readonly po: PoId; readonly biaya: Decimal }
  | { readonly jenis: 'kepala'; readonly tahap: TahapId; readonly biaya: Decimal }
  | { readonly jenis: 'jalur'; readonly biaya: Decimal };

/** PO termurah dari daftar (seri: urutan PO_IDS). */
const termurah = (daftar: readonly PoId[], cfg: KonfigEkonomi): PoId => daftar.reduce((a, b) => (biayaDaftarPo(b, cfg).lt(biayaDaftarPo(a, cfg)) ? b : a));

/**
 * PO yang disarankan untuk didaftarkan: yang termurah di antara yang syaratnya
 * sudah terpenuhi (tinggal uangnya). Cadangan bila tidak ada (mis. semuanya
 * sedang jeda setelah diputus): PO biasa termurah yang belum terdaftar.
 */
function poTutorial(s: GameState, cfg: KonfigEkonomi): PoId {
  const bisa = PO_IDS.filter((id) => syaratDaftarPoKurang(s, id, cfg) === null);
  if (bisa.length > 0) return termurah(bisa, cfg);
  const biasa = PO_IDS.filter((id) => cfg.mitra.po[id].sumber === undefined && !s.mitra.terdaftar.some((p) => p.id === id));
  return termurah(biasa.length > 0 ? biasa : PO_IDS, cfg);
}

export function sasaranLangkah(id: IdLangkahTutorial, s: GameState, cfg: KonfigEkonomi = EKONOMI): SasaranTutorial {
  switch (id) {
    case 'upgrade': {
      // Tahap paling lambat: upgrade di sana yang langsung menaikkan arus penumpang.
      const tahap = tahapBottleneck(s, cfg);
      return { jenis: 'upgrade', tahap, po: tahap === 'loket' ? poTujuanLoket(s, cfg) : null, biaya: biayaUpgradeState(s, tahap, cfg) };
    }
    case 'po': {
      const po = poTutorial(s, cfg);
      return { jenis: 'po', po, biaya: biayaDaftarPo(po, cfg) };
    }
    case 'kepala': {
      // Kepala termurah dulu: paling cepat terjangkau.
      const belum = TAHAP_IDS.filter((t) => !s.terminal.tahap[t].kepala.direkrut);
      const tahap = belum.length > 0 ? belum.reduce((a, b) => (biayaKepala(b, cfg).lt(biayaKepala(a, cfg)) ? b : a)) : TAHAP_IDS[0]!;
      return { jenis: 'kepala', tahap, biaya: biayaKepala(tahap, cfg) };
    }
    case 'jalur':
      return { jenis: 'jalur', biaya: biayaJalurBerikutnya(s, cfg) ?? new Decimal(0) };
  }
}
