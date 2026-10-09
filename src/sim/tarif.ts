/**
 * Tarif terminal (murni). Harga tiket diatur & diterima PO sendiri, dan
 * penumpang tidak membayar apa pun ke terminal (toilet & musholla gratis).
 * Pemain mengatur tarif terminal, dan tiap tarif menggeser sesuatu:
 * - sewa jendela loket & retribusi bus: kepuasan mitra PO;
 * - parkir kendaraan pengantar: banyaknya yang parkir, dan kepuasan;
 * - sewa kios & toko: okupansi penyewa menurut keramaian.
 * Rancangan: bagian 6.4 documents/13-rancangan-tycoon.md.
 */
import { EKONOMI, type KonfigEkonomi, type KonfigSkorTarif } from '../config/economy.config';
import { TARIF_IDS, type TarifId } from './fitur';

export type NilaiTarif = Readonly<Record<TarifId, number>>;

const jepit01 = (x: number): number => Math.min(1, Math.max(0, x));

export function tarifBawaan(cfg: KonfigEkonomi = EKONOMI): NilaiTarif {
  return Object.fromEntries(TARIF_IDS.map((id) => [id, cfg.tycoon.tarif[id].bawaan])) as Record<TarifId, number>;
}

/** Tarif dalam rentang & kelipatan langkahnya (nilai tak sah → bawaan). */
export function jepitTarif(id: TarifId, nilai: number, cfg: KonfigEkonomi = EKONOMI): number {
  const t = cfg.tycoon.tarif[id];
  if (!Number.isFinite(nilai)) return t.bawaan;
  const bulat = t.langkah > 0 ? Math.round(nilai / t.langkah) * t.langkah : nilai;
  return Math.min(t.maks, Math.max(t.min, bulat));
}

/** Tarif dibanding bawaannya (1 = bawaan). */
export function rasioTarif(id: TarifId, t: NilaiTarif, cfg: KonfigEkonomi = EKONOMI): number {
  const b = cfg.tycoon.tarif[id].bawaan;
  return b > 0 ? t[id] / b : 1;
}

/**
 * Bagian penumpang yang memakai layanan berbayar (pengantar yang parkir) pada
 * tarif ini: `bagian` pada tarif bawaan, naik bila lebih murah, dan habis pada
 * (1 + 1 ÷ kepekaan) × bawaan.
 */
export function bagianPemakai(tarif: number, bawaan: number, bagian: number, kepekaan: number): number {
  if (!(bawaan > 0)) return bagian;
  return bagian * Math.max(0, 1 + kepekaan * (1 - tarif / bawaan));
}

/**
 * Okupansi kios & toko (0–1): penyewa mau membayar bila sewanya sepadan dengan
 * keramaian. Sewa wajar = nilaiPerArus × arus puncak; tepat wajar → penuh, lebih
 * mahal → sebagian kosong. Terminal yang masih sepi tidak laku disewakan mahal.
 */
export function okupansiKios(sewa: number, arusPuncak: number, cfg: KonfigEkonomi = EKONOMI): number {
  const k = cfg.tycoon.kios;
  const wajar = k.nilaiPerArus * Math.max(0, arusPuncak);
  if (!(wajar > 0)) return sewa <= 0 ? 1 : 0;
  return jepit01(1 + k.kepekaan * (1 - sewa / wajar));
}

/** Skor 0–1 dari rasio tarif terhadap bawaan: `skorBawaan` di bawaan, turun `turunPerRasio` tiap kelipatan di atasnya, naik bila lebih murah. */
export function skorTarif(rasio: number, k: KonfigSkorTarif): number {
  return jepit01(k.skorBawaan - k.turunPerRasio * (rasio - 1));
}

const rataRata = (x: readonly number[]): number => (x.length > 0 ? x.reduce((a, b) => a + b, 0) / x.length : 1);

/**
 * Komponen harga kepuasan penumpang: tarif parkir pengantar bila lahan parkir
 * ada. Penumpang sendiri tidak membayar terminal, jadi tanpa lahan parkir
 * komponen ini penuh.
 */
export function skorHargaPenumpang(t: NilaiTarif, ada: { readonly parkir: boolean }, cfg: KonfigEkonomi = EKONOMI): number {
  return ada.parkir ? skorTarif(rasioTarif('parkir', t, cfg), cfg.tycoon.kepuasan.harga) : 1;
}

/** Skor tarif bagi mitra PO: sewa jendela loket, dan retribusi bus bila dipungut. */
export function skorTarifMitra(t: NilaiTarif, retribusiDipungut: boolean, cfg: KonfigEkonomi = EKONOMI): number {
  const r = [rasioTarif('sewaLoket', t, cfg)];
  if (retribusiDipungut) r.push(rasioTarif('retribusiBus', t, cfg));
  return skorTarif(rataRata(r), cfg.tycoon.mitra.tarif);
}
