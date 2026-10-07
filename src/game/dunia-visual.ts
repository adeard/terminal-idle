/**
 * Model keramaian DEKORATIF: bus dan orang yang bergerak di terminal isometrik.
 * Bukan simulasi ekonomi. Uang tetap dihitung di sim/; model ini hanya
 * membaca laju visual (lihat laju.ts) dan dibatasi jumlahnya (MAKS_ORANG, slot).
 * Murni TypeScript tanpa three.js, jadi perilakunya bisa dites.
 *
 * Bus (semua gerak maju, belok lewat kurva halus, jaga jarak dengan bus di depan):
 *   jalan raya → kurva masuk → halte kedatangan (turunkan) → parkir serong di
 *   pangkalan & dicuci → lorong belakang → halte keberangkatan (ngetem, muat) →
 *   pindah ke lajur sirkulasi → kurva keluar → jalan raya.
 * Orang berjalan dengan laju alami (KECEPATAN_JALAN), dua arus terpisah:
 *   - penumpang turun di peron kedatangan lalu langsung berjalan keluar terminal
 *     (gerbang KELUAR di pagar belakang → trotoar jalan belakang), tidak antre lagi;
 *   - calon penumpang datang dari luar (trotoar jalan belakang lewat gerbang MASUK,
 *     atau dari parkir) → masuk pintu gedung → berjalan langsung ke ujung antrean
 *     di labirin (dua baris per lajur; meluap keluar pintu bila penuh) → beli
 *     tiket di jendela loket → berjalan menyusuri aula ke ruang tunggu → duduk →
 *     dipanggil saat busnya keluar pangkalan, berkumpul di balik gerbang → naik bus.
 * Jumlah calon penumpang yang datang mengikuti jumlah yang turun, jadi arus tetap
 * seimbang dengan kapasitas bus dan kerumunan hanya menumpuk di depan bottleneck.
 * Laju visual (laju.ts) dibatasi di bawah daya tampung jalan kaki (antrean dua
 * baris, jendela loket, gerbang), jadi langkah yang pelan tidak memunculkan
 * hambatan palsu.
 */
import { bezier, Jalur, lintasanS, sambung } from './jalur';
import type { LajuVisual } from './laju';
import { dalamRentang, JAM_LOKET_MALAM, tokoBuka, type JenisToko } from './kehidupan-malam';
import { anggotaRombongan } from './rombongan';
import {
  BAGASI,
  BLOK_KURSI,
  BUS,
  CUCI,
  GEDUNG,
  GERBANG_KELUAR_X,
  GERBANG_MASUK_X,
  GERBANG_X,
  HALTE_BERANGKAT_X,
  HALTE_DATANG_X,
  ISTIRAHAT_DETIK,
  JALUR_ANTREAN,
  JUMLAH_SLOT_LABIRIN,
  JUMLAH_SLOT_LUAPAN,
  KAPASITAS_ANTREAN,
  KECEPATAN_JALAN,
  KELOMPOK_PARKIR,
  KELUAR,
  KOLOM_KANOPI_DATANG,
  KURSI,
  KURSI_TUNGGU,
  LABIRIN,
  LAJU_BUS_LEWAT,
  LAJUR,
  LOKET,
  LORONG_PARKIR,
  MAKS_NGETEM_DETIK,
  MAKS_ORANG,
  MASUK,
  MASUK_SIRKULASI,
  MULUT_ANTREAN,
  PANJANG_PINDAH_LAJUR,
  jurusanDiMask,
  type KelompokParkir,
  MASK_SEMUA_JURUSAN,
  PARKIR_SERONG,
  PERON,
  PERON_BERANGKAT,
  PINTU_BUS,
  PINTU_RUANG_TUNGGU,
  posisiPembeli,
  RUANG_TUNGGU,
  RUTE_DARI_PARKIR,
  SAMBUNG_BERANGKAT,
  SINGGAH_GERBANG_MASUK,
  TITIK_PINTU_LUAR,
  TUJUAN_BUS,
  VARIASI_JALAN,
  X_HILANG,
  X_JALUR_KAKI,
  X_LOKET,
  X_MUNCUL,
  X_TUNGGU_MASUK,
  X_TURUN_KE_LORONG,
  Y_DEPAN_GERBANG,
  Y_LORONG_LOKET,
  Y_LORONG_TUNGGU,
  Y_PAGAR,
  Y_TROTOAR_BELAKANG,
  Y_TURUN_PERON,
  RUANG_SAYAP,
  ruteKeluarSayap,
  ruteMasukSayap,
  SINGGAH,
  X_MUKA_KIOS,
  type GayaSinggah,
  type JenisKelamin,
  type KelompokSinggah,
  type Titik,
  type TitikSinggah,
} from './tata-letak';

export type JenisBus = 'terminal' | 'lewat';
export type FaseBus = 'lewat' | 'masuk' | 'turunkan' | 'kePetak' | 'parkir' | 'keHalteBerangkat' | 'muat' | 'keluar';

export interface BusVisual {
  readonly id: number;
  readonly jenis: JenisBus;
  readonly livery: number;
  /** Bus Emas (hadiah iklan): bus lewat berwarna emas. */
  readonly emas: boolean;
  x: number;
  y: number;
  /** Arah hadap bus (radian, 0 = +x). */
  sudut: number;
  fase: FaseBus;
  /** Indeks halte (kedatangan atau keberangkatan, tergantung fase); −1 = belum ada. */
  halte: number;
  /** Indeks petak parkir serong; −1 = tidak parkir. */
  petak: number;
  /** True selama bus keluar dari petak dan belum lurus di lorong belakang. */
  menyatuLorong: boolean;
  /** Penumpang yang dibawa bus saat tiba (untuk kemajuan menurunkan penumpang). */
  readonly muatanDatang: number;
  /** Penumpang di bus; saat memuat: yang sudah naik + yang sudah dipanggil dan sedang berjalan ke pintu. */
  muatan: number;
  /** Penumpang berangkat yang sudah benar-benar naik (masuk pintu). */
  penumpangNaik: number;
  /** Kursi untuk penumpang berangkat (bisa lebih dari muatan datang saat terminal sepi). */
  readonly kapasitas: number;
  /** Detik di fase sekarang (parkir/ngetem). */
  tunggu: number;
  /** Detik sejak penumpang terakhir turun. */
  jeda: number;
  /** Debu bawaan perjalanan saat tiba (0 = bersih, 1 = sangat kotor). Bus lewat selalu 0. */
  readonly debu: number;
  /** Kemajuan cuci di petak parkir: 0 = belum, 1 = selesai (bus boleh berangkat). */
  cuci: number;
  /** Jurusan (indeks TUJUAN_BUS) yang ditugaskan saat bus masuk pangkalan; −1 = belum. */
  tujuan: number;
  /** Kemajuan istirahat/menunggu jadwal setelah dicuci: 1 = boleh berangkat. */
  istirahat: number;
  jalur: Jalur;
  /** Jarak tempuh di sepanjang jalur. */
  s: number;
  /** Kecepatan (petak/detik), selalu ≥ 0. */
  v: number;
  selesai: boolean;
}

export type FaseOrang =
  /** Turun dari bus kedatangan lalu berjalan keluar terminal (pulang). */
  | 'pulang'
  /** Calon penumpang dari luar berjalan ke mulut antrean di depan pintu masuk. */
  | 'keAntrean'
  /** Masuk pintu & celah labirin, menyusuri lajur labirin ke ujung barisnya; mendapat urutan saat tiba. */
  | 'keEkor'
  /** Antre: maju menyusuri lajur labirin di aula, atau baris luapan di luar pintu. */
  | 'antre'
  /** Dipanggil loket: berjalan dari kepala antrean ke jendela loket (atau menunggu di belakangnya). */
  | 'keLoket'
  /** Di jendela loket, membeli tiket. */
  | 'beliTiket'
  /** Bertiket: menyusuri aula ke pintu ruang tunggu lalu ke kursinya (juga kembali ke kursi setelah mampir). */
  | 'keRuangTunggu'
  /** Mampir: toilet, musholla, ATM, toko aula (setelah beli tiket) atau kios ruang tunggu (dari kursi); lihat OrangVisual.singgah. */
  | 'singgah'
  /** Duduk di kursi ruang tunggu menunggu bus. */
  | 'tungguBerangkat'
  /** Busnya sedang masuk halte: berdiri & berkumpul di balik gerbang. */
  | 'keGerbang'
  /** Busnya sudah berhenti: keluar gerbang lalu naik lewat pintu depan. */
  | 'naikBus';

/**
 * Yang sedang dilakukan orang di tempat singgah (untuk digambar): biasa, di
 * dalam bilik toilet (tidak digambar), atau sholat (berdiri / duduk bergantian).
 */
export type GayaOrang = 'biasa' | 'bilik' | 'sholatBerdiri' | 'sholatDuduk';

/** Satu langkah kunjungan: jalan ke titik singgah, lalu singgah selama `lama`. */
export interface LangkahKunjungan {
  readonly rute: readonly Titik[];
  readonly titik: TitikSinggah;
  readonly lama: number;
}

/** Rencana mampir: urutan titik singgah, lalu jalan lanjutan kembali ke kursi. */
export interface Kunjungan {
  readonly tempat: string;
  readonly langkah: readonly LangkahKunjungan[];
  /** Indeks langkah yang sedang dituju / dijalani. */
  i: number;
  /** Sudah tiba di titik langkah ke-i (sedang singgah). */
  tiba: boolean;
  /** Jalan setelah langkah terakhir sampai kursi; setelah itu fase keRuangTunggu. */
  readonly lanjut: readonly Titik[];
}

type TempatMampir = 'toilet' | 'musholla' | 'atm' | 'minimarket' | 'apotek';

/** Titik singgah yang sudah dipesan dan lamanya. */
interface PesananSinggah {
  readonly titik: TitikSinggah;
  readonly lama: number;
}

function buatKunjungan(tempat: string, rute: readonly (readonly Titik[])[], pesan: readonly PesananSinggah[], lanjut: readonly Titik[]): Kunjungan {
  return { tempat, langkah: pesan.map((p, i) => ({ rute: rute[i]!, titik: p.titik, lama: p.lama })), i: 0, tiba: false, lanjut };
}

/** Gaya selama singgah. Sholat: berdiri lalu duduk bergantian (±7 detik per rakaat), duduk tasyahud di akhir. */
export function gayaSinggah(gaya: GayaSinggah, sudah: number, sisa: number): GayaOrang {
  if (gaya === 'bilik') return 'bilik';
  if (gaya !== 'sholat') return 'biasa';
  if (sisa < 5) return 'sholatDuduk';
  return sudah % 7 < 4.5 ? 'sholatBerdiri' : 'sholatDuduk';
}

/** Pilih satu dari [nilai, bobot] dengan angka acak u ∈ [0, 1). */
function pilihBerbobot<T>(pilihan: readonly (readonly [T, number])[], u: number): T {
  const total = pilihan.reduce((a, [, b]) => a + b, 0);
  let x = u * total;
  for (const [nilai, bobot] of pilihan) {
    if (x < bobot) return nilai;
    x -= bobot;
  }
  return pilihan[0]![0];
}

/**
 * Jurusan bus di kelompok petaknya, tetap untuk id bus yang sama: sebanding
 * bagian penumpang tiap jurusan (harga tiket), atau bergiliran bila tidak ada.
 */
function pilihTujuan(pilihan: readonly number[], bagian: readonly number[] | null, idBus: number): number {
  const bobot = pilihan.map((t) => [t, Math.max(0, bagian?.[t] ?? 0)] as const);
  if (!bagian || !bobot.some(([, b]) => b > 0)) return pilihan[idBus % pilihan.length]!;
  return pilihBerbobot(bobot, (((idBus * 0.6180339887) % 1) + 1) % 1);
}

export interface OrangVisual {
  readonly id: number;
  readonly varian: number;
  x: number;
  y: number;
  fase: FaseOrang;
  rute: Titik[];
  /** Indeks kursi ruang tunggu (sejak dilayani loket), −1 kalau belum punya. */
  slot: number;
  /** Kursi di sebelahnya yang dipesan untuk anggota rombongannya (lihat rombongan.ts), urut anggota. */
  kursiRombongan: number[];
  /** Indeks loket tempat membeli tiket, −1 kalau tidak sedang di loket. */
  loket: number;
  /** Posisi di lintasan antrean (jarak dari kepala antrean), −1 kalau belum menapak lintasan. */
  s: number;
  /** Baris antrean (0/1, dua baris berdampingan per lajur), −1 kalau tidak sedang antre. */
  kolom: number;
  timer: number;
  /** Lama total timer yang sedang berjalan (detik main): kemajuan transaksi di jendela loket. */
  lamaTimer: number;
  busId: number;
  bergerak: boolean;
  selesai: boolean;
  gaya: GayaOrang;
  /** Rencana mampir yang sedang dijalani (fase singgah), null kalau tidak. */
  singgah: Kunjungan | null;
}

/**
 * Kejadian bus pada frame ini (untuk suara): berhenti (rem angin), tiba di halte
 * kedatangan, dipanggil ke halte keberangkatan (pengumuman), berangkat.
 */
export type JenisPeristiwaBus = 'berhenti' | 'tiba' | 'panggil' | 'berangkat';

export interface PeristiwaBus {
  readonly jenis: JenisPeristiwaBus;
  readonly busId: number;
  readonly x: number;
  readonly y: number;
  /** Indeks halte keberangkatan (untuk 'panggil'), −1 kalau tidak ada. */
  readonly halte: number;
  /** Jurusan bus (indeks TUJUAN_BUS), −1 kalau belum ditugaskan. */
  readonly tujuan: number;
}

/**
 * Transaksi yang terlihat (untuk efek "+Rp", lihat kas-visual.ts): tiket terjual
 * di jendela loket, bus parkir di petak (retribusi), kendaraan pengantar parkir
 * (calon penumpang datang dari lorong parkir), dan penumpang selesai belanja di
 * kios ruang tunggu, minimarket, atau apotek.
 */
export type JenisTransaksi = 'tiket' | 'retribusi' | 'parkir' | 'belanja';

export interface TransaksiVisual {
  readonly jenis: JenisTransaksi;
  readonly x: number;
  readonly y: number;
}

/** Tempat singgah yang berbelanja (uangnya jadi omzet kios). */
const TEMPAT_BELANJA: ReadonlySet<string> = new Set(['kios', 'minimarket', 'apotek']);

export interface OpsiDunia {
  readonly acak?: () => number;
  readonly jumlahLivery?: number;
  readonly jumlahVarianOrang?: number;
  /** Varian penampilan ini wanita (ke toilet/musholla wanita)? Bawaan: tiap varian ke-3. */
  readonly wanita?: (varian: number) => boolean;
}

/** PRNG kecil yang bisa di-seed (mulberry32), supaya test deterministik. */
export function acakBerbenih(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EPS_SAMPAI = 0.015;
/** Jarak di sepanjang lintasan untuk menentukan lajur yang dituju bus (lihat ruangDepan). */
const LIHAT_DEPAN = 1.3;
/** Konstanta waktu (detik) rata-rata bergerak arus penumpang turun. */
const TAU_ARUS_NYATA = 12;
/** Loket sedikit lebih cepat dari arus masuk bila kapasitasnya setara dengan peron. */
const MARJIN_HILIR = 1.04;
const SEMUA_LOKET: readonly number[] = X_LOKET.map((_, i) => i);
/** Variasi isi bus yang datang (± pecahan dari muatanBus). */
const VARIASI_MUATAN = 0.3;
/** Calon penumpang yang tertunda paling banyak sekian (sisanya dianggap batal datang). */
const MAKS_CALON_DATANG = 12;
/** Porsi calon penumpang yang datang dari parkir mobil (sisanya dari trotoar jalan belakang). */
const PELUANG_DARI_PARKIR = 0.28;
/** Orang terdepan antrean boleh dilayani loket bila sudah sedekat ini ke slot terdepan. */
const JARAK_DILAYANI = 0.22;
/**
 * Lama transaksi di jendela loket (detik main). Sepanjang mungkin supaya
 * terlihat natural (bertanya, membayar, menerima tiket), tapi menyusut saat
 * loket cepat supaya jendela yang buka tidak jadi hambatan palsu (lihat
 * lamaBeli). Arus visual dibatasi per jendela buka (laju.ts), jadi pada
 * umumnya lama ini ±2,5–7 detik; batas bawah hanya untuk arus ekstrem.
 */
const LAMA_BELI = { min: 0.35, maks: 7 } as const;
const CADANGAN_JENDELA = 0.75;
/** Waktu pembeli berikutnya melangkah dari tempat tunggu ke jendela. */
const DETIK_MAJU = 0.6;
/**
 * Petugas loket bergegas saat antrean menumpuk (mis. dua bus menurunkan
 * penumpang sekaligus): mulai dari sekian orang berdiri di antrean, penuh
 * pada sekian orang (lihat lamaBeli).
 */
const BERDIRI_SANTAI = 0;
const BERDIRI_BERGEGAS = 4;
/** Peluang pembeli yang bepergian sendiri mampir (toilet, musholla, ATM, toko) setelah membeli tiket. */
const PELUANG_MAMPIR = { siang: 0.34, malam: 0.2 } as const;
/** Rata-rata detik duduk sebelum penumpang (sendirian) bangun ke kios ruang tunggu. */
const RATA_DUDUK_KE_KIOS = 240;
/** Paling cepat bangun ke kios setelah sekian detik duduk. */
const MIN_DUDUK_SEBELUM_KIOS = 10;
/** Awal waktu sholat (jam): Subuh, Dzuhur, Ashar, Maghrib, Isya. Musholla lebih ramai ±50 menit sesudahnya. */
const WAKTU_SHOLAT: readonly number[] = [4.6, 11.95, 15.2, 17.95, 19.15];
/** Rata-rata waktu jalan dari kepala antrean ke jendela loket (±2,6 petak). */
const DETIK_KE_JENDELA = 2.6 / KECEPATAN_JALAN;
/** Lintasan antrean (labirin → pintu masuk → baris luapan); slot ke-i sejauh i × LABIRIN.jarak dari kepala. */
const JALUR_ANTRE = new Jalur(JALUR_ANTREAN);
/** Jarak di lintasan antrean dari kepala sampai titik di luar pintu masuk. */
const S_PINTU_LUAR = new Jalur(JALUR_ANTREAN.slice(0, JALUR_ANTREAN.indexOf(TITIK_PINTU_LUAR) + 1)).panjang;
/** Slot per baris di seluruh lintasan antrean. */
const JUMLAH_SLOT_ANTREAN = JUMLAH_SLOT_LABIRIN + JUMLAH_SLOT_LUAPAN;
/**
 * Titik kumpul di balik gerbang (dx, dy) untuk penumpang ke-n yang dipanggil ke
 * satu bus: petak 4 × 4 di antara gerbang dan baris kursi terdepan.
 */
const KUMPUL_GERBANG: readonly Titik[] = Array.from({ length: 16 }, (_, n): Titik => [((n % 4) - 1.5) * 0.14, Math.floor(n / 4) * 0.13]);

/**
 * Deretan halte satu lajur (FIFO). Indeks 0 = paling depan. Bus dari belakang
 * hanya bisa mencapai halte yang semua halte di belakangnya kosong.
 */
class Barisan {
  readonly penghuni: number[];
  /** Halte yang boleh dipesan, terdepan dulu; sisanya milik jalur yang belum dibangun. */
  aktif: number;

  constructor(readonly posisiX: readonly number[]) {
    this.penghuni = posisiX.map(() => 0);
    this.aktif = posisiX.length;
  }

  /** Ada bus (berhenti atau sedang menuju) di halte di belakang halte k. */
  terisiDiBelakang(k: number): boolean {
    return this.penghuni.slice(k + 1).some((id) => id !== 0);
  }

  /** Maju ke halte kosong terdepan yang bisa dicapai tanpa menyalip. */
  majuDari(k: number, id: number): number {
    let j = k;
    for (let i = k - 1; i >= 0; i--) {
      if (this.penghuni[i] !== 0) break;
      j = i;
    }
    if (j !== k) {
      this.penghuni[k] = 0;
      this.penghuni[j] = id;
    }
    return j;
  }

  /**
   * Halte kosong mana pun, terdepan dulu, tanpa syarat halte di belakangnya
   * kosong (bus mencapainya lewat lajur sirkulasi). −1 kalau penuh.
   */
  pesanBebas(id: number): number {
    for (let k = 0; k < this.aktif; k++) {
      if (this.penghuni[k] !== 0) continue;
      this.penghuni[k] = id;
      return k;
    }
    return -1;
  }

  lepas(k: number, id: number): void {
    if (k >= 0 && this.penghuni[k] === id) this.penghuni[k] = 0;
  }
}

export class DuniaVisual {
  readonly bus: BusVisual[] = [];
  readonly orang: OrangVisual[] = [];
  /** Kejadian bus selama perbarui() terakhir (dikosongkan tiap frame). */
  readonly peristiwa: PeristiwaBus[] = [];
  /** Transaksi selama perbarui() terakhir (dikosongkan tiap frame). */
  readonly transaksi: TransaksiVisual[] = [];

  private readonly acak: () => number;
  private readonly jumlahLivery: number;
  private readonly jumlahVarianOrang: number;
  private idBerikut = 1;
  private akumMasuk = 0;
  private akumLewat = 0;
  private akumTurun = 0;
  private akumLayan = 0;
  private akumNaik = 0;
  private faktorKecepatan = 1;
  private totalBusKeluar = 0;
  private totalNaikBus = 0;
  private totalTurun = 0;
  private totalPulang = 0;
  private totalDatang = 0;
  /** Orang yang sedang berjalan dari luar ke antrean (belum punya urutan), dihitung tiap frame. */
  private menujuAntrean = 0;
  /** Peringkat tiap orang di barisnya (0 = terdepan) dan jumlah orang per baris antrean. */
  private readonly peringkat = new Map<number, number>();
  private readonly isiKolom = [0, 0];
  /** Orang yang sedang berjalan ke ujung tiap baris (belum mendapat urutan). */
  private readonly menujuKolom = [0, 0];
  /** Posisi (s) orang yang sedang menyusuri labirin menuju ujung antrean, per baris (diisi awal tiap frame). */
  private readonly sPejalan: [number[], number[]] = [[], []];
  /** Calon penumpang yang akan datang dari luar (bertambah tiap ada penumpang turun). */
  private calonDatang = 0;
  private jedaDatang = 0;
  /** Rata-rata bergerak penumpang turun per detik (−1 = belum ada data). */
  private lajuTurunNyata = -1;

  private readonly petaOrang = new Map<number, OrangVisual>();
  private readonly halteDatang = new Barisan(HALTE_DATANG_X);
  private readonly halteBerangkat = new Barisan(HALTE_BERANGKAT_X);
  private readonly petak: number[] = PARKIR_SERONG.pusatX.map(() => 0);
  private readonly kursi: number[] = KURSI_TUNGGU.map(() => 0);
  private readonly antrean: number[] = [];
  /** Pembeli per jendela loket, urut: indeks 0 di jendela, berikutnya menunggu di belakangnya. */
  private readonly loket: number[][] = X_LOKET.map(() => []);
  /** Laju loket efektif frame ini (menentukan lama transaksi di jendela). */
  private lajuLayan = 0;
  /** Pengali kecepatan transaksi yang sedang berjalan: 1 = santai, lebih besar saat petugas bergegas. */
  private faktorBergegas = 1;
  /** Jurusan yang dilayani mitra PO (bitmask, lihat MASK_SEMUA_JURUSAN): bus hanya melayani jurusan ini. */
  private maskJurusan = MASK_SEMUA_JURUSAN;
  /** Bagian penumpang tiap jurusan (harga tiket); null = sama rata. */
  private bagianJurusan: readonly number[] | null = null;
  /** Jendela loket yang melayani (jurusannya dilayani; malam hari separuh tutup); pembeli hanya dipanggil ke jendela ini. */
  private loketBuka: readonly number[] = SEMUA_LOKET;
  /** Jam terminal (jam buka toko & kios, waktu sholat). */
  private jam = 12;
  /** Kios & toko aula baru melayani setelah fasilitas Kios & Minimarket dibangun. */
  private kiosDibangun = true;
  private readonly wanita: (varian: number) => boolean;
  /** Titik singgah yang sedang dipakai atau dituju seseorang (satu orang per titik). */
  private readonly titikTerpakai = new Set<TitikSinggah>();

  constructor(opsi: OpsiDunia = {}) {
    this.acak = opsi.acak ?? Math.random;
    this.jumlahLivery = opsi.jumlahLivery ?? 7;
    this.jumlahVarianOrang = opsi.jumlahVarianOrang ?? 16;
    this.wanita = opsi.wanita ?? ((v) => v % 3 === 0);
  }

  /** Jalankan model beberapa detik tanpa render, supaya scene tidak kosong di awal. */
  pemanasan(detik: number, laju: LajuVisual): void {
    for (let t = 0; t < detik; t += 0.1) this.perbarui(0.1, laju);
  }

  perbarui(dtDetik: number, laju: LajuVisual): void {
    const dt = Math.min(Math.max(dtDetik, 0), 0.1);
    this.peristiwa.length = 0;
    this.transaksi.length = 0;
    if (!(dt > 0)) return;
    this.faktorKecepatan = laju.faktorKecepatanBus;
    // Paling sedikit satu jurusan (jaga-jaga): tanpa jurusan, bus tidak punya kelompok parkir.
    this.maskJurusan = (laju.maskJurusan ?? MASK_SEMUA_JURUSAN) % (MASK_SEMUA_JURUSAN + 1) || 1;
    this.bagianJurusan = laju.bagianJurusan ?? null;
    // Jalur yang belum dibangun: halte kedatangan & keberangkatan paling belakang tidak dipakai.
    this.halteDatang.aktif = Math.max(1, Math.min(HALTE_DATANG_X.length, laju.jalur ?? HALTE_DATANG_X.length));
    this.halteBerangkat.aktif = Math.max(1, Math.min(HALTE_BERANGKAT_X.length, laju.jalur ?? HALTE_BERANGKAT_X.length));
    this.loketBuka = laju.loketBuka && laju.loketBuka.length > 0 ? laju.loketBuka : SEMUA_LOKET;
    this.jam = laju.jam ?? 12;
    this.kiosDibangun = laju.kiosDibangun ?? true;

    this.munculkanBus(dt, laju);
    for (const b of this.bus) this.perbaruiBus(b, dt);
    const turunSebelum = this.totalTurun;
    this.turunkanPenumpang(dt, laju);
    this.datangkanPenumpang(dt);
    // Loket mengikuti arus nyata (yang dibatasi kapasitas manuver bus) dengan rasio
    // loket:turun yang sama seperti laju nominal, jadi antrean hanya menumpuk kalau
    // loket memang paling lambat. Pembandingnya arus turun yang mungkin: laju turun,
    // atau permintaan (busDatang × muatan) kalau lebih kecil. Saat sepi arus kecil
    // karena permintaan, bukan karena manuver bus, jadi loket tetap melayani penuh
    // dan antrean sisa jam sibuk surut. Naik bus tidak perlu diskalakan: ia hanya
    // terjadi selama ada bus di halte, jadi sudah dibatasi ketersediaan bus.
    const sesaat = (this.totalTurun - turunSebelum) / dt;
    const arusMungkin = Math.min(laju.turun, laju.busDatang * laju.muatanBus);
    this.lajuTurunNyata = this.lajuTurunNyata < 0 ? arusMungkin : this.lajuTurunNyata + (sesaat - this.lajuTurunNyata) * Math.min(1, dt / TAU_ARUS_NYATA);
    const skala = arusMungkin > 0 ? Math.min(1, (this.lajuTurunNyata / arusMungkin) * MARJIN_HILIR) : 1;
    this.layaniLoket(dt, laju.layanLoket * skala);
    this.naikkanPenumpang(dt, laju.naik);
    this.hitungAntrean();
    this.sPejalan[0].length = 0;
    this.sPejalan[1].length = 0;
    for (const o of this.orang) if (o.fase === 'keEkor' && o.rute.length === 0 && o.s >= 0) this.sPejalan[o.kolom === 1 ? 1 : 0].push(o.s);
    for (const o of this.orang) this.perbaruiOrang(o, dt);
    this.buangYangSelesai();
  }

  /** Peringkat tiap orang di barisnya, isi tiap baris, dan orang yang sedang menuju antrean. */
  private hitungAntrean(): void {
    this.peringkat.clear();
    this.isiKolom.fill(0);
    for (const id of this.antrean) {
      const k = this.petaOrang.get(id)!.kolom;
      this.peringkat.set(id, this.isiKolom[k]!++);
    }
    this.menujuKolom.fill(0);
    this.menujuAntrean = 0;
    for (const o of this.orang) {
      if (o.fase === 'keEkor') this.menujuKolom[o.kolom]!++;
      if (o.fase === 'keAntrean' || o.fase === 'keEkor') this.menujuAntrean++;
    }
  }

  // -------------------------------------------------------------------------
  // Statistik (untuk test)

  /** Orang di antrean loket: yang sudah berdiri di antrean + yang sedang berjalan ke sana. */
  get jumlahAntrean(): number {
    return this.antrean.length + this.orang.filter((o) => o.fase === 'keAntrean' || o.fase === 'keEkor').length;
  }

  /** Orang yang berdiri diam di antrean (bukan sedang maju atau berjalan ke ujungnya). */
  get jumlahBerdiriAntre(): number {
    return this.orang.filter((o) => o.fase === 'antre' && !o.bergerak).length;
  }

  /** Penumpang turun yang sedang berjalan keluar terminal. */
  get jumlahPulang(): number {
    return this.orang.filter((o) => o.fase === 'pulang').length;
  }

  /** Penumpang bertiket di ruang tunggu (sedang menuju kursi atau sudah duduk). */
  get jumlahTungguBerangkat(): number {
    return this.orang.filter((o) => o.fase === 'tungguBerangkat' || o.fase === 'keRuangTunggu').length;
  }

  /** Kursi ruang tunggu yang terisi atau dipesan (termasuk anggota rombongan). */
  get jumlahKursiTerisi(): number {
    return this.kursi.filter((id) => id !== 0).length;
  }

  get jumlahDuduk(): number {
    return this.orang.filter((o) => o.fase === 'tungguBerangkat').length;
  }

  /** Pembeli yang sedang dilayani di jendela loket. */
  get jumlahDiLoket(): number {
    return this.orang.filter((o) => o.fase === 'beliTiket').length;
  }

  /** Bus terminal yang tertahan di jalan raya karena halte kedatangan penuh. */
  get jumlahBusMenunggu(): number {
    return this.bus.filter((b) => b.fase === 'masuk' && b.halte < 0).length;
  }

  get jumlahParkir(): number {
    return this.petak.filter((id) => id !== 0).length;
  }

  get total(): { readonly busKeluar: number; readonly naikBus: number; readonly turun: number; readonly pulang: number; readonly datang: number } {
    return { busKeluar: this.totalBusKeluar, naikBus: this.totalNaikBus, turun: this.totalTurun, pulang: this.totalPulang, datang: this.totalDatang };
  }

  /** Daftar pelanggaran invarian (kosong = konsisten). Dipakai test. */
  periksaKonsistensi(): string[] {
    const galat: string[] = [];
    const cekSlot = (nama: string, slot: number[]): void => {
      slot.forEach((id, i) => {
        if (id === 0) return;
        // Id negatif = kursi anggota rombongan orang −id.
        const o = this.petaOrang.get(Math.abs(id));
        if (!o) galat.push(`${nama}[${i}] berisi orang ${id} yang tidak ada`);
        else if (id > 0 && o.slot !== i) galat.push(`${nama}[${i}] berisi orang ${id} dengan slot ${o.slot}`);
        else if (id < 0 && !o.kursiRombongan.includes(i)) galat.push(`${nama}[${i}] dipesan untuk rombongan ${-id} yang tidak memesannya`);
      });
    };
    cekSlot('kursi', this.kursi);
    if (new Set(this.antrean).size !== this.antrean.length) galat.push('antrean berisi id dobel');
    for (const id of this.antrean) {
      const o = this.petaOrang.get(id);
      if (!o || o.fase !== 'antre') galat.push(`antrean berisi ${id} dengan fase ${o?.fase}`);
      else if (o.kolom !== 0 && o.kolom !== 1) galat.push(`orang ${id} antre tanpa baris (${o.kolom})`);
    }
    for (const o of this.orang) {
      if (o.fase === 'keEkor' && o.kolom !== 0 && o.kolom !== 1) galat.push(`orang ${o.id} menuju antrean tanpa baris`);
      if (o.fase === 'antre' && !this.antrean.includes(o.id)) galat.push(`orang ${o.id} antre tapi tidak tercatat di antrean`);
    }
    this.loket.forEach((daftar, i) => {
      if (daftar.length > LOKET.maksPembeli) galat.push(`loket[${i}] berisi ${daftar.length} pembeli`);
      for (const id of daftar) {
        const o = this.petaOrang.get(id);
        if (!o || o.loket !== i || (o.fase !== 'keLoket' && o.fase !== 'beliTiket')) galat.push(`loket[${i}] berisi ${id} dengan fase ${o?.fase}`);
      }
    });
    for (const o of this.orang) {
      const diLoket = o.fase === 'keLoket' || o.fase === 'beliTiket';
      if (diLoket !== (o.loket >= 0) || (diLoket && !this.loket[o.loket]?.includes(o.id))) galat.push(`orang ${o.id} (${o.fase}) tidak tercatat di loket ${o.loket}`);
      if (o.fase === 'beliTiket' && this.loket[o.loket]![0] !== o.id) galat.push(`orang ${o.id} membeli tiket padahal bukan giliran di loket ${o.loket}`);
    }
    for (const o of this.orang) {
      if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) galat.push(`orang ${o.id} posisi tidak valid`);
    }
    const cari = (id: number): BusVisual | undefined => this.bus.find((b) => b.id === id);
    for (const b of this.bus) {
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.sudut)) galat.push(`bus ${b.id} posisi tidak valid`);
      // Saat memuat: yang sudah naik ≤ yang sudah dipanggil (muatan) ≤ kapasitas.
      const memuat = b.fase === 'muat' || b.fase === 'keHalteBerangkat';
      if (memuat && (b.penumpangNaik > b.muatan || b.muatan > b.kapasitas)) galat.push(`bus ${b.id} naik ${b.penumpangNaik}, muatan ${b.muatan}, kapasitas ${b.kapasitas}`);
    }
    this.halteDatang.penghuni.forEach((id, i) => {
      const b = id ? cari(id) : undefined;
      if (id && (!b || b.halte !== i || (b.fase !== 'masuk' && b.fase !== 'turunkan'))) galat.push(`halteDatang[${i}] tidak cocok dengan bus ${id}`);
    });
    this.halteBerangkat.penghuni.forEach((id, i) => {
      const b = id ? cari(id) : undefined;
      if (id && (!b || b.halte !== i || (b.fase !== 'keHalteBerangkat' && b.fase !== 'muat'))) galat.push(`halteBerangkat[${i}] tidak cocok dengan bus ${id}`);
    });
    this.petak.forEach((id, i) => {
      const b = id ? cari(id) : undefined;
      if (id && (!b || b.petak !== i)) galat.push(`petak[${i}] tidak cocok dengan bus ${id}`);
    });
    for (const o of this.orang) {
      if (o.fase !== 'keGerbang' && o.fase !== 'naikBus') continue;
      const b = cari(o.busId);
      if (!b || (b.fase !== 'keHalteBerangkat' && b.fase !== 'muat')) galat.push(`orang ${o.id} menuju bus ${o.busId} yang tidak sedang di halte (${b?.fase})`);
    }
    if (this.orang.length > MAKS_ORANG) galat.push(`orang melebihi batas: ${this.orang.length}`);
    // Mampir: fase sesuai rencana, titik yang dipesan = sisa langkah semua kunjungan, gaya khusus hanya saat singgah.
    let dipesan = 0;
    for (const o of this.orang) {
      if ((o.fase === 'singgah') !== (o.singgah !== null)) galat.push(`orang ${o.id} fase ${o.fase} tidak cocok dengan rencana singgahnya`);
      if (o.singgah) dipesan += o.singgah.langkah.length - o.singgah.i;
      if (o.gaya !== 'biasa' && !o.singgah?.tiba) galat.push(`orang ${o.id} bergaya ${o.gaya} di luar tempat singgah`);
      if (o.singgah && o.slot < 0) galat.push(`orang ${o.id} mampir tanpa kursi di ruang tunggu`);
    }
    if (dipesan !== this.titikTerpakai.size) galat.push(`titik singgah dipesan ${this.titikTerpakai.size}, sisa langkah ${dipesan}`);
    return galat;
  }

  // -------------------------------------------------------------------------
  // Bus: kemunculan

  private munculkanBus(dt: number, laju: LajuVisual): void {
    this.akumMasuk = Math.min(1, this.akumMasuk + dt * laju.busDatang);
    if (this.akumMasuk >= 1 && this.lajurKosong(LAJUR.dekat, X_MUNCUL)) {
      // Isi bus yang datang bervariasi (rata-rata tetap muatanBus): bus yang lebih kosong
      // selesai menurunkan penumpang lebih dulu dan mendahului bus di depannya.
      const muatan = Math.max(1, Math.round(laju.muatanBus * (1 + VARIASI_MUATAN * (2 * this.acak() - 1))));
      this.buatBus('terminal', LAJUR.dekat, X_TUNGGU_MASUK, muatan, laju.kapasitasBus ?? laju.muatanBus);
      this.akumMasuk = 0;
    }
    // Selama Bus Emas bisa diketuk, selalu ada satu bus emas melintas di jalan raya.
    if (laju.busEmas && !this.bus.some((b) => b.emas) && this.lajurKosong(LAJUR.jauh, X_MUNCUL)) {
      this.buatBus('lewat', LAJUR.jauh, X_HILANG, 0, 0, true);
      return;
    }
    this.akumLewat = Math.min(1, this.akumLewat + dt * LAJU_BUS_LEWAT * (0.5 + this.acak()));
    if (this.akumLewat >= 1 && this.lajurKosong(LAJUR.jauh, X_MUNCUL)) {
      this.buatBus('lewat', LAJUR.jauh, X_HILANG, 0, 0);
      this.akumLewat = 0;
    }
  }

  private buatBus(jenis: JenisBus, lajur: number, xTujuan: number, muatan: number, kapasitas: number, emas = false): void {
    const id = this.idBerikut++;
    this.bus.push({
      id,
      jenis,
      emas,
      livery: emas ? 0 : Math.floor(this.acak() * this.jumlahLivery),
      x: X_MUNCUL,
      y: lajur,
      sudut: 0,
      fase: jenis === 'lewat' ? 'lewat' : 'masuk',
      halte: -1,
      petak: -1,
      menyatuLorong: false,
      muatan,
      muatanDatang: muatan,
      penumpangNaik: 0,
      kapasitas: Math.max(muatan, kapasitas),
      tunggu: 0,
      jeda: 0,
      // Debu bervariasi per bus, tanpa memakai generator acak (urutan acak model tetap).
      debu: jenis === 'terminal' ? 0.55 + 0.45 * ((id * 0.6180339887) % 1) : 0,
      cuci: 0,
      tujuan: -1,
      istirahat: 0,
      jalur: new Jalur([
        [X_MUNCUL, lajur],
        [xTujuan, lajur],
      ]),
      s: 0,
      v: BUS.kecepatan * 0.8,
      selesai: false,
    });
  }

  // -------------------------------------------------------------------------
  // Bus: siklus

  private perbaruiBus(b: BusVisual, dt: number): void {
    switch (b.fase) {
      case 'lewat':
      case 'keluar':
        this.jalankan(b, dt);
        if (b.x >= X_HILANG - 0.05) b.selesai = true;
        break;

      case 'masuk':
        if (b.halte < 0) {
          // Halte kosong terdepan, walau bus di belakangnya masih menurunkan penumpang:
          // bus baru menyalip lewat lajur sirkulasi lalu berbelok masuk (tidak antre di jalan raya).
          const k = this.halteDatang.pesanBebas(b.id);
          if (k >= 0) {
            b.halte = k;
            this.setJalur(b, sambung([[b.x, b.y]], ruteKeHalteDatang(k, this.halteDatang.terisiDiBelakang(k))));
          }
        } else {
          this.majuDiHalte(b, this.halteDatang, HALTE_DATANG_X);
        }
        this.jalankan(b, dt);
        if (b.halte >= 0 && this.sampai(b)) {
          b.fase = 'turunkan';
          b.v = 0;
          b.jeda = 0;
          this.catat('berhenti', b);
          this.catat('tiba', b);
        }
        break;

      case 'turunkan':
        // Selama penumpang turun bus diam (tidak maju ke halte depan walau kosong);
        // setelah penumpang terakhir turun, jeda sebentar lalu berangkat ke pangkalan.
        b.jeda += dt;
        if (b.muatan > 0 || b.jeda < 0.6) break;
        this.tinggalkanHalteDatang(b);
        break;

      case 'kePetak':
        this.jalankan(b, dt);
        if (this.sampai(b)) {
          b.fase = 'parkir';
          b.v = 0;
          b.tunggu = 0;
          this.catat('berhenti', b);
          this.transaksi.push({ jenis: 'retribusi', x: b.x, y: b.y });
        }
        break;

      case 'parkir':
        b.tunggu += dt;
        // Dicuci selama parkir (ikut dipercepat bersama manuver bus).
        b.cuci = Math.min(1, b.cuci + (dt * this.faktorKecepatan) / CUCI.detik);
        // Setelah bersih: menunggu jadwal berangkat jurusannya.
        if (b.cuci >= 1) b.istirahat = Math.min(1, b.istirahat + (dt * this.faktorKecepatan) / ISTIRAHAT_DETIK);
        this.keluarkanDariPangkalan(b);
        break;

      case 'keHalteBerangkat':
        this.jalankan(b, dt);
        if (b.menyatuLorong && Math.abs(b.y - LAJUR.lorong) < 0.02 && Math.abs(Math.sin(b.sudut)) < 0.05) b.menyatuLorong = false;
        if (this.sampai(b)) {
          b.fase = 'muat';
          b.v = 0;
          b.tunggu = 0;
          this.catat('berhenti', b);
        }
        break;

      case 'muat': {
        b.tunggu += dt;
        // Bus tetap di halte (gerbang JALUR-nya) sampai berangkat, walau halte depan kosong,
        // supaya penumpang tidak bingung; halte kosong diisi bus berikutnya dari pangkalan.
        // Selama ada penumpang berjalan ke pintunya, bus tidak berangkat.
        if (this.adaYangMenuju(b.id)) break;
        if ((b.muatan >= b.kapasitas || b.tunggu >= MAKS_NGETEM_DETIK) && this.celahLajur(LAJUR.sirkulasi, b.x, b.x + PANJANG_PINDAH_LAJUR)) {
          this.halteBerangkat.lepas(b.halte, b.id);
          b.halte = -1;
          this.keluarLewatSirkulasi(b);
          this.catat('berangkat', b);
        }
        break;
      }
    }
  }

  private catat(jenis: JenisPeristiwaBus, b: BusVisual): void {
    this.peristiwa.push({ jenis, busId: b.id, x: b.x, y: b.y, halte: jenis === 'panggil' ? b.halte : -1, tujuan: b.tujuan });
  }

  /** Bus di halte maju ke halte kosong di depannya. @returns true kalau pindah. */
  private majuDiHalte(b: BusVisual, barisan: Barisan, posisiX: readonly number[]): boolean {
    if (b.halte < 0 || Math.abs(b.y - LAJUR.halte) > 0.02) return false;
    const j = barisan.majuDari(b.halte, b.id);
    if (j === b.halte) return false;
    b.halte = j;
    this.setJalur(b, [
      [b.x, b.y],
      [posisiX[j]!, LAJUR.halte],
    ]);
    return true;
  }

  /**
   * Bus kosong meninggalkan halte kedatangan menuju pangkalan: ditugaskan ke
   * jurusan yang kelompok petaknya paling lowong, lalu parkir di salah satu
   * petak kosong kelompok itu. Bila halte di depannya kosong, bus maju lurus di
   * lajur halte. Bila bus di depannya masih menurunkan penumpang, ia tidak
   * perlu menunggu: ia mendahului lewat lajur sirkulasi lalu turun lagi ke
   * lorong pangkalan (hanya bisa ke petak yang kurva masuknya setelah titik
   * turun). Kalau pangkalan penuh, bus langsung keluar terminal.
   */
  private tinggalkanHalteDatang(b: BusVisual): void {
    const lurus = this.halteDatang.penghuni.slice(0, b.halte).every((id) => id === 0);
    const petak = this.pilihPetak(lurus);
    if (petak >= 0 && lurus) {
      this.masukPetak(b, petak, [[b.x, b.y]]);
      return;
    }
    if (!this.celahLajur(LAJUR.sirkulasi, b.x, b.x + PANJANG_PINDAH_LAJUR)) return;
    if (petak >= 0) {
      if (!this.celahLajur(LAJUR.halte, X_TURUN_KE_LORONG[1], X_TURUN_KE_LORONG[1])) return;
      const naik: Titik = [b.x + PANJANG_PINDAH_LAJUR, LAJUR.sirkulasi];
      const turun0: Titik = [X_TURUN_KE_LORONG[0], LAJUR.sirkulasi];
      const turun1: Titik = [X_TURUN_KE_LORONG[1], LAJUR.halte];
      this.masukPetak(b, petak, sambung(lintasanS([b.x, LAJUR.halte], naik), [naik, turun0], lintasanS(turun0, turun1)));
      return;
    }
    // Pangkalan penuh: keluar terminal tanpa menunggu.
    this.halteDatang.lepas(b.halte, b.id);
    b.halte = -1;
    this.keluarLewatSirkulasi(b);
  }

  /**
   * Petak untuk bus yang keluar dari halte kedatangan: kelompok jurusan dengan
   * petak kosong terbanyak yang bisa dicapai (seri → diundi, supaya semua
   * kelompok terisi merata), lalu salah satu petak kosongnya secara acak.
   * Kelompok yang belum ada jurusannya dilayani dipagari (pembangunan3d.ts) dan
   * tidak dipakai; bila yang terbuka penuh, bus langsung keluar terminal.
   * @param lurus bus bisa maju lurus di lajur halte (semua petak terjangkau), bukan menyalip lewat sirkulasi.
   */
  private pilihPetak(lurus: boolean): number {
    const buka = KELOMPOK_PARKIR.filter((k) => k.tujuan.some((t) => jurusanDiMask(this.maskJurusan, t)));
    return this.pilihPetakDari(buka, lurus) ?? -1;
  }

  private pilihPetakDari(kelompok: readonly KelompokParkir[], lurus: boolean): number | null {
    let terbaik: number[] = [];
    let seri = 0;
    for (const k of kelompok) {
      const kosong = k.petak.filter((i) => this.petak[i] === 0 && (lurus || PARKIR_SERONG.pusatX[i]! - PARKIR_SERONG.jarakMasuk >= X_TURUN_KE_LORONG[1]));
      if (kosong.length === 0 || kosong.length < terbaik.length) continue;
      if (kosong.length > terbaik.length) {
        terbaik = kosong;
        seri = 1;
      } else if (this.acak() < 1 / ++seri) {
        terbaik = kosong;
      }
    }
    return terbaik.length > 0 ? terbaik[Math.floor(this.acak() * terbaik.length)]! : null;
  }

  private masukPetak(b: BusVisual, petak: number, awal: Titik[]): void {
    this.petak[petak] = b.id;
    // Jurusan bus mengikuti kelompok petaknya (kota yang dilayani, sebanding bagian penumpangnya).
    // pilihPetak hanya memberi petak di kelompok yang dilayani; cadangan semua jurusan yang dilayani hanya jaga-jaga.
    const kelompok = KELOMPOK_PARKIR.find((k) => k.petak.includes(petak));
    const bukaDiKelompok = kelompok ? kelompok.tujuan.filter((t) => jurusanDiMask(this.maskJurusan, t)) : [];
    const pilihan = bukaDiKelompok.length > 0 ? bukaDiKelompok : TUJUAN_BUS.map((_, i) => i).filter((i) => jurusanDiMask(this.maskJurusan, i));
    b.tujuan = pilihTujuan(pilihan, this.bagianJurusan, b.id);
    this.halteDatang.lepas(b.halte, b.id);
    b.halte = -1;
    b.petak = petak;
    b.fase = 'kePetak';
    const sx = PARKIR_SERONG.pusatX[petak]!;
    this.setJalur(b, sambung(awal, [awal[awal.length - 1]!, [sx - PARKIR_SERONG.jarakMasuk, LAJUR.halte]], kurvaMasukPetak(sx)));
  }

  /**
   * Bus parkir terlama keluar ke lorong belakang kalau sudah selesai dicuci,
   * menunggu jadwalnya, dan ada halte keberangkatan kosong (mana pun, terdepan
   * dulu). Bus masuk lorong hanya jika ada ruang di belakang bus yang sudah di lorong.
   */
  private keluarkanDariPangkalan(b: BusVisual): void {
    for (const c of this.bus) {
      if (c !== b && c.fase === 'parkir' && c.tunggu > b.tunggu) return; // bukan giliran
    }
    if (b.cuci < 1 || b.istirahat < 1) return; // belum selesai dicuci / belum jadwalnya
    const sx = PARKIR_SERONG.pusatX[b.petak]!;
    const xGabung = sx + PARKIR_SERONG.jarakKeluar;
    for (const c of this.bus) {
      if (c === b || c.fase !== 'keHalteBerangkat') continue;
      if (c.menyatuLorong) return;
      if (c.x - ekstenX(c) < xGabung + BUS.panjang / 2 + BUS.jarak) return;
    }
    const k = this.halteBerangkat.pesanBebas(b.id);
    if (k < 0) return;
    this.petak[b.petak] = 0;
    b.petak = -1;
    b.halte = k;
    b.fase = 'keHalteBerangkat';
    b.menyatuLorong = true;
    this.catat('panggil', b);
    this.setJalur(b, sambung(kurvaKeluarPetak(sx), [[xGabung, LAJUR.lorong], SAMBUNG_BERANGKAT.dari], ruteKeHalteBerangkat(k)));
  }

  private keluarLewatSirkulasi(b: BusVisual): void {
    const x = b.x;
    b.fase = 'keluar';
    this.setJalur(
      b,
      sambung(
        lintasanS([x, LAJUR.halte], [x + PANJANG_PINDAH_LAJUR, LAJUR.sirkulasi]),
        [[x + PANJANG_PINDAH_LAJUR, LAJUR.sirkulasi], KELUAR.dari],
        lintasanS(KELUAR.dari, KELUAR.ke),
        [KELUAR.ke, [X_HILANG, LAJUR.dekat]],
      ),
    );
  }

  /**
   * Lajur tujuan cukup lowong untuk bus yang masuk/pindah lajur di rentang
   * x [xMulai, xSelesai]: tidak ada bus di rentang itu, dan bus di belakangnya
   * masih sempat mengerem.
   */
  private celahLajur(yLajur: number, xMulai: number, xSelesai: number): boolean {
    const rem = BUS.perlambatan * this.faktorKecepatan;
    for (const c of this.bus) {
      if (c.selesai || !menempatiLajur(c, yLajur)) continue;
      const belakang = c.x - ekstenX(c);
      const depan = c.x + ekstenX(c);
      if (belakang > xSelesai + BUS.panjang / 2 + BUS.jarak) continue; // jauh di depan
      if (depan + BUS.jarak + (c.v * c.v) / (2 * rem) < xMulai - BUS.panjang / 2) continue; // di belakang & sempat mengerem
      return false;
    }
    return true;
  }

  private setJalur(b: BusVisual, titik: Titik[]): void {
    b.jalur = new Jalur(titik);
    b.s = 0;
  }

  // -------------------------------------------------------------------------
  // Bus: gerak

  /** Gerak di sepanjang jalur dengan percepatan/pengereman dan jaga jarak. */
  private jalankan(b: BusVisual, dt: number): void {
    const sisaJalur = b.jalur.panjang - b.s;
    let sisa = sisaJalur;
    if (Math.abs(Math.sin(b.sudut)) < 0.35) sisa = Math.min(sisa, this.ruangDepan(b));

    const k = this.faktorKecepatan;
    const vMaks = BUS.kecepatan * k;
    const rem = BUS.perlambatan * k;
    const vTarget = Math.min(vMaks, Math.sqrt(2 * rem * Math.max(0, sisa)));
    b.v = b.v < vTarget ? Math.min(vTarget, b.v + BUS.percepatan * k * dt) : Math.max(vTarget, b.v - rem * 1.5 * dt);

    let langkah = Math.min(b.v * dt, Math.max(0, sisa));
    // Tempelkan ke ujung jalur supaya tidak merayap tanpa akhir.
    if (sisa === sisaJalur && sisaJalur - langkah < EPS_SAMPAI) langkah = sisaJalur;
    b.s = Math.min(b.jalur.panjang, b.s + langkah);

    const pose = b.jalur.pose(b.s);
    b.x = pose.x;
    b.y = pose.y;
    if (langkah > 1e-6) b.sudut = dekatiSudut(b.sudut, pose.sudut, Math.min(1, dt * 9));
  }

  /** Sampai ujung jalur, atau berhenti tepat di belakang bus lain yang nyaris di ujung. */
  private sampai(b: BusVisual): boolean {
    const sisa = b.jalur.panjang - b.s;
    return sisa < EPS_SAMPAI || (sisa < 0.15 && b.v < 0.05);
  }

  /**
   * Ruang kosong di depan bus pada lajur yang dituju (∞ kalau tidak ada bus di
   * depan). Lajur diambil dari titik lintasan sedikit di depan bus: bus yang
   * mulai berbelok keluar dari halte tidak tertahan oleh bus yang berhenti di
   * halte depannya (lintasan beloknya sudah bebas dari bus itu, dites), tapi
   * tetap mengerem untuk bus di lajur tujuannya.
   */
  private ruangDepan(b: BusVisual): number {
    let min = Number.POSITIVE_INFINITY;
    const depan = b.x + ekstenX(b);
    const yLajur = b.jalur.pose(b.s + LIHAT_DEPAN).y;
    for (const c of this.bus) {
      // Bus yang parkir tidak di lajur mana pun (jarak aman masuk/keluar petak dijamin tata letak).
      if (c === b || c.selesai || c.x <= b.x || c.fase === 'parkir') continue;
      if (!menempatiLajur(c, yLajur)) continue;
      min = Math.min(min, c.x - ekstenX(c) - depan - BUS.jarak);
    }
    return min;
  }

  private lajurKosong(lajur: number, x: number): boolean {
    return !this.bus.some((c) => !c.selesai && menempatiLajur(c, lajur) && Math.abs(c.x - x) < BUS.panjang + BUS.jarak);
  }

  // -------------------------------------------------------------------------
  // Orang

  /**
   * Semua bus yang berhenti di samping peron kedatangan menurunkan penumpang
   * bersamaan, bergiliran (bus yang paling lama belum menurunkan penumpang
   * didahulukan). Laju turun total tetap laju peron, jadi peron yang lambat
   * tetap terlihat sebagai bottleneck (bus menumpuk di jalan raya).
   */
  private turunkanPenumpang(dt: number, laju: LajuVisual): void {
    if (laju.turun <= 0) return;
    this.akumTurun = Math.min(1, this.akumTurun + dt * laju.turun);
    if (this.akumTurun < 1 || this.orang.length >= MAKS_ORANG) return;
    let bus: BusVisual | null = null;
    for (const b of this.bus) {
      if (b.fase !== 'turunkan' || b.muatan <= 0) continue;
      if (!bus || b.jeda > bus.jeda || (b.jeda === bus.jeda && b.x > bus.x)) bus = b;
    }
    if (!bus) return;
    bus.jeda = 0;
    const xPintu = bus.x + PINTU_BUS;
    const o = this.buatOrang(xPintu, LAJUR.halte + 0.4, 'pulang');
    o.rute = this.rutePulang(xPintu);
    bus.muatan--;
    this.akumTurun = 0;
    this.totalTurun++;
    // Arus seimbang: tiap penumpang turun diimbangi satu calon penumpang dari luar.
    this.calonDatang = Math.min(this.calonDatang + 1, MAKS_CALON_DATANG);
  }

  /**
   * Penumpang turun langsung pulang: menyeberangi peron (di sela tiang kanopi),
   * menyusuri jalur pejalan kaki di sisi barat gedung, keluar gerbang KELUAR,
   * lewat gang ke trotoar jalan belakang, lalu berjalan menjauh.
   */
  private rutePulang(xPintu: number): Titik[] {
    let xTurun = xPintu + (this.acak() - 0.5) * 0.2;
    for (const k of KOLOM_KANOPI_DATANG) if (Math.abs(xTurun - k) < 0.3) xTurun = k + (xTurun < k ? -0.35 : 0.35);
    const lajur = (this.acak() - 0.5) * 0.4; // sedikit menyebar, tidak berbaris satu garis
    const xJalur = X_JALUR_KAKI + lajur;
    const xGerbang = GERBANG_KELUAR_X + lajur;
    const arah = this.acak() < 0.65 ? -1 : 1;
    const yTrotoar = Y_TROTOAR_BELAKANG + (this.acak() - 0.5) * 0.16;
    return [
      [xPintu, PERON.y0 + 0.2],
      [xTurun, PERON.y1 - 0.15],
      [xTurun, Y_TURUN_PERON],
      [xJalur, Y_TURUN_PERON + 0.1],
      [xGerbang, Y_PAGAR],
      [xGerbang, yTrotoar],
      // Sebentar menyusuri trotoar lalu hilang di kejauhan (tidak lama memenuhi layar).
      [xGerbang + arah * (1.5 + this.acak() * 2.5), yTrotoar],
    ];
  }

  /**
   * Calon penumpang muncul di luar terminal: di trotoar jalan belakang (lalu
   * masuk lewat gerbang MASUK) atau di lorong parkir, lalu berjalan ke mulut
   * antrean loket. Hanya datang selama antrean masih ada tempat.
   */
  private datangkanPenumpang(dt: number): void {
    this.jedaDatang -= dt;
    if (this.calonDatang <= 0 || this.jedaDatang > 0 || this.orang.length >= MAKS_ORANG) return;
    // Yang masih berjalan ikut dihitung supaya tiap orang pasti kebagian tempat
    // (antrean + baris luapan) saat tiba.
    if (this.antrean.length + this.menujuAntrean >= KAPASITAS_ANTREAN) return;
    this.calonDatang--;
    this.jedaDatang = 0.08 + this.acak() * 0.3;
    this.menujuAntrean++;
    this.totalDatang++;
    if (this.acak() < PELUANG_DARI_PARKIR) {
      const x = LORONG_PARKIR.x0 + this.acak() * (LORONG_PARKIR.x1 - LORONG_PARKIR.x0) * 0.6;
      const o = this.buatOrang(x, LORONG_PARKIR.y + (this.acak() - 0.5) * 0.3, 'keAntrean');
      o.rute = [...RUTE_DARI_PARKIR, MULUT_ANTREAN];
      this.transaksi.push({ jenis: 'parkir', x: o.x, y: o.y });
      return;
    }
    const arah = this.acak() < 0.5 ? -1 : 1;
    const yTrotoar = Y_TROTOAR_BELAKANG + (this.acak() - 0.5) * 0.16;
    const o = this.buatOrang(GERBANG_MASUK_X + arah * (1.5 + this.acak() * 3.5), yTrotoar, 'keAntrean');
    const xGerbang = GERBANG_MASUK_X + (this.acak() - 0.5) * 0.5;
    o.rute = [[xGerbang, yTrotoar], [xGerbang, Y_PAGAR], SINGGAH_GERBANG_MASUK, MULUT_ANTREAN];
  }

  private buatOrang(x: number, y: number, fase: FaseOrang): OrangVisual {
    const o: OrangVisual = {
      id: this.idBerikut++,
      varian: Math.floor(this.acak() * this.jumlahVarianOrang),
      x,
      y,
      fase,
      rute: [],
      slot: -1,
      kursiRombongan: [],
      loket: -1,
      kolom: -1,
      s: -1,
      timer: 0,
      lamaTimer: 0,
      busId: 0,
      bergerak: false,
      selesai: false,
      gaya: 'biasa',
      singgah: null,
    };
    this.orang.push(o);
    this.petaOrang.set(o.id, o);
    return o;
  }

  private perbaruiOrang(o: OrangVisual, dt: number): void {
    switch (o.fase) {
      case 'pulang':
        if (this.jalan(o, dt)) {
          o.selesai = true;
          this.totalPulang++;
        }
        break;
      case 'keAntrean':
        if (this.jalan(o, dt)) this.pilihUjungAntrean(o);
        break;
      case 'keEkor': {
        // Masuk lewat pintu, lalu menyusuri lajur labirin seperti yang sudah antre
        // (tidak memotong tali pembatas antarlajur) sampai ujung barisnya. Urutan
        // antrean diambil saat tiba, jadi yang masih berjalan tidak ikut dihitung antre.
        if (o.rute.length > 0) {
          if (this.jalan(o, dt)) o.s = S_PINTU_LUAR;
          break;
        }
        const r = this.isiKolom[o.kolom]!;
        const ekor = sSlot(r);
        // Jaga jarak satu slot dari yang berjalan di depannya di baris yang sama (tidak berhimpit).
        if (o.s > ekor + 1e-9) this.susuriLintasan(o, Math.max(ekor, this.sPejalanDepan(o) + LABIRIN.jarak), dt);
        if (o.s <= ekor + 1e-9) {
          this.antrean.push(o.id);
          this.peringkat.set(o.id, r);
          this.isiKolom[o.kolom]!++;
          this.menujuKolom[o.kolom]!--;
          o.fase = 'antre';
        }
        break;
      }
      case 'antre': {
        if (o.rute.length > 0) {
          this.jalan(o, dt); // masih menuju ujung baris luapan di luar pintu
          break;
        }
        // Maju menyusuri lintasan antrean sampai slotnya (bergeser tiap antrean maju).
        this.susuriLintasan(o, sSlot(this.peringkat.get(o.id) ?? 0), dt);
        break;
      }
      case 'keLoket': {
        // Tujuan: jendela loket, atau tempat menunggu di belakang pembeli yang sedang dilayani.
        const k = this.loket[o.loket]!.indexOf(o.id);
        o.rute = [...o.rute.slice(0, -1), posisiPembeli(X_LOKET[o.loket]!, k)];
        if (this.jalan(o, dt) && k === 0) {
          o.fase = 'beliTiket';
          o.timer = o.lamaTimer = this.lamaBeli();
        }
        break;
      }
      case 'beliTiket':
        o.timer -= dt * this.faktorBergegas;
        if (o.timer <= 0) {
          const daftar = this.loket[o.loket]!;
          daftar.splice(daftar.indexOf(o.id), 1);
          const xLoket = X_LOKET[o.loket]!;
          o.loket = -1;
          this.transaksi.push({ jenis: 'tiket', x: xLoket, y: LOKET.yPembeli });
          const kunjungan = this.rencanaMampirAula(o, xLoket);
          if (kunjungan) this.mulaiSinggah(o, kunjungan);
          else {
            o.rute = [...ruteLoketKeRuangTunggu(xLoket), ...ruteKeKursi(o.slot)];
            o.fase = 'keRuangTunggu';
          }
        }
        break;
      case 'keRuangTunggu':
        if (this.jalan(o, dt)) {
          o.fase = 'tungguBerangkat';
          o.timer = MIN_DUDUK_SEBELUM_KIOS;
        }
        break;
      case 'tungguBerangkat':
        // Duduk sampai dipanggil naikkanPenumpang; yang sendirian sesekali bangun ke kios ruang tunggu.
        o.timer -= dt;
        if (o.timer <= 0 && this.acak() < dt / RATA_DUDUK_KE_KIOS) {
          const k = this.rencanaKeKios(o);
          if (k) this.mulaiSinggah(o, k);
        }
        break;
      case 'singgah':
        this.jalaniSinggah(o, dt);
        break;
      case 'keGerbang': {
        this.jalan(o, dt);
        const b = this.bus.find((c) => c.id === o.busId);
        if (b && b.fase === 'muat') {
          // Bus sudah berhenti: lanjutkan dari rute yang tersisa (tanpa titik kumpul) keluar gerbang.
          const sisa = o.rute.slice(0, -1);
          o.rute = [...sisa, ...ruteGerbangKePintu(GERBANG_X[b.halte]!, b.x + PINTU_BUS)];
          o.fase = 'naikBus';
        }
        break;
      }
      case 'naikBus':
        if (this.jalan(o, dt)) o.selesai = true;
        break;
    }
  }

  /**
   * Kepala antrean dipanggil ke jendela loket dengan laju loket. Lama transaksi
   * di jendela menyesuaikan laju itu, jadi deretan jendela tidak menahan arus;
   * yang menentukan panjang antrean tetap laju loket (bottleneck atau bukan).
   */
  private layaniLoket(dt: number, lajuLayan: number): void {
    this.lajuLayan = lajuLayan;
    this.faktorBergegas = this.hitungBergegas();
    if (this.antrean.length === 0 || lajuLayan <= 0) return;
    // Petugas sudah mulai melayani selagi orang berikutnya melangkah maju, jadi
    // langkah antrean tidak memperlambat loket yang cepat (hambatan palsu).
    this.akumLayan = Math.min(1, this.akumLayan + dt * lajuLayan);
    const o = this.kepalaSiap();
    if (!o || this.akumLayan < 1) return;
    const loket = this.pilihLoket(o.x);
    if (loket < 0) return; // semua jendela masih penuh pembeli
    const { slot, rombongan } = this.pilihKursi(anggotaRombongan(o.id).length);
    if (slot < 0) return; // ruang tunggu penuh: loket tertahan
    this.akumLayan = 0;
    this.antrean.splice(this.antrean.indexOf(o.id), 1);
    this.kursi[slot] = o.id;
    for (const k of rombongan) this.kursi[k] = -o.id;
    o.kursiRombongan = rombongan;
    // Sampai ujung lajur terdepan (lewat celah tali), ke lorong loket, lalu ke jendelanya.
    const kepala = posisiSlotAntrean(0, o.kolom);
    o.slot = slot;
    o.s = -1;
    o.kolom = -1;
    o.loket = loket;
    const daftar = this.loket[loket]!;
    daftar.push(o.id);
    o.fase = 'keLoket';
    const xLoket = X_LOKET[loket]!;
    o.rute = [kepala, [kepala[0], Y_LORONG_LOKET], [xLoket, Y_LORONG_LOKET], posisiPembeli(xLoket, daftar.length - 1)];
  }

  /**
   * Orang terdepan yang siap dipanggil loket: yang terdepan di barisnya dan
   * sudah berdiri di slot kepala. Urutan antre didahulukan, tapi bila orang
   * terdepan satu baris masih melangkah maju, orang terdepan baris sebelahnya
   * yang sudah siap maju duluan (seperti antrean dua baris sungguhan). Tanpa
   * ini, orang yang tiba di ujung antrean bergerombol per baris membuat satu
   * baris menunggu baris lain maju selangkah demi selangkah (hambatan palsu).
   */
  private kepalaSiap(): OrangVisual | null {
    let kepala = 0;
    for (const id of this.antrean) {
      if (this.peringkat.get(id) !== 0) continue;
      const o = this.petaOrang.get(id);
      if (o && o.fase === 'antre' && o.rute.length === 0 && o.s <= JARAK_DILAYANI) return o;
      if (++kepala >= LABIRIN.kolom) break;
    }
    return null;
  }

  /**
   * Di mulut antrean: pilih baris yang lebih pendek. Kalau ujung baris itu sudah
   * di luar pintu (antrean meluap), langsung ambil urutan dan berbaris di sana.
   * Kalau masih di dalam gedung, masuk pintu (dan celah labirin bila ujungnya di
   * dalam labirin) lalu berjalan langsung ke ujung baris; urutan diambil saat tiba.
   */
  private pilihUjungAntrean(o: OrangVisual): void {
    const panjang = (k: number): number => this.isiKolom[k]! + this.menujuKolom[k]!;
    const k = panjang(0) <= panjang(1) ? 0 : 1;
    o.kolom = k;
    const perkiraan = sSlot(panjang(k));
    if (perkiraan >= S_PINTU_LUAR - LABIRIN.jarak) {
      const r = this.isiKolom[k]!++;
      this.antrean.push(o.id);
      this.peringkat.set(o.id, r);
      o.fase = 'antre';
      o.s = sSlot(r);
      const [x, y] = posisiSlotAntrean(r, k);
      o.rute = [[x + 0.1, y + 0.3], [x, y]]; // didekati dari sisi plaza, tidak menembus barisan
      return;
    }
    o.fase = 'keEkor';
    this.menujuKolom[k]!++;
    // Ke titik lintasan antrean di luar pintu; dari situ menyusuri lintasan (lihat keEkor).
    o.s = -1;
    o.rute = [posisiLintasan(S_PINTU_LUAR, k)];
  }

  /**
   * Melangkah di sepanjang lintasan antrean (barisnya sendiri) menuju jarak
   * `tujuan` dari kepala, dengan laju jalan. @returns true kalau sudah sampai.
   */
  private susuriLintasan(o: OrangVisual, tujuan: number, dt: number): boolean {
    o.bergerak = Math.abs(o.s - tujuan) > 1e-9;
    if (!o.bergerak) return true;
    const arah = o.s > tujuan ? -1 : 1;
    const maks = KECEPATAN_JALAN * dt;
    let langkah = Math.min(maks, Math.abs(tujuan - o.s));
    let p = posisiLintasan(o.s + arah * langkah, o.kolom);
    // Di belokan, baris luar menempuh busur lebih panjang dari sumbu lintasan:
    // perkecil langkah supaya laju nyatanya tetap laju jalan.
    const jarak = Math.hypot(p[0] - o.x, p[1] - o.y);
    if (jarak > maks) {
      langkah *= maks / jarak;
      p = posisiLintasan(o.s + arah * langkah, o.kolom);
    }
    o.s += arah * langkah;
    [o.x, o.y] = p;
    return Math.abs(o.s - tujuan) <= 1e-9;
  }

  /**
   * Posisi (s) orang terdekat di depannya yang juga sedang menyusuri labirin di
   * baris yang sama (posisi awal frame); −∞ kalau tidak ada.
   */
  private sPejalanDepan(o: OrangVisual): number {
    let s = Number.NEGATIVE_INFINITY;
    for (const c of this.sPejalan[o.kolom === 1 ? 1 : 0]) if (c < o.s && c > s) s = c;
    return s;
  }

  /**
   * Jendela loket untuk pembeli berikutnya: yang paling sedikit pembelinya,
   * lalu yang dekat dengan kepala antrean (dengan sedikit acak supaya semua
   * jendela terpakai), hanya di antara jendela yang buka. −1 kalau semua penuh.
   */
  private pilihLoket(x: number): number {
    let terbaik = -1;
    let skorTerbaik = Number.POSITIVE_INFINITY;
    for (const i of this.loketBuka) {
      const n = this.loket[i]!.length;
      if (n >= LOKET.maksPembeli) continue;
      const skor = n * 10 + Math.abs(X_LOKET[i]! - x) * 0.4 + this.acak() * 1.2;
      if (skor < skorTerbaik) {
        skorTerbaik = skor;
        terbaik = i;
      }
    }
    return terbaik;
  }

  /**
   * Lama transaksi terpanjang yang masih sanggup diikuti jendela-jendela yang
   * buka pada arus `laju`:
   * - tiap jendela melayani satu per satu: transaksi + melangkah maju tidak
   *   melebihi CADANGAN_JENDELA dari waktu jendela-jendela itu;
   * - pembeli yang berjalan ke jendela + yang bertransaksi (hukum Little) tidak
   *   melebihi CADANGAN_JENDELA dari tempat di semua jendela.
   */
  private lamaUntuk(laju: number): number {
    const n = this.loketBuka.length;
    const bergiliran = (CADANGAN_JENDELA * n) / laju - DETIK_MAJU;
    const tempat = (CADANGAN_JENDELA * n * LOKET.maksPembeli) / laju - DETIK_KE_JENDELA;
    return Math.min(LAMA_BELI.maks, Math.max(LAMA_BELI.min, Math.min(bergiliran, tempat)));
  }

  /** Arus calon penumpang rata-rata yang lewat loket (± arus turun bus, tidak lebih dari laju loket). */
  private arusSantai(): number {
    return Math.min(this.lajuLayan, Math.max(this.lajuTurunNyata, 0.05));
  }

  /** Lama transaksi santai untuk pembeli yang baru tiba di jendela (bervariasi per pembeli). */
  private lamaBeli(): number {
    if (this.lajuLayan <= 0) return LAMA_BELI.maks;
    return this.lamaUntuk(this.arusSantai()) * (0.8 + this.acak() * 0.4);
  }

  /**
   * Saat antrean menumpuk (mis. dua bus menurunkan penumpang sekaligus),
   * semua transaksi yang berjalan dipercepat sampai sanggup mengikuti laju
   * loket penuh, jadi gelombang penumpang tidak jadi hambatan palsu; setelah
   * antrean surut petugas kembali santai.
   */
  private hitungBergegas(): number {
    if (this.lajuLayan <= 0) return 1;
    let berdiri = 0;
    for (const o of this.orang) if (o.fase === 'antre' && !o.bergerak) berdiri++;
    const desak = Math.min(1, Math.max(0, (berdiri - BERDIRI_SANTAI) / (BERDIRI_BERGEGAS - BERDIRI_SANTAI)));
    if (desak <= 0) return 1;
    const rasio = this.lamaUntuk(this.arusSantai()) / this.lamaUntuk(this.lajuLayan);
    return 1 + desak * (rasio - 1);
  }
  // -------------------------------------------------------------------------
  // Mampir: toilet, musholla, ATM, toko aula, kios ruang tunggu

  private mulaiSinggah(o: OrangVisual, k: Kunjungan): void {
    o.singgah = k;
    o.fase = 'singgah';
    o.rute = [...k.langkah[0]!.rute];
  }

  /** Pesan satu titik bebas acak dari tiap kelompok; kalau ada yang penuh, batal semua (null). */
  private pesanTitik(kelompok: readonly KelompokSinggah[]): PesananSinggah[] | null {
    const hasil: PesananSinggah[] = [];
    for (const k of kelompok) {
      const bebas = k.titik.filter((t) => !this.titikTerpakai.has(t));
      if (bebas.length === 0) {
        for (const h of hasil) this.titikTerpakai.delete(h.titik);
        return null;
      }
      const titik = bebas[Math.floor(this.acak() * bebas.length)]!;
      this.titikTerpakai.add(titik);
      hasil.push({ titik, lama: k.lama[0] + this.acak() * (k.lama[1] - k.lama[0]) });
    }
    return hasil;
  }

  /** Toko/kios ini bisa didatangi: fasilitasnya sudah dibangun dan sedang jam buka. */
  private tokoMelayani(jenis: JenisToko): boolean {
    return this.kiosDibangun && tokoBuka(jenis, this.jam);
  }

  private dekatWaktuSholat(): boolean {
    return WAKTU_SHOLAT.some((w) => this.jam >= w && this.jam < w + 0.85);
  }

  /**
   * Setelah membeli tiket, sebagian penumpang yang bepergian sendiri mampir di
   * aula sebelum ke ruang tunggu: toilet, musholla (wudhu lalu sholat; lebih
   * ramai di waktu sholat), ATM, minimarket, atau apotek yang sedang buka.
   * Kursinya tetap dipesan; ia baru bisa dipanggil ke bus setelah duduk.
   */
  private rencanaMampirAula(o: OrangVisual, xLoket: number): Kunjungan | null {
    if (anggotaRombongan(o.id).length > 0) return null;
    const malam = dalamRentang(this.jam, JAM_LOKET_MALAM);
    if (this.acak() >= (malam ? PELUANG_MAMPIR.malam : PELUANG_MAMPIR.siang)) return null;
    const jk: JenisKelamin = this.wanita(o.varian) ? 'wanita' : 'pria';
    const tempat = pilihBerbobot<TempatMampir>(
      [
        ['toilet', 0.3],
        ['musholla', this.dekatWaktuSholat() ? 0.6 : 0.12],
        ['atm', 0.25],
        ['minimarket', this.tokoMelayani('minimarket') ? 0.15 : 0],
        ['apotek', this.tokoMelayani('apotek') ? 0.07 : 0],
      ],
      this.acak(),
    );
    const awal: Titik[] = [
      [xLoket + 0.28, LOKET.yPembeli + 0.1],
      [xLoket + 0.4, Y_LORONG_LOKET],
    ];
    const keKursi: Titik[] = [...ruteLoketKeRuangTunggu(xLoket).slice(2), ...ruteKeKursi(o.slot)];
    if (tempat === 'toilet' || tempat === 'musholla') {
      const toilet = tempat === 'toilet';
      const t = SINGGAH.toilet[jk];
      const m = SINGGAH.musholla[jk];
      const buang = t.urinoir && this.acak() < 0.45 ? t.urinoir : t.bilik;
      const p = this.pesanTitik(toilet ? [buang, t.wastafel] : [m.wudhu, m.sholat]);
      if (!p) return null;
      const pintu = toilet ? 0 : 1;
      const y = toilet ? RUANG_SAYAP.toilet[jk].yPintu : RUANG_SAYAP.wudhu[jk].yPintu;
      return buatKunjungan(
        tempat,
        [
          [...awal, ...ruteMasukSayap(pintu, y), ...p[0]!.titik.masuk],
          [...p[0]!.titik.keluar, ...p[1]!.titik.masuk],
        ],
        p,
        [...p[1]!.titik.keluar, ...ruteKeluarSayap(pintu, y), ...keKursi],
      );
    }
    const p = this.pesanTitik([SINGGAH[tempat]]);
    if (!p) return null;
    return buatKunjungan(tempat, [[...awal, ...p[0]!.titik.masuk]], p, [...p[0]!.titik.keluar, ...keKursi]);
  }

  /** Penumpang sendirian yang sudah duduk bangun ke salah satu kios ruang tunggu (yang buka), lalu kembali ke kursinya. */
  private rencanaKeKios(o: OrangVisual): Kunjungan | null {
    if (o.slot < 0 || anggotaRombongan(o.id).length > 0 || !this.tokoMelayani('kios')) return null;
    const p = this.pesanTitik([SINGGAH.kios[Math.floor(this.acak() * SINGGAH.kios.length)]!]);
    if (!p) return null;
    const kursi = KURSI_TUNGGU[o.slot]!;
    const lorong = lorongDekat(o.slot, X_MUKA_KIOS);
    const yDepan = yDepanBaris(o.slot);
    const dariKursi: Titik[] = [
      [kursi.x, yDepan],
      [lorong, yDepan],
      [lorong, Y_LORONG_TUNGGU],
    ];
    return buatKunjungan('kios', [[...dariKursi, ...p[0]!.titik.masuk]], p, [...p[0]!.titik.keluar, ...ruteKeKursi(o.slot).slice(1)]);
  }

  /** Jalan ke titik singgah berikutnya, singgah selama waktunya, lalu lanjut (terakhir: kembali ke kursi). */
  private jalaniSinggah(o: OrangVisual, dt: number): void {
    const k = o.singgah;
    if (!k) {
      o.fase = 'keRuangTunggu';
      return;
    }
    const l = k.langkah[k.i]!;
    if (!k.tiba) {
      if (!this.jalan(o, dt)) return;
      k.tiba = true;
      o.timer = o.lamaTimer = l.lama;
    }
    o.timer -= dt;
    o.gaya = gayaSinggah(l.titik.gaya, o.lamaTimer - o.timer, o.timer);
    if (o.timer > 0) return;
    this.titikTerpakai.delete(l.titik);
    if (TEMPAT_BELANJA.has(k.tempat)) this.transaksi.push({ jenis: 'belanja', x: o.x, y: o.y });
    o.gaya = 'biasa';
    k.i++;
    k.tiba = false;
    const berikut = k.langkah[k.i];
    if (berikut) o.rute = [...berikut.rute];
    else {
      o.rute = [...k.lanjut];
      o.singgah = null;
      o.fase = 'keRuangTunggu';
    }
  }

  private naikkanPenumpang(dt: number, lajuNaik: number): void {
    if (lajuNaik <= 0) return;
    this.akumNaik = Math.min(1, this.akumNaik + dt * lajuNaik);
    if (this.akumNaik < 1) return;

    // Bus paling depan yang sudah berhenti di halte keberangkatan diisi duluan.
    // Penumpang sudah dipanggil sejak busnya keluar pangkalan: dengan langkah
    // biasa mereka butuh beberapa detik dari kursi, jadi saat bus berhenti mereka
    // sudah berkumpul di balik gerbang dan bus tidak lama menunggu.
    let busTujuan: BusVisual | null = null;
    for (const b of this.bus) {
      if (b.halte < 0 || b.muatan >= b.kapasitas) continue;
      if (b.fase !== 'muat' && b.fase !== 'keHalteBerangkat') continue;
      if (!busTujuan || b.x > busTujuan.x) busTujuan = b;
    }
    if (!busTujuan) return;
    const gerbang = GERBANG_X[busTujuan.halte]!;

    // Yang dipanggil: penumpang duduk yang paling dekat ke gerbang bus ini.
    let calon: OrangVisual | null = null;
    let jarakCalon = Number.POSITIVE_INFINITY;
    for (const o of this.orang) {
      if (o.fase !== 'tungguBerangkat') continue;
      const jarak = Math.abs(o.x - gerbang) + Math.abs(o.y - PERON_BERANGKAT.y1) * 0.6;
      if (jarak < jarakCalon) {
        calon = o;
        jarakCalon = jarak;
      }
    }
    if (!calon) return;

    this.akumNaik = 0;
    const kursi = calon.slot;
    this.kursi[kursi] = 0;
    for (const k of calon.kursiRombongan) this.kursi[k] = 0;
    calon.kursiRombongan = [];
    calon.slot = -1;
    calon.busId = busTujuan.id;
    const keGerbang = ruteKeGerbang(kursi, gerbang).slice(0, -2);
    if (busTujuan.fase === 'muat') {
      calon.fase = 'naikBus';
      calon.rute = [...keGerbang, ...ruteGerbangKePintu(gerbang, busTujuan.x + PINTU_BUS)];
    } else {
      // Bus belum berhenti: tunggu di balik gerbang (berkerumun kecil).
      const n = this.orang.filter((o) => o.fase === 'keGerbang' && o.busId === busTujuan.id).length;
      const [dx, dy] = KUMPUL_GERBANG[n % KUMPUL_GERBANG.length]!;
      calon.fase = 'keGerbang';
      calon.rute = [...keGerbang, [gerbang + dx, Y_DEPAN_GERBANG + dy]];
    }
    busTujuan.muatan++;
  }

  /** Ada penumpang yang sedang dipanggil/berjalan ke bus ini (bus harus menunggu). */
  private adaYangMenuju(busId: number): boolean {
    return this.orang.some((o) => (o.fase === 'naikBus' || o.fase === 'keGerbang') && o.busId === busId);
  }

  /**
   * Kursi kosong untuk penumpang yang baru membeli tiket: dari beberapa calon
   * acak, pilih yang kiri-kanannya kosong dan barisnya lebih depan, jadi ruang
   * tunggu terisi menyebar seperti orang sungguhan. Rombongan dicarikan kursi
   * berdampingan di baris yang sama; kalau tidak ada, anggotanya berdiri di
   * dekatnya. slot −1 kalau penuh.
   */
  private pilihKursi(jumlahAnggota = 0): { readonly slot: number; readonly rombongan: number[] } {
    const kosong: number[] = [];
    for (let i = 0; i < this.kursi.length; i++) if (this.kursi[i] === 0) kosong.push(i);
    if (kosong.length === 0) return { slot: -1, rombongan: [] };
    if (jumlahAnggota > 0) {
      for (let n = 0; n < 12; n++) {
        const i = kosong[Math.floor(this.acak() * kosong.length)]!;
        const sebelah = this.kursiSebelah(i, jumlahAnggota);
        if (sebelah) return { slot: i, rombongan: sebelah };
      }
    }
    return { slot: this.pilihKursiSendiri(kosong), rombongan: [] };
  }

  /** n kursi kosong berdampingan dengan kursi i di baris yang sama (kanan dulu, lalu kiri), atau null. */
  private kursiSebelah(i: number, n: number): number[] | null {
    const kolom = i % KURSI.perBaris;
    const hasil: number[] = [];
    for (const arah of [1, -1]) {
      for (let d = 1; hasil.length < n; d++) {
        const k = kolom + arah * d;
        if (k < 0 || k >= KURSI.perBaris || this.kursi[i + arah * d] !== 0) break;
        hasil.push(i + arah * d);
      }
    }
    return hasil.length >= n ? hasil.slice(0, n) : null;
  }

  private pilihKursiSendiri(kosong: readonly number[]): number {
    let terbaik = -1;
    let skorTerbaik = Number.POSITIVE_INFINITY;
    for (let n = 0; n < 5; n++) {
      const i = kosong[Math.floor(this.acak() * kosong.length)]!;
      const k = KURSI_TUNGGU[i]!;
      const kolom = i % KURSI.perBaris;
      const tetangga = (kolom > 0 && this.kursi[i - 1] !== 0 ? 1 : 0) + (kolom < KURSI.perBaris - 1 && this.kursi[i + 1] !== 0 ? 1 : 0);
      const skor = tetangga + k.baris * 0.3 + this.acak() * 0.6;
      if (skor < skorTerbaik) {
        skorTerbaik = skor;
        terbaik = i;
      }
    }
    return terbaik;
  }

  /** @returns true kalau rute sudah habis (sampai tujuan). */
  private jalan(o: OrangVisual, dt: number): boolean {
    let sisaLangkah = lajuJalan(o.id) * dt;
    while (o.rute.length > 0 && sisaLangkah > 0) {
      const [tx, ty] = o.rute[0]!;
      const dx = tx - o.x;
      const dy = ty - o.y;
      const jarak = Math.hypot(dx, dy);
      if (jarak <= sisaLangkah) {
        o.x = tx;
        o.y = ty;
        sisaLangkah -= jarak;
        o.rute.shift();
      } else {
        o.x += (dx / jarak) * sisaLangkah;
        o.y += (dy / jarak) * sisaLangkah;
        sisaLangkah = 0;
      }
    }
    o.bergerak = o.rute.length > 0;
    return o.rute.length === 0;
  }

  private buangYangSelesai(): void {
    for (let i = this.bus.length - 1; i >= 0; i--) {
      if (this.bus[i]!.selesai) {
        if (this.bus[i]!.jenis === 'terminal') this.totalBusKeluar++;
        this.bus.splice(i, 1);
      }
    }
    for (let i = this.orang.length - 1; i >= 0; i--) {
      const o = this.orang[i]!;
      if (o.selesai) {
        this.orang.splice(i, 1);
        this.petaOrang.delete(o.id);
        if (o.singgah) for (const l of o.singgah.langkah.slice(o.singgah.i)) this.titikTerpakai.delete(l.titik);
        if (o.fase === 'naikBus') {
          this.totalNaikBus++;
          const b = this.bus.find((c) => c.id === o.busId);
          if (b) b.penumpangNaik++;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Antrean & aula loket

/** Laju jalan orang ini: KECEPATAN_JALAN ± VARIASI_JALAN, tetap per orang. */
export function lajuJalan(id: number): number {
  const pecahan = (id * 0.6180339887) % 1;
  return KECEPATAN_JALAN * (1 + VARIASI_JALAN * (2 * pecahan - 1));
}

/** Jarak slot ke-r di satu baris (0 = kepala) dari kepala antrean, di sepanjang lintasan antrean. */
function sSlot(r: number): number {
  return Math.min(Math.max(0, r), JUMLAH_SLOT_ANTREAN - 1) * LABIRIN.jarak;
}

/** Panjang kumulatif tiap titik lintasan antrean (untuk arah yang dihaluskan di belokan). */
const KUMULATIF_ANTRE: readonly number[] = JALUR_ANTREAN.reduce<number[]>((acc, t, i) => {
  if (i === 0) acc.push(0);
  else acc.push(acc[i - 1]! + Math.hypot(t[0] - JALUR_ANTREAN[i - 1]![0], t[1] - JALUR_ANTREAN[i - 1]![1]));
  return acc;
}, []);
/** Jari-jari penghalusan arah di sekitar tiap belokan lintasan antrean. */
const R_BELOKAN = 0.1;

/** Arah lintasan antrean di s, dihaluskan di sekitar belokan supaya geser baris tidak melompat. */
function arahLintasan(s: number): number {
  const n = JALUR_ANTREAN.length;
  let i = 0;
  while (i < n - 2 && KUMULATIF_ANTRE[i + 1]! <= s) i++;
  const arahRuas = (j: number): number => {
    const a = JALUR_ANTREAN[j]!;
    const b = JALUR_ANTREAN[j + 1]!;
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  const campur = (a: number, b: number, w: number): number => Math.atan2((1 - w) * Math.sin(a) + w * Math.sin(b), (1 - w) * Math.cos(a) + w * Math.cos(b));
  const dariAwal = s - KUMULATIF_ANTRE[i]!;
  const keAkhir = KUMULATIF_ANTRE[i + 1]! - s;
  if (i > 0 && dariAwal < R_BELOKAN) return campur(arahRuas(i - 1), arahRuas(i), 0.5 + (0.5 * dariAwal) / R_BELOKAN);
  if (i < n - 2 && keAkhir < R_BELOKAN) return campur(arahRuas(i), arahRuas(i + 1), 0.5 - (0.5 * keAkhir) / R_BELOKAN);
  return arahRuas(i);
}

/** Titik di lintasan antrean sejauh s dari kepala, bergeser ke baris 0 (kanan arah maju) atau baris 1 (kiri). */
export function posisiLintasan(s: number, kolom: number): Titik {
  const p = JALUR_ANTRE.pose(s);
  const sudut = arahLintasan(Math.min(Math.max(0, s), JALUR_ANTRE.panjang));
  const g = (kolom === 1 ? 1 : -1) * LABIRIN.geserKolom;
  return [p.x - Math.sin(sudut) * g, p.y + Math.cos(sudut) * g];
}

/** Posisi slot ke-r di baris `kolom`: di lajur labirin, lalu (luapan) ke pintu masuk dan berbaris di luar. */
export function posisiSlotAntrean(r: number, kolom = 0): Titik {
  return posisiLintasan(sSlot(r), kolom);
}

/**
 * Dari jendela loket: menyamping ke lorong loket (tidak menembus pembeli yang
 * menunggu di belakang), menyusuri aula ke timur, lalu lewat pintu ke ruang tunggu.
 */
export function ruteLoketKeRuangTunggu(xLoket: number): Titik[] {
  return [
    [xLoket + 0.28, LOKET.yPembeli + 0.1],
    [xLoket + 0.4, Y_LORONG_LOKET],
    [GEDUNG.x1 - 0.45, Y_LORONG_LOKET],
    [GEDUNG.x1 - 0.15, PINTU_RUANG_TUNGGU[1]],
    PINTU_RUANG_TUNGGU,
  ];
}

// ---------------------------------------------------------------------------
// Rute di ruang tunggu

/** Lorong (x garis gerbang) di sisi blok kursi yang paling dekat ke x tertentu. */
function lorongDekat(kursi: number, x: number): number {
  const b = BLOK_KURSI[KURSI_TUNGGU[kursi]!.blok]!;
  const sisi = GERBANG_X.filter((g) => Math.abs(g - b.x0) < 0.9 || Math.abs(g - b.x1) < 0.9);
  let terbaik = sisi[0] ?? b.x0 - 0.3;
  for (const g of sisi) if (Math.abs(g - x) < Math.abs(terbaik - x)) terbaik = g;
  return terbaik;
}

/** y jalur di depan (utara) baris kursi, di antara baris itu dan sandaran baris depannya. */
const yDepanBaris = (kursi: number): number => KURSI_TUNGGU[kursi]!.y - KURSI.jarakBaris / 2;

/**
 * Titik belok di balik pintu dari gedung utama: menjauh dari kios (dinding
 * barat) sebelum menyusuri ruang tunggu, dan tetap di depan meja makan.
 */
const TITIK_MASUK_TUNGGU: Titik = [RUANG_TUNGGU.x0 + 1.26, Y_LORONG_TUNGGU + 1.45];

/** Dari pintu gedung utama: titik belok → lorong belakang → lorong antarblok → sepanjang baris → kursi. */
export function ruteKeKursi(kursi: number): Titik[] {
  const k = KURSI_TUNGGU[kursi]!;
  const lorong = lorongDekat(kursi, k.x);
  const yDepan = yDepanBaris(kursi);
  return [
    TITIK_MASUK_TUNGGU,
    [lorong, Y_LORONG_TUNGGU],
    [lorong, yDepan],
    [k.x, yDepan],
    [k.x, k.y],
  ];
}

/** Dari depan gerbang (di dalam) keluar ke peron lalu ke pintu depan bus yang berhenti di halte. */
function ruteGerbangKePintu(xGerbang: number, xPintu: number): Titik[] {
  return [
    [xGerbang, Y_DEPAN_GERBANG],
    [xGerbang, PERON_BERANGKAT.y1],
    [xPintu, (PERON_BERANGKAT.y0 + PERON_BERANGKAT.y1) / 2],
    [xPintu, LAJUR.halte + 0.4],
  ];
}

/** Dari kursi ke gerbang di x tertentu: keluar ke depan baris → lorong → depan gerbang → ambang gerbang. */
export function ruteKeGerbang(kursi: number, xGerbang: number): Titik[] {
  const k = KURSI_TUNGGU[kursi]!;
  const lorong = lorongDekat(kursi, xGerbang);
  const yDepan = yDepanBaris(kursi);
  return [
    [k.x, yDepan],
    [lorong, yDepan],
    [lorong, Y_DEPAN_GERBANG],
    [xGerbang, Y_DEPAN_GERBANG],
    [xGerbang, PERON_BERANGKAT.y1],
  ];
}

// ---------------------------------------------------------------------------
// Lintasan ke halte kedatangan & keberangkatan

/**
 * Dari lajur dekat jalan raya ke halte kedatangan ke-k. Bila halte di
 * belakangnya kosong semua, lewat lajur halte; bila ada bus di sana (sedang
 * menurunkan penumpang), lewat lajur sirkulasi lalu berbelok masuk tepat di
 * depan bus itu (celah antarbus di halte cukup untuk belokan ini, dites).
 */
export function ruteKeHalteDatang(k: number, lewatSirkulasi: boolean): Titik[] {
  const xHalte = HALTE_DATANG_X[k]!;
  if (!lewatSirkulasi) return sambung(lintasanS(MASUK.dari, MASUK.ke), [MASUK.ke, [xHalte, LAJUR.halte]]);
  const { dari, ke } = MASUK_SIRKULASI;
  const mulaiMasuk: Titik = [xHalte - PANJANG_PINDAH_LAJUR, LAJUR.sirkulasi];
  return sambung(lintasanS(dari, ke), [ke, mulaiMasuk], lintasanS(mulaiMasuk, [xHalte, LAJUR.halte]));
}

/**
 * Dari ujung lorong pangkalan ke halte keberangkatan ke-k. Halte paling
 * belakang (barat) dicapai langsung lewat lajur halte; halte lain lewat lajur
 * sirkulasi lalu berbelok masuk, jadi bisa dicapai walau halte di belakangnya
 * terisi (celah antarbus di halte cukup untuk belokan ini, dites).
 */
export function ruteKeHalteBerangkat(k: number): Titik[] {
  const xHalte = HALTE_BERANGKAT_X[k]!;
  const { dari, ke } = SAMBUNG_BERANGKAT;
  if (k === HALTE_BERANGKAT_X.length - 1) return sambung(lintasanS(dari, ke), [ke, [xHalte, LAJUR.halte]]);
  // Turun ke lajur sirkulasi sedikit lebih landai (lebih jauh) daripada ke lajur halte:
  // melewati bus di halte paling belakang dengan ruang lega.
  const keSirkulasi: Titik = [ke[0] + 1.0, LAJUR.sirkulasi];
  const mulaiMasuk: Titik = [xHalte - PANJANG_PINDAH_LAJUR, LAJUR.sirkulasi];
  return sambung(lintasanS(dari, keSirkulasi), [keSirkulasi, mulaiMasuk], lintasanS(mulaiMasuk, [xHalte, LAJUR.halte]));
}

// ---------------------------------------------------------------------------
// Lintasan parkir serong

const COS_P = Math.cos(PARKIR_SERONG.sudut);
const SIN_P = Math.sin(PARKIR_SERONG.sudut);
/** Jarak (sepanjang arah petak) dari pusat ke ujung lurus petak. */
const SETENGAH_PETAK = 1.13;

/** Dari lajur halte (arah +x) membelok masuk petak serong sampai pusatnya. */
export function kurvaMasukPetak(sx: number): Titik[] {
  const { pusatY, jarakMasuk } = PARKIR_SERONG;
  const awal: Titik = [sx - jarakMasuk, LAJUR.halte];
  const ujung: Titik = [sx - SETENGAH_PETAK * COS_P, pusatY - SETENGAH_PETAK * SIN_P];
  return sambung(
    bezier(awal, [awal[0] + 0.9, awal[1]], [ujung[0] - 0.6 * COS_P, ujung[1] - 0.6 * SIN_P], ujung),
    [ujung, [sx, pusatY]],
  );
}

/** Dari pusat petak maju lurus lalu membelok ke lorong belakang (arah +x). */
export function kurvaKeluarPetak(sx: number): Titik[] {
  const { pusatY, jarakKeluar } = PARKIR_SERONG;
  const pangkal: Titik = [sx + SETENGAH_PETAK * COS_P, pusatY + SETENGAH_PETAK * SIN_P];
  const akhir: Titik = [sx + jarakKeluar, LAJUR.lorong];
  return sambung(
    [[sx, pusatY], pangkal],
    bezier(pangkal, [pangkal[0] + 0.6 * COS_P, pangkal[1] + 0.6 * SIN_P], [akhir[0] - 0.9, akhir[1]], akhir),
  );
}

// ---------------------------------------------------------------------------
// Cuci bus di petak parkir

const langkahHalus = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Petugas bus yang mencuci: kenek menyabun, sopir menyusul sambil membilas. */
export type PeranCuci = 'kenek' | 'sopir';
const MULAI_PERAN: Readonly<Record<PeranCuci, number>> = { kenek: CUCI.mulaiKenek, sopir: CUCI.mulaiSopir };

/** Kemajuan cuci saat petugas `peran` melewati titik ke-u (0–1) lintasannya mengelilingi bus. */
export function saatLewat(peran: PeranCuci, u: number): number {
  return MULAI_PERAN[peran] + CUCI.lamaPintu + CUCI.lamaPutaran * u;
}

/** Tingkat kotor bus (0–1): debu bawaan hilang selama sopir membilas. */
export function tingkatKotor(b: BusVisual): number {
  return b.debu * (1 - langkahHalus(saatLewat('sopir', 0), saatLewat('sopir', 1), b.cuci));
}

/**
 * Lintasan petugas mengelilingi bus dalam koordinat lokal bus [sepanjang hadap,
 * ke sisi pintu]: dari pintu depan ke belakang, menyeberang di belakang bus,
 * menyusuri sisi lain ke depan, menyeberang di depan, kembali ke pintu.
 */
export const LINGKAR_CUCI: readonly Titik[] = [
  [PINTU_BUS, CUCI.jarakSisi],
  [-CUCI.jarakUjung, CUCI.jarakSisi],
  [-CUCI.jarakUjung, -CUCI.jarakSisi],
  [CUCI.jarakUjung, -CUCI.jarakSisi],
  [CUCI.jarakUjung, CUCI.jarakSisi],
  [PINTU_BUS, CUCI.jarakSisi],
];
const JALUR_CUCI = new Jalur(LINGKAR_CUCI);

/** Titik lokal ke-u (0–1) di sepanjang lintasan petugas mengelilingi bus. */
export function titikLingkarCuci(u: number): Titik {
  const q = JALUR_CUCI.pose(u * JALUR_CUCI.panjang);
  return [q.x, q.y];
}
/** Jarak ke samping dari sumbu bus saat petugas masih/sudah di dalam pintu (tertutup badan bus). */
const L_DALAM_PINTU = 0.16;

export interface PetugasCuci {
  readonly peran: PeranCuci;
  /** Posisi lokal [sepanjang hadap, ke sisi pintu]. */
  readonly lokal: Titik;
  /** Sedang mengelilingi bus (bukan turun/naik pintu): kenek menyabun, sopir menyemprot air. */
  readonly bekerja: boolean;
  /** Kemajuan putaran (0–1) di sepanjang LINGKAR_CUCI. */
  readonly u: number;
}

/** Posisi lokal petugas pada kemajuan cuci p, null kalau ia sedang di dalam bus. */
function petugas(peran: PeranCuci, p: number): PetugasCuci | null {
  const t = p - MULAI_PERAN[peran];
  const selesaiPutaran = CUCI.lamaPintu + CUCI.lamaPutaran;
  if (!(t > 0 && t < selesaiPutaran + CUCI.lamaPintu)) return null;
  const [aPintu] = LINGKAR_CUCI[0]!;
  const sisi = CUCI.jarakSisi - L_DALAM_PINTU;
  if (t < CUCI.lamaPintu) return { peran, lokal: [aPintu, L_DALAM_PINTU + sisi * (t / CUCI.lamaPintu)], bekerja: false, u: 0 };
  if (t > selesaiPutaran) return { peran, lokal: [aPintu, CUCI.jarakSisi - sisi * ((t - selesaiPutaran) / CUCI.lamaPintu)], bekerja: false, u: 1 };
  const u = (t - CUCI.lamaPintu) / CUCI.lamaPutaran;
  const q = JALUR_CUCI.pose(u * JALUR_CUCI.panjang);
  return { peran, lokal: [q.x, q.y], bekerja: true, u };
}

/** Petugas yang sedang di luar bus pada kemajuan cuci p (kosong kalau belum/sudah selesai). */
export function petugasCuci(p: number): PetugasCuci[] {
  if (!(p > 0 && p < 1)) return [];
  const hasil: PetugasCuci[] = [];
  for (const peran of ['kenek', 'sopir'] as const) {
    const q = petugas(peran, p);
    if (q) hasil.push(q);
  }
  return hasil;
}

/** Ada petugas yang sedang turun/naik lewat pintu depan (pintu dibuka). */
export function petugasDiPintu(p: number): boolean {
  if (!(p > 0 && p < 1)) return false;
  const selesaiPutaran = CUCI.lamaPintu + CUCI.lamaPutaran;
  return (['kenek', 'sopir'] as const).some((peran) => {
    const t = p - MULAI_PERAN[peran];
    return (t > -0.01 && t < CUCI.lamaPintu + 0.01) || (t > selesaiPutaran - 0.01 && t < selesaiPutaran + CUCI.lamaPintu + 0.01);
  });
}

/** Titik lokal bus [sepanjang hadap, ke sisi pintu] → koordinat dunia. */
export function lokalBusKeDunia(b: BusVisual, a: number, l: number): Titik {
  const c = Math.cos(b.sudut);
  const s = Math.sin(b.sudut);
  return [b.x + a * c - l * s, b.y + a * s + l * c];
}

/** Bus berhenti di halte menurunkan/memuat penumpang (pintu & bagasi terbuka, kenek berjaga di bagasi). */
export function busDiHalte(b: BusVisual): boolean {
  return b.jenis === 'terminal' && (b.fase === 'turunkan' || b.fase === 'muat') && b.v < 0.05;
}

/** Posisi dunia kenek yang berjaga di samping bagasi bus yang sedang di halte, atau null. */
export function posisiKenekBagasi(b: BusVisual): Titik | null {
  return busDiHalte(b) ? lokalBusKeDunia(b, BAGASI.a + BAGASI.kenek, BUS.lebar / 2 + 0.15) : null;
}

/** Posisi dunia petugas yang sedang mencuci bus ini. */
export function posisiPetugasCuci(b: BusVisual): { readonly peran: PeranCuci; readonly titik: Titik }[] {
  if (b.fase !== 'parkir') return [];
  return petugasCuci(b.cuci).map((q) => ({ peran: q.peran, titik: lokalBusKeDunia(b, q.lokal[0], q.lokal[1]) }));
}

// ---------------------------------------------------------------------------
// Geometri bus

function ekstenX(b: BusVisual): number {
  return (Math.abs(Math.cos(b.sudut)) * BUS.panjang + Math.abs(Math.sin(b.sudut)) * BUS.lebar) / 2;
}

function ekstenY(b: BusVisual): number {
  return (Math.abs(Math.sin(b.sudut)) * BUS.panjang + Math.abs(Math.cos(b.sudut)) * BUS.lebar) / 2;
}

function menempatiLajur(b: BusVisual, yLajur: number): boolean {
  return Math.abs(b.y - yLajur) < ekstenY(b) + 0.15;
}

function dekatiSudut(sekarang: number, target: number, t: number): number {
  let beda = target - sekarang;
  while (beda > Math.PI) beda -= 2 * Math.PI;
  while (beda < -Math.PI) beda += 2 * Math.PI;
  return sekarang + beda * t;
}
