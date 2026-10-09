/**
 * Tutorial terpandu untuk pemain baru (murni). Empat langkah yang selesai
 * dengan sendirinya begitu syaratnya terpenuhi di state, dalam urutan apa pun:
 * pemain tidak pernah dihalangi, UI hanya menyorot tombol yang dituju
 * (ui/tutorial.ts). Langkah yang ditampilkan = langkah pertama yang belum
 * terpenuhi. Terminal sudah berjalan sendiri sejak awal, jadi langkah pertama
 * langsung membelanjakan modal awal (documents/13 bagian 15).
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { PO_IDS, type PoId } from '../sim/fitur';
import { urutanPo } from '../sim/mitra';
import { biayaBangunState, poTujuanJendela, syaratDaftarPoKurang, tawaranKontrakPo, type GameState } from '../sim/state';

export type IdLangkahTutorial = 'jendela' | 'po' | 'petugas' | 'jalur';
/**
 * Bangun jendela loket kedua (loket paling lambat di awal), daftarkan PO
 * kedua (jurusan baru), rekrut petugas peron (peron jadi paling lambat), lalu
 * tujuan pertama yang terlihat di adegan: Jalur 2 (bus tidak lagi antre di jalan raya).
 */
export const LANGKAH_TUTORIAL: readonly IdLangkahTutorial[] = ['jendela', 'po', 'petugas', 'jalur'];

/** Disimpan per perangkat: tutorial sedang berjalan, sudah tamat, atau dilewati pemain. */
export type StatusTutorial = 'aktif' | 'selesai' | 'dilewati';
export const STATUS_TUTORIAL: readonly StatusTutorial[] = ['aktif', 'selesai', 'dilewati'];

export function langkahTerpenuhi(id: IdLangkahTutorial, s: GameState, cfg: KonfigEkonomi = EKONOMI): boolean {
  const b = s.terminal.bangunan;
  switch (id) {
    case 'jendela':
      return b.jendela > cfg.tycoon.bangunan.jendela.awal;
    case 'po':
      return s.mitra.terdaftar.length >= 2;
    case 'petugas':
      return s.terminal.petugas.includes('peron');
    case 'jalur':
      return b.jalur > cfg.tycoon.bangunan.jalur.awal;
  }
}

/** Langkah yang sedang ditampilkan, atau null bila semua sudah terpenuhi. */
export function langkahBerikut(s: GameState, cfg: KonfigEkonomi = EKONOMI): IdLangkahTutorial | null {
  return LANGKAH_TUTORIAL.find((id) => !langkahTerpenuhi(id, s, cfg)) ?? null;
}

/**
 * Game yang benar-benar baru (belum membangun & merekrut apa pun): tutorial
 * dimulai. Pemain lama yang pertama kali menerima versi bertutorial tidak diganggu.
 */
export function cocokUntukTutorial(s: GameState, cfg: KonfigEkonomi = EKONOMI): boolean {
  return s.perkembangan.perluasan === 0 && LANGKAH_TUTORIAL.every((id) => !langkahTerpenuhi(id, s, cfg));
}

/** Tombol yang dituju langkah ini, dan biayanya (untuk kemajuan "kas / biaya"; 0 = gratis). */
export type SasaranTutorial =
  /** po: PO yang menyewa jendela baru (null bila belum ada PO). */
  | { readonly jenis: 'jendela'; readonly po: PoId | null; readonly biaya: number }
  /** nilai: kontrak yang dibayar PO di muka saat bergabung. */
  | { readonly jenis: 'po'; readonly po: PoId; readonly biaya: number; readonly nilai: number }
  | { readonly jenis: 'petugas'; readonly biaya: number }
  | { readonly jenis: 'jalur'; readonly biaya: number };

/**
 * PO yang disarankan untuk didaftarkan: yang pertama (urut katalog PO, sama
 * dengan daftar di tab PO) di antara yang syaratnya sudah terpenuhi. Cadangan
 * bila tidak ada (mis. semuanya sedang jeda setelah diputus): PO biasa pertama
 * yang belum terdaftar.
 */
function poTutorial(s: GameState, cfg: KonfigEkonomi): PoId {
  const urut = [...PO_IDS].sort((a, b) => urutanPo(a, cfg) - urutanPo(b, cfg));
  const bisa = urut.filter((id) => syaratDaftarPoKurang(s, id, cfg) === null);
  if (bisa.length > 0) return bisa[0]!;
  const biasa = urut.filter((id) => cfg.mitra.po[id].sumber === undefined && !s.mitra.terdaftar.some((p) => p.id === id));
  return (biasa.length > 0 ? biasa : urut)[0]!;
}

export function sasaranLangkah(id: IdLangkahTutorial, s: GameState, cfg: KonfigEkonomi = EKONOMI): SasaranTutorial {
  switch (id) {
    case 'jendela':
      return { jenis: 'jendela', po: poTujuanJendela(s, cfg), biaya: biayaBangunState(s, 'jendela', cfg) ?? 0 };
    case 'po': {
      const po = poTutorial(s, cfg);
      return { jenis: 'po', po, biaya: 0, nilai: tawaranKontrakPo(s, po, cfg).nilai };
    }
    case 'petugas':
      // Rekrut tanpa biaya sekali bayar: gajinya dibayar per hari.
      return { jenis: 'petugas', biaya: 0 };
    case 'jalur':
      return { jenis: 'jalur', biaya: biayaBangunState(s, 'jalur', cfg) ?? 0 };
  }
}
