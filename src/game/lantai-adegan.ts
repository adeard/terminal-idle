/**
 * Tambah lantai di adegan (murni, tanpa three.js; documents/18, rancangan
 * docs/design/20261105-tambah-lantai bagian 6 & 8.4): lantai yang digambar menurut
 * state, dan bagian cangkang mana yang terlihat di tampilan biasa dan di mode lihat
 * per lantai. lantai3d.ts menggambar cangkangnya di ekor mesh gabungan utama, per unit.
 *
 * Penomoran sama dengan sim/lantai.ts: `TerminalState.lantai[g]` = lantai tambahan
 * (0 = hanya lantai dasar); nomor lantai 1 = lantai dasar, 2 = lantai tambahan pertama.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import type { JumlahBangunan } from '../sim/bangunan';
import { GEDUNG_LANTAI_IDS, type BangunanId, type GedungLantaiId, type LantaiDilihat } from '../sim/fitur';
import { GEDUNG_PARKIR, RUANG_LANTAI, SELASAR, type Persegi, type RuangLantai } from './tata-letak';

export type LantaiGedung = Readonly<Record<GedungLantaiId, number>>;

export const TANPA_LANTAI: LantaiGedung = { parkir: 0, ruangTunggu: 0, sayapBarat: 0, aula: 0 };

/**
 * Bagian cangkang tiap lantai (digit terakhir nomor unit):
 * - struktur: pelat, dinding, kolom, ramp;
 * - atap: atap dan pita jendela (dibuka di mode lantai untuk lantai yang dilihat);
 * - pagar: pagar kaca rendah pengganti atap, hanya di mode lantai;
 * - puncak: yang hanya ada di lantai teratas yang terlihat (mobil dek, papan P, tembok bibir dek);
 * - akses: aspal, panah, dan gapura gedung parkir; tetap ada saat melihat Lantai 1.
 */
export const BAGIAN_LANTAI = { struktur: 0, atap: 1, pagar: 2, puncak: 3, akses: 4 } as const;

/** Nomor unit di bagian 'lantai' mesh gabungan utama: gedung × 100 + nomor lantai × 10 + bagian. */
export function unitLantai(gedung: GedungLantaiId, lantai: number, bagian: number): number {
  return (GEDUNG_LANTAI_IDS.indexOf(gedung) + 1) * 100 + lantai * 10 + bagian;
}

function uraiUnit(unit: number): { readonly gedung: GedungLantaiId; readonly lantai: number; readonly bagian: number } | null {
  const gedung = GEDUNG_LANTAI_IDS[Math.floor(unit / 100) - 1];
  return gedung ? { gedung, lantai: Math.floor(unit / 10) % 10, bagian: unit % 10 } : null;
}

/**
 * Lantai tambahan yang digambar: semua 0 sebelum tahap perluasan lantai gedung itu
 * (EKONOMI.tycoon.lantai[g].tahap). Tanpa alokasi: memberi objek state itu sendiri atau konstanta.
 */
export function lantaiAdegan(lantai: LantaiGedung, perluasan: number): LantaiGedung {
  for (const g of GEDUNG_LANTAI_IDS) if (lantai[g] > 0 && perluasan < EKONOMI.tycoon.lantai[g].tahap) return TANPA_LANTAI;
  return lantai;
}

/**
 * Unit cangkang yang terlihat. Tampilan biasa: semua lantai yang dibangun, atap & jendela
 * tertutup, mobil dek hanya di dek teratas. Mode lantai: lantai di atas yang dilihat
 * disembunyikan, atap & jendela lantai itu dibuka (pagar kaca rendah menggantikannya), dan
 * bagian puncak ada di lantai yang dilihat. Akses gedung parkir ada selama gedungnya ada.
 */
export function cangkangTerlihat(unit: number, lantai: LantaiGedung, lihat: LantaiDilihat | null): boolean {
  const u = uraiUnit(unit);
  if (!u) return false;
  const tambahan = lantai[u.gedung];
  if (tambahan < 1) return false;
  if (u.bagian === BAGIAN_LANTAI.akses) return true;
  if (u.lantai - 1 > tambahan) return false;
  const dilihat = lihat?.gedung === u.gedung ? lihat : null;
  if (dilihat && u.lantai > dilihat.lantai) return false;
  const ini = dilihat !== null && u.lantai === dilihat.lantai;
  switch (u.bagian) {
    case BAGIAN_LANTAI.struktur:
      return true;
    case BAGIAN_LANTAI.atap:
      return !ini;
    case BAGIAN_LANTAI.pagar:
      return ini;
    case BAGIAN_LANTAI.puncak:
      return u.lantai === (dilihat ? dilihat.lantai : tambahan + 1);
    default:
      return false;
  }
}

/**
 * Kunci keadaan cangkang (lantai yang digambar & lantai yang dilihat) sebagai satu bilangan,
 * supaya adegan memotong ulang mesh hanya saat kuncinya berganti, tanpa alokasi tiap frame.
 */
export function kunciLantai(lantai: LantaiGedung, lihat: LantaiDilihat | null): number {
  let k = 0;
  for (const g of GEDUNG_LANTAI_IDS) k = k * 10 + Math.min(9, Math.max(0, lantai[g]));
  return lihat ? k * 100 + (GEDUNG_LANTAI_IDS.indexOf(lihat.gedung) + 1) * 10 + Math.min(9, Math.max(0, lihat.lantai)) : k * 100;
}

/** Mobil tanah baris 2 di bawah ramp & lengkung S disembunyikan selama gedung parkir ada. */
export function mobilTanahTersembunyi(lantai: LantaiGedung): boolean {
  return lantai.parkir >= 1;
}

// ---------------------------------------------------------------------------
// Isi lantai di mode lantai (rancangan 8.4)

/** Unit bangunan yang bisa berada di lantai tambahan; urutannya = digit jenis (1…) di nomor unit isi, 0 = bagian tetap. */
export const JENIS_ISI = ['kursi', 'kios', 'toko', 'toilet', 'lahanParkir'] as const satisfies readonly BangunanId[];
export type JenisIsi = (typeof JENIS_ISI)[number];

/** Satu unit bangunan di lantai tambahan: urutannya di lantai itu (1-based) dan ada atau tidak (bagiIsiLantai). */
export interface UnitIsiLantai {
  readonly id: JenisIsi;
  readonly urut: number;
  readonly ada: boolean;
}

/** Isi bangunan yang dibagi antara lantai dasar dan lantai tambahan (rancangan 8.4, "lantai diisi lebih dulu"). */
export interface IsiTerbagi {
  /** Unit tiap jenis yang digambar di lantai dasar. */
  readonly dasar: Readonly<Record<JenisIsi, number>>;
  /** Unit di tiap lantai tambahan: perLantai[gedung][nomor − 2][jenis], 0 … isi lantai itu. */
  readonly perLantai: Readonly<Record<GedungLantaiId, readonly Readonly<Partial<Record<JenisIsi, number>>>[]>>;
}

/**
 * Gedung yang isi lantainya digambar di lantai dasar, bukan di lantai tambahan. Sayap barat: lantai 2-nya selasar
 * penghubung tanpa toilet (owner, Telegram 2026-11-06 pesan 272), jadi +1 toilet ikut lantai dasar. Mengosongkan
 * himpunan ini mengembalikan toilet ke lantai 2.
 */
export const GEDUNG_ISI_DI_DASAR: ReadonlySet<GedungLantaiId> = new Set<GedungLantaiId>(['sayapBarat']);

/**
 * Bagi tiap jenis isi antara lantai dasar dan lantai tambahan yang digambar: lantai diisi lebih dulu (urut level
 * terbuka naik, seri: urutan GEDUNG_LANTAI_IDS), lantai dasar menampilkan sisanya. Jadi membeli lantai tidak mengubah
 * lantai dasar, dan bongkar mengurangi lantai dasar lebih dulu; tanpa lantai, dasar = bangunan (sama dengan 0.5.0).
 */
export function bagiIsiLantai(bangunan: JumlahBangunan, lantai: LantaiGedung, perluasan: number, cfg: KonfigEkonomi = EKONOMI): IsiTerbagi {
  const L = lantaiAdegan(lantai, perluasan);
  const urut: { readonly g: GedungLantaiId; readonly i: number; readonly level: number }[] = [];
  for (const g of GEDUNG_LANTAI_IDS) for (let i = 0; i < L[g]; i++) if (!GEDUNG_ISI_DI_DASAR.has(g)) urut.push({ g, i, level: cfg.tycoon.lantai[g].level[i] ?? Number.POSITIVE_INFINITY });
  // Array.prototype.sort stabil: level seri tetap urut GEDUNG_LANTAI_IDS.
  urut.sort((a, b) => a.level - b.level);
  const perLantai = Object.fromEntries(GEDUNG_LANTAI_IDS.map((g) => [g, Array.from({ length: L[g] }, (): Partial<Record<JenisIsi, number>> => ({}))])) as Record<GedungLantaiId, Partial<Record<JenisIsi, number>>[]>;
  const dasar = {} as Record<JenisIsi, number>;
  for (const j of JENIS_ISI) {
    const n = Math.max(0, bangunan[j]);
    let sisa = Math.min(n, urut.reduce((a, u) => a + (cfg.tycoon.lantai[u.g].isi[j] ?? 0), 0));
    dasar[j] = n - sisa;
    for (const u of urut) {
      const per = cfg.tycoon.lantai[u.g].isi[j] ?? 0;
      if (per === 0) continue;
      const ambil = Math.min(sisa, per);
      perLantai[u.g][u.i]![j] = ambil;
      sisa -= ambil;
    }
  }
  return { dasar, perLantai };
}

/** Unit bangunan di lantai `nomor` gedung ini (2 = lantai tambahan pertama) dan ada atau tidaknya menurut bagiIsiLantai. */
export function isiLantaiAdegan(gedung: GedungLantaiId, nomor: number, lantai: LantaiGedung, bangunan: JumlahBangunan, perluasan: number): UnitIsiLantai[] {
  if (nomor < 2 || nomor - 1 > lantai[gedung] || GEDUNG_ISI_DI_DASAR.has(gedung)) return [];
  const isi = bagiIsiLantai(bangunan, lantai, perluasan).perLantai[gedung][nomor - 2] ?? {};
  const hasil: UnitIsiLantai[] = [];
  for (const id of JENIS_ISI) {
    const per = EKONOMI.tycoon.lantai[gedung].isi[id] ?? 0;
    for (let urut = 1; urut <= per; urut++) hasil.push({ id, urut, ada: urut <= (isi[id] ?? 0) });
  }
  return hasil;
}

/** Nomor unit isi lantai di KumpulanUnit isi: gedung × 1000 + nomor lantai × 100 + jenis × 10 + urutan (jenis 0 = bagian tetap). */
export function unitIsi(gedung: GedungLantaiId, nomor: number, jenis: JenisIsi | null, urut: number): number {
  return (GEDUNG_LANTAI_IDS.indexOf(gedung) + 1) * 1000 + nomor * 100 + (jenis === null ? 0 : JENIS_ISI.indexOf(jenis) + 1) * 10 + urut;
}

/** Unit isi yang terlihat: hanya di mode lantai, untuk lantai tambahan yang dilihat dan dibangun; bagian tetap ditambah unit yang ada. */
export function unitIsiTerlihat(lihat: LantaiDilihat | null, lantai: LantaiGedung, bangunan: JumlahBangunan, perluasan: number): ReadonlySet<number> {
  const hasil = new Set<number>();
  if (!lihat || lihat.lantai < 2 || lihat.lantai - 1 > lantai[lihat.gedung]) return hasil;
  hasil.add(unitIsi(lihat.gedung, lihat.lantai, null, 0));
  for (const u of isiLantaiAdegan(lihat.gedung, lihat.lantai, lantai, bangunan, perluasan)) if (u.ada) hasil.add(unitIsi(lihat.gedung, lihat.lantai, u.id, u.urut));
  return hasil;
}

/** Tinggi lantai jalan lantai 2 gedung kotak: di atas pelat, kecuali selasar Sayap barat yang setinggi lantai 2 Sayap 2 Lantai. */
export function hLantaiAtas(gedung: Exclude<GedungLantaiId, 'parkir'>): number {
  return gedung === 'sayapBarat' ? SELASAR.hLantai : RUANG_LANTAI[gedung].hL + 0.1;
}

// ---------------------------------------------------------------------------
// Kamera mode lantai

/** Kotak gedung berlantai (hL = kaki, hA = puncak): gedung parkir dari tanah sampai tembok dek teratas. */
export function ruangGedungLantai(gedung: GedungLantaiId): RuangLantai {
  if (gedung !== 'parkir') return RUANG_LANTAI[gedung];
  const P = GEDUNG_PARKIR;
  return { x0: P.x0, y0: P.y0, x1: P.x1, y1: P.y1, hL: 0, hA: P.hDek[1] + P.hTembok };
}

/**
 * Pinggir bingkai kamera mode lantai per gedung (satuan denah): kotak gedung diperluas sebanyak ini. Gedung
 * kecil mendapat pinggir lebih lebar supaya sekitarnya ikut terlihat (purwarupa: Sayap barat terlalu dekat).
 */
export const PINGGIR_KAMERA_LANTAI: Readonly<Record<GedungLantaiId, number>> = { parkir: 2.2, ruangTunggu: 0.8, sayapBarat: 2.6, aula: 1.2 };

/**
 * Azimut kamera mode lantai per orientasi (radian, 0 = dari selatan), bila beda dari kamera awal. Aula: mezanin lantai 2
 * di belakang dinding utara tertutup atap lengkung bila dilihat dari tenggara; dari selatan (landscape) pita isinya
 * terbaca (temuan QA grafis G-2). Portrait tetap 55°: dari selatan aula menjadi kecil di layar sempit, sedangkan toko
 * mezanin di ujung barat sudah membedakan Lantai 2 dari Lantai 1 (keputusan Sapto).
 */
export const AZIMUT_KAMERA_LANTAI: Readonly<Partial<Record<GedungLantaiId, { readonly lanskap: number; readonly potret: number }>>> = {
  aula: { lanskap: 0, potret: (55 * Math.PI) / 180 },
};

/** Titik yang dibingkai kamera saat masuk mode lantai gedung ini: pojok kaki dan muka selatan atas, diperluas pinggirnya. */
export function titikKameraLantai(gedung: GedungLantaiId): readonly (readonly [number, number, number])[] {
  const R = ruangGedungLantai(gedung);
  const p = PINGGIR_KAMERA_LANTAI[gedung];
  const [x0, x1, y0, y1] = [R.x0 - p, R.x1 + p, R.y0 - p, R.y1 + p];
  return [
    [x0, y0, R.hL],
    [x1, y0, R.hL],
    [x0, y1, R.hL],
    [x1, y1, R.hL],
    [x0, y1, R.hA],
    [x1, y1, R.hA],
  ];
}

/**
 * Kamera digeser jauh dari gedung yang dilihat (UI keluar dari mode lantai): titik pandang lebih dari
 * setengah panjang gedung + 4 satuan dari titik pandang bingkai mode lantai.
 */
export function kameraLepasDariGedung(x: number, y: number, pusatX: number, pusatY: number, gedung: GedungLantaiId): boolean {
  const R = ruangGedungLantai(gedung);
  return Math.hypot(x - pusatX, y - pusatY) > Math.max(R.x1 - R.x0, R.y1 - R.y0) / 2 + 4;
}

// ---------------------------------------------------------------------------
// Hujan dan kembang api

/** Kotak atap hujan lantai tambahan: butiran berhenti di tinggi h di atas persegi ini. */
export interface AtapHujanLantai extends Persegi {
  readonly h: number;
}

/**
 * Atap hujan gedung ini (null = tanpa lantai tambahan yang terlihat). Lantai kotak: di atapnya; di mode lantai
 * lantai itu, di lantainya (atap dibuka). Gedung parkir: di dek teratas yang terlihat, menutupi lajur ramp juga.
 */
export function atapHujanLantai(gedung: GedungLantaiId, lantai: LantaiGedung, lihat: LantaiDilihat | null): AtapHujanLantai | null {
  if (lantai[gedung] < 1) return null;
  const dilihat = lihat?.gedung === gedung ? lihat.lantai : null;
  if (gedung === 'parkir') {
    const n = dilihat ?? lantai.parkir + 1;
    if (n < 2) return null;
    const P = GEDUNG_PARKIR;
    return { x0: P.x0, y0: P.y0, x1: P.x1, y1: P.y1, h: P.hDek[Math.min(n, P.hDek.length + 1) - 2]! };
  }
  if (dilihat === 1) return null;
  const R = RUANG_LANTAI[gedung];
  return { x0: R.x0, y0: R.y0, x1: R.x1, y1: R.y1, h: dilihat === 2 ? hLantaiAtas(gedung) : R.hA + 0.05 };
}

/** Gedung yang lantainya bertambah tepat satu sejak frame lalu (pembelian), atau null (tidak berubah, atau lompatan dari muat save). */
export function lantaiDibeli(lalu: LantaiGedung, kini: LantaiGedung): GedungLantaiId | null {
  let dibeli: GedungLantaiId | null = null;
  for (const g of GEDUNG_LANTAI_IDS) {
    const d = kini[g] - lalu[g];
    if (d === 0) continue;
    if (d !== 1 || dibeli) return null;
    dibeli = g;
  }
  return dibeli;
}

/** Titik kembang api kecil saat lantai tambahan ke-`tambahan` gedung ini dibeli: di atas tengah lantai baru. */
export function titikKembangApiLantai(gedung: GedungLantaiId, tambahan: number): readonly [number, number, number] {
  const R = ruangGedungLantai(gedung);
  const x = (R.x0 + R.x1) / 2;
  const y = (R.y0 + R.y1) / 2;
  if (gedung === 'parkir') return [x, (GEDUNG_PARKIR.y0 + GEDUNG_PARKIR.yDek) / 2, GEDUNG_PARKIR.hDek[Math.min(tambahan, GEDUNG_PARKIR.hDek.length) - 1]! + 0.6];
  return [x, y, R.hA + 0.5];
}
