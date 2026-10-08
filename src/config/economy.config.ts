import type { BangunanId, EventId, FasilitasId, KelasBusId, PetugasId, PoId, TarifId, TeknologiId } from '../sim/fitur';
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

/** Jurusan (kota tujuan) yang bisa dilayani mitra PO (lihat KonfigMitraPo.jurusan); nilai tiketnya di KonfigMitra.nilaiJurusan. */
export interface KonfigJurusan {
  readonly nama: string;
  /** Rute antarpulau: penyeberangan feri yang dilalui (mis. 'Merak–Bakauheni'). */
  readonly feri?: string;
  /** Kelas terminal minimal untuk melayani rute ini (0 = Tipe C, 1 = Tipe B, 2 = Tipe A, 3 = Terpadu). */
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

/** Kelas bus: dioperasikan mitra PO menurut level & tingkatnya (nilai tiket & level PO di KonfigMitra.kelas). */
export interface KonfigKelasBus {
  /** Kelas terminal minimal (0 = Tipe C, 1 = Tipe B, 2 = Tipe A): terminal kecil belum melayani bus besar. */
  readonly kelasTerminal: number;
  /** Bagian kursi (& penumpang) kelas ini dibanding kelas lain yang beroperasi. */
  readonly peminat: number;
  /** Kepekaan peminat terhadap harga tiket (lihat EKONOMI.harga): penumpang ekonomi paling peka. */
  readonly elastisitas: number;
}

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

// ---------------------------------------------------------------------------
// Ekonomi v2: mitra PO (rancangan di documents/12-rancangan-ekonomi-po.md).
// Belum dipakai game; disusun berdampingan dengan v1 sampai UI dipindahkan.

/** Tingkat mitra PO v2. */
export type TingkatPo = 'lokal' | 'regional' | 'nasional' | 'premium';

export interface KonfigTingkatPo {
  /** Banyaknya kelas bus (urut KELAS_BUS_IDS) yang boleh dioperasikan PO tingkat ini. */
  readonly kelasMaks: number;
  readonly reputasiAwal: number;
  /** Loket yang langsung ditempati saat PO bergabung (loket kosong dulu, sisanya dibangun PO sendiri). */
  readonly loketBawaan: number;
}

export interface KonfigMitraPo {
  readonly tingkat: TingkatPo;
  /** Nama jurusan (EKONOMI.jurusan): ke-1 sejak Lv 1, berikutnya terbuka di level `mitra.levelJurusan`. */
  readonly jurusan: readonly string[];
  /** Kelas terminal minimal untuk didaftarkan (0 = Tipe C, 1 = Tipe B, 2 = Tipe A, 3 = Terpadu). */
  readonly kelasTerminal: number;
  /** Kepuasan minimal (0–1) agar PO mau bergabung & memperpanjang kontrak. */
  readonly kepuasanMin?: number;
  /**
   * Asal PO di luar pendaftaran biasa: PO awal game baru, hadiah naik kelas
   * terminal, atau hadiah tahap terakhir event musiman. Biasa = bisa didaftarkan
   * begitu syaratnya terpenuhi.
   */
  readonly sumber?: 'awal' | 'hadiahKelas' | 'hadiahEvent';
  /** Biaya daftar (0 = gratis). */
  readonly biayaDaftar: number;
}

/** Tahap perluasan terminal (bangunan permanen, tidak ikut Renovasi). */
export interface KonfigPerluasan {
  /** Level terminal minimal. */
  readonly level: number;
  readonly biaya: number;
  /** Tambahan jatah loket untuk semua PO setelah tahap ini selesai dibangun. */
  readonly jatah: number;
}

export interface KonfigMitra {
  readonly tingkat: Readonly<Record<TingkatPo, KonfigTingkatPo>>;
  readonly po: Readonly<Record<PoId, KonfigMitraPo>>;
  /**
   * Nilai tiket tiap jurusan (nama → pengali harga dasar nilaiPerPenumpang).
   * Menggantikan bonusTiket v1 yang menumpuk untuk semua penumpang: kini tiap
   * jurusan punya harganya sendiri, jurusan jauh lebih mahal.
   */
  readonly nilaiJurusan: Readonly<Record<string, number>>;
  /** Nilai tiket & level PO minimal tiap kelas bus. Peminat, elastisitas, kelas terminal tetap dari `kelasBus`. */
  readonly kelas: Readonly<Record<KelasBusId, { readonly nilai: number; readonly levelPo: number }>>;
  /** Level PO yang membuka jurusan ke-1, ke-2, ke-3. */
  readonly levelJurusan: readonly number[];
  /** XP kumulatif PO (satuan bus) untuk mencapai level L = xpA × (L − 1)^xpK. */
  readonly xpA: number;
  readonly xpK: number;
  /** XP satu loket baru di atas rekor PO = fraksi × XP yang dibutuhkan level sekarang. */
  readonly fraksiXpLoket: number;
  /** Jatah loket PO = jatahAwal + jatahPerLevel × (L − 1) + bonus perluasan. */
  readonly jatahAwal: number;
  readonly jatahPerLevel: number;
  /** Nilai tiket PO × rNilaiPerLevel^(L − 1): armada PO yang besar & bagus, tiketnya lebih mahal. */
  readonly rNilaiPerLevel: number;
  /**
   * Reputasi PO (0–100) bergerak menuju target = bobot.kepuasan × kepuasan +
   * bobot.harga × skor harga + bobot.armada × (kelas aktif ÷ 5), dengan konstanta
   * waktu `konstantaWaktuDetik` (detik main). Skor harga = jepit((hargaNol −
   * harga rata-rata %) ÷ rentangHarga, 0, 1). Minat penumpang × (faktorDasar +
   * faktorPerPoin × reputasi).
   */
  readonly reputasi: {
    readonly bobot: { readonly kepuasan: number; readonly harga: number; readonly armada: number };
    readonly hargaNol: number;
    readonly rentangHarga: number;
    readonly konstantaWaktuDetik: number;
    readonly faktorDasar: number;
    readonly faktorPerPoin: number;
  };
  /**
   * Persaingan di jurusan yang sama: minat × (daya tarik ÷ rata-rata pesaing)^gamma.
   * Kejenuhan: minat × 1 ÷ (1 + kejenuhan ÷ peminat jurusan × (jumlah PO − 1)).
   */
  readonly persaingan: { readonly gamma: number; readonly kejenuhan: number };
  readonly kontrak: {
    /** Lama kontrak & tambahan tiap perpanjangan (hari terminal). */
    readonly hari: number;
    /** Sisa kontrak paling banyak setelah diperpanjang. */
    readonly hariMaks: number;
    /** Kontrak pertama PO hadiah (kelas/event). */
    readonly hariHadiah: number;
    /** Biaya perpanjang = sekian menit pendapatan PO itu (harga normal), minimal biayaMin. */
    readonly biayaMenit: number;
    readonly biayaMin: number;
    /** PO yang diputus tidak bisa didaftarkan lagi selama sekian hari terminal, dan reputasinya turun. */
    readonly jedaPutusHari: number;
    readonly penaltiReputasiPutus: number;
  };
  readonly terminal: {
    /** XP kumulatif terminal (penumpang) untuk level T = xpA × (T − 1)^xpK. */
    readonly xpA: number;
    readonly xpK: number;
    /** Semua pendapatan × (1 + bonusPerLevel × (T − 1)). */
    readonly bonusPerLevel: number;
    /** Level awal Tipe B, Tipe A, Terpadu ★1; bintang berikutnya tiap levelPerBintang. */
    readonly levelKelas: readonly [number, number, number];
    readonly levelPerBintang: number;
    /** Slot PO: [level terminal minimal, jumlah slot], urut naik. */
    readonly slot: readonly (readonly [number, number])[];
    /** Slot di atas batas ini butuh aula loket kedua (tahap perluasan `tahapAulaKedua`). */
    readonly slotTanpaAulaKedua: number;
    readonly tahapAulaKedua: number;
  };
  readonly perluasan: readonly KonfigPerluasan[];
  /** Lama proyek perluasan sebelum diresmikan (detik main; 1440 = satu hari terminal). */
  readonly detikProyek: number;
  /** Renovasi (pengganti prestige): poin minimal; rumus poin & bonus memakai ambangPrestige/eksponenPrestige/bonusPrestige. */
  readonly poinMinRenovasi: number;
}

export interface KonfigEkonomi {
  readonly tahap: Readonly<Record<TahapId, KonfigTahap>>;

  readonly fasilitas: Readonly<Record<FasilitasId, KonfigFasilitas>>;
  /** Jurusan: Jawa–Bali lebih dulu, lalu rute antarpulau (urutan ini juga indeks harga PO & papan di adegan). */
  readonly jurusan: readonly KonfigJurusan[];
  readonly teknologi: Readonly<Record<TeknologiId, KonfigTeknologi>>;
  /**
   * Jalur bus: pasangan halte kedatangan & jalur keberangkatan di adegan. Game
   * baru mulai dengan satu jalur; jalur berikutnya dibangun berurutan (biaya[i]
   * = biaya jalur ke-(i + 2)). Tiap jalur tambahan menaikkan kapasitas Peron &
   * Keberangkatan sebesar bonusKapasitas. Permanen: tidak diulang saat Renovasi.
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
   * Harga tiket yang diatur pemain per PO per jurusan, disimpan dalam persen
   * harga normal (pemain melihat Rupiah): min … maks, kelipatan langkah; kelas
   * bus lain ikut berlipat. Tiap segmen PO × jurusan × kelas punya jatah kursi
   * tetap; calon penumpangnya × (harga ÷ normal)^(−(elastisitas jurusan +
   * elastisitas kelas) ÷ 2), lalu dibagi dengan PO lain di jurusan yang sama (lihat
   * sim/segmen.ts). Harga rata-rata PO juga menentukan skor harga reputasinya
   * (KonfigMitra.reputasi).
   */
  readonly harga: {
    readonly min: number;
    readonly maks: number;
    readonly langkah: number;
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

  /** Harga tiket per penumpang: jurusan bernilai 1, PO Lv 1, kelas Ekonomi, harga normal. */
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

  /** Pendapatan sejak Renovasi terakhir yang bernilai satu poin Renovasi (lihat eksponenPrestige). */
  readonly ambangPrestige: number;
  /** Bonus pendapatan per poin Renovasi (0.1 = +10% per poin). */
  readonly bonusPrestige: number;
  /**
   * PLACEHOLDER (tidak ada di spreadsheet):
   * poin = floor((totalPendapatanRun / ambangPrestige) ^ eksponenPrestige).
   */
  readonly eksponenPrestige: number;

  /** Ekonomi mitra PO: tingkat & daftar PO, level PO & terminal, reputasi, kontrak, perluasan, Renovasi (documents/12). */
  readonly mitra: KonfigMitra;
  /** Ekonomi tycoon: bangunan, petugas, tarif, pasar, biaya (documents/13). Belum dipakai game. */
  readonly tycoon: KonfigTycoon;
}

/** Satu jenis bangunan tycoon di slot denah. */
export interface KonfigBangunan {
  /** Unit yang sudah ada di game baru. */
  readonly awal: number;
  /** Slot setelah tahap perluasan ke-i (indeks 0 = terminal awal; tahap di luar daftar memakai nilai terakhir). */
  readonly slot: readonly number[];
  /** Biaya unit tambahan ke-1, ke-2, … (di atas `awal`); sesudah daftar habis: biaya terakhir × pertumbuhan^(kelebihan). */
  readonly biaya: readonly number[];
  readonly pertumbuhan: number;
  /** Perawatan per unit per hari terminal (Rp). */
  readonly perawatan: number;
}

export interface KonfigTarif {
  readonly bawaan: number;
  readonly min: number;
  readonly maks: number;
  readonly langkah: number;
}

/** Skor 0–1 dari tarif: `skorBawaan` pada tarif bawaan, turun `turunPerRasio` tiap kelipatan bawaan di atasnya. */
export interface KonfigSkorTarif {
  readonly skorBawaan: number;
  readonly turunPerRasio: number;
}

/**
 * Ekonomi tycoon (documents/13-rancangan-tycoon.md): kapasitas dari bangunan &
 * petugas, pasar penumpang mutlak, tarif terminal, biaya operasional. Satuan
 * arus = penumpang per jam terminal (1 jam terminal = 60 detik main). Angka
 * hasil kalibrasi pertama dengan pemain serakah (tests/tycoon-tempo.test.ts).
 */
export interface KonfigTycoon {
  /** Kas game baru (Rp). */
  readonly modalAwal: number;
  readonly kapasitas: {
    /** Penumpang per jam satu halte kedatangan, satu jendela loket, satu gerbang keberangkatan. */
    readonly halte: number;
    readonly jendela: number;
    readonly gerbang: number;
    /** Tambahan kapasitas halte / gerbang yang dijaga petugasnya (0.25 = +25%). */
    readonly bonusPetugas: number;
    /** Penumpang per bus, dan lama bus menempati petak parkir (jam terminal): dicuci & menunggu jadwal. */
    readonly penumpangPerBus: number;
    readonly jamParkirBus: number;
  };
  /** Petak parkir bus setelah tahap perluasan ke-i (indeks 0 = terminal awal). */
  readonly petakBus: readonly number[];
  readonly bangunan: Readonly<Record<BangunanId, KonfigBangunan>>;
  /** Gaji satu posisi per hari terminal (Rp): terminal buka 24 jam, jadi satu posisi = tiga shift. */
  readonly gaji: Readonly<Record<PetugasId, number>>;
  readonly tarif: Readonly<Record<TarifId, KonfigTarif>>;
  /** Biaya modernisasi & perawatannya per hari (Rp). Pengali kapasitasnya tetap dari `teknologi`. */
  readonly teknologi: Readonly<Record<TeknologiId, { readonly biaya: number; readonly perawatan: number }>>;
  /** Tahap perluasan ke-i (levelnya dari mitra.perluasan): biaya (Rp) & biaya operasional gedungnya per hari setelah selesai. */
  readonly perluasan: readonly { readonly biaya: number; readonly operasional: number }[];
  readonly biayaDaftarPo: Readonly<Record<PoId, number>>;
  /** XP PO (bus yang datang): XP kumulatif level L = xpA × (L − 1)^xpK. */
  readonly xpPo: { readonly xpA: number; readonly xpK: number };
  /** XP terminal (penumpang): XP kumulatif level L = xpA × (L − 1)^xpK. */
  readonly xpTerminal: { readonly xpA: number; readonly xpK: number };
  /** Listrik per jalur per hari; malam hari (lampu) dikali pengaliMalam. */
  readonly listrik: { readonly perJalur: number; readonly pengaliMalam: number };
  /** Gaji, perawatan & listrik dikali ini menurut kelas terminal (indeks kelas; lebih dari daftar = nilai terakhir). */
  readonly pengaliBiayaKelas: readonly number[];
  /**
   * Pasar: calon penumpang per jam = perPeminat × peminat jurusan × pengali kelas
   * terminal × daya tarik (dayaTarikDasar + dayaTarikPerKepuasan × kepuasan) × ritme jam.
   */
  readonly pasar: {
    readonly perPeminat: number;
    readonly pengaliKelas: readonly number[];
    readonly dayaTarikDasar: number;
    readonly dayaTarikPerKepuasan: number;
    /** Biaya layanan: permintaan × (1 + kepekaanLayanan × elastisitas segmen ÷ elastisitasAcuan × (1 − tarif ÷ bawaan)). */
    readonly kepekaanLayanan: number;
    readonly elastisitasAcuan: number;
  };
  /** Harga tiket normal = hargaTiketDasar × nilai jurusan × nilai kelas bus × nilai level PO (ditetapkan PO). */
  readonly hargaTiketDasar: number;
  /**
   * Pengantar yang parkir & pemakai toilet: bagian penumpang pada tarif bawaan,
   * berubah linear dengan tarif (× 1 + kepekaan × (1 − tarif ÷ bawaan)), dibatasi
   * kapasitas per unit per jam.
   */
  readonly pengantar: { readonly bagian: number; readonly kepekaan: number; readonly perUnit: number };
  readonly pemakaiToilet: { readonly bagian: number; readonly kepekaan: number; readonly perUnit: number };
  /** Sewa wajar kios/toko per hari = nilaiPerArus × arus puncak; okupansi = jepit(1 + kepekaan × (1 − sewa ÷ wajar)). */
  readonly kios: { readonly nilaiPerArus: number; readonly kepekaan: number };
  readonly kepuasan: {
    readonly bobot: {
      readonly kelancaran: number;
      readonly kenyamanan: number;
      readonly kebersihan: number;
      readonly keamanan: number;
      readonly fasilitas: number;
      readonly harga: number;
    };
    /** Kelancaran 0 bila arus ≤ rasioNol × permintaan, 1 bila ≥ rasioLancar × permintaan (jam sibuk). */
    readonly rasioNol: number;
    readonly rasioLancar: number;
    readonly kursiPerBlok: number;
    /** Lama penumpang menunggu di ruang tunggu (jam terminal): kursi dibutuhkan = arus × jamTunggu. */
    readonly jamTunggu: number;
    readonly arusPerPetugasKebersihan: number;
    /** Kios + toko dibutuhkan = arus ÷ arusPerKios. */
    readonly arusPerKios: number;
    /** Komponen harga: biaya layanan, tarif parkir & toilet. */
    readonly harga: KonfigSkorTarif;
  };
  /** Kepuasan mitra PO: bobot komponen, skor tarif sewa loket & retribusi, dan batas perpanjang kontrak / mau bergabung. */
  readonly mitra: {
    readonly bobot: { readonly tarif: number; readonly penuh: number; readonly jendela: number; readonly kepuasan: number };
    readonly tarif: KonfigSkorTarif;
    readonly minimal: number;
  };
  /** Offline (butuh Manajer Operasional): paling lama `batasDetik`, pendapatan × efisiensi, biaya penuh. */
  readonly offline: { readonly batasDetik: number; readonly efisiensi: number };
  /** Bagian biaya yang kembali saat membongkar unit. */
  readonly bongkar: number;
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
    { nama: 'JAKARTA', peminat: 3, elastisitas: 1.8 },
    { nama: 'BANDUNG', peminat: 2, elastisitas: 1.8 },
    { nama: 'SEMARANG', peminat: 1.5, elastisitas: 1.6 },
    { nama: 'YOGYAKARTA', peminat: 1.5, elastisitas: 1.5 },
    { nama: 'SOLO', peminat: 1.2, elastisitas: 1.5 },
    { nama: 'SURABAYA', peminat: 1.5, elastisitas: 1.4 },
    { nama: 'MALANG', peminat: 1, elastisitas: 1.4 },
    { nama: 'DENPASAR', peminat: 1, elastisitas: 1.3 },
    // PLACEHOLDER: rute antarpulau setelah Denpasar (bus ikut menyeberang dengan kapal feri).
    { nama: 'LAMPUNG', feri: 'Merak–Bakauheni', kelasTerminal: 1, peminat: 0.8, elastisitas: 1.25 },
    { nama: 'PALEMBANG', feri: 'Merak–Bakauheni', kelasTerminal: 1, peminat: 0.8, elastisitas: 1.25 },
    { nama: 'MATARAM', feri: 'Padangbai–Lembar', kelasTerminal: 2, peminat: 0.6, elastisitas: 1.2 },
    { nama: 'JAMBI', feri: 'Merak–Bakauheni', kelasTerminal: 2, peminat: 0.5, elastisitas: 1.2 },
    { nama: 'PADANG', feri: 'Merak–Bakauheni', kelasTerminal: 2, peminat: 0.6, elastisitas: 1.2 },
    { nama: 'BIMA', feri: 'Kayangan–Pototano', kelasTerminal: 3, peminat: 0.4, elastisitas: 1.15 },
    { nama: 'MEDAN', feri: 'Merak–Bakauheni', kelasTerminal: 3, peminat: 0.7, elastisitas: 1.15 },
    { nama: 'BANDA ACEH', feri: 'Merak–Bakauheni', kelasTerminal: 3, peminat: 0.4, elastisitas: 1.15 },
  ],
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
  // PLACEHOLDER: harga tiket per PO & jurusan. Saran harga paling tinggi 120 %: di atasnya reputasi PO turun.
  harga: { min: 50, maks: 200, langkah: 10 },
  // PLACEHOLDER: kelas bus. Patas & Eksekutif sejak Tipe C, Sleeper di Tipe B, Double Decker di Tipe A.
  kelasBus: {
    ekonomi: { kelasTerminal: 0, peminat: 4, elastisitas: 2 },
    patas: { kelasTerminal: 0, peminat: 3, elastisitas: 1.6 },
    eksekutif: { kelasTerminal: 0, peminat: 2, elastisitas: 1.35 },
    sleeper: { kelasTerminal: 1, peminat: 1, elastisitas: 1.2 },
    tingkat: { kelasTerminal: 2, peminat: 1, elastisitas: 1.15 },
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
  eksponenPrestige: 0.5,

  // PLACEHOLDER (ekonomi v2): dikalibrasi dengan simulasi pemain optimal, lihat bagian 15–16 documents/12.
  mitra: {
    tingkat: {
      lokal: { kelasMaks: 3, reputasiAwal: 45, loketBawaan: 2 },
      regional: { kelasMaks: 4, reputasiAwal: 50, loketBawaan: 3 },
      nasional: { kelasMaks: 5, reputasiAwal: 55, loketBawaan: 4 },
      premium: { kelasMaks: 5, reputasiAwal: 65, loketBawaan: 4 },
    },
    po: {
      ondelOndel: { tingkat: 'lokal', jurusan: ['JAKARTA', 'SEMARANG', 'SURABAYA'], kelasTerminal: 0, sumber: 'awal', biayaDaftar: 0 },
      peuyeumKilat: { tingkat: 'lokal', jurusan: ['BANDUNG', 'YOGYAKARTA', 'SOLO'], kelasTerminal: 0, biayaDaftar: 50 },
      lumpiaKilat: { tingkat: 'lokal', jurusan: ['SEMARANG', 'JAKARTA', 'MALANG'], kelasTerminal: 0, biayaDaftar: 1_500 },
      bakpiaRasa: { tingkat: 'regional', jurusan: ['YOGYAKARTA', 'BANDUNG', 'DENPASAR'], kelasTerminal: 0, biayaDaftar: 12_000 },
      wayangLestari: { tingkat: 'regional', jurusan: ['SOLO', 'JAKARTA', 'SURABAYA'], kelasTerminal: 0, biayaDaftar: 60_000 },
      arekEkspres: { tingkat: 'regional', jurusan: ['SURABAYA', 'MALANG', 'DENPASAR'], kelasTerminal: 0, biayaDaftar: 300_000 },
      teloletJaya: { tingkat: 'premium', jurusan: ['SEMARANG', 'JAKARTA', 'DENPASAR'], kelasTerminal: 0, kepuasanMin: 0.65, biayaDaftar: 1_000_000 },
      apelBatu: { tingkat: 'regional', jurusan: ['MALANG', 'JAKARTA', 'DENPASAR'], kelasTerminal: 1, biayaDaftar: 3_000_000 },
      kecakLaju: { tingkat: 'nasional', jurusan: ['DENPASAR', 'SURABAYA', 'MATARAM'], kelasTerminal: 1, biayaDaftar: 12_000_000 },
      sigerSakti: { tingkat: 'regional', jurusan: ['LAMPUNG', 'PALEMBANG', 'JAKARTA'], kelasTerminal: 1, biayaDaftar: 40_000_000 },
      juaraKelas: { tingkat: 'nasional', jurusan: ['JAKARTA', 'BANDUNG', 'PALEMBANG'], kelasTerminal: 1, sumber: 'hadiahKelas', biayaDaftar: 0 },
      sultanGarasi: { tingkat: 'premium', jurusan: ['JAKARTA', 'DENPASAR', 'MEDAN'], kelasTerminal: 1, kepuasanMin: 0.8, biayaDaftar: 150_000_000 },
      rinjaniIndah: { tingkat: 'nasional', jurusan: ['MATARAM', 'BIMA', 'DENPASAR'], kelasTerminal: 2, biayaDaftar: 600_000_000 },
      rumahGadang: { tingkat: 'nasional', jurusan: ['PADANG', 'JAMBI', 'JAKARTA'], kelasTerminal: 2, biayaDaftar: 2_500_000_000 },
      juaraUmum: { tingkat: 'nasional', jurusan: ['PADANG', 'JAMBI', 'MEDAN'], kelasTerminal: 2, sumber: 'hadiahKelas', biayaDaftar: 0 },
      danauToba: { tingkat: 'nasional', jurusan: ['MEDAN', 'BANDA ACEH', 'PADANG'], kelasTerminal: 3, biayaDaftar: 12_000_000_000 },
      kopiGayo: { tingkat: 'nasional', jurusan: ['BANDA ACEH', 'MEDAN', 'JAKARTA'], kelasTerminal: 3, biayaDaftar: 50_000_000_000 },
      mudikCeria: { tingkat: 'regional', jurusan: ['SEMARANG', 'YOGYAKARTA', 'SOLO'], kelasTerminal: 0, sumber: 'hadiahEvent', biayaDaftar: 0 },
      merahPutih: { tingkat: 'nasional', jurusan: ['JAKARTA', 'SURABAYA', 'DENPASAR'], kelasTerminal: 0, sumber: 'hadiahEvent', biayaDaftar: 0 },
      kembangApi: { tingkat: 'nasional', jurusan: ['DENPASAR', 'MATARAM', 'BIMA'], kelasTerminal: 0, sumber: 'hadiahEvent', biayaDaftar: 0 },
    },
    nilaiJurusan: {
      JAKARTA: 1.0,
      BANDUNG: 1.0,
      SEMARANG: 1.4,
      YOGYAKARTA: 1.7,
      SOLO: 1.9,
      SURABAYA: 2.4,
      MALANG: 2.8,
      DENPASAR: 3.6,
      LAMPUNG: 4.2,
      PALEMBANG: 5.2,
      MATARAM: 6.4,
      JAMBI: 7.2,
      PADANG: 8.4,
      BIMA: 10,
      MEDAN: 12,
      'BANDA ACEH': 15,
    },
    kelas: {
      ekonomi: { nilai: 1.0, levelPo: 1 },
      patas: { nilai: 1.25, levelPo: 3 },
      eksekutif: { nilai: 1.6, levelPo: 6 },
      sleeper: { nilai: 2.1, levelPo: 10 },
      tingkat: { nilai: 2.6, levelPo: 15 },
    },
    levelJurusan: [1, 6, 12],
    xpA: 15,
    xpK: 3,
    fraksiXpLoket: 0.1,
    jatahAwal: 6,
    jatahPerLevel: 4,
    rNilaiPerLevel: 1.06,
    reputasi: {
      bobot: { kepuasan: 50, harga: 30, armada: 20 },
      hargaNol: 150,
      rentangHarga: 60,
      konstantaWaktuDetik: 1200,
      faktorDasar: 0.7,
      faktorPerPoin: 0.006,
    },
    persaingan: { gamma: 1, kejenuhan: 0.3 },
    kontrak: { hari: 7, hariMaks: 14, hariHadiah: 14, biayaMenit: 10, biayaMin: 50, jedaPutusHari: 3, penaltiReputasiPutus: 10 },
    terminal: {
      xpA: 4_500,
      xpK: 3.2,
      bonusPerLevel: 0.04,
      levelKelas: [10, 20, 30],
      levelPerBintang: 10,
      slot: [[1, 2], [3, 3], [6, 4], [10, 5], [14, 6], [20, 7], [25, 8], [30, 9], [40, 10], [50, 11], [60, 12]],
      slotTanpaAulaKedua: 8,
      tahapAulaKedua: 4,
    },
    perluasan: [
      { level: 3, biaya: 2_000, jatah: 2 },
      { level: 6, biaya: 50_000, jatah: 2 },
      { level: 10, biaya: 1_000_000, jatah: 2 },
      { level: 20, biaya: 500_000_000, jatah: 3 },
      { level: 30, biaya: 50_000_000_000, jatah: 3 },
    ],
    detikProyek: 1440,
    poinMinRenovasi: 3,
  },

  // Tycoon: hasil kalibrasi pertama (documents/13 bagian 14), dijaga tests/tycoon-tempo.test.ts.
  tycoon: {
    modalAwal: 25_000_000,
    kapasitas: { halte: 100, jendela: 50, gerbang: 150, bonusPetugas: 0.25, penumpangPerBus: 25, jamParkirBus: 0.75 },
    petakBus: [10, 10, 20, 20, 40, 60],
    bangunan: {
      jalur: { awal: 1, slot: [5, 5, 5, 5, 7, 9], biaya: [15_000_000, 60_000_000, 250_000_000, 800_000_000, 1_500_000_000, 2_500_000_000, 4_000_000_000, 6_000_000_000], pertumbuhan: 1, perawatan: 500_000 },
      jendela: { awal: 1, slot: [4, 6, 8, 12, 16, 20], biaya: [2_000_000], pertumbuhan: 1.25, perawatan: 150_000 },
      kursi: { awal: 1, slot: [4, 4, 4, 8], biaya: [4_000_000], pertumbuhan: 1, perawatan: 50_000 },
      kios: { awal: 0, slot: [3], biaya: [5_000_000], pertumbuhan: 1, perawatan: 100_000 },
      toko: { awal: 0, slot: [2, 2, 2, 4], biaya: [12_000_000], pertumbuhan: 1, perawatan: 250_000 },
      toilet: { awal: 0, slot: [1, 1, 1, 2], biaya: [8_000_000], pertumbuhan: 1, perawatan: 200_000 },
      lahanParkir: { awal: 0, slot: [1, 1, 2], biaya: [6_000_000], pertumbuhan: 1, perawatan: 100_000 },
      posRetribusi: { awal: 0, slot: [1], biaya: [6_000_000], pertumbuhan: 1, perawatan: 100_000 },
    },
    gaji: {
      peron: 450_000,
      gerbang: 450_000,
      kebersihan: 360_000,
      satpam: 450_000,
      juruParkir: 300_000,
      petugasToilet: 300_000,
      petugasRetribusi: 360_000,
      manajerOperasional: 1_500_000,
      manajerKemitraan: 1_200_000,
    },
    tarif: {
      layanan: { bawaan: 10, min: 0, maks: 25, langkah: 1 },
      sewaLoket: { bawaan: 250_000, min: 0, maks: 1_000_000, langkah: 25_000 },
      retribusiBus: { bawaan: 20_000, min: 0, maks: 60_000, langkah: 5_000 },
      parkir: { bawaan: 5_000, min: 0, maks: 20_000, langkah: 1_000 },
      toilet: { bawaan: 2_000, min: 0, maks: 5_000, langkah: 500 },
      sewaKios: { bawaan: 300_000, min: 0, maks: 2_000_000, langkah: 50_000 },
    },
    teknologi: {
      rambuHalte: { biaya: 15_000_000, perawatan: 15_000 },
      pengaturBus: { biaya: 100_000_000, perawatan: 100_000 },
      mesinTiket: { biaya: 10_000_000, perawatan: 10_000 },
      eTiket: { biaya: 80_000_000, perawatan: 80_000 },
      jadwalDigital: { biaya: 25_000_000, perawatan: 25_000 },
      gateOtomatis: { biaya: 400_000_000, perawatan: 400_000 },
    },
    perluasan: [
      { biaya: 20_000_000, operasional: 500_000 },
      { biaya: 80_000_000, operasional: 2_000_000 },
      { biaya: 250_000_000, operasional: 6_000_000 },
      { biaya: 800_000_000, operasional: 20_000_000 },
      { biaya: 3_000_000_000, operasional: 60_000_000 },
    ],
    biayaDaftarPo: {
      ondelOndel: 0,
      peuyeumKilat: 3_000_000,
      lumpiaKilat: 12_000_000,
      bakpiaRasa: 40_000_000,
      wayangLestari: 80_000_000,
      arekEkspres: 150_000_000,
      teloletJaya: 250_000_000,
      apelBatu: 350_000_000,
      kecakLaju: 600_000_000,
      sigerSakti: 900_000_000,
      juaraKelas: 0,
      sultanGarasi: 1_500_000_000,
      rinjaniIndah: 2_500_000_000,
      rumahGadang: 4_000_000_000,
      juaraUmum: 0,
      danauToba: 6_000_000_000,
      kopiGayo: 10_000_000_000,
      mudikCeria: 0,
      merahPutih: 0,
      kembangApi: 0,
    },
    xpPo: { xpA: 15, xpK: 3 },
    xpTerminal: { xpA: 50, xpK: 2.75 },
    listrik: { perJalur: 600_000, pengaliMalam: 1.5 },
    pengaliBiayaKelas: [1, 1.25, 1.5, 2],
    pasar: { perPeminat: 45, pengaliKelas: [1, 1.3, 1.6, 2], dayaTarikDasar: 0.6, dayaTarikPerKepuasan: 0.8, kepekaanLayanan: 0.5, elastisitasAcuan: 1.5 },
    hargaTiketDasar: 60_000,
    pengantar: { bagian: 0.3, kepekaan: 0.5, perUnit: 60 },
    pemakaiToilet: { bagian: 0.25, kepekaan: 0.5, perUnit: 200 },
    kios: { nilaiPerArus: 1_500, kepekaan: 0.5 },
    kepuasan: {
      bobot: { kelancaran: 0.3, kenyamanan: 0.2, kebersihan: 0.2, keamanan: 0.1, fasilitas: 0.1, harga: 0.1 },
      rasioNol: 0.5,
      rasioLancar: 0.95,
      kursiPerBlok: 60,
      jamTunggu: 0.5,
      arusPerPetugasKebersihan: 150,
      arusPerKios: 100,
      harga: { skorBawaan: 0.75, turunPerRasio: 0.25 },
    },
    mitra: { bobot: { tarif: 0.5, penuh: 0.2, jendela: 0.15, kepuasan: 0.15 }, tarif: { skorBawaan: 0.8, turunPerRasio: 0.4 }, minimal: 0.5 },
    offline: { batasDetik: 8 * 3600, efisiensi: 0.6 },
    bongkar: 0.3,
  },
};

export const SIMULASI: KonfigSimulasi = {
  tickPerDetik: 10,
  maksKejarDetik: 1,
  intervalSimpanDetik: 10,
  intervalUnggahDetik: 60,
  minDetikPopupOffline: 30,
};
