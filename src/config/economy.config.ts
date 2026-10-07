import type { EventId, FasilitasId, KelasBusId, PoId, TeknologiId } from '../sim/fitur';
import type { TahapId } from '../sim/tahap';

/**
 * SEMUA angka tuning game ada di file ini. Jangan hardcode angka ekonomi
 * atau timing simulasi di tempat lain.
 *
 * Nilai tahap & global disalin dari spreadsheet model. Yang ditandai
 * PLACEHOLDER belum berasal dari spreadsheet dan boleh diubah bebas.
 */

export interface KonfigTahap {
  /** Biaya upgrade dari level 1 ke 2. */
  readonly biayaAwal: number;
  /** Rasio pertumbuhan biaya per level: biaya(L) = biayaAwal × r^(L − 1). */
  readonly r: number;
  /** Kapasitas di level 1, dalam penumpang/detik. */
  readonly kapAwal: number;
  /** Tambahan kapasitas (pnp/dtk) per level, sebelum pengali milestone. */
  readonly tambahKap: number;
  /** Biaya rekrut Kepala tahap ini. PLACEHOLDER. */
  readonly biayaKepala: number;
}

/**
 * Fasilitas penunjang. Level 0 = belum dibangun. Arti `nilaiPerLevel` per fasilitas:
 * - kios: belanja per penumpang (Rp), dikumpulkan sepanjang hari lalu dibayar sebagai sewa harian;
 * - parkir: uang parkir kendaraan pengantar & penjemput per penumpang (Rp), masuk terus-menerus;
 * - toilet: tidak menghasilkan uang; tambahan belanja di kios (0.1 = +10%);
 * - retribusi: pungutan per bus yang parkir (Rp; bus = penumpangPerBus penumpang).
 */
export interface KonfigFasilitas {
  /** Biaya membangun (level 0 → 1); biaya level L → L+1 = biayaAwal × r^L. */
  readonly biayaAwal: number;
  readonly r: number;
  /** Efek per level (lihat di atas). */
  readonly nilaiPerLevel: number;
}

/** Jurusan (kota tujuan), dibuka berurutan. */
export interface KonfigJurusan {
  readonly nama: string;
  /** Biaya membuka (0 untuk jurusan awal). */
  readonly biaya: number;
  /** Tambahan harga tiket rata-rata (0.1 = +10% nilai per penumpang). */
  readonly bonusTiket: number;
  /** Rute antarpulau: penyeberangan feri yang dilalui (mis. 'Merak–Bakauheni'). */
  readonly feri?: string;
  /** Kelas terminal minimal untuk membuka (0 = Tipe C, 1 = Tipe B, 2 = Tipe A, 3 = Terpadu). */
  readonly kelasTerminal?: number;
  /** Bagian kursi (& penumpang) jurusan ini dibanding jurusan lain yang terbuka: kota besar lebih banyak. */
  readonly peminat: number;
  /** Kepekaan peminat terhadap harga tiket (lihat EKONOMI.harga): rute pendek punya banyak pilihan lain. */
  readonly elastisitas: number;
}

/** Modernisasi: pembelian sekali yang menambah kapasitas satu tahap. */
export interface KonfigTeknologi {
  readonly tahap: TahapId;
  readonly biaya: number;
  /** Pengali kapasitas tahap (1.2 = +20%). */
  readonly multKapasitas: number;
  /** Teknologi yang harus dimiliki lebih dulu. */
  readonly syarat: TeknologiId | null;
}

/** Kelas bus: didatangkan berurutan (kelas sebelumnya harus sudah beroperasi). */
export interface KonfigKelasBus {
  /** Biaya mendatangkan armada kelas ini (0 = beroperasi sejak awal). */
  readonly biaya: number;
  /** Tambahan harga tiket rata-rata (0.1 = +10%), dikalikan dengan bonus jurusan & mitra PO. */
  readonly bonusTiket: number;
  /** Kelas terminal minimal (0 = Tipe C, 1 = Tipe B, 2 = Tipe A): terminal kecil belum melayani bus besar. */
  readonly kelasTerminal: number;
  /** Bagian kursi (& penumpang) kelas ini dibanding kelas lain yang beroperasi. */
  readonly peminat: number;
  /** Kepekaan peminat terhadap harga tiket (lihat EKONOMI.harga): penumpang ekonomi paling peka. */
  readonly elastisitas: number;
}

/**
 * Cara mitra PO bergabung: otomatis saat jurusan ke-`ke` (indeks `jurusan`)
 * dibuka, lewat kontrak (dibayar sekali dengan uang), atau sebagai hadiah naik kelas.
 */
export type SyaratPo =
  | { readonly jenis: 'jurusan'; readonly ke: number }
  /** `kepuasanMin`: PO besar hanya mau bergabung dengan terminal yang penumpangnya cukup puas (0–1). */
  | { readonly jenis: 'kontrak'; readonly biaya: number; readonly kepuasanMin?: number }
  /** Hadiah naik kelas: bergabung saat terminal mencapai kelas ini (1 = Tipe B). */
  | { readonly jenis: 'kelas'; readonly kelas: number }
  /** Hadiah tahap terakhir event musiman (eksklusif). */
  | { readonly jenis: 'event'; readonly event: EventId };

/** Event musiman (tanggal di sim/event.ts). */
export interface KonfigEvent {
  /** Pengali semua pendapatan selama event (musim ramai, tarif naik). */
  readonly pengaliPendapatan: number;
  /**
   * Target tiap tahap: berangkatkan penumpang sebanyak arus potensial saat
   * edisi dimulai × sekian detik (dibulatkan).
   */
  readonly targetDetik: readonly number[];
  /** Hadiah uang tiap tahap = sekian menit pendapatan saat diklaim. */
  readonly hadiahMenit: readonly number[];
  /** Mitra PO eksklusif hadiah tahap terakhir. */
  readonly po: PoId;
}

export interface KonfigEkonomi {
  readonly tahap: Readonly<Record<TahapId, KonfigTahap>>;

  readonly fasilitas: Readonly<Record<FasilitasId, KonfigFasilitas>>;
  /** Jurusan dalam urutan dibuka; `jurusanAwal` pertama langsung terbuka di game baru. */
  readonly jurusan: readonly KonfigJurusan[];
  readonly jurusanAwal: number;
  /** Mitra PO: bonus harga tiket per PO yang bergabung (permanen) dan cara tiap PO bergabung. */
  readonly po: {
    /** Tambahan harga tiket per PO (0.03 = +3%), dikalikan dengan bonus jurusan. */
    readonly bonusTiket: number;
    readonly syarat: Readonly<Record<PoId, SyaratPo>>;
  };
  readonly teknologi: Readonly<Record<TeknologiId, KonfigTeknologi>>;
  /**
   * Jalur bus: pasangan halte kedatangan & jalur keberangkatan di adegan. Game
   * baru mulai dengan satu jalur; jalur berikutnya dibangun berurutan (biaya[i]
   * = biaya jalur ke-(i + 2)). Tiap jalur tambahan menaikkan kapasitas Peron &
   * Keberangkatan sebesar bonusKapasitas. Diulang dari awal saat naik kelas.
   */
  readonly jalur: { readonly biaya: readonly number[]; readonly bonusKapasitas: number };
  /**
   * Kepuasan penumpang (sim/kepuasan.ts): bobot tiap komponen, dan bonus semua
   * pendapatan yang mulai di kepuasan `bonusMulai` lalu naik linear sampai
   * `bonusPendapatan` di 100 % (terminal tanpa fasilitas paling puas 70 %, jadi
   * ekonomi dasar tetap sama dengan spreadsheet). Kelancaran penuh bila tahap paling lambat
   * ≥ rasioLancar × tahap tercepat (nol di rasioNol); level Kios + Toilet yang
   * dibutuhkan = fasilitasDasar + fasilitasPerLog2 × log2(1 + arus); jalur yang
   * dibutuhkan = 1 + ⌊jalurPerLog10 × log10(1 + arus)⌋.
   */
  readonly kepuasan: {
    readonly bobot: { readonly kelancaran: number; readonly fasilitas: number; readonly jalur: number };
    readonly bonusPendapatan: number;
    readonly bonusMulai: number;
    readonly rasioLancar: number;
    readonly rasioNol: number;
    readonly fasilitasDasar: number;
    readonly fasilitasPerLog2: number;
    readonly jalurPerLog10: number;
  };
  /**
   * Permintaan penumpang (permintaanPenumpang di sim/state.ts): calon penumpang
   * yang datang dibanding kapasitas terminal = daya tarik × ritme jam. Daya tarik
   * = dasar + perKepuasan × kepuasan (makin puas, makin banyak yang datang). Ritme
   * = ritmeMin + (1 − ritmeMin) × keramaian jam & hari (RITME di
   * config/waktu.config.ts): malam berangsur sepi tapi tidak pernah berhenti.
   * Arus nyata = kapasitas × min(1, permintaan).
   */
  readonly permintaan: { readonly dasar: number; readonly perKepuasan: number; readonly ritmeMin: number };
  /**
   * Harga tiket yang diatur pemain, disimpan dalam persen harga normal (pemain
   * melihat Rupiah): tiket = harga jurusan (min … maks) + tambahan kelas bus
   * (0 … tambahanMaks), kelipatan langkah. Tiap pasangan jurusan × kelas punya
   * jatah kursi tetap (sebanding peminat keduanya). Calon penumpangnya ×
   * hj^(−elastisitas jurusan) × (tiket ÷ hj)^(−elastisitas kelas), hj = harga
   * jurusan ÷ normal. Kursi yang kosong tidak diisi penumpang segmen lain, jadi
   * tiap segmen punya harga terbaiknya sendiri. Tiket di atas ambangMahal (persen
   * harga normal) membuat penumpang kecewa: kepuasan × (1 − penaltiMahal ×
   * kelebihan rata-rata), paling banyak penaltiMaks.
   */
  readonly harga: {
    readonly min: number;
    readonly maks: number;
    readonly langkah: number;
    readonly tambahanMaks: number;
    readonly ambangMahal: number;
    readonly penaltiMahal: number;
    readonly penaltiMaks: number;
  };
  readonly kelasBus: Readonly<Record<KelasBusId, KonfigKelasBus>>;
  readonly event: Readonly<Record<EventId, KonfigEvent>>;
  /**
   * Tantangan mingguan (sim/tantangan.ts): target ditetapkan saat minggu dimulai
   * dari keadaan terminal saat itu (penumpang = arus × penumpangDetik, pendapatan
   * = pendapatan/dtk × pendapatanDetik, kepuasan = detik main dengan kepuasan ≥
   * kepuasanMin); hadiah tiap tantangan = sekian menit pendapatan.
   */
  readonly tantangan: {
    readonly penumpangDetik: number;
    readonly pendapatanDetik: number;
    readonly upgrade: number;
    readonly fasilitas: number;
    readonly kepuasanMin: number;
    readonly kepuasanDetik: number;
    readonly hadiahMenit: number;
  };
  readonly harian: {
    /** Hadiah target harian = sekian menit pendapatan saat diklaim. */
    readonly hadiahMenit: number;
    /** Target "lakukan N upgrade hari ini". */
    readonly targetUpgrade: number;
    /** Target "berangkatkan N penumpang" = arus potensial × lama sehari × fraksi ini. */
    readonly fraksiPenumpang: number;
  };
  /** Hadiah tiap pencapaian = sekian menit pendapatan saat diklaim. */
  readonly hadiahMenitPencapaian: number;
  /**
   * Hadiah dari iklan berhadiah (pemain memilih menonton iklan): boost
   * pendapatan, Bus Emas, dan hadiah 2× (lihat bagian Hadiah di sim/state.ts).
   */
  readonly hadiah: {
    /** Pengali pendapatan selama boost. */
    readonly pengaliBoost: number;
    /** Boost yang ditambahkan tiap iklan (detik main; juga berlaku untuk penghasilan offline). */
    readonly boostPerIklanDetik: number;
    /** Boost paling lama yang bisa ditumpuk (detik main). */
    readonly boostMaksDetik: number;
    /** Hadiah Bus Emas = sekian menit pendapatan saat ini. */
    readonly busEmasMenit: number;
    /** Jeda sebelum Bus Emas pertama & antar-kemunculan (detik main, diundi di rentang ini). */
    readonly busEmasSelangDetik: readonly [number, number];
    /** Lama Bus Emas bisa diketuk setelah muncul (detik main). */
    readonly busEmasAktifDetik: number;
  };

  /** Penumpang per bus, untuk retribusi per bus yang parkir. */
  readonly penumpangPerBus: number;

  /** Harga tiket per penumpang (sebelum bonus jurusan). */
  readonly nilaiPerPenumpang: number;
  /** Uang saat game baru dimulai. */
  readonly uangAwal: number;

  /** Pengali kapasitas setiap kali satu milestone level tercapai. */
  readonly multMilestone: number;
  /** Level-level milestone, urut naik. */
  readonly milestone: readonly number[];

  /** Batas maksimum waktu offline yang dihitung, dalam detik. */
  readonly batasOfflineDetik: number;
  /** Fraksi pendapatan yang didapat selama offline (0–1). */
  readonly efisiensiOffline: number;

  /** Total pendapatan satu run minimal untuk bisa prestige. */
  readonly ambangPrestige: number;
  /** Bonus pendapatan per poin prestige (0.1 = +10% per poin). */
  readonly bonusPrestige: number;
  /**
   * Naik kelas terminal (prestige): poin prestige minimal yang harus didapat
   * dari run ini untuk naik dari kelas ke-i (indeks = kelas sekarang: 0 = Tipe C
   * → Tipe B, 1 = B → A, 2 = A → Terpadu ★1). Sesudah daftar habis, tiap naik
   * kelas berikutnya butuh `tambahPoinMinimal` poin lebih banyak.
   */
  readonly kelas: { readonly poinMinimal: readonly number[]; readonly tambahPoinMinimal: number };
  /**
   * PLACEHOLDER (tidak ada di spreadsheet):
   * poin = floor((totalPendapatanRun / ambangPrestige) ^ eksponenPrestige).
   */
  readonly eksponenPrestige: number;
}

export interface KonfigSimulasi {
  /** Frekuensi fixed timestep simulasi. */
  readonly tickPerDetik: number;
  /**
   * Maksimum waktu yang dikejar dalam satu frame. Selisih waktu yang lebih
   * besar (tab tersembunyi, debugger) dibuang; itu urusan logika offline.
   */
  readonly maksKejarDetik: number;
  /** Interval autosave, dalam detik. */
  readonly intervalSimpanDetik: number;
  /**
   * Jarak minimum antar-unggahan cloud save (pemain login), dalam detik waktu
   * nyata. Lebih jarang dari autosave lokal supaya hemat kuota tulis cloud;
   * saat app ke background tetap langsung diunggah.
   */
  readonly intervalUnggahDetik: number;
  /**
   * Popup "Selama kamu pergi…" hanya muncul kalau pergi minimal selama ini.
   * Penghasilan offline tetap diberikan walau popup tidak muncul.
   */
  readonly minDetikPopupOffline: number;
}

export const EKONOMI: KonfigEkonomi = {
  tahap: {
    peron: { biayaAwal: 15, r: 1.08, kapAwal: 1.0, tambahKap: 0.5, biayaKepala: 50 },
    loket: { biayaAwal: 22, r: 1.085, kapAwal: 0.8, tambahKap: 0.45, biayaKepala: 150 },
    keberangkatan: { biayaAwal: 30, r: 1.09, kapAwal: 0.9, tambahKap: 0.5, biayaKepala: 400 },
  },

  // PLACEHOLDER (belum dari spreadsheet): fitur pengelolaan terminal.
  fasilitas: {
    kios: { biayaAwal: 80, r: 1.11, nilaiPerLevel: 0.2 },
    parkir: { biayaAwal: 200, r: 1.11, nilaiPerLevel: 0.15 },
    toilet: { biayaAwal: 50, r: 1.11, nilaiPerLevel: 0.1 },
    // Rp 5 per bus = Rp 0,25 per penumpang (penumpangPerBus 20), sama dengan sebelumnya.
    retribusi: { biayaAwal: 500, r: 1.12, nilaiPerLevel: 5 },
  },
  penumpangPerBus: 20,
  jurusan: [
    { nama: 'JAKARTA', biaya: 0, bonusTiket: 0, peminat: 3, elastisitas: 1.8 },
    { nama: 'BANDUNG', biaya: 0, bonusTiket: 0, peminat: 2, elastisitas: 1.8 },
    { nama: 'SEMARANG', biaya: 2_000, bonusTiket: 0.1, peminat: 1.5, elastisitas: 1.6 },
    { nama: 'YOGYAKARTA', biaya: 12_000, bonusTiket: 0.15, peminat: 1.5, elastisitas: 1.5 },
    { nama: 'SOLO', biaya: 70_000, bonusTiket: 0.2, peminat: 1.2, elastisitas: 1.5 },
    { nama: 'SURABAYA', biaya: 400_000, bonusTiket: 0.25, peminat: 1.5, elastisitas: 1.4 },
    { nama: 'MALANG', biaya: 2_500_000, bonusTiket: 0.35, peminat: 1, elastisitas: 1.4 },
    { nama: 'DENPASAR', biaya: 15_000_000, bonusTiket: 0.5, peminat: 1, elastisitas: 1.3 },
    // PLACEHOLDER: rute antarpulau setelah Denpasar (bus ikut menyeberang dengan kapal feri).
    { nama: 'LAMPUNG', biaya: 60_000_000, bonusTiket: 0.5, feri: 'Merak–Bakauheni', kelasTerminal: 1, peminat: 0.8, elastisitas: 1.25 },
    { nama: 'PALEMBANG', biaya: 250_000_000, bonusTiket: 0.55, feri: 'Merak–Bakauheni', kelasTerminal: 1, peminat: 0.8, elastisitas: 1.25 },
    { nama: 'MATARAM', biaya: 1_000_000_000, bonusTiket: 0.6, feri: 'Padangbai–Lembar', kelasTerminal: 2, peminat: 0.6, elastisitas: 1.2 },
    { nama: 'JAMBI', biaya: 4_000_000_000, bonusTiket: 0.65, feri: 'Merak–Bakauheni', kelasTerminal: 2, peminat: 0.5, elastisitas: 1.2 },
    { nama: 'PADANG', biaya: 15_000_000_000, bonusTiket: 0.7, feri: 'Merak–Bakauheni', kelasTerminal: 2, peminat: 0.6, elastisitas: 1.2 },
    { nama: 'BIMA', biaya: 60_000_000_000, bonusTiket: 0.8, feri: 'Kayangan–Pototano', kelasTerminal: 3, peminat: 0.4, elastisitas: 1.15 },
    { nama: 'MEDAN', biaya: 250_000_000_000, bonusTiket: 0.9, feri: 'Merak–Bakauheni', kelasTerminal: 3, peminat: 0.7, elastisitas: 1.15 },
    { nama: 'BANDA ACEH', biaya: 1_000_000_000_000, bonusTiket: 1, feri: 'Merak–Bakauheni', kelasTerminal: 3, peminat: 0.4, elastisitas: 1.15 },
  ],
  jurusanAwal: 2,
  // PLACEHOLDER: mitra PO. Sebelas bergabung bersama jurusannya (Semarang … Denpasar, lalu lima kota antarpulau), empat lewat kontrak.
  po: {
    bonusTiket: 0.03,
    syarat: {
      lumpiaKilat: { jenis: 'jurusan', ke: 2 },
      bakpiaRasa: { jenis: 'jurusan', ke: 3 },
      wayangLestari: { jenis: 'jurusan', ke: 4 },
      arekEkspres: { jenis: 'jurusan', ke: 5 },
      apelBatu: { jenis: 'jurusan', ke: 6 },
      kecakLaju: { jenis: 'jurusan', ke: 7 },
      sigerSakti: { jenis: 'jurusan', ke: 8 },
      rinjaniIndah: { jenis: 'jurusan', ke: 10 },
      rumahGadang: { jenis: 'jurusan', ke: 12 },
      danauToba: { jenis: 'jurusan', ke: 14 },
      kopiGayo: { jenis: 'jurusan', ke: 15 },
      ondelOndel: { jenis: 'kontrak', biaya: 5_000 },
      peuyeumKilat: { jenis: 'kontrak', biaya: 150_000, kepuasanMin: 0.5 },
      teloletJaya: { jenis: 'kontrak', biaya: 3_000_000, kepuasanMin: 0.65 },
      sultanGarasi: { jenis: 'kontrak', biaya: 80_000_000, kepuasanMin: 0.8 },
      juaraKelas: { jenis: 'kelas', kelas: 1 },
      juaraUmum: { jenis: 'kelas', kelas: 2 },
      mudikCeria: { jenis: 'event', event: 'mudikLebaran' },
      merahPutih: { jenis: 'event', event: 'hutRi' },
      kembangApi: { jenis: 'event', event: 'nataru' },
    },
  },
  teknologi: {
    rambuHalte: { tahap: 'peron', biaya: 3_000, multKapasitas: 1.15, syarat: null },
    pengaturBus: { tahap: 'peron', biaya: 150_000, multKapasitas: 1.25, syarat: 'rambuHalte' },
    mesinTiket: { tahap: 'loket', biaya: 1_500, multKapasitas: 1.2, syarat: null },
    eTiket: { tahap: 'loket', biaya: 80_000, multKapasitas: 1.3, syarat: 'mesinTiket' },
    jadwalDigital: { tahap: 'keberangkatan', biaya: 5_000, multKapasitas: 1.15, syarat: null },
    gateOtomatis: { tahap: 'keberangkatan', biaya: 400_000, multKapasitas: 1.25, syarat: 'jadwalDigital' },
  },
  // PLACEHOLDER: jalur bus. Jalur 2 = tujuan pertama pemain baru (akhir tutorial).
  jalur: { biaya: [300, 25_000, 1_500_000, 60_000_000], bonusKapasitas: 0.4 },
  // PLACEHOLDER: kepuasan. Jalur 2 dibutuhkan mulai arus ±5 pnp/dtk, jalur 5 mulai ±300.
  kepuasan: {
    bobot: { kelancaran: 0.4, fasilitas: 0.3, jalur: 0.3 },
    bonusPendapatan: 0.25,
    bonusMulai: 0.7,
    rasioLancar: 0.85,
    rasioNol: 0.25,
    fasilitasDasar: 1,
    fasilitasPerLog2: 1.5,
    jalurPerLog10: 1.6,
  },
  // PLACEHOLDER: permintaan. Jam sibuk penuh mulai kepuasan ±10 %, tengah hari mulai ±60 %; dini hari terisi ±55 % (kepuasan 30 %) … ±72 % (90 %).
  permintaan: { dasar: 1, perKepuasan: 0.6, ritmeMin: 0.4 },
  // PLACEHOLDER: harga tiket. Harga terbaik ±100–110 % untuk segmen peka harga (ekonomi, rute pendek), ±120–140 % untuk yang kurang peka (antarpulau, Sleeper, Double Decker); makin puas penumpang, makin tinggi.
  harga: { min: 50, maks: 200, langkah: 10, tambahanMaks: 100, ambangMahal: 125, penaltiMahal: 0.6, penaltiMaks: 0.6 },
  // PLACEHOLDER: kelas bus. Patas & Eksekutif sejak Tipe C, Sleeper di Tipe B, Double Decker di Tipe A.
  kelasBus: {
    ekonomi: { biaya: 0, bonusTiket: 0, kelasTerminal: 0, peminat: 4, elastisitas: 2 },
    patas: { biaya: 25_000, bonusTiket: 0.1, kelasTerminal: 0, peminat: 3, elastisitas: 1.6 },
    eksekutif: { biaya: 750_000, bonusTiket: 0.2, kelasTerminal: 0, peminat: 2, elastisitas: 1.35 },
    sleeper: { biaya: 6_000_000, bonusTiket: 0.3, kelasTerminal: 1, peminat: 1, elastisitas: 1.2 },
    tingkat: { biaya: 50_000_000, bonusTiket: 0.4, kelasTerminal: 2, peminat: 1, elastisitas: 1.15 },
  },
  // PLACEHOLDER: event musiman. Target tahap = arus × 20 menit, 1 jam, 3 jam main.
  event: {
    mudikLebaran: { pengaliPendapatan: 1.5, targetDetik: [1200, 3600, 10800], hadiahMenit: [5, 15, 30], po: 'mudikCeria' },
    hutRi: { pengaliPendapatan: 1.17, targetDetik: [1200, 3600, 10800], hadiahMenit: [5, 15, 30], po: 'merahPutih' },
    nataru: { pengaliPendapatan: 1.3, targetDetik: [1200, 3600, 10800], hadiahMenit: [5, 15, 30], po: 'kembangApi' },
  },
  // PLACEHOLDER: tantangan mingguan (±2–3 jam main aktif per minggu untuk ketiganya).
  tantangan: { penumpangDetik: 7200, pendapatanDetik: 10_800, upgrade: 40, fasilitas: 8, kepuasanMin: 0.75, kepuasanDetik: 3600, hadiahMenit: 15 },
  harian: { hadiahMenit: 2, targetUpgrade: 10, fraksiPenumpang: 0.5 },
  hadiahMenitPencapaian: 3,
  hadiah: {
    pengaliBoost: 2,
    boostPerIklanDetik: 30 * 60,
    boostMaksDetik: 4 * 60 * 60,
    busEmasMenit: 10,
    busEmasSelangDetik: [5 * 60, 10 * 60],
    busEmasAktifDetik: 60,
  },

  nilaiPerPenumpang: 5,
  uangAwal: 20,

  multMilestone: 2,
  milestone: [25, 50, 100, 200],

  batasOfflineDetik: 4 * 60 * 60,
  efisiensiOffline: 0.5,

  ambangPrestige: 100_000,
  bonusPrestige: 0.1,
  // PLACEHOLDER: poin minimal naik kelas (3 poin = pendapatan run ±Rp 900 rb).
  kelas: { poinMinimal: [3, 8, 15], tambahPoinMinimal: 10 },
  eksponenPrestige: 0.5,
};

export const SIMULASI: KonfigSimulasi = {
  tickPerDetik: 10,
  maksKejarDetik: 1,
  intervalSimpanDetik: 10,
  intervalUnggahDetik: 60,
  minDetikPopupOffline: 30,
};
