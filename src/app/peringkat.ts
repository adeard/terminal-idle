/**
 * Papan peringkat mingguan (murni; dipakai game DAN server di server/).
 *
 * Skor = penumpang yang diberangkatkan minggu ini selama main aktif (minggu
 * WIB yang sama dengan tantangan mingguan, `tantangan.penumpang` di state).
 * Hanya pemain yang login Google dan menyetujui yang ikut; yang tampil publik
 * hanya nama terminal, tipe terminal, dan skornya. Peringkat tidak memberi
 * hadiah gameplay, jadi curang tidak menguntungkan apa pun selain gengsi;
 * server tetap menolak kiriman yang tidak masuk akal (lihat validasiKiriman).
 *
 * Isi modul: kontrak API (bentuk data & kode galat), batas-batas, saringan
 * nama publik, id publik, validasi kiriman (server), pembaca jawaban server
 * (game), dan PengirimSkor (jadwal kirim skor dari game).
 */
import { PILIHAN_KECEPATAN } from '../config/waktu.config';
import { MAKS_NAMA_TERMINAL, rapikanNamaTerminal } from '../sim/profil';
import type { GameState } from '../sim/state';
import { mingguWib } from '../sim/tantangan';

/** Banyaknya baris teratas yang ditampilkan papan. */
export const JUMLAH_PAPAN = 50;
/** Peringkat pemain dihitung sampai sekian; di bawahnya "di luar 1.000 besar" (hemat baca database). */
export const BATAS_PERINGKAT = 1000;
/** Game mengirim skor paling sering tiap sekian (selain saat nama berubah & saat dijeda). */
export const SELANG_KIRIM_MS = 3 * 60_000;
/** Server menolak kiriman satu akun yang lebih rapat dari ini. */
export const SELANG_MIN_SERVER_MS = 20_000;
/** Arus penumpang tertinggi yang masih masuk akal (pnp/dtk); terminal terbesar pun jauh di bawahnya. */
export const ARUS_WAJAR_MAKS = 100_000;
/** Kecepatan waktu tercepat (penumpang bertambah sekian kali lebih cepat per detik nyata). */
export const KECEPATAN_MAKS = Math.max(...PILIHAN_KECEPATAN);
/** Skor akhir minggu lalu masih diterima sebentar setelah Senin 00.00 WIB. */
export const TENGGANG_MINGGU_MS = 10 * 60_000;
/** Tipe terminal tertinggi yang diterima (kelas = banyaknya naik kelas). */
const KELAS_MAKS = 10_000;

const WIB_MS = 7 * 3_600_000;

// ---------------------------------------------------------------------------
// Kontrak API (/api/peringkat, lihat server/peringkat.ts)

export interface EntriPeringkat {
  /** Id publik (lihat idPublik): hanya untuk menandai baris sendiri, tidak membuka akun. */
  readonly id: string;
  readonly nama: string;
  /** Kelas terminal (0 = Tipe C, …). */
  readonly kelas: number;
  readonly skor: number;
}

/** GET /api/peringkat?minggu=…: baris teratas sebuah minggu. */
export interface PapanPeringkat {
  readonly minggu: string;
  readonly daftar: readonly EntriPeringkat[];
  /** Banyaknya terminal yang ikut minggu itu. */
  readonly jumlah: number;
}

/** GET /api/peringkat/saya: skor & peringkat pemain yang login, minggu ini. */
export interface PeringkatSaya {
  readonly minggu: string;
  /** null = belum ada skor minggu ini di server. */
  readonly skor: number | null;
  /** null = belum ada skor, atau di luar BATAS_PERINGKAT. */
  readonly peringkat: number | null;
  readonly jumlah: number;
}

/** POST /api/peringkat: skor pemain yang login (nama & kelas ikut diperbarui). */
export interface KirimanSkor {
  readonly minggu: string;
  readonly skor: number;
  readonly kelas: number;
  readonly nama: string;
}

/**
 * - token: belum login / sesi login berakhir;
 * - dilarang: akun diblokir dari papan;
 * - terlalu-sering: kiriman terlalu rapat (coba lagi setelah `tungguMs`);
 * - minggu-lain: minggu kiriman bukan minggu ini menurut server (jam perangkat salah);
 * - nama-kosong / nama-ditolak: nama terminal kosong / tidak layak tampil publik;
 * - skor-tidak-wajar: skor naik lebih cepat dari yang mungkin;
 * - data-salah: bentuk kiriman salah; server / jaringan: gangguan sementara.
 */
export const KODE_GALAT_PERINGKAT = ['token', 'dilarang', 'terlalu-sering', 'minggu-lain', 'nama-kosong', 'nama-ditolak', 'skor-tidak-wajar', 'data-salah', 'server', 'jaringan'] as const;
export type KodeGalatPeringkat = (typeof KODE_GALAT_PERINGKAT)[number];

export function isKodeGalatPeringkat(nilai: unknown): nilai is KodeGalatPeringkat {
  return typeof nilai === 'string' && (KODE_GALAT_PERINGKAT as readonly string[]).includes(nilai);
}

export class GalatPeringkat extends Error {
  constructor(
    readonly kode: KodeGalatPeringkat,
    /** Untuk 'terlalu-sering': tunggu sekian ms sebelum mengirim lagi. */
    readonly tungguMs = 0,
  ) {
    super(`Papan peringkat: ${kode}`);
    this.name = 'GalatPeringkat';
  }
}

/** Layanan papan peringkat dari sisi game (diimplementasikan platform/peringkat.ts). */
export interface ApiPeringkat {
  papan(minggu: string): Promise<PapanPeringkat>;
  saya(): Promise<PeringkatSaya>;
  kirim(k: KirimanSkor): Promise<void>;
  /** Hapus semua skor pemain ini dari papan (keluar papan / hapus akun). */
  keluar(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Minggu

/** Senin 00.00 WIB (ms epoch) dari kunci minggu "YYYY-MM-DD", atau null kalau bukan kunci Senin yang sah. */
export function mulaiMingguDariKunci(kunci: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(kunci);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - WIB_MS;
  return Number.isFinite(ms) && mingguWib(ms).kunci === kunci ? ms : null;
}

/** Kunci minggu sebelum `kunci`. */
export function mingguSebelum(kunci: string): string | null {
  const mulai = mulaiMingguDariKunci(kunci);
  return mulai === null ? null : mingguWib(mulai - 1).kunci;
}

// ---------------------------------------------------------------------------
// Nama publik

/**
 * Kata kasar, cabul, & kebencian yang tidak boleh tampil di papan. Dibandingkan
 * setelah huruf kecil, tanpa aksen, dan angka "leet" diganti huruf. Kata
 * pendek hanya cocok sebagai kata utuh (supaya "Pantai" & "Pasuruan" tetap
 * boleh); kata panjang cocok di mana pun, termasuk yang dieja berspasi.
 */
const TERLARANG_UTUH: ReadonlySet<string> = new Set([
  'asu', 'tai', 'taik', 'babi', 'anjing', 'anjg', 'njing', 'bego', 'goblok', 'goblog', 'tolol', 'kampret', 'bangsat',
  'kontol', 'memek', 'ngentot', 'ngewe', 'pepek', 'peler', 'titit', 'bokep', 'lonte', 'pelacur', 'perek', 'jablay', 'sange', 'sangean', 'coli',
  'kafir', 'pki', 'nazi',
  'fuck', 'shit', 'bitch', 'cunt', 'pussy', 'porn', 'porno', 'sex', 'seks', 'whore', 'slut', 'nigga', 'nigger', 'faggot', 'asshole', 'bastard',
]);
const TERLARANG_DI_MANA_PUN: readonly string[] = [
  'kontol', 'memek', 'ngentot', 'ngewe', 'jancok', 'jancuk', 'dancok', 'bangsat', 'bajingan', 'keparat', 'goblok', 'bokep', 'pelacur', 'lonte', 'jablay',
  'fuck', 'bitch', 'nigger', 'faggot', 'asshole', 'hitler',
];
const LEET: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b' };

/** Nama (sudah dirapikan) boleh tampil di papan peringkat. */
export function namaLayakPublik(nama: string): boolean {
  const huruf = nama
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[0134578]/g, (c) => LEET[c]!);
  if (huruf.split(/[^a-z]+/).some((k) => TERLARANG_UTUH.has(k))) return false;
  const rapat = huruf.replace(/[^a-z]/g, '');
  return !TERLARANG_DI_MANA_PUN.some((k) => rapat.includes(k));
}

/**
 * Id publik dari uid akun (hash cyrb53, bukan rahasia): stabil, cukup unik,
 * dan tidak memperlihatkan uid. Game memakainya untuk menandai baris sendiri.
 */
export function idPublik(uid: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < uid.length; i++) {
    const c = uid.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36).padStart(11, '0');
}

// ---------------------------------------------------------------------------
// Validasi di server

export type HasilValidasi = { readonly ok: true; readonly kiriman: KirimanSkor } | { readonly ok: false; readonly kode: KodeGalatPeringkat };

/**
 * Periksa & rapikan isi POST. Minggu harus minggu ini menurut jam server
 * (atau minggu lalu, sebentar setelah berganti); nama dirapikan seperti di game
 * dan disaring; skor dibulatkan ke bawah.
 */
export function validasiKiriman(isi: unknown, sekarangMs: number): HasilValidasi {
  if (typeof isi !== 'object' || isi === null) return { ok: false, kode: 'data-salah' };
  const { minggu, skor, kelas, nama } = isi as Record<string, unknown>;
  if (typeof minggu !== 'string' || typeof nama !== 'string' || nama.length > MAKS_NAMA_TERMINAL * 4) return { ok: false, kode: 'data-salah' };
  if (typeof skor !== 'number' || !Number.isFinite(skor) || skor < 0) return { ok: false, kode: 'data-salah' };
  if (typeof kelas !== 'number' || !Number.isInteger(kelas) || kelas < 0 || kelas > KELAS_MAKS) return { ok: false, kode: 'data-salah' };
  const ini = mingguWib(sekarangMs);
  const lalu = mingguWib(ini.mulaiMs - 1);
  if (minggu !== ini.kunci && !(minggu === lalu.kunci && sekarangMs - ini.mulaiMs < TENGGANG_MINGGU_MS)) return { ok: false, kode: 'minggu-lain' };
  const rapi = rapikanNamaTerminal(nama);
  if (rapi === '') return { ok: false, kode: 'nama-kosong' };
  if (!namaLayakPublik(rapi)) return { ok: false, kode: 'nama-ditolak' };
  return { ok: true, kiriman: { minggu, skor: Math.floor(skor), kelas, nama: rapi } };
}

/**
 * Skor tertinggi yang mungkin dicapai dari `skorLama` sejak `dariMs`: arus
 * wajar maksimal × kecepatan waktu tercepat × lama waktunya, ditambah kelonggaran.
 */
export function skorMaksWajar(skorLama: number, dariMs: number, sekarangMs: number): number {
  const detik = Math.max(0, sekarangMs - dariMs) / 1000;
  return skorLama + ARUS_WAJAR_MAKS * KECEPATAN_MAKS * detik + 1000;
}

/** Awal minggu (ms) sebuah kunci yang sudah lolos validasi. */
export function mulaiMinggu(kunci: string): number {
  return mulaiMingguDariKunci(kunci) ?? 0;
}

// ---------------------------------------------------------------------------
// Jawaban server → data game (bentuknya diperiksa; server lain versi bisa berbeda)

function angka(nilai: unknown, nama: string): number {
  if (typeof nilai !== 'number' || !Number.isFinite(nilai)) throw new Error(`Jawaban papan peringkat tidak valid: ${nama}`);
  return nilai;
}

function teks(nilai: unknown, nama: string): string {
  if (typeof nilai !== 'string') throw new Error(`Jawaban papan peringkat tidak valid: ${nama}`);
  return nilai;
}

function objek(nilai: unknown, nama: string): Record<string, unknown> {
  if (typeof nilai !== 'object' || nilai === null || Array.isArray(nilai)) throw new Error(`Jawaban papan peringkat tidak valid: ${nama}`);
  return nilai as Record<string, unknown>;
}

export function bacaPapan(json: unknown): PapanPeringkat {
  const o = objek(json, 'papan');
  if (!Array.isArray(o['daftar'])) throw new Error('Jawaban papan peringkat tidak valid: daftar');
  return {
    minggu: teks(o['minggu'], 'minggu'),
    jumlah: angka(o['jumlah'], 'jumlah'),
    daftar: o['daftar'].map((x, i) => {
      const e = objek(x, `daftar.${i}`);
      return { id: teks(e['id'], 'id'), nama: teks(e['nama'], 'nama'), kelas: angka(e['kelas'], 'kelas'), skor: angka(e['skor'], 'skor') };
    }),
  };
}

export function bacaSaya(json: unknown): PeringkatSaya {
  const o = objek(json, 'saya');
  const skor = o['skor'] === null ? null : angka(o['skor'], 'skor');
  const peringkat = o['peringkat'] === null ? null : angka(o['peringkat'], 'peringkat');
  return { minggu: teks(o['minggu'], 'minggu'), skor, peringkat, jumlah: angka(o['jumlah'], 'jumlah') };
}

/** Peringkat tampilan per baris: skor sama = peringkat sama (1, 2, 2, 4). */
export function peringkatBaris(daftar: readonly EntriPeringkat[]): number[] {
  const hasil: number[] = [];
  daftar.forEach((e, i) => hasil.push(i > 0 && e.skor === daftar[i - 1]!.skor ? hasil[i - 1]! : i + 1));
  return hasil;
}

// ---------------------------------------------------------------------------
// Pengiriman skor dari game

/** Isi kiriman dari state, atau null kalau pemain tidak ikut / minggu belum dimulai. */
export function kirimanDari(state: GameState): KirimanSkor | null {
  const t = state.tantangan;
  if (!state.profil.ikutPeringkat || t.minggu === null) return null;
  return { minggu: t.minggu, skor: Math.floor(t.penumpang), kelas: state.prestige.jumlahReset, nama: state.profil.namaTerminal };
}

/** Galat yang menghentikan pengiriman sampai sesi dimuat ulang. */
const GALAT_MATI: ReadonlySet<KodeGalatPeringkat> = new Set(['token', 'dilarang']);
/** Galat yang menghentikan pengiriman sampai nama atau minggunya berubah. */
const GALAT_TAHAN: ReadonlySet<KodeGalatPeringkat> = new Set(['nama-kosong', 'nama-ditolak', 'minggu-lain', 'skor-tidak-wajar', 'data-salah']);
/** Jarak aman antarkiriman (sedikit di atas batas server). */
const JEDA_MIN_MS = SELANG_MIN_SERVER_MS + 5000;
const TUNDA_GAGAL_MS = 30_000;
const TUNDA_GAGAL_MAKS_MS = 10 * 60_000;

/**
 * Jadwal kirim skor: dipanggil tiap state berubah (murah kalau belum waktunya).
 * Skor dikirim paling sering tiap SELANG_KIRIM_MS; perubahan nama, kelas, atau
 * minggu dikirim segera; saat game dijeda skor terakhir dikirim tanpa menunggu
 * selang. Gangguan jaringan dicoba lagi dengan jeda yang makin panjang.
 */
export class PengirimSkor {
  private terkirim: { readonly k: KirimanSkor; readonly ms: number } | null = null;
  /** Kiriman yang sedang berjalan. */
  private jalan: Promise<void> | null = null;
  private tundaHinggaMs = 0;
  private gagalBeruntun = 0;
  private tahan: { readonly kode: KodeGalatPeringkat; readonly nama: string; readonly minggu: string } | null = null;
  private mati: KodeGalatPeringkat | null = null;
  private readonly pendengar = new Set<() => void>();

  constructor(
    private readonly kirim: (k: KirimanSkor) => Promise<void>,
    private readonly jam: () => number = () => Date.now(),
    private readonly selangMs = SELANG_KIRIM_MS,
  ) {}

  /** Galat yang sedang menghentikan pengiriman (untuk UI), atau null. */
  get galat(): KodeGalatPeringkat | null {
    return this.mati ?? this.tahan?.kode ?? null;
  }

  /** Kiriman terakhir yang diterima server. */
  get terakhir(): KirimanSkor | null {
    return this.terkirim?.k ?? null;
  }

  /** Dipanggil saat galat atau kiriman berhasil (UI kartu peringkat). */
  berlangganan(f: () => void): () => void {
    this.pendengar.add(f);
    return () => this.pendengar.delete(f);
  }

  /** @param segera game dijeda/ditutup: kirim skor terakhir tanpa menunggu selang. */
  periksa(state: GameState, segera = false): void {
    const k = kirimanDari(state);
    if (k === null) {
      if (!state.profil.ikutPeringkat) this.lupakan();
      return;
    }
    if (this.mati || this.jalan) return;
    if (this.tahan) {
      if (this.tahan.nama === k.nama && this.tahan.minggu === k.minggu) return;
      this.tahan = null;
    }
    const sekarang = this.jam();
    if (sekarang < this.tundaHinggaMs) return;
    const t = this.terkirim;
    if (t) {
      const sama = t.k.minggu === k.minggu && t.k.nama === k.nama && t.k.kelas === k.kelas;
      if (sama && t.k.skor === k.skor) return;
      const jeda = sekarang - t.ms;
      if (jeda < JEDA_MIN_MS) return;
      if (sama && !segera && jeda < this.selangMs) return;
    }
    void this.mulai(k, sekarang).catch(() => undefined);
  }

  /**
   * Kirim sekarang juga atas perintah pemain (mis. tepat setelah ikut papan),
   * tanpa menunggu selang; galatnya dilempar supaya UI bisa menampilkannya.
   * Kiriman yang sedang berjalan (biasanya dimulai `periksa` saat aksi ikut
   * diterapkan) dipakai, bukan dikirim dua kali.
   */
  kirimSekarang(state: GameState): Promise<void> {
    if (this.jalan) return this.jalan;
    const k = kirimanDari(state);
    if (k === null) return Promise.resolve();
    this.mati = null;
    this.tahan = null;
    return this.mulai(k, this.jam());
  }

  /** Lupakan kiriman terakhir (keluar papan): ikut lagi = langsung dikirim. */
  lupakan(): void {
    this.terkirim = null;
    this.tahan = null;
    this.gagalBeruntun = 0;
    this.tundaHinggaMs = 0;
  }

  private mulai(k: KirimanSkor, sekarang: number): Promise<void> {
    const jalan = this.kirim(k)
      .then(
        () => {
          this.terkirim = { k, ms: sekarang };
          this.gagalBeruntun = 0;
        },
        (e: unknown) => {
          const kode = e instanceof GalatPeringkat ? e.kode : 'jaringan';
          if (GALAT_MATI.has(kode)) this.mati = kode;
          else if (GALAT_TAHAN.has(kode)) this.tahan = { kode, nama: k.nama, minggu: k.minggu };
          else if (kode === 'terlalu-sering') this.tundaHinggaMs = this.jam() + Math.max(e instanceof GalatPeringkat ? e.tungguMs : 0, SELANG_MIN_SERVER_MS);
          else {
            this.gagalBeruntun++;
            this.tundaHinggaMs = this.jam() + Math.min(TUNDA_GAGAL_MAKS_MS, TUNDA_GAGAL_MS * 2 ** (this.gagalBeruntun - 1));
          }
          throw e;
        },
      )
      .finally(() => {
        this.jalan = null;
        for (const f of this.pendengar) f();
      });
    this.jalan = jalan;
    return jalan;
  }
}
