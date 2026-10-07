/**
 * Rute antarpulau di adegan (murni, tanpa DOM & three.js): pelabuhan yang
 * ditunjuk rambu di median jalan raya untuk tiap penyeberangan feri, dan arah
 * mana yang sudah terbuka menurut jurusan yang dilayani mitra PO.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';

export interface Pelabuhan {
  /** Tulisan di rambu. */
  readonly nama: string;
  /** Di barat (Sumatra, lewat Merak) atau timur (Nusa Tenggara, lewat Bali). */
  readonly barat: boolean;
}

/** Pelabuhan penyeberangan pertama dari Jawa untuk tiap rute feri (lihat EKONOMI.jurusan). */
export const PELABUHAN_FERI: Readonly<Record<string, Pelabuhan>> = {
  'Merak–Bakauheni': { nama: 'MERAK', barat: true },
  'Padangbai–Lembar': { nama: 'PADANGBAI', barat: false },
  // Ke Sumbawa lewat Lombok: dari Jawa tetap menyeberang di Padangbai dulu.
  'Kayangan–Pototano': { nama: 'PADANGBAI', barat: false },
};

/**
 * Pelabuhan barat & timur yang dilalui rute yang dilayani (null = belum ada).
 * @param mask jurusan yang dilayani mitra PO (bit i = cfg.jurusan[i], lihat tata-letak.ts MASK_SEMUA_JURUSAN)
 */
export function pelabuhanTerbuka(mask: number, cfg: KonfigEkonomi = EKONOMI): { readonly barat: string | null; readonly timur: string | null } {
  let barat: string | null = null;
  let timur: string | null = null;
  for (const [i, j] of cfg.jurusan.entries()) {
    if (Math.floor(mask / 2 ** i) % 2 !== 1) continue;
    const p = j.feri !== undefined ? PELABUHAN_FERI[j.feri] : undefined;
    if (!p) continue;
    if (p.barat) barat ??= p.nama;
    else timur ??= p.nama;
  }
  return { barat, timur };
}
