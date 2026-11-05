/**
 * Musim Terminal (documents/17-rancangan-musim-terminal.md, ADR 009): kalender musim 6 minggu WIB,
 * tiga tugas harian, Rapor Musim 30 tingkat, dan hadiahnya (hiasan, tiket ganti, Surat Armada).
 * Semua angka musim ada di sini; logikanya di sim/musim.ts. Teks & nama tema di ui/teks.ts.
 */

/** Tempat hiasan musim: spanduk gapura, seragam petugas peron & gerbang, papan gapura (adegan), bingkai foto (UI). */
export const SLOT_HIASAN = ['spanduk', 'seragam', 'papan', 'bingkai'] as const;
export type SlotHiasan = (typeof SLOT_HIASAN)[number];

/** Tema musim, urut kalender tahun pertama (bagian 3.1); sesudah habis diulang dengan tahun baru di namanya. */
export const TEMA_MUSIM = ['hujan', 'imlek', 'mudik'] as const;
export type TemaMusimId = (typeof TEMA_MUSIM)[number];

/** Templat tugas harian ronde 1 (bagian 3.2), urut tabel. */
export const TEMPLAT_TUGAS = ['penumpang', 'laba', 'kota', 'antarpulau', 'kelasTinggi', 'poTerendah', 'kios', 'parkir', 'kepuasan', 'perbaikan', 'bangun', 'daftarPo'] as const;
export type TemplatTugas = (typeof TEMPLAT_TUGAS)[number];

/** main = cukup bermain; sorotan = laju yang bisa dipercepat keputusan; kelola = satu keputusan. */
export type KelompokTugas = 'main' | 'sorotan' | 'kelola';

/** Komponen kepuasan yang bisa dinaikkan tugas `perbaikan` (bersama aksi yang menaikkannya, lihat sim/musim.ts). */
export const KOMPONEN_PERBAIKAN = ['kebersihan', 'keamanan', 'kenyamanan', 'fasilitas'] as const;
export type KomponenPerbaikan = (typeof KOMPONEN_PERBAIKAN)[number];

/** Hadiah satu tingkat rapor. Hiasan bertema memakai id `{slot}-{tema}`; `item` = id tetap (mis. bingkai emas). */
export type HadiahTingkat =
  | { readonly tingkat: number; readonly jenis: 'lencana'; readonly lencana: 'peserta' | 'lulus' | 'istimewa' }
  | { readonly tingkat: number; readonly jenis: 'hiasan'; readonly slot: SlotHiasan; readonly item?: string }
  | { readonly tingkat: number; readonly jenis: 'tiket'; readonly jumlah: number }
  | { readonly tingkat: number; readonly jenis: 'surat'; readonly jumlah: number };

export interface KonfigMusim {
  /** Senin 00.00 WIB awal Musim 1 ("YYYY-MM-DD"); musim ke-n mulai jangkar + n × mingguPerMusim minggu. */
  readonly mulai: string;
  readonly mingguPerMusim: number;
  readonly tema: readonly TemaMusimId[];
  /** Musim terbuka di level terminal ini (sesudah tutorial selesai atau dilewati, lihat main.ts). */
  readonly lvBuka: number;
  readonly tugas: {
    readonly perHari: number;
    /** Tugas hari D berlaku sampai akhir hari D + berlakuHari − 1 (WIB). */
    readonly berlakuHari: number;
    readonly maksTerbuka: number;
    /** Target = laju rata-rata sehari × durasiJam jam terminal (= menit main di 1×). */
    readonly durasiJam: number;
    /** Pengali target tugas sorotan (pemain pasif butuh ±10 menit, bukan 8). */
    readonly naikSorotan: number;
    /** Ambang tugas kepuasan = kepuasan saat dibuat, dibulatkan ke bawah ke kepuasanLangkah, dijepit min–maks. */
    readonly kepuasanMin: number;
    readonly kepuasanMaks: number;
    readonly kepuasanLangkah: number;
    /** Laju sumber sorotan (pnp per jam terminal) minimal supaya templatnya layak. */
    readonly arusMin: number;
    /**
     * Tugas perbaikan: hanya komponen di bawah ini, dan aksinya harus menaikkannya lebih dari perbaikanNaikMin.
     * Tuas "›" tugas sorotan memakai perbaikanNaikMin sebagai bagian: aksinya harus menaikkan laju sehari lebih dari itu.
     */
    readonly perbaikanMaks: number;
    readonly perbaikanNaikMin: number;
    readonly gantiGratisPerHari: number;
  };
  readonly poin: { readonly tugas: number; readonly tantangan: number; readonly perTingkat: number; readonly tingkat: number };
  readonly hadiah: readonly HadiahTingkat[];
  /** Batas bawah nilai rapor Baik, Sangat Baik, Istimewa (di bawah yang pertama: Cukup). */
  readonly nilai: readonly [number, number, number];
  /** Surat Armada: XP = bagian × kebutuhan level berikutnya PO pilihan (rumus berikanPaket). */
  readonly suratBagian: number;
  /** Hiasan yang sudah dimiliki (tema kembali tahun berikutnya) diganti tiket ganti sebanyak ini. */
  readonly tiketDuplikat: number;
  /** Kelas bus tugas kelasTinggi (Eksekutif ke atas). */
  readonly kelasTinggi: readonly string[];
}

export const KELOMPOK_TUGAS: Readonly<Record<TemplatTugas, KelompokTugas>> = {
  penumpang: 'main',
  laba: 'main',
  kota: 'sorotan',
  antarpulau: 'sorotan',
  kelasTinggi: 'sorotan',
  poTerendah: 'sorotan',
  kios: 'sorotan',
  parkir: 'sorotan',
  kepuasan: 'sorotan',
  perbaikan: 'kelola',
  bangun: 'kelola',
  daftarPo: 'kelola',
};

/** Id hiasan yang tidak bertema. */
export const BINGKAI_EMAS = 'bingkai-emas';

export const MUSIM: KonfigMusim = {
  mulai: '2026-11-30',
  mingguPerMusim: 6,
  tema: TEMA_MUSIM,
  lvBuka: 6,
  tugas: {
    perHari: 3,
    berlakuHari: 2,
    maksTerbuka: 6,
    durasiJam: 8,
    naikSorotan: 1.25,
    kepuasanMin: 0.5,
    kepuasanMaks: 0.8,
    kepuasanLangkah: 0.05,
    arusMin: 0.5,
    perbaikanMaks: 0.95,
    perbaikanNaikMin: 0.02,
    gantiGratisPerHari: 1,
  },
  poin: { tugas: 10, tantangan: 40, perTingkat: 45, tingkat: 30 },
  // Bagian 4.1 (susunan sama tiap musim, temanya berganti).
  hadiah: [
    { tingkat: 1, jenis: 'lencana', lencana: 'peserta' },
    { tingkat: 3, jenis: 'hiasan', slot: 'bingkai' },
    { tingkat: 5, jenis: 'hiasan', slot: 'spanduk' },
    { tingkat: 8, jenis: 'tiket', jumlah: 2 },
    { tingkat: 10, jenis: 'hiasan', slot: 'seragam' },
    { tingkat: 12, jenis: 'surat', jumlah: 1 },
    { tingkat: 15, jenis: 'hiasan', slot: 'papan' },
    { tingkat: 18, jenis: 'tiket', jumlah: 2 },
    { tingkat: 20, jenis: 'lencana', lencana: 'lulus' },
    { tingkat: 23, jenis: 'tiket', jumlah: 2 },
    { tingkat: 25, jenis: 'surat', jumlah: 1 },
    { tingkat: 28, jenis: 'tiket', jumlah: 2 },
    { tingkat: 30, jenis: 'lencana', lencana: 'istimewa' },
    { tingkat: 30, jenis: 'hiasan', slot: 'bingkai', item: BINGKAI_EMAS },
  ],
  nilai: [10, 20, 30],
  suratBagian: 0.5,
  tiketDuplikat: 1,
  kelasTinggi: ['eksekutif', 'sleeper', 'tingkat'],
};
