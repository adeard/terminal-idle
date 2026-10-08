/**
 * Terminal 3D: menyusun adegan (lingkungan, gedung, armada, kerumunan, zona)
 * dan tiap frame hanya MEMBACA state (lewat PembacaState) untuk menggerakkan
 * model keramaian dekoratif (DuniaVisual). Tidak menghitung ekonomi, tidak
 * mengirim aksi.
 */
import * as THREE from 'three';
import type { PembacaState } from '../app/pengendali';
import { cuacaTerminal, cuacaTerminalState, kilatPada, type Cuaca } from '../sim/cuaca';
import type { FasilitasId, PoId, TeknologiId } from '../sim/fitur';
import { busEmasAktif, kelasBusBeroperasi, kelasTerminal, loketTerisi, type GameState, type PoTerdaftar } from '../sim/state';
import { keramaianTerminal, waktuTerminal, waktuTerminalState } from '../sim/waktu';
import { URL_ATLAS } from './aset';
import { Adegan } from './adegan';
import { CahayaMalam } from './cahaya3d';
import { PencucianBus } from './cuci3d';
import { DuniaVisual, posisiKenekBagasi, posisiPetugasCuci, type PeristiwaBus, type TransaksiVisual } from './dunia-visual';
import { bangunGedung, DERET_KURSI_AULA, MEJA_INFO, MEJA_TUNGGU, posisiKursiAula, Y_MEJA_TUNGGU } from './gedung3d';
import { Kumpulan } from './geometri';
import { KasVisual, lajuUangState, type LajuUang } from './kas-visual';
import { HiasanKelas } from './kelas3d';
import { HiasanEvent, RAMAI_EVENT } from './event3d';
import { PembangunanTerminal } from './pembangunan3d';
import { jendelaDipakai, jendelaPo, kelompokParkirDibangun, posisiPekerja, TAHAP_PARKIR_MOBIL_PENUH } from './perluasan-adegan';
import { ArmadaKendaraan } from './kendaraan3d';
import { hitungLajuVisual, maskJurusanState, terapkanRitme, type LajuVisual } from './laju';
import { Hujan3D } from './hujan3d';
import { formatJamJadwal, JadwalKeberangkatan } from './jadwal';
import {
  ASONGAN,
  dalamRentang,
  JAM_ASONGAN,
  JAM_KEBERSIHAN,
  JAM_PATROLI,
  loketBuka,
  PATROLI_SATPAM,
  posisiPatroli,
  SAPU_AULA,
  SAPU_TUNGGU,
  tokoBuka,
  type JenisToko,
} from './kehidupan-malam';
import { LabelBus } from './label-bus3d';
import { GUBUK_OJEK, LuarTerminal } from './luar3d';
import { RollingDoor } from './malam3d';
import { PapanJadwal } from './papan-jadwal3d';
import { Modernisasi } from './modernisasi3d';
import { PapanJurusan } from './papan-jurusan3d';
import { LaluLintas, Trotoar } from './lalu-lintas';
import { suasanaLangit, terapkanCuaca } from './langit';
import { bangunLingkungan, kibarkan, TITIK_LAMPU } from './lingkungan3d';
import { buatMaterial, type PustakaMaterial } from './material3d';
import { LaluLintas3D } from './mobil3d';
import { buatPenampilan, buatPenampilanAnak, Kerumunan3D, WARNA_PAYUNG, type DataOrang, type Penampilan } from './orang3d';
import { Rombongan } from './rombongan';
import { bangunSekitar, JALAN_BELAKANG } from './sekitar3d';
import { PopUang3D } from './pop-uang3d';
import { ProyekPerluasan } from './proyek3d';
import { bunyiTelolet, PengamatSuara, type PenerimaSuara, type Pendengar } from './suara';
import {
  diBawahAtap,
  GEDUNG,
  GERBANG_X,
  KIOS_TUNGGU,
  LORONG_PARKIR,
  PERON,
  PERON_BERANGKAT,
  LOKET,
  MAKS_ORANG,
  PINTU_MASUK,
  POS_RETRIBUSI,
  RUANG_TUNGGU,
  TINGGI_LANTAI_GEDUNG,
  TINGGI_PERON,
  tinggiLantai,
  TITIK_INTI,
  TITIK_INTI_POTRET,
  TOKO_AULA,
  X_LOKET,
  Y_TROTOAR_BELAKANG,
} from './tata-letak';
import { AnakTelolet, ANAK_TELOLET, anakTeloletHadir, busDiKetuk, JEDA_TELOLET_BUS, melodiTelolet } from './telolet';
import { SpandukTelolet } from './telolet3d';
import { TEKS } from '../ui/teks';
import { ZonaTahap } from './zona3d';

/** Detik simulasi keramaian sebelum frame pertama, supaya terminal langsung hidup: orang berjalan dengan laju alami dan bus menunggu jadwal di pangkalan, jadi butuh beberapa menit sampai semua tahap terisi. */
const PEMANASAN_DETIK = 150;
/** Tinggi lantai kompleks (paving) tempat orang berdiri di luar peron. */
const H_LANTAI = 0.012;
const H_TROTOAR = 0.035;
/** Jumlah variasi penampilan penumpang & pejalan kaki. */
const JUMLAH_PENAMPILAN = 64;
const JUMLAH_PENAMPILAN_ANAK = 24;
/** Id pejalan kaki trotoar & orang statis dipisah dari id penumpang DuniaVisual. */
const ID_TROTOAR = 1_000_000;
const ID_STATIS = 2_000_000;
/** Kenek & sopir yang mencuci bus: id orang = ID_PETUGAS_CUCI + 2 × id bus (+1 untuk sopir). */
const ID_PETUGAS_CUCI = 3_000_000;
/** Pekerja proyek perluasan: id orang = ID_PEKERJA_PROYEK + indeks rutenya (lihat LOKASI_PROYEK). */
const ID_PEKERJA_PROYEK = 5_000_000;
/** Tinggi aspal pangkalan tempat kenek berdiri. */
const H_ASPAL = 0.02;
/** Penumpang duduk di ruang tunggu menghadap gerbang (utara, −y). */
const HADAP_GERBANG = -Math.PI / 2;
/** Kiblat dari Indonesia ±barat-barat laut; di denah ini musholla menghadap barat (−x). */
const HADAP_KIBLAT = Math.PI;
/** Anak-anak "Om Telolet Om" menghadap jalan raya (selatan pagar seberang = +y). */
const HADAP_JALAN = Math.PI / 2;
/** Ketukan (bukan geser/zoom kamera): jari bergeser paling jauh sekian px dan diangkat dalam sekian ms. */
const KETUK = { geserPx: 8, lamaMs: 400 } as const;
/** Porsi kendaraan & pejalan kaki di luar terminal saat paling sepi (ikut ritme harian). */
const KEPADATAN_LUAR_SEPI = 0.25;

/** Laju keramaian dari state, disesuaikan ritme jam & hari terminal. */
function lajuBerirama(state: GameState, keramaian: number): LajuVisual {
  return terapkanRitme(hitungLajuVisual(state), keramaian);
}

/** Bagian terminal yang sudah dibangun menurut state: jurusan yang dilayani, kelompok parkir, & jendela loket yang dipakai PO. */
function bangunanTerminal(state: GameState): { readonly mask: number; readonly kelompok: number; readonly jendela: number } {
  const perluasan = state.perkembangan.perluasan;
  return { mask: maskJurusanState(state), kelompok: kelompokParkirDibangun(perluasan), jendela: jendelaDipakai(perluasan, loketTerisi(state)) };
}

/** Tahap perluasan yang sedang dibangun (1-based), atau null bila tidak ada proyek. */
const tahapProyek = (state: GameState): number | null => (state.perkembangan.proyekDetik > 0 ? state.perkembangan.perluasan + 1 : null);

const kepadatanLuar = (keramaian: number): number => KEPADATAN_LUAR_SEPI + (1 - KEPADATAN_LUAR_SEPI) * keramaian;

/** Mulai sekian deras, orang di luar atap membuka payung dan pengunjung di luar berteduh. */
const HUJAN_PAYUNG = 0.12;
/** Porsi orang yang membawa payung (sisanya menerobos hujan). */
const PORSI_BERPAYUNG = 0.85;
/** Tanah basah mengikuti hujan dalam ±10 dtk, mengering ±2 menit (±2 jam terminal) setelah reda. */
const TAU_BASAH = 10;
const DETIK_KERING = 120;
/** Langkah simulasi keramaian terbesar (detik main); dipercepat = beberapa langkah per frame. */
const LANGKAH_SIM = 0.05;

/** Tempat "+Rp" sewa kios harian: di atas deretan kios ruang tunggu. */
const TEMPAT_SEWA: readonly [number, number] = [RUANG_TUNGGU.x0 + 0.4, (KIOS_TUNGGU[0]![0] + KIOS_TUNGGU[KIOS_TUNGGU.length - 1]![1]) / 2];

/** Pecahan tetap per id (0–1). */
const pecahanId = (id: number): number => (id * 0.6180339887 + 0.21) % 1;

const warna = (c: number): THREE.Color => new THREE.Color(c);

/** Sopir bus: kemeja putih, celana gelap, bertopi. */
const SERAGAM_SOPIR: Penampilan = {
  kulit: warna(0xc68642),
  baju: warna(0xf1f5f9),
  celana: warna(0x1f2937),
  rambut: warna(0x1c1410),
  jilbab: null,
  ransel: null,
  koper: null,
  topi: true,
  skala: 1,
};

/** Pengunjung yang duduk di kursi aula: [indeks deretan, indeks kursi]. */
const DUDUK_AULA: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 5],
  [1, 3],
  [2, 6],
  [3, 0],
  [3, 4],
  [4, 2],
  [4, 3],
  [5, 6],
  [6, 0],
  [7, 5],
];

/** Orang yang diam di tempat; pengunjung hanya terlihat bila terminal cukup ramai. */
interface OrangStatis {
  readonly orang: DataOrang;
  /** Terlihat bila keramaian ≥ ambang (0 = selalu ada, mis. petugas). */
  readonly ambang: number;
  /** Hanya ada setelah fasilitas ini dibangun (mis. penjaga kios, juru parkir). */
  readonly fasilitas?: FasilitasId;
  /** Hanya ada setelah modernisasi ini dipasang (mis. petugas pengatur bus). */
  readonly teknologi?: TeknologiId;
  /** Penjaga toko: pulang saat tokonya tutup (lihat JAM_BUKA). */
  readonly toko?: JenisToko;
  /** Petugas jendela loket ke-i: tidak ada saat loketnya tutup (malam hari, atau jendelanya tidak dipakai mitra PO). */
  readonly loket?: number;
}

/**
 * Orang statis ini sedang bertugas/berada di terminal menurut state (fasilitas, modernisasi, jam buka).
 * @param jendela banyaknya jendela loket yang dipakai mitra PO di siang hari (lihat jendelaDipakai)
 */
function hadir(s: OrangStatis, state: GameState, jam: number, jendela: number): boolean {
  if (s.fasilitas && state.terminal.fasilitas[s.fasilitas] === 0) return false;
  if (s.teknologi && !state.terminal.teknologi[s.teknologi]) return false;
  if (s.toko && !tokoBuka(s.toko, jam)) return false;
  if (s.loket !== undefined && !loketBuka(jam, jendela).includes(s.loket)) return false;
  return true;
}

const diLuar = (o: DataOrang): boolean => !diBawahAtap(o.x, o.y);

/** Ambang pengunjung ke-i: menyebar 0,12–0,82, jadi saat sepi tinggal sebagian kecil. */
const ambangPengunjung = (i: number): number => 0.12 + 0.7 * ((i * 0.6180339887 + 0.3) % 1);

/**
 * Orang yang diam di tempat: satpam, polisi di pos, orang duduk, anak di taman,
 * petugas loket, petugas informasi, penjaga toko aula, petugas gerbang ruang
 * tunggu, penjual kios, dan pengunjung yang makan. Petugas selalu ada;
 * pengunjung (makan, duduk di aula, anak di taman) berkurang saat sepi.
 */
function orangStatis(): OrangStatis[] {
  const seragam = (baju: number, celana: number, topi: boolean, skala = 1): Penampilan => ({
    kulit: warna(0xc68642),
    baju: warna(baju),
    celana: warna(celana),
    rambut: warna(0x1c1410),
    jilbab: null,
    ransel: null,
    koper: null,
    topi,
    skala,
  });
  const sipil = (benih: number, skala = 1): Penampilan => {
    const p = buatPenampilan(1, 900 + benih)[0]!;
    return { ...p, skala: p.skala * skala };
  };
  /** Orang yang bekerja di tempat (penjual, penjaga toko): tanpa koper & ransel. */
  const pekerja = (benih: number): Penampilan => ({ ...sipil(benih), ransel: null, koper: null });
  const petugas = GERBANG_X.map((g, i): DataOrang => ({
    id: ID_STATIS + 10 + i,
    x: g + 0.3,
    y: RUANG_TUNGGU.y0 + 0.16,
    h: TINGGI_PERON,
    penampilan: seragam(0x1e3a8a, 0x111827, true),
    hadap: Math.PI,
  }));
  const penjual = KIOS_TUNGGU.map(([ya, yb], i): DataOrang => ({
    id: ID_STATIS + 20 + i,
    x: RUANG_TUNGGU.x0 + 0.4,
    y: (ya + yb) / 2 + (i - 1) * 0.12,
    h: TINGGI_PERON,
    penampilan: pekerja(i),
    hadap: 0,
  }));
  // Pengunjung makan: duduk di kursi bulat sisi kiri/kanan meja, menghadap meja.
  const makan: DataOrang[] = [];
  MEJA_TUNGGU.forEach((x, i) => {
    if (i % 2 === 1) makan.push({ id: ID_STATIS + 30 + i * 2, x: x - 0.2, y: Y_MEJA_TUNGGU, h: TINGGI_PERON + 0.005, penampilan: sipil(10 + i), pose: 'duduk', hadap: 0 });
    if (i !== 2) makan.push({ id: ID_STATIS + 31 + i * 2, x: x + 0.2, y: Y_MEJA_TUNGGU, h: TINGGI_PERON + 0.005, penampilan: sipil(20 + i), pose: 'duduk', hadap: Math.PI });
  });
  // Aula loket: petugas berdiri di balik tiap jendela menghadap pembeli (selatan).
  const hAula = TINGGI_LANTAI_GEDUNG;
  const petugasLoket = X_LOKET.map((x, i): DataOrang => ({
    id: ID_STATIS + 50 + i,
    x,
    y: LOKET.yPetugas,
    h: hAula,
    penampilan: seragam(i % 2 ? 0xe9a23b : 0xf5f5f4, 0x1f2937, false),
    hadap: Math.PI / 2,
  }));
  const penjagaToko = TOKO_AULA.map((t, i): DataOrang => ({ id: ID_STATIS + 70 + i, x: t.x1 - 0.27, y: 11.62, h: hAula, penampilan: pekerja(40 + i), hadap: Math.PI / 2 }));
  const dudukAula = DUDUK_AULA.map(([d, c], i): DataOrang => {
    const [x, y] = posisiKursiAula(DERET_KURSI_AULA[d]!, c);
    return { id: ID_STATIS + 80 + i, x, y, h: hAula + 0.005, penampilan: sipil(50 + i), pose: 'duduk', hadap: Math.PI / 2 };
  });
  const petugasLain: DataOrang[] = [
    { id: ID_STATIS + 60, x: MEJA_INFO[0] + 0.1, y: MEJA_INFO[1] - 0.25, h: hAula, penampilan: seragam(0x1d4ed8, 0x1f2937, false), hadap: Math.PI / 2 },
    { id: ID_STATIS + 61, x: PINTU_MASUK[0] - 0.6, y: 14.55, h: hAula, penampilan: seragam(0xdbe4ee, 0x1e293b, true), hadap: Math.PI / 2 },
    { id: ID_STATIS, x: 18.95, y: 15.35, h: H_LANTAI, penampilan: seragam(0xdbe4ee, 0x1e293b, true), hadap: Math.PI / 2 },
  ];
  const selalu = (orang: DataOrang): OrangStatis => ({ orang, ambang: 0 });
  const rompi = (warnaRompi: number): Penampilan => seragam(warnaRompi, 0x1f2937, true);
  return [
    ...[...petugas, ...petugasLain].map(selalu),
    ...petugasLoket.map((orang, i): OrangStatis => ({ orang, ambang: 0, loket: i })),
    // Fasilitas: penjaga kios & toko (pulang saat tokonya tutup), juru parkir, petugas toilet, petugas retribusi.
    ...penjual.map((orang): OrangStatis => ({ orang, ambang: 0, fasilitas: 'kios', toko: 'kios' })),
    ...penjagaToko.map((orang, i): OrangStatis => ({ orang, ambang: 0, fasilitas: 'kios', toko: TOKO_AULA[i]!.nama === 'MINIMARKET' ? 'minimarket' : 'apotek' })),
    // Pangkalan ojek: satu duduk di bangku gubuk, satu menawarkan ojek di mulut gang (siang).
    { orang: { id: ID_STATIS + 94, x: GUBUK_OJEK.x - 0.02, y: (GUBUK_OJEK.y0 + GUBUK_OJEK.y1) / 2, h: 0.055, penampilan: seragam(0x7f1d1d, 0x1f2937, false), pose: 'duduk', hadap: 0 }, ambang: 0 },
    { orang: { id: ID_STATIS + 95, x: GUBUK_OJEK.x + 0.55, y: 19.75, h: H_TROTOAR, penampilan: seragam(0x1f2937, 0x334155, true), hadap: -Math.PI / 2 }, ambang: 0.35 },
    { orang: { id: ID_STATIS + 90, x: LORONG_PARKIR.x0 - 0.3, y: LORONG_PARKIR.y + 0.6, h: H_LANTAI, penampilan: rompi(0xf97316), hadap: Math.PI }, ambang: 0, fasilitas: 'parkir' },
    // Petugas kebersihan toilet berjaga di lorong sayap barat, di sisi dinding aula (tidak menghalangi jalan).
    { orang: { id: ID_STATIS + 91, x: GEDUNG.x0 - 0.15, y: 12.3, h: hAula, penampilan: seragam(0x16a34a, 0x1f2937, false), hadap: Math.PI }, ambang: 0, fasilitas: 'toilet' },
    { orang: { id: ID_STATIS + 1, x: POS_RETRIBUSI.x0 - 0.5, y: POS_RETRIBUSI.y1 + 0.3, h: 0, penampilan: seragam(0x8b6b3d, 0x4a3b24, true), hadap: Math.PI / 4 }, ambang: 0, fasilitas: 'retribusi' },
    // Modernisasi: petugas pengatur bus berompi di peron kedatangan & keberangkatan.
    { orang: { id: ID_STATIS + 92, x: PERON.x0 + 0.45, y: PERON.y0 + 0.4, h: TINGGI_PERON, penampilan: rompi(0xfacc15), hadap: -Math.PI / 2 }, ambang: 0, teknologi: 'pengaturBus' },
    { orang: { id: ID_STATIS + 93, x: RUANG_TUNGGU.x1 - 0.45, y: PERON_BERANGKAT.y0 + 0.3, h: TINGGI_PERON, penampilan: rompi(0xfacc15), hadap: -Math.PI / 2 }, ambang: 0, teknologi: 'pengaturBus' },
    ...makan.map((orang, i): OrangStatis => ({ orang, ambang: ambangPengunjung(i) })),
    // Tiap pengunjung aula keempat tetap ada semalaman (menunggu bus subuh).
    ...dudukAula.map((orang, i): OrangStatis => ({ orang, ambang: i % 4 === 0 ? 0 : ambangPengunjung(i + 3) })),
    { orang: { id: ID_STATIS + 2, x: 21.0, y: 16.72, h: H_LANTAI, penampilan: seragam(0x2563eb, 0x334155, false), pose: 'duduk', hadap: Math.PI / 2 }, ambang: 0.25 },
    // Anak bermain di taman: pulang saat malam/sepi.
    { orang: { id: ID_STATIS + 3, x: 9.35, y: 14.4, h: 0.016, penampilan: { ...seragam(0xf472b6, 0x1e3a8a, false, 0.62), kulit: warna(0xe0ac69) }, hadap: 0.3 }, ambang: 0.45 },
  ];
}

/** Id petugas kebersihan & pedagang asongan (dipisah dari orang statis lain). */
const ID_KEBERSIHAN = ID_STATIS + 200;
const ID_ASONGAN = ID_STATIS + 210;
const ID_ANAK_TELOLET = ID_STATIS + 300;

const seragamPolos = (baju: number, celana: number, topi: boolean): Penampilan => ({
  kulit: warna(0xc68642),
  baju: warna(baju),
  celana: warna(celana),
  rambut: warna(0x1c1410),
  jilbab: null,
  ransel: null,
  koper: null,
  topi,
  skala: 1,
});
/** Petugas kebersihan: seragam hijau toska bertopi. */
const SERAGAM_KEBERSIHAN = seragamPolos(0x0e7490, 0x1f2937, true);
/** Pedagang asongan: kaus & topi, dengan warna dagangan di kotaknya. */
const PENAMPILAN_ASONGAN: readonly Penampilan[] = [seragamPolos(0xf59e0b, 0x44403c, true), seragamPolos(0x65a30d, 0x1f2937, true)];
const DAGANGAN_ASONGAN = [0xef4444, 0x3b82f6].map((c) => new THREE.Color(c));
/** Pekerja proyek perluasan: rompi oranye bertopi. */
const SERAGAM_PEKERJA = seragamPolos(0xf97316, 0x1f2937, true);

/**
 * Mode sinema (video promosi): hanya tampilan yang berubah, ekonomi di state
 * tetap berjalan normal.
 */
export interface OpsiSinema {
  /** Laju jam tampilan (detik main per detik nyata); 0 = jam terminal sebenarnya. */
  readonly detikPerDetik: number;
  /** Kecepatan kerumunan, bus & lalu lintas; 0 = ikut kecepatan game. */
  readonly kecepatanDunia: number;
  readonly cuaca: 'jadwal' | 'cerah' | 'hujan';
}

/** Cuaca tampilan: sesuai jadwal, atau dipaksa cerah / hujan (mode sinema). */
function cuacaTampil(c: Cuaca, pilihan: OpsiSinema['cuaca']): Cuaca {
  if (pilihan === 'hujan') return { hujan: Math.max(c.hujan, 0.75), mendung: 1 };
  if (pilihan === 'cerah') return { hujan: 0, mendung: 0 };
  return c;
}

export class Terminal3D {
  /** Bus Emas boleh digambar (hanya kalau iklan berhadiah tersedia; diatur dari main.ts). */
  tampilkanBusEmas: () => boolean = () => false;
  /** Dipanggil tiap pemain membunyikan klakson telolet (untuk analitik; diatur dari main.ts). */
  saatTelolet: () => void = () => {};
  /** Mode sinema (lihat aturSinema); null = tampilan biasa. */
  private sinema: OpsiSinema | null = null;
  /** Selisih jam tampilan terhadap jam main selama mode sinema (detik main). */
  private geserWaktu = 0;
  private readonly dunia: DuniaVisual;
  private readonly penampilan = buatPenampilan(JUMLAH_PENAMPILAN);
  private readonly penampilanAnak = buatPenampilanAnak(JUMLAH_PENAMPILAN_ANAK);
  /** Kenek (bagasi & cuci): penampilan penumpang tanpa koper & ransel. */
  private readonly penampilanKenek = this.penampilan.map((p): Penampilan => ({ ...p, ransel: null, koper: null }));
  /** Anak & pendamping yang ikut sebagian penumpang (tidak memakai slot antrean). */
  private readonly rombongan = new Rombongan();
  private readonly statis = orangStatis();
  private waktu = 0;
  /** Keramaian terminal (0–1) menurut jam & hari, diperbarui tiap frame. */
  private keramaian: number;
  private readonly pengamatSuara = new PengamatSuara();
  private suara: PenerimaSuara | null = null;
  private readonly hujan3d = new Hujan3D();
  /** Intensitas hujan & kebasahan tanah sekarang (0–1). */
  private hujan = 0;
  private basah: number;
  private kilat = 0;
  /** Waktu main yang dihaluskan per frame (state maju per tick 0,1 dtk; kilatan petir lebih singkat). */
  private detikHalus = 0;
  /** Orientasi area adegan saat terakhir dibingkai. */
  private lanskap: boolean;
  /** Kejadian bus selama frame ini (dari semua langkah simulasi), untuk suara. */
  private readonly peristiwa: PeristiwaBus[] = [];
  /** Transaksi keramaian selama frame ini (dari semua langkah simulasi), untuk efek "+Rp". */
  private readonly transaksi: TransaksiVisual[] = [];
  private readonly kas = new KasVisual();
  /** Pendapatan per detik tiap sumber untuk state terakhir (state berganti tiap tick). */
  private lajuUang: { readonly state: GameState; readonly laju: LajuUang } | null = null;
  /** Detik main berjalan (dipercepat bersama kecepatan waktu): patroli satpam, sapu, asongan. */
  private detikPatroli = 0;
  /** Jam terminal frame ini (0–24). */
  private jam = 0;
  /** Jendela loket yang dipakai mitra PO di siang hari (lihat jendelaDipakai), diperbarui tiap frame dari state. */
  private jendela = X_LOKET.length;
  /** Pemilik tiap jendela loket untuk daftar PO & banyaknya jendela terakhir (lihat pemilikJendela). */
  private pemilik: { readonly terdaftar: readonly PoTerdaftar[]; readonly jendela: number; readonly po: readonly (PoId | null)[] } | null = null;
  /** Tahap perluasan frame lalu: kembang api peresmian saat bertambah (bukan saat memuat save). */
  private perluasanLalu: number;
  private readonly jadwal = new JadwalKeberangkatan();
  private readonly anakTelolet = new AnakTelolet();
  /** Klakson telolet yang diketuk sejak frame lalu (dibunyikan di kirimSuara). */
  private readonly teloletTertunda: { readonly x: number; readonly y: number; readonly melodi: number }[] = [];
  /** Waktu (detik nyata) telolet terakhir tiap bus. */
  private readonly teloletTerakhir = new Map<number, number>();

  private constructor(
    private readonly adegan: Adegan,
    private readonly pembaca: PembacaState,
    private readonly armada: ArmadaKendaraan,
    private readonly kerumunan: Kerumunan3D,
    private readonly zona: ZonaTahap,
    private readonly labelBus: LabelBus,
    private readonly papanJurusan: PapanJurusan,
    private readonly modernisasi: Modernisasi,
    private readonly rollingDoor: RollingDoor,
    private readonly luar: LuarTerminal,
    private readonly papanJadwal: PapanJadwal,
    private readonly bendera: THREE.Mesh,
    private readonly laluLintas: LaluLintas,
    private readonly laluLintas3D: LaluLintas3D,
    private readonly trotoar: Trotoar,
    private readonly material: PustakaMaterial,
    private readonly cahaya: CahayaMalam,
    private readonly cuci: PencucianBus,
    private readonly popUang: PopUang3D,
    private readonly spanduk: SpandukTelolet,
    private readonly hiasanKelas: HiasanKelas,
    private readonly hiasanEvent: HiasanEvent,
    private readonly pembangunan: PembangunanTerminal,
    private readonly proyek: ProyekPerluasan,
    /** Mobil pengunjung di baris kedua parkir: baru terisi setelah pangkalan diperluas (TAHAP_PARKIR_MOBIL_PENUH). */
    private readonly parkirBaris2: THREE.Group,
  ) {
    this.pasangKetuk(adegan.renderer.domElement);
    // 40 = kelipatan jumlah bus terminal (8) & kendaraan lewat (5), jadi keduanya merata.
    this.lanskap = adegan.lebarCss > adegan.tinggiCss;
    this.dunia = new DuniaVisual({ jumlahLivery: 40, jumlahVarianOrang: JUMLAH_PENAMPILAN, wanita: (v) => this.penampilan[v % JUMLAH_PENAMPILAN]!.jilbab !== null });
    const w = waktuTerminalState(pembaca.state);
    this.keramaian = keramaianTerminal(w);
    this.basah = Math.min(1, cuacaTerminalState(pembaca.state).hujan * 1.5);
    this.perluasanLalu = pembaca.state.perkembangan.perluasan;
    adegan.scene.add(this.hujan3d.objek);
    // Pemanasan dengan jendela loket yang buka di frame pertama, supaya antrean tidak langsung pindah jendela.
    const awal = lajuBerirama(pembaca.state, this.keramaian);
    this.dunia.pemanasan(PEMANASAN_DETIK, { ...awal, loketBuka: loketBuka(w.jamDesimal, awal.jendela), jam: w.jamDesimal });
    laluLintas.aturKepadatanSegera(kepadatanLuar(this.keramaian));
    trotoar.aturKepadatanSegera(kepadatanLuar(this.keramaian));
  }

  static async buat(wadah: HTMLElement, wadahLabel: HTMLElement, pembaca: PembacaState): Promise<Terminal3D> {
    const adegan = new Adegan(wadah);
    adegan.ukur(wadah.clientWidth, wadah.clientHeight);
    const atlas = await new THREE.TextureLoader().loadAsync(URL_ATLAS);
    const m = buatMaterial(adegan.renderer, atlas);
    const aniso = Math.min(8, adegan.renderer.capabilities.getMaxAnisotropy());

    const k = new Kumpulan();
    const { bendera } = bangunLingkungan(k, m);
    bangunGedung(k, m);
    const kabel = new THREE.Group();
    const baris2 = new Kumpulan();
    bangunSekitar(k, m, kabel, baris2);
    k.bangun(adegan.scene);
    const parkirBaris2 = new THREE.Group();
    baris2.bangun(parkirBaris2);
    adegan.scene.add(bendera, kabel, parkirBaris2);

    const laluLintas = new LaluLintas({ x0: -64, x1: 100, lajurTimur: JALAN_BELAKANG.lajurTimur, lajurBarat: JALAN_BELAKANG.lajurBarat, jumlahPerLajur: 25 });
    const laluLintas3D = new LaluLintas3D(48);
    // Trotoar seberang jalan raya dan kedua sisi jalan belakang.
    const trotoar = new Trotoar({ x0: -48, x1: 76, jalur: [-0.5, Y_TROTOAR_BELAKANG, 22.05], jumlahPerJalur: 20, jumlahVarian: JUMLAH_PENAMPILAN });

    const armada = new ArmadaKendaraan(atlas.image as CanvasImageSource, aniso, adegan.renderer);
    // Penumpang + anggota rombongannya (±30 %) + pejalan kaki, petugas, orang diam.
    const kerumunan = new Kerumunan3D(Math.round(MAKS_ORANG * 1.3) + 200);
    const cahaya = new CahayaMalam(TITIK_LAMPU);
    const cuci = new PencucianBus();
    adegan.scene.add(laluLintas3D.objek, armada.objek, kerumunan.objek, cahaya.objek, cuci.objek);

    const zona = new ZonaTahap(adegan.scene, wadahLabel);
    const labelBus = new LabelBus(wadahLabel);
    const popUang = new PopUang3D(wadahLabel);
    const spanduk = new SpandukTelolet(m);
    const hiasanKelas = new HiasanKelas(m);
    hiasanKelas.perbarui(kelasTerminal(pembaca.state), pembaca.state.profil.namaTerminal);
    const hiasanEvent = new HiasanEvent(m);
    // Bagian terminal yang belum dibangun (jalur & parkir jurusan yang belum dibuka), dan proyek perluasan yang sedang berjalan.
    const bangunan = bangunanTerminal(pembaca.state);
    const pembangunan = new PembangunanTerminal();
    pembangunan.perbarui({ jalur: pembaca.state.terminal.jalur, mask: bangunan.mask, kelompok: bangunan.kelompok });
    const proyek = new ProyekPerluasan(m);
    proyek.perbarui(tahapProyek(pembaca.state), 0, 0);
    adegan.scene.add(pembangunan.objek, proyek.objek);
    adegan.scene.add(spanduk.objek, hiasanKelas.objek, hiasanEvent.objek);
    // Papan jurusan (ikut jurusan yang dilayani mitra PO) & perlengkapan modernisasi (tampil setelah dibeli).
    const papanJurusan = new PapanJurusan(m);
    const modernisasi = new Modernisasi(m);
    adegan.scene.add(papanJurusan.objek, modernisasi.objek);
    papanJurusan.perbarui({ mask: bangunan.mask, jendela: jendelaPo(bangunan.jendela, pembaca.state.mitra.terdaftar), kelompok: bangunan.kelompok });
    modernisasi.perbarui(pembaca.state.terminal.teknologi);
    // Kehidupan malam (rolling door), luar pagar (ojek & ojol), papan jadwal dari bus yang ada.
    const rollingDoor = new RollingDoor(m);
    const luar = new LuarTerminal(m);
    const papanJadwal = new PapanJadwal(m);
    adegan.scene.add(rollingDoor.objek, luar.objek);
    adegan.bingkai(adegan.lebarCss > adegan.tinggiCss ? TITIK_INTI : TITIK_INTI_POTRET);
    // Kompilasi shader sebelum frame pertama supaya tidak tersendat saat mulai.
    await adegan.renderer.compileAsync(adegan.scene, adegan.kamera);
    return new Terminal3D(adegan, pembaca, armada, kerumunan, zona, labelBus, papanJurusan, modernisasi, rollingDoor, luar, papanJadwal, bendera, laluLintas, laluLintas3D, trotoar, m, cahaya, cuci, popUang, spanduk, hiasanKelas, hiasanEvent, pembangunan, proyek, parkirBaris2);
  }

  /** Sambungkan mesin suara; tiap frame adegan mengirim lapisan suara & bunyi sesaat. */
  pasangSuara(suara: PenerimaSuara | null): void {
    this.suara = suara;
  }

  /**
   * Mode sinema untuk video promosi: kamera berputar sendiri, jam tampilan
   * (langit, lampu, keramaian) melaju lebih cepat, cuaca bisa dipaksa. null =
   * kembali ke tampilan biasa: jam kembali ke jam terminal sebenarnya.
   */
  aturSinema(o: OpsiSinema | null): void {
    this.sinema = o;
    if (!o) this.geserWaktu = 0;
    this.adegan.aturSinema(o !== null);
  }

  /** Jam tampilan adegan (0–24; dalam mode sinema bisa mendahului jam terminal). */
  get jamTampil(): number {
    return this.jam;
  }

  /** Foto adegan saat ini (tanpa label & tombol), untuk dibagikan pemain. */
  ambilFoto(): HTMLCanvasElement {
    return this.adegan.foto();
  }

  /** Putar kamera (radian; positif = isi layar searah jarum jam), beranimasi. */
  putarKamera(sudut: number): void {
    this.adegan.putar(sudut);
  }

  /** Kembalikan kamera ke arah & kemiringan awal. */
  kembalikanKamera(): void {
    this.adegan.kembalikanArah();
  }

  /** Arah utara di layar (radian searah jarum jam dari atas), untuk kompas. */
  get arahUtara(): number {
    return this.adegan.arahUtaraLayar();
  }

  ukur(lebar: number, tinggi: number): void {
    this.adegan.ukur(lebar, tinggi);
    // Layar diputar (portrait ↔ landscape): bingkai ulang supaya terminal tetap termuat utuh.
    const lanskap = lebar > tinggi;
    if (lanskap !== this.lanskap) {
      this.lanskap = lanskap;
      this.adegan.bingkai(lanskap ? TITIK_INTI : TITIK_INTI_POTRET);
    }
  }

  /**
   * @param dtDetik waktu nyata sejak frame lalu
   * @param kecepatan pengali waktu main (1×, 2×, 3×): bus, orang, lalu lintas,
   *   dan cuaca ikut dipercepat; animasi kilau (hujan, kedip lampu, bendera),
   *   kamera, dan jeda pengumuman tetap waktu nyata. Mode sinema memakai
   *   kecepatan dunia & jam tampilannya sendiri.
   */
  perbarui(dtDetik: number, kecepatan = 1): void {
    const dtNyata = Math.min(dtDetik, 0.1);
    const s = this.sinema;
    const dt = dtNyata * Math.max(0, s && s.kecepatanDunia > 0 ? s.kecepatanDunia : kecepatan);
    if (s) this.geserWaktu += dtNyata * Math.max(0, s.detikPerDetik - kecepatan);
    this.waktu += dtNyata;
    const state = this.pembaca.state;
    // Siang–malam, ritme keramaian, dan cuaca mengikuti jam terminal (dari waktu main di state),
    // atau jam tampilan yang lebih cepat di mode sinema. Uang ("+Rp") tetap mengikuti jam main.
    const detikMain = state.statistik.waktuMainDetik;
    const detikTampil = detikMain + this.geserWaktu;
    const w = waktuTerminal(detikTampil);
    const cuaca = cuacaTampil(cuacaTerminal(detikTampil, state.benihCuaca), s?.cuaca ?? 'jadwal');
    this.hujan = cuaca.hujan;
    this.detikHalus = Math.min(detikTampil + 0.1, Math.max(detikTampil, this.detikHalus + dt));
    this.kilat = kilatPada(this.detikHalus, state.benihCuaca);
    const langit = suasanaLangit(w.jamDesimal);
    const suasana = terapkanCuaca(langit, cuaca.mendung, this.kilat);
    const targetBasah = Math.min(1, cuaca.hujan * 1.5);
    this.basah = targetBasah > this.basah ? this.basah + (targetBasah - this.basah) * Math.min(1, dt / TAU_BASAH) : Math.max(targetBasah, this.basah - dt / DETIK_KERING);
    const eventAktif = state.event.aktif;
    this.keramaian = eventAktif ? Math.max(keramaianTerminal(w), RAMAI_EVENT[eventAktif.id]) : keramaianTerminal(w);
    this.adegan.aturSuasana(suasana);
    this.material.aturMalam(suasana.malam);
    const bangunan = bangunanTerminal(state);
    this.jendela = bangunan.jendela;
    this.papanJurusan.perbarui({ mask: bangunan.mask, jendela: this.pemilikJendela(state), kelompok: bangunan.kelompok });
    this.pembangunan.perbarui({ jalur: state.terminal.jalur, mask: bangunan.mask, kelompok: bangunan.kelompok });
    this.parkirBaris2.visible = state.perkembangan.perluasan >= TAHAP_PARKIR_MOBIL_PENUH;
    this.perbaruiProyek(state, dt, dtNyata);
    this.modernisasi.perbarui(state.terminal.teknologi);
    this.hiasanKelas.perbarui(kelasTerminal(state), state.profil.namaTerminal);
    this.hiasanEvent.perbarui(state.event.aktif?.id ?? null);
    this.jam = w.jamDesimal;
    this.detikPatroli += dt;
    this.rollingDoor.perbarui(this.jam, this.jendela, state.terminal.fasilitas.kios > 0, state.terminal.jalur);
    this.luar.perbarui(this.jam, this.keramaian);
    this.material.aturBasah(this.basah);
    this.laluLintas.kepadatan = kepadatanLuar(this.keramaian);
    // Saat hujan pejalan kaki di trotoar berkurang.
    this.trotoar.kepadatan = kepadatanLuar(this.keramaian) * (1 - 0.5 * this.hujan);
    // Simulasi bergerak dalam langkah kecil supaya tetap stabil saat dipercepat;
    // kejadian bus (untuk suara) dari semua langkah dikumpulkan.
    const laju = {
      ...lajuBerirama(state, this.keramaian),
      loketBuka: loketBuka(this.jam, this.jendela),
      jam: this.jam,
      busEmas: busEmasAktif(state) && this.tampilkanBusEmas(),
    };
    const langkah = Math.max(1, Math.ceil(dt / LANGKAH_SIM));
    this.peristiwa.length = 0;
    this.transaksi.length = 0;
    for (let i = 0; i < langkah; i++) {
      this.dunia.perbarui(dt / langkah, laju);
      this.peristiwa.push(...this.dunia.peristiwa);
      this.transaksi.push(...this.dunia.transaksi);
      this.laluLintas.perbarui(dt / langkah);
      this.trotoar.perbarui(dt / langkah);
    }
    this.rombongan.perbarui(this.dunia.orang, dt, this.dunia.bus);
    // Papan jadwal: jadwal tiap bus tetap sejak diparkir; status mengikuti keadaannya.
    const jamMutlak = w.hariKe * 24 + w.jamDesimal;
    this.papanJadwal.perbarui(this.jadwal.perbarui(this.dunia.bus, jamMutlak), formatJamJadwal(jamMutlak));
    // Lampu kendaraan menyala saat hujan walau siang; bus terminal baru memakai livery & kelas bus PO pemiliknya.
    this.armada.aturPo(laju.po ?? []);
    this.armada.aturKelasBus(kelasBusBeroperasi(state), laju.bagianKelas);
    this.armada.perbarui(this.dunia.bus, dt, this.waktu, Math.max(suasana.malam, 0.8 * this.hujan));
    // Genangan cahaya lampu jalan hanya terlihat saat benar-benar gelap (bukan siang mendung).
    this.cahaya.perbarui(Math.max(langit.malam, 0.3 * suasana.malam), this.dunia.bus);
    this.cuci.perbarui(this.dunia.bus, dt, this.waktu);
    this.laluLintas3D.perbarui(this.laluLintas);
    this.anakTelolet.perbarui(dtNyata);
    this.spanduk.perbarui(anakTeloletHadir(this.jam, this.hujan));
    this.sinkronOrang(dt);
    const pandang = this.adegan.titikPandang();
    const pikselPerUnit = this.adegan.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.adegan.kamera.fov / 2)));
    this.hujan3d.perbarui(this.hujan, this.basah, this.waktu, pandang.x, pandang.y, 1 - suasana.malam, pikselPerUnit);
    this.zona.perbarui(state, this.waktu, this.adegan, this.adegan.lebarCss, this.adegan.tinggiCss);
    this.labelBus.perbarui(this.dunia.bus, dtNyata, this.adegan, this.adegan.lebarCss, this.adegan.tinggiCss, pandang.jarak);
    this.labelBus.perbaruiLoket(this.dunia.orang, dtNyata, this.adegan, this.adegan.lebarCss, this.adegan.tinggiCss, pandang.jarak);
    // "+Rp": uang yang masuk menurut sim dibagikan ke transaksi yang terlihat frame ini.
    const pop = this.kas.perbarui(detikMain, dt, this.lajuUangTersimpan(state), this.transaksi, state.sewaKios, TEMPAT_SEWA);
    if (pop.length > 0) this.popUang.tambah(pop);
    this.popUang.perbarui(dtNyata, this.adegan, this.adegan.lebarCss, this.adegan.tinggiCss, pandang.jarak);
    kibarkan(this.bendera, this.waktu);
    this.adegan.render(dtDetik);
    if (this.suara) this.kirimSuara(this.suara, dtNyata, suasana.malam);
    this.teloletTertunda.length = 0;
  }

  /**
   * Pemain mengetuk adegan di (x, y) piksel CSS: bus yang diketuk membunyikan
   * klakson telolet, dan anak-anak di pinggir jalan kegirangan.
   * @returns true bila ketukan mengenai bus.
   */
  ketuk(x: number, y: number): boolean {
    const b = busDiKetuk(this.dunia.bus, this.adegan, x, y);
    if (!b) return false;
    if (this.waktu - (this.teloletTerakhir.get(b.id) ?? Number.NEGATIVE_INFINITY) < JEDA_TELOLET_BUS) return true;
    this.teloletTerakhir.set(b.id, this.waktu);
    this.teloletTertunda.push({ x: b.x, y: b.y, melodi: melodiTelolet(b.id) });
    this.anakTelolet.dengar(b.x, b.y);
    const id = b.id;
    this.popUang.tambahTelolet(b.x, b.y, TEKS.telolet, () => {
      const c = this.dunia.bus.find((q) => q.id === id);
      return c ? [c.x, c.y] : null;
    });
    this.saatTelolet();
    return true;
  }

  /** Ketukan singkat di kanvas (bukan geser, zoom, atau putar kamera) diteruskan ke ketuk(). */
  private pasangKetuk(kanvas: HTMLElement): void {
    let awal: { readonly id: number; readonly x: number; readonly y: number; readonly t: number } | null = null;
    let jari = 0;
    kanvas.addEventListener('pointerdown', (e) => {
      if (e.isPrimary) jari = 0;
      jari++;
      awal = jari === 1 && e.button === 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() } : null;
    });
    const angkat = (e: PointerEvent, batal: boolean): void => {
      jari = Math.max(0, jari - 1);
      const a = awal;
      if (!a || a.id !== e.pointerId) return;
      awal = null;
      if (batal || Math.hypot(e.clientX - a.x, e.clientY - a.y) > KETUK.geserPx || performance.now() - a.t > KETUK.lamaMs) return;
      const kotak = kanvas.getBoundingClientRect();
      this.ketuk(e.clientX - kotak.left, e.clientY - kotak.top);
    };
    kanvas.addEventListener('pointerup', (e) => angkat(e, false));
    kanvas.addEventListener('pointercancel', (e) => angkat(e, true));
  }

  /** Pemilik tiap jendela loket (lihat jendelaPo), dihitung ulang hanya bila daftar PO atau banyaknya jendela berubah. */
  private pemilikJendela(state: GameState): readonly (PoId | null)[] {
    const terdaftar = state.mitra.terdaftar;
    const p = this.pemilik;
    if (p && p.terdaftar === terdaftar && p.jendela === this.jendela) return p.po;
    const po = jendelaPo(this.jendela, terdaftar);
    this.pemilik = { terdaftar, jendela: this.jendela, po };
    return po;
  }

  /** Proyek perluasan tahap berikutnya selama dibangun; kembang api saat tahap baru selesai. */
  private perbaruiProyek(state: GameState, dt: number, dtNyata: number): void {
    const perluasan = state.perkembangan.perluasan;
    if (perluasan > this.perluasanLalu) this.proyek.rayakan(perluasan);
    this.perluasanLalu = perluasan;
    this.proyek.perbarui(tahapProyek(state), dt, dtNyata);
  }

  /** Pendapatan per detik tiap sumber, dihitung ulang hanya saat state berganti. */
  private lajuUangTersimpan(state: GameState): LajuUang {
    if (this.lajuUang?.state !== state) this.lajuUang = { state, laju: lajuUangState(state) };
    return this.lajuUang.laju;
  }

  private kirimSuara(suara: PenerimaSuara, dt: number, malam: number): void {
    const a = this.adegan;
    const pendengar: Pendengar = {
      ...a.titikPandang(),
      pan: (x, y) => Math.max(-1, Math.min(1, (a.proyeksi(x, y, 0).x / Math.max(1, a.lebarCss)) * 2 - 1)),
    };
    const { lapisan, bunyi } = this.pengamatSuara.amati(
      dt,
      {
        orang: [this.dunia.orang, this.trotoar.orang],
        bus: this.dunia.bus,
        peristiwa: this.peristiwa,
        kendaraan: this.laluLintas.kendaraan,
        keramaian: this.keramaian,
        malam,
        hujan: this.hujan,
        kilat: this.kilat,
      },
      pendengar,
    );
    const telolet = this.teloletTertunda.map((t) => bunyiTelolet(pendengar, t.x, t.y, t.melodi));
    suara.perbarui(lapisan, telolet.length > 0 ? [...bunyi, ...telolet] : bunyi);
  }

  private sinkronOrang(dt: number): void {
    const k = this.kerumunan;
    k.mulai();
    for (const o of this.dunia.orang) {
      // Lantai peron / ruang tunggu / aula loket / bordes, atau trotoar jalan belakang
      // berkerb (penumpang pulang & calon penumpang dari luar), atau paving kompleks.
      const h = Math.max(tinggiLantai(o.x, o.y) ?? 0, o.y > Y_TROTOAR_BELAKANG - 0.2 ? H_TROTOAR : H_LANTAI);
      const penampilan = this.penampilan[o.varian % JUMLAH_PENAMPILAN]!;
      if (o.gaya === 'bilik') continue; // di dalam bilik toilet
      if (o.fase === 'tungguBerangkat') k.tambah({ id: o.id, x: o.x, y: o.y, h, penampilan, pose: 'duduk', hadap: HADAP_GERBANG }, dt);
      // Sholat menghadap kiblat (barat); duduk (sujud/tasyahud) di lantai, bukan setinggi bangku.
      else if (o.gaya === 'sholatBerdiri') k.tambah({ id: o.id, x: o.x, y: o.y, h, penampilan, hadap: HADAP_KIBLAT }, dt);
      else if (o.gaya === 'sholatDuduk') k.tambah({ id: o.id, x: o.x, y: o.y, h: h - 0.075 * penampilan.skala, penampilan, pose: 'duduk', hadap: HADAP_KIBLAT }, dt);
      else k.tambah({ id: o.id, x: o.x, y: o.y, h, penampilan, payung: this.payung(o.id, o.x, o.y) }, dt);
    }
    // Anak & pendamping: berjalan di sisi pemimpinnya, duduk di kursi sebelahnya saat menunggu.
    for (const f of this.rombongan.pengikut) {
      const h = Math.max(tinggiLantai(f.x, f.y) ?? 0, f.y > Y_TROTOAR_BELAKANG - 0.2 ? H_TROTOAR : H_LANTAI);
      const anak = f.peran === 'anak';
      const penampilan = anak ? this.penampilanAnak[(f.idPemimpin * 3 + f.urutan) % JUMLAH_PENAMPILAN_ANAK]! : this.penampilan[(f.idPemimpin * 7 + 13 * (f.urutan + 1)) % JUMLAH_PENAMPILAN]!;
      if (f.duduk) k.tambah({ id: f.id, x: f.x, y: f.y, h, penampilan, pose: 'duduk', hadap: HADAP_GERBANG }, dt);
      // Pengantar melambaikan tangan ke bus dari balik gerbang.
      else if (f.lambai) k.tambah({ id: f.id, x: f.x, y: f.y, h, penampilan, hadap: HADAP_GERBANG, lambai: Math.sin(this.waktu * 7 + f.id) }, dt);
      // Anak berlindung di bawah payung orang tuanya.
      else k.tambah({ id: f.id, x: f.x, y: f.y, h, penampilan, payung: anak ? null : this.payung(f.id, f.x, f.y) }, dt);
    }
    for (const p of this.trotoar.orang) {
      if (!p.aktif) continue;
      k.tambah({ id: ID_TROTOAR + p.id, x: p.x, y: p.y, h: H_TROTOAR, penampilan: this.penampilan[p.varian % JUMLAH_PENAMPILAN]!, payung: this.payung(ID_TROTOAR + p.id, p.x, p.y) }, dt);
    }
    // Kenek & sopir turun dari bus yang parkir, mengelilinginya sambil menyabun & membilas.
    // Di halte, kenek berjaga di samping bagasi yang terbuka (menghadap bus).
    for (const b of this.dunia.bus) {
      const bagasi = posisiKenekBagasi(b);
      if (bagasi) {
        k.tambah({ id: ID_PETUGAS_CUCI + b.id * 2, x: bagasi[0], y: bagasi[1], h: H_ASPAL, penampilan: this.penampilanKenek[(b.id * 7) % JUMLAH_PENAMPILAN]!, hadap: b.sudut - Math.PI / 2, payung: this.payung(ID_PETUGAS_CUCI + b.id * 2, bagasi[0], bagasi[1]) }, dt);
      }
      for (const { peran, titik } of posisiPetugasCuci(b)) {
        const sopir = peran === 'sopir';
        const penampilan = sopir ? SERAGAM_SOPIR : this.penampilanKenek[(b.id * 7) % JUMLAH_PENAMPILAN]!;
        k.tambah({ id: ID_PETUGAS_CUCI + b.id * 2 + (sopir ? 1 : 0), x: titik[0], y: titik[1], h: H_ASPAL, penampilan }, dt);
      }
    }
    // Pengunjung di luar berteduh saat hujan; petugas di luar tetap berjaga dengan payung.
    const berteduh = this.hujan > HUJAN_PAYUNG;
    const state = this.pembaca.state;
    const patroli = dalamRentang(this.jam, JAM_PATROLI);
    for (const s of this.statis) {
      if (this.keramaian < s.ambang || !hadir(s, state, this.jam, this.jendela)) continue;
      // Malam: satpam luar berkeliling plaza (siang berjaga di posnya).
      const orang = s.orang.id === ID_STATIS && patroli ? this.satpamBerpatroli(s.orang) : s.orang;
      if (berteduh && diLuar(orang)) {
        if (s.ambang > 0) continue;
        k.tambah({ ...orang, payung: WARNA_PAYUNG[0]! }, dt);
      } else {
        k.tambah(orang, dt);
      }
    }
    this.pekerjaProyek(k, dt);
    this.orangBergilir(k, dt);
    if (anakTeloletHadir(this.jam, this.hujan)) this.anakPinggirJalan(k, dt);
    k.selesai();
  }

  /** Pekerja proyek perluasan mondar-mandir di lokasi proyek, siang & malam (kontraktor terus bekerja). */
  private pekerjaProyek(k: Kerumunan3D, dt: number): void {
    const lokasi = this.proyek.lokasi;
    if (!lokasi) return;
    lokasi.pekerja.forEach((rute, i) => {
      const [x, y] = posisiPekerja(rute, i, this.detikPatroli);
      k.tambah({ id: ID_PEKERJA_PROYEK + i, x, y, h: tinggiLantai(x, y) ?? H_LANTAI, penampilan: SERAGAM_PEKERJA }, dt);
    });
  }

  private satpamBerpatroli(pos: DataOrang): DataOrang {
    const p = posisiPatroli(PATROLI_SATPAM, this.detikPatroli);
    const diPos = Math.hypot(p.x - pos.x, p.y - pos.y) < 1e-6;
    // Saat berjalan arah hadap mengikuti langkah; di pos kembali menghadap plaza.
    const { hadap: _, ...tanpaHadap } = pos;
    return diPos ? pos : { ...tanpaHadap, x: p.x, y: p.y };
  }

  /** Orang yang hanya ada pada jam tertentu: petugas kebersihan menyapu (malam), pedagang asongan (siang). */
  private orangBergilir(k: Kerumunan3D, dt: number): void {
    if (dalamRentang(this.jam, JAM_KEBERSIHAN)) {
      const ayun = Math.sin(this.detikPatroli * 4.5);
      const aula = posisiPatroli(SAPU_AULA, this.detikPatroli);
      const tunggu = posisiPatroli(SAPU_TUNGGU, this.detikPatroli + 40);
      k.tambah({ id: ID_KEBERSIHAN, x: aula.x, y: aula.y, h: TINGGI_LANTAI_GEDUNG, penampilan: SERAGAM_KEBERSIHAN, sapu: ayun }, dt);
      k.tambah({ id: ID_KEBERSIHAN + 1, x: tunggu.x, y: tunggu.y, h: TINGGI_PERON, penampilan: SERAGAM_KEBERSIHAN, sapu: -ayun }, dt);
    }
    if (dalamRentang(this.jam, JAM_ASONGAN)) {
      ASONGAN.forEach((rute, i) => {
        const p = posisiPatroli(rute, this.detikPatroli + i * 17);
        const orang: DataOrang = { id: ID_ASONGAN + i, x: p.x, y: p.y, h: H_LANTAI, penampilan: PENAMPILAN_ASONGAN[i % PENAMPILAN_ASONGAN.length]!, baki: DAGANGAN_ASONGAN[i % DAGANGAN_ASONGAN.length]! };
        // Saat hujan pedagang tetap berjualan berpayung.
        k.tambah(this.hujan > HUJAN_PAYUNG ? { ...orang, payung: WARNA_PAYUNG[(i + 3) % WARNA_PAYUNG.length]! } : orang, dt);
      });
    }
  }

  /** Anak-anak "Om Telolet Om" di trotoar seberang jalan raya: menyapa bus yang lewat, melompat saat telolet. */
  private anakPinggirJalan(k: Kerumunan3D, dt: number): void {
    ANAK_TELOLET.forEach((a, i) => {
      const g = this.anakTelolet.gerak(i, this.dunia.bus);
      const orang: DataOrang = { id: ID_ANAK_TELOLET + i, x: a.x, y: a.y, h: H_TROTOAR + g.loncat, penampilan: this.penampilanAnak[(i * 7 + 5) % JUMLAH_PENAMPILAN_ANAK]!, hadap: HADAP_JALAN };
      k.tambah(g.lambai === null ? orang : { ...orang, lambai: g.lambai }, dt);
    });
  }

  /** Payung orang ini sekarang: saat hujan, di luar atap, dan ia termasuk yang membawa payung. */
  private payung(id: number, x: number, y: number): THREE.Color | null {
    if (this.hujan < HUJAN_PAYUNG || pecahanId(id) >= PORSI_BERPAYUNG || diBawahAtap(x, y)) return null;
    return WARNA_PAYUNG[id % WARNA_PAYUNG.length]!;
  }
}
