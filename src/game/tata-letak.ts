/**
 * Denah terminal (satuan petak) dan parameter animasi dekoratif.
 * Tidak import three.js supaya bisa dites. Semua angka di sini murni visual;
 * ekonomi tetap dihitung di sim/ dari economy.config.ts.
 *
 * Dunia 3D: 1 unit = 1 petak ≈ 5 m. Petak (x, y) → three.js (X = x, Z = y),
 * tinggi = sumbu Y dalam unit yang sama. Kamera melihat dari arah +x+y, jadi
 * x mengarah ke kanan-bawah layar dan y ke kiri-bawah. Terminal terpadu: jalan
 * raya bermedian, pangkalan bus parkir serong, gedung utama beratap lengkung
 * (loket) yang menyatu dengan ruang tunggu keberangkatan berdinding & beratap kaca.
 *
 *   y 0–2.6    jalan raya satu arah (+x): lajur jauh = bus lewat, lajur dekat = bus terminal
 *   y 2.6–3.4  median berpohon (bukaan masuk di kiri, keluar di kanan)
 *   y 3.4–5.6  jalan dalam satu arah: lajur sirkulasi (4.0) + lajur halte (5.0)
 *   x −25…−8   peron kedatangan (5 halte, y 5.6–7.2), taman di belakangnya
 *   x −7…26    pangkalan: 20 petak parkir serong dalam 4 kelompok jurusan (tiap
 *              kelompok diawali pulau bertiang papan jurusan) + tempat cuci
 *              (y ≈ 7.2), pos cuci di ujung timur, lorong belakang (y 9.6)
 *   y 11–15    gedung utama memanjang (x 11.6–29): aula kaca berisi loket tiket
 *              (dinding utara), labirin antrean, toko; di depannya plaza
 *   x 29–50    ruang tunggu keberangkatan (y 6.3–13, 5 gerbang JALUR), menempel ke gedung utama
 *
 * Siklus bus (semua gerak maju): masuk → halte kedatangan → parkir serong di
 * pangkalan → lorong belakang → halte keberangkatan → keluar ke jalan raya.
 * Dua arus penumpang yang terpisah:
 *   - penumpang turun: peron kedatangan → jalur pejalan kaki → gerbang KELUAR di
 *     pagar belakang → gang di sela ruko → trotoar jalan belakang (pulang);
 *   - calon penumpang (datang dari luar: trotoar jalan belakang lewat gerbang
 *     MASUK, atau dari parkir mobil) → masuk pintu gedung → antre di labirin
 *     (meluap keluar pintu bila penuh) → beli tiket di jendela loket → menyusuri
 *     aula ke ruang tunggu → duduk → saat busnya berhenti, lewat gerbang lalu naik.
 */
import { EKONOMI } from '../config/economy.config';
import type { AreaId } from '../sim/operasi';

export type Titik = readonly [number, number];

export interface Persegi {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

// ---------------------------------------------------------------------------
// Jalan & lajur

export const JALAN = { x0: -50, x1: 80, y0: 0, y1: 2.6 } as const;
export const MEDIAN = { y0: 2.6, y1: 3.4 } as const;
/** Bukaan median untuk kurva masuk & keluar. */
export const BUKAAN_MEDIAN: readonly (readonly [number, number])[] = [
  [-30.3, -25.9],
  [50.4, 54.8],
];
export const JALAN_DALAM: Persegi = { x0: -27.9, y0: 3.4, x1: 51.2, y1: 5.6 };

export const LAJUR = {
  /** Jalan raya, bus lewat (dekoratif). */
  jauh: 0.7,
  /** Jalan raya, bus menuju terminal & bus yang keluar. */
  dekat: 1.9,
  /** Jalan dalam: lajur menyalip/sirkulasi. */
  sirkulasi: 4.0,
  /** Jalan dalam: lajur halte, menempel ke peron; di pangkalan jadi lorong depan. */
  halte: 5.0,
  /** Lorong belakang pangkalan menuju peron keberangkatan. */
  lorong: 9.6,
} as const;

export const X_MUNCUL = -48;
export const X_HILANG = 70;

export const BUS = {
  panjang: 2.4,
  lebar: 0.56,
  /** Jarak aman ke bus di depan (petak). */
  jarak: 0.45,
  kecepatan: 3.4,
  percepatan: 2.2,
  perlambatan: 3.2,
} as const;

/**
 * Jarak (petak) dari pusat bus ke pintu depan, searah hadap bus. Penumpang
 * turun/naik di titik ini, tepat di pintu depan yang tergambar di sisi bus.
 */
export const PINTU_BUS = 0.84;

/**
 * Pintu bagasi di bawah lantai bus, di sisi pintu (menghadap peron), di antara
 * kedua roda: a = tengahnya sepanjang hadap bus dari pusat, bawah/atas = tinggi
 * dari aspal. Terbuka ke atas saat bus menurunkan/memuat penumpang; kenek
 * berjaga di sampingnya.
 */
export const BAGASI = { a: -0.03, lebar: 0.46, bawah: 0.085, atas: 0.25, kenek: 0.22 } as const;

/** Bus menunggu di lajur dekat kalau semua halte kedatangan penuh. */
export const X_TUNGGU_MASUK = -31.7;
/** Kurva masuk: dari lajur dekat jalan raya ke lajur halte. */
export const MASUK: { readonly dari: Titik; readonly ke: Titik } = { dari: [-29.9, LAJUR.dekat], ke: [-26.1, LAJUR.halte] };
/**
 * Kurva masuk ke lajur sirkulasi: untuk bus yang menuju halte kedatangan di depan
 * bus yang sedang menurunkan penumpang (menyalipnya, lalu berbelok masuk ke halte).
 * Lebih pendek dari MASUK supaya bus sudah lurus sebelum menjajari bus di halte
 * kedatangan paling belakang (dites).
 */
export const MASUK_SIRKULASI: { readonly dari: Titik; readonly ke: Titik } = { dari: MASUK.dari, ke: [-27.0, LAJUR.sirkulasi] };
/** Kurva keluar: dari lajur sirkulasi ke lajur dekat jalan raya. */
export const KELUAR: { readonly dari: Titik; readonly ke: Titik } = { dari: [50.8, LAJUR.sirkulasi], ke: [54.4, LAJUR.dekat] };
/** Kurva dari ujung lorong pangkalan naik ke lajur halte keberangkatan. */
export const SAMBUNG_BERANGKAT: { readonly dari: Titik; readonly ke: Titik } = {
  dari: [25.4, LAJUR.lorong],
  ke: [28.8, LAJUR.halte],
};
/**
 * Panjang (x) kurva pindah lajur dari lajur halte ke lajur sirkulasi: cukup
 * landai tapi tetap bebas dari bus yang berhenti di halte depannya (dites).
 */
export const PANJANG_PINDAH_LAJUR = 2.2;

/**
 * Posisi halte (x pusat bus), indeks 0 = paling depan. Celah antarbus yang
 * berhenti (±1,2 kedatangan, ±1,6 keberangkatan) cukup untuk bus belakang
 * berbelok keluar ke lajur sirkulasi tanpa menunggu bus di depannya pergi.
 * Jarak halte keberangkatan 4 petak: gerbang tetap jatuh di antara rusuk atap.
 * Halte keberangkatan paling belakang cukup jauh dari ujung lorong pangkalan
 * sehingga bus bisa turun ke lajur sirkulasi di belakangnya (ke halte lain).
 */
export const HALTE_DATANG_X: readonly number[] = [-9.5, -13.1, -16.7, -20.3, -23.9];
export const HALTE_BERANGKAT_X: readonly number[] = [47.8, 43.8, 39.8, 35.8, 31.8];
/**
 * Bus yang selesai menurunkan penumpang di belakang halte terdepan menyalip
 * lewat lajur sirkulasi, lalu turun kembali ke lorong pangkalan di rentang x
 * ini (tepat di depan bus di halte terdepan).
 */
export const X_TURUN_KE_LORONG: readonly [number, number] = [HALTE_DATANG_X[0]! + 2.0, HALTE_DATANG_X[0]! + 2.0 + PANJANG_PINDAH_LAJUR];

/**
 * Deretan posisi serong di pangkalan (jarak 1,25), barat → timur: tiap
 * kelompok jurusan = satu pulau papan jurusan lalu lima petak parkir.
 */
const POSISI_SERONG: readonly number[] = Array.from({ length: 24 }, (_, i) => -6.15 + i * 1.25);
const POSISI_PULAU = (i: number): boolean => i % 6 === 0;

/**
 * Pulau papan jurusan (x pusat) di awal tiap kelompok: menempati satu posisi
 * serong seperti bus parkir, jadi bus yang masuk/keluar petak sebelahnya tidak
 * menyenggol tiangnya; papannya menjulang di atas atap bus.
 */
export const PULAU_JURUSAN: readonly number[] = POSISI_SERONG.filter((_, i) => POSISI_PULAU(i));

/**
 * Parkir serong (sekaligus tempat cuci bus): bus masuk dari lajur halte, keluar
 * maju ke lorong belakang. Dua puluh petak berjarak 1,25: bus yang parkir
 * bersebelahan berjarak ±0,32, dan bus yang masuk/keluar petak tidak menyenggol
 * bus di petak sebelahnya (dicek di tests/tata-letak.test.ts).
 */
export const PARKIR_SERONG = {
  pusatX: POSISI_SERONG.filter((_, i) => !POSISI_PULAU(i)),
  pusatY: 7.2,
  sudut: Math.PI / 4,
  /** Jarak (x) awal kurva masuk di belakang pusat petak. */
  jarakMasuk: 2.8,
  /** Jarak (x) akhir kurva keluar di depan pusat petak. */
  jarakKeluar: 2.8,
} as const;

/**
 * Cuci bus di petak parkir oleh dua petugas bus: kenek turun dari pintu depan
 * dan sekali mengelilingi bus sambil menyabun; sopir turun menyusul dan
 * mengelilingi bus sambil membilas. Masing-masing lalu naik lagi. Bus baru boleh
 * berangkat setelah bersih. `detik` = lama cuci pada kecepatan normal (ikut
 * dipercepat bersama bus); pecahan lain = tahap dari 0 sampai 1.
 */
export const CUCI = {
  /** Satu putaran (±6,9 petak) ditempuh dalam lamaPutaran × detik: laju jalan biasa. */
  detik: 21,
  /** Lama turun/naik pintu dan lama satu putaran mengelilingi bus. */
  lamaPintu: 0.04,
  lamaPutaran: 0.72,
  /** Saat kenek (menyabun) dan sopir (membilas) mulai turun dari pintu. */
  mulaiKenek: 0,
  mulaiSopir: 0.2,
  /** Jarak lintasan petugas dari sumbu bus: ke samping dan ke depan/belakang. */
  jarakSisi: 0.4,
  jarakUjung: 1.32,
} as const;

/**
 * Setelah dicuci, bus menunggu jadwal berangkat jurusannya (sopir & kenek
 * beristirahat) selama sekian detik sebelum boleh keluar pangkalan. Karena itu
 * pangkalan berisi beberapa bus per jurusan, bukan hanya bus yang sedang dicuci.
 * Ikut dipercepat bersama bus, seperti CUCI.detik.
 */
export const ISTIRAHAT_DETIK = 45;

/** Pos cuci (gudang sabun & tandon air) di ujung timur pangkalan, di luar lintasan bus. */
export const POS_CUCI: Persegi = { x0: 23.95, y0: 6.2, x1: 24.95, y1: 7.2 };

/**
 * Penumpang per bus: naik seiring throughput supaya halte tidak jadi hambatan
 * palsu. Dengan langkah alami, penumpang terakhir yang dipanggil butuh beberapa
 * detik dari kursinya; muatan yang lebih besar membagi jeda itu ke lebih banyak orang.
 */
export const MUATAN_BUS = { min: 12, maks: 20 } as const;
/** Bus menunggu penumpang ("ngetem") paling lama sekian detik (cukup untuk memanggil satu bus penuh). */
export const MAKS_NGETEM_DETIK = 15;
/**
 * Kota tujuan bus (urut dibuka pemain, lihat EKONOMI.jurusan): papan di atas
 * jendela loket (satu per jendela), kelompok parkir, dan pengumuman keberangkatan.
 */
export const TUJUAN_BUS: readonly string[] = EKONOMI.jurusan.map((j) => j.nama);

/**
 * Jurusan yang dilayani mitra PO sebagai bitmask (bit i = TUJUAN_BUS[i]):
 * tidak selalu urut, karena tiap PO punya jurusannya sendiri. Murah
 * dibandingkan & jadi kunci cache tiap frame.
 */
export const MASK_SEMUA_JURUSAN = 2 ** TUJUAN_BUS.length - 1;

/** Jurusan ke-j termasuk mask. */
export const jurusanDiMask = (mask: number, j: number): boolean => j >= 0 && j < TUJUAN_BUS.length && Math.floor(mask / 2 ** j) % 2 === 1;

/** Mask dari daftar boolean per jurusan (lihat sim jurusanDilayani). */
export function maskJurusan(dilayani: readonly boolean[]): number {
  let mask = 0;
  dilayani.forEach((ya, j) => {
    if (ya && j < TUJUAN_BUS.length) mask += 2 ** j;
  });
  return mask;
}

/** Mask n jurusan pertama (urut TUJUAN_BUS). */
export const maskAwal = (n: number): number => 2 ** Math.max(0, Math.min(TUJUAN_BUS.length, Math.floor(n))) - 1;

export interface KelompokParkir {
  /** Tulisan papan jurusan di belakang kelompok petak (kota Jawa–Bali). */
  readonly nama: string;
  /** Indeks TUJUAN_BUS yang dilayani bus di kelompok ini (Jawa–Bali, lalu antarpulau). */
  readonly tujuan: readonly number[];
  /** Rute antarpulau kelompok ini (indeks TUJUAN_BUS, urut dibuka): baris kedua papan pulau. */
  readonly antarpulau: readonly number[];
  /** Indeks petak PARKIR_SERONG milik kelompok ini (berurutan barat → timur). */
  readonly petak: readonly number[];
  /** Warna papan & tanda lantai petak. */
  readonly warna: number;
}

/**
 * Pangkalan dikelompokkan per jurusan keberangkatan (barat → timur), lima
 * petak per kelompok. Bus yang selesai menurunkan penumpang ditugaskan ke satu
 * jurusan lalu parkir & dicuci di kelompoknya sebelum berangkat. Rute
 * antarpulau setelah Denpasar dibagi dua per kelompok (Nusa Tenggara di
 * kelompok timur yang juga melayani Denpasar).
 */
export const KELOMPOK_PARKIR: readonly KelompokParkir[] = (
  [
    ['JAKARTA · BANDUNG', [0, 1], [8, 9], 0xdc2626],
    ['SEMARANG · YOGYAKARTA', [2, 3], [11, 12], 0x16a34a],
    ['SOLO · MALANG', [4, 6], [14, 15], 0x2563eb],
    ['SURABAYA · DENPASAR', [5, 7], [10, 13], 0x9333ea],
  ] as const
).map(([nama, darat, laut, warna], k): KelompokParkir => {
  const antarpulau = laut.filter((t) => t < TUJUAN_BUS.length);
  return { nama, tujuan: [...darat, ...antarpulau], antarpulau, warna, petak: Array.from({ length: 5 }, (_, i) => k * 5 + i) };
});

/**
 * Tampilan papan pulau kelompok parkir: 0 = belum ada jurusan kelompok yang
 * dilayani ("SEGERA DIBUKA"), selain itu 1 + bit rute antarpulau kelompok yang
 * dilayani (baris kedua papan, urut KelompokParkir.antarpulau).
 */
export function kunciPapanPulau(tujuan: readonly number[], antarpulau: readonly number[], mask: number): number {
  if (!tujuan.some((t) => jurusanDiMask(mask, t))) return 0;
  return 1 + antarpulau.reduce((bit, t, k) => (jurusanDiMask(mask, t) ? bit + 2 ** k : bit), 0);
}

/** Kelompok jurusan pemilik petak ke-i. */
export function kelompokPetak(i: number): number {
  return KELOMPOK_PARKIR.findIndex((k) => k.petak.includes(i));
}
/** Bus lewat di jalan raya (dekoratif), per detik. */
export const LAJU_BUS_LEWAT = 0.14;

// ---------------------------------------------------------------------------
// Peron, gedung, antrean

/** Tinggi lantai peron & ruang tunggu (unit). */
export const TINGGI_PERON = 0.15;
export const PERON: Persegi = { x0: HALTE_DATANG_X[HALTE_DATANG_X.length - 1]! - 0.8, y0: 5.6, x1: HALTE_DATANG_X[0]! + 1.6, y1: 7.2 };
export const PANGKALAN: Persegi = { x0: PULAU_JURUSAN[0]! - 1.0, y0: 5.6, x1: 26.4, y1: 10.4 };
/**
 * Tempat petugas peron tiap halte kedatangan (urut HALTE_DATANG_X): di tepi
 * peron sedikit di belakang pintu bus, menghadap pintunya. Di luar lintasan
 * penumpang turun (lurus dari pintu, menghindari tiang kanopi) dan rambu BUS
 * di ujung depan peron.
 */
export const POS_PETUGAS_PERON: readonly Titik[] = HALTE_DATANG_X.map((x): Titik => [x + PINTU_BUS - 0.45, PERON.y0 + 0.3]);

/**
 * Ruang tunggu keberangkatan: aula kaca di atas lantai setinggi peron. Dinding
 * utaranya (y0) berpintu gerbang ke peron keberangkatan; sisi baratnya menempel
 * ke gedung utama. Rentang x dipilih supaya rusuk atap (tiap 1 petak dari x0)
 * jatuh tepat di tengah antara dua gerbang.
 */
export const RUANG_TUNGGU: Persegi = { x0: 29.14, y0: 6.3, x1: 50.14, y1: 13.0 };
/** Peron keberangkatan: selasar sempit antara gerbang ruang tunggu dan tepi lajur halte. */
export const PERON_BERANGKAT: Persegi = { x0: RUANG_TUNGGU.x0, y0: 5.6, x1: RUANG_TUNGGU.x1, y1: RUANG_TUNGGU.y0 };
/** Gerbang ruang tunggu (x), satu per halte keberangkatan, tepat di depan pintu bus. */
export const GERBANG_X: readonly number[] = HALTE_BERANGKAT_X.map((x) => x + PINTU_BUS);
/** Titik di dalam ruang tunggu tepat di balik pintu dari aula loket gedung utama. */
export const PINTU_RUANG_TUNGGU: Titik = [RUANG_TUNGGU.x0 + 0.3, 12.1];

/**
 * Gedung utama memanjang di belakang pangkalan; ujung timurnya menyatu dengan
 * ruang tunggu. Aula di dalamnya (loket tiket, antrean, toko) terlihat lewat
 * atap dan fasad kaca.
 */
export const GEDUNG: Persegi = { x0: 11.6, y0: 11.2, x1: RUANG_TUNGGU.x0, y1: 15.0 };
/** Tinggi lantai aula gedung utama (di atas podium). */
export const TINGGI_LANTAI_GEDUNG = 0.12;
/**
 * Sayap barat gedung utama, menempel dinding barat aula di tepi taman: toilet
 * pria & wanita, tempat wudhu & musholla pria & wanita, dan lorong di sepanjang
 * dinding aula (dua pintu dari aula). Lantainya setinggi lantai aula; isi
 * ruangannya ada di bagian "Sayap barat" di bawah dan di sayap3d.ts.
 */
export const SAYAP_BARAT: Persegi = { x0: 6.6, y0: GEDUNG.y0, x1: GEDUNG.x0, y1: GEDUNG.y1 };

/** Atap lengkung: membentang x0–x1, melengkung sepanjang y (tepi y0/y1 setinggi hTepi, puncak di tengah). */
export interface AtapLengkung extends Persegi {
  readonly hTepi: number;
  readonly hPuncak: number;
}

/**
 * Atap terminal: gedung utama (termasuk selasar depan), ruang tunggu & peron
 * keberangkatan, kanopi peron kedatangan. Orang di bawahnya tidak kehujanan
 * (tanpa payung) dan butiran hujan berhenti di permukaannya.
 */
export const ATAP: { readonly gedung: AtapLengkung; readonly tunggu: AtapLengkung; readonly datang: AtapLengkung; readonly sayap: AtapLengkung } = {
  gedung: { x0: GEDUNG.x0 - 0.35, x1: GEDUNG.x1, y0: GEDUNG.y0 - 0.5, y1: GEDUNG.y1 + 0.5, hTepi: 1.9, hPuncak: 2.95 },
  // Atap kaca sayap barat: nyaris datar (sedikit melengkung supaya rumus lengkung hujan tetap berlaku).
  sayap: { x0: SAYAP_BARAT.x0 - 0.12, x1: SAYAP_BARAT.x1 - 0.35, y0: SAYAP_BARAT.y0 - 0.12, y1: SAYAP_BARAT.y1 + 0.12, hTepi: 1.0, hPuncak: 1.08 },
  tunggu: { x0: RUANG_TUNGGU.x0, x1: RUANG_TUNGGU.x1 + 0.2, y0: PERON_BERANGKAT.y0 - 0.1, y1: RUANG_TUNGGU.y1 + 0.1, hTepi: 1.35, hPuncak: 2.45 },
  datang: { x0: PERON.x0 - 0.1, x1: PERON.x1 + 0.1, y0: PERON.y0 - 0.1, y1: PERON.y1 + 0.05, hTepi: TINGGI_PERON + 1.1, hPuncak: TINGGI_PERON + 1.45 },
};

const DAFTAR_ATAP: readonly AtapLengkung[] = Object.values(ATAP);

/** Titik (x, y) terlindung atap terminal (dipanggil per orang per frame saat hujan). */
export function diBawahAtap(x: number, y: number): boolean {
  for (const a of DAFTAR_ATAP) if (x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1) return true;
  return false;
}
export const PINTU_MASUK: Titik = [18.3, 15.05];
/** Bordes landai di depan pintu masuk: lantai aula turun ke plaza. */
export const BORDES: Persegi = { x0: PINTU_MASUK[0] - 0.5, y0: GEDUNG.y1, x1: PINTU_MASUK[0] + 0.5, y1: GEDUNG.y1 + 0.5 };

/** Jalur pejalan kaki dari peron kedatangan ke gerbang keluar (di antara peron dan pangkalan). */
export const X_JALUR_KAKI = PERON.x1 + 0.5;
export const Y_TURUN_PERON = 7.6;
/** Tiang kanopi peron kedatangan (x, tiap 2,4 dari ujung barat), di sela slot tunggu & jalur turun penumpang. */
export const KOLOM_KANOPI_DATANG: readonly number[] = Array.from({ length: 12 }, (_, i) => PERON.x0 + 0.6 + i * 2.4).filter((x) => x < PERON.x1 - 0.3);

// ---------------------------------------------------------------------------
// Keluar-masuk pejalan kaki: pagar belakang, gang di sela ruko, trotoar

/** Pagar kompleks di sisi jalan belakang (y) dan trotoar utara jalan belakang (y). */
export const Y_PAGAR = 17.9;
export const Y_TROTOAR_BELAKANG = 20.15;
/** Gerbang pejalan kaki di pagar: KELUAR (penumpang turun pulang) & MASUK (calon penumpang). */
export const GERBANG_KELUAR_X = X_JALUR_KAKI;
export const GERBANG_MASUK_X = PINTU_MASUK[0];
export const LEBAR_GERBANG_PAGAR = 1.2;
/** Rentang x yang dibiarkan kosong dari ruko: gang dari trotoar ke gerbang pagar. */
export const GANG_RUKO: readonly (readonly [number, number])[] = [
  [GERBANG_KELUAR_X - 1.1, GERBANG_KELUAR_X + 1.1],
  [GERBANG_MASUK_X - 1.1, GERBANG_MASUK_X + 1.1],
];
/** Lorong di antara dua baris mobil parkir: sebagian calon penumpang datang dari sini. */
export const LORONG_PARKIR = { x0: 31.2, x1: 49.2, y: 15.85 } as const;
/** Dari parkir menyusuri plaza selatan (di luar air mancur & perabot) ke mulut antrean. */
export const RUTE_DARI_PARKIR: readonly Titik[] = [
  [30.3, 15.85],
  [29.6, 17.3],
  [19.9, 17.35],
];
/** Dari gerbang masuk pagar ke mulut antrean. */
export const SINGGAH_GERBANG_MASUK: Titik = [18.6, 17.3];

/** Pos retribusi di samping pintu masuk. */
export const POS_RETRIBUSI: Persegi = { x0: -31.5, y0: 3.6, x1: -30.5, y1: 4.4 };

/**
 * Pos jaga satpam, urut yang lebih dulu diisi (satpam ke-1, ke-2, …): pos luar
 * di samping bordes (malam hari berpatroli keliling plaza, lihat
 * PATROLI_SATPAM), di balik pintu masuk aula, ujung barat peron keberangkatan,
 * dan ujung barat peron kedatangan. Semuanya di luar lintasan pejalan kaki,
 * tong sampah, dan tiang kanopi.
 */
export const POS_SATPAM: readonly Titik[] = [
  [18.95, 15.35],
  [PINTU_MASUK[0] - 0.6, 14.55],
  [RUANG_TUNGGU.x0 + 0.85, PERON_BERANGKAT.y0 + 0.35],
  [PERON.x0 + 0.9, PERON.y1 - 0.25],
];

// ---------------------------------------------------------------------------
// Aula loket di dalam gedung utama

/**
 * Loket tiket: deretan jendela di dinding utara aula, menghadap selatan (ke
 * kamera). Petugas berdiri di balik meja; pembeli berdiri di depan jendela,
 * dan pembeli berikutnya untuk loket yang sama menunggu tepat di belakangnya.
 */
export const LOKET = {
  /** Muka meja loket (sisi pembeli) dan posisi petugas di baliknya. */
  yMeja: 11.8,
  yPetugas: 11.5,
  /** Posisi pembeli di jendela (lihat posisiPembeli untuk yang menunggu). */
  yPembeli: 11.97,
  /**
   * Pembeli paling banyak per loket: satu di jendela, dua menunggu di
   * belakangnya, dan saat ramai dua lagi di kiri-kanan pembeli. Tempatnya
   * sudah dipesan sejak dipanggil dari kepala antrean, jadi harus cukup
   * untuk yang sedang berjalan ke jendela juga (tidak jadi hambatan palsu).
   */
  maksPembeli: 5,
  /** Setengah lebar satu jendela loket (sekat di kedua sisinya). */
  setengahLebar: 0.4,
} as const;
/** Pusat (x) tiap jendela loket, dari barat ke timur. */
export const X_LOKET: readonly number[] = Array.from({ length: 8 }, (_, i) => 19.9 + i * 0.8);
/** Lorong di depan loket, di antara pembeli dan labirin antrean: jalan ke loket dan ke pintu ruang tunggu. */
export const Y_LORONG_LOKET = 12.46;

/**
 * Tempat pembeli ke-k di loket ber-x tertentu: 0 = di jendela, 1–2 menunggu
 * berselang di belakangnya, 3–4 menunggu di kiri-kanan pembeli (saat jendela ramai).
 */
export function posisiPembeli(xLoket: number, k: number): Titik {
  if (k <= 0) return [xLoket, LOKET.yPembeli];
  if (k >= 3) return [xLoket + (k === 3 ? -0.22 : 0.22), LOKET.yPembeli + 0.02];
  return k === 1 ? [xLoket - 0.1, LOKET.yPembeli + 0.22] : [xLoket + 0.13, LOKET.yPembeli + 0.26];
}


/**
 * Labirin antrean di depan loket: tali pembatas keliling (masuk di pojok barat
 * daya, keluar ke loket di pojok timur laut) dan tiga lajur bergaris lantai
 * memanjang sumbu x, berjarak `jarak`. Tiap lajur muat dua baris berdampingan
 * (`kolom`, bergeser `geserKolom` dari sumbu lajur), jadi antrean bisa maju dua
 * kali lebih cepat dengan langkah biasa. Lajur 0 paling dekat loket dan berakhir
 * di timur (kepala antrean); antrean memanjang ke lajur 1, lalu lajur 2.
 */
export const LABIRIN = { xBarat: 18.95, xTimur: 22.47, yLajur: [12.8, 13.12, 13.44], jarak: 0.32, kolom: 2, geserKolom: 0.075 } as const;

/**
 * Urutan jendela loket dipakai (seiring loket yang disewa mitra PO) dan dibangun
 * (seiring tahap perluasan): yang terdekat ke kepala antrean (ujung timur
 * labirin) dulu. Dengan sedikit jendela pun jalan dari antrean ke jendela tetap
 * pendek, jadi loket tidak tampak macet padahal bukan bottleneck.
 */
export const URUTAN_LOKET: readonly number[] = X_LOKET.map((x, i) => ({ i, jarak: Math.abs(x - LABIRIN.xTimur) }))
  .sort((a, b) => a.jarak - b.jarak || a.i - b.i)
  .map((e) => e.i);
/** Slot per baris di dalam labirin (3 lajur × 12). */
export const JUMLAH_SLOT_LABIRIN = 36;
/** Slot luapan per baris: dari ekor labirin ke pintu masuk, lalu keluar berbaris ke barat menyusuri fasad. */
export const JUMLAH_SLOT_LUAPAN = 16;
/** Orang yang muat di dalam labirin (dua baris) dan di seluruh antrean termasuk luapan. */
export const JUMLAH_ORANG_LABIRIN = JUMLAH_SLOT_LABIRIN * LABIRIN.kolom;
export const KAPASITAS_ANTREAN = (JUMLAH_SLOT_LABIRIN + JUMLAH_SLOT_LUAPAN) * LABIRIN.kolom;
export const Y_LUAPAN = 15.78;
/** Titik di luar pintu masuk (di atas bordes), bagian dari lintasan antrean. */
export const TITIK_PINTU_LUAR: Titik = [PINTU_MASUK[0], BORDES.y1 - 0.05];

/**
 * Lintasan antrean dari kepala (s = 0) sampai ujung luapan. Slot ke-i berada
 * sejauh i × LABIRIN.jarak di sepanjang lintasan ini, jadi orang yang antre
 * selalu menyusuri lajur labirin dan tidak pernah menembus tali pembatas.
 */
export const JALUR_ANTREAN: readonly Titik[] = ((): Titik[] => {
  const { xBarat, xTimur, yLajur } = LABIRIN;
  const [y0, y1, y2] = yLajur;
  return [
    [xTimur, y0],
    [xBarat, y0],
    [xBarat, y1],
    [xTimur, y1],
    [xTimur, y2],
    [xBarat, y2],
    // Keluar labirin ke arah pintu masuk, lalu keluar gedung.
    [18.5, 13.95],
    [PINTU_MASUK[0], 14.7],
    TITIK_PINTU_LUAR,
    [17.8, Y_LUAPAN],
    [12.6, Y_LUAPAN],
  ];
})();

type Ruas = readonly [number, number, number, number];

/**
 * Tali pembatas labirin [x0, y0, x1, y1] (sejajar sumbu): keliling, dengan celah
 * masuk di pojok barat daya dan celah keluar (kepala antrean ke loket) di pojok
 * timur laut, serta tali di antara lajur dengan celah belokan bergantian di
 * barat dan timur. Semua orang di labirin, termasuk calon penumpang yang menuju
 * ujung antrean, menyusuri lajur berkelok; tidak ada yang memotong antarlajur.
 */
export const TALI_LABIRIN: readonly Ruas[] = ((): Ruas[] => {
  const { xBarat, xTimur, yLajur, jarak } = LABIRIN;
  const [y0, y1, y2] = yLajur;
  const h = jarak / 2;
  const xB = xBarat - 0.3;
  const xT = xTimur + 0.3;
  return [
    [xB, y0 - h, xTimur - 0.15, y0 - h], // utara: kepala antrean keluar di ujung timur
    [xBarat + 0.15, y2 + h, xT, y2 + h], // selatan: celah masuk di ujung barat
    [xB, y0 - h, xB, y2 + h], // barat
    [xT, y0 + h, xT, y2 + h], // timur
    [xBarat + 0.15, y0 + h, xT, y0 + h], // lajur 0 | 1: belokan di barat
    [xB, y1 + h, xTimur - 0.15, y1 + h], // lajur 1 | 2: belokan di timur
  ];
})();

/** Titik kumpul di plaza depan pintu masuk: di sini calon penumpang memilih ujung antrean yang dituju. */
export const MULUT_ANTREAN: Titik = [18.75, 16.15];

/**
 * Kursi ruang tunggu: dua blok di antara gerbang (lorong = garis gerbang), tiap
 * blok beberapa baris menghadap utara (ke gerbang). Titik kursi = posisi pinggul
 * orang duduk; sandaran di sisi selatan.
 */
export const KURSI = {
  /** Jarak antarkursi dalam satu baris. */
  jarak: 0.17,
  perBaris: 10,
  /** y baris terdepan (paling dekat gerbang) dan jarak antarbaris. */
  yBaris0: 7.35,
  jarakBaris: 0.4,
  jumlahBaris: 6,
} as const;

export interface BlokKursi {
  readonly x0: number;
  readonly x1: number;
}

/** Blok kursi berpusat di tengah antara tiap dua gerbang yang bersebelahan (barat → timur). */
export const BLOK_KURSI: readonly BlokKursi[] = ((): BlokKursi[] => {
  const g = [...GERBANG_X].sort((a, b) => a - b);
  const lebar = KURSI.jarak * KURSI.perBaris;
  return g.slice(1).map((x, i) => {
    const pusat = (g[i]! + x) / 2;
    return { x0: pusat - lebar / 2, x1: pusat + lebar / 2 };
  });
})();

export interface Kursi {
  readonly x: number;
  readonly y: number;
  readonly blok: number;
  readonly baris: number;
}

export const KURSI_TUNGGU: readonly Kursi[] = BLOK_KURSI.flatMap((b, blok) =>
  Array.from({ length: KURSI.jumlahBaris * KURSI.perBaris }, (_, i) => {
    const baris = Math.floor(i / KURSI.perBaris);
    const kolom = i % KURSI.perBaris;
    return { x: b.x0 + KURSI.jarak * (kolom + 0.5), y: KURSI.yBaris0 + baris * KURSI.jarakBaris, blok, baris };
  }),
);

/** Lorong di belakang baris kursi terakhir (jalan masuk dari pintu gedung ke blok kursi). */
export const Y_LORONG_TUNGGU = KURSI.yBaris0 + KURSI.jumlahBaris * KURSI.jarakBaris;
/** Titik di dalam ruang tunggu tepat di depan gerbang (antrean kecil sebelum keluar). */
export const Y_DEPAN_GERBANG = RUANG_TUNGGU.y0 + 0.35;

// ---------------------------------------------------------------------------
// Toko, ATM, kios, dan sayap barat (toilet & musholla): tempat singgah penumpang

/** Toko di sisi barat aula, menghadap selatan (penjaganya diletakkan di terminal3d). */
export const TOKO_AULA: readonly { readonly x0: number; readonly x1: number; readonly nama: string; readonly latar: string }[] = [
  { x0: 11.72, x1: 13.45, nama: 'MINIMARKET', latar: '#b91c1c' },
  { x0: 13.65, x1: 14.95, nama: 'APOTEK', latar: '#15803d' },
];
/** Muka toko (y) di sisi barat aula. */
export const Y_MUKA_TOKO = 12.05;
/** Pusat (x) mesin ATM di dinding utara aula. */
export const X_ATM: readonly number[] = [15.35, 15.7, 16.05];
/** Kios di ruang tunggu (rentang y), menempel dinding barat & menghadap timur. */
export const KIOS_TUNGGU: readonly (readonly [number, number])[] = [
  [6.95, 7.95],
  [8.15, 9.15],
  [9.35, 10.35],
];
/** Muka meja kios ruang tunggu (x). */
export const X_MUKA_KIOS = RUANG_TUNGGU.x0 + 0.785;

export type JenisKelamin = 'pria' | 'wanita';

/** Satu ruangan di sayap barat; `yPintu` = y pintu/bukaan masuknya (juga lorong di dalam ruangan). */
export interface RuangSayap extends Persegi {
  readonly yPintu: number;
}

/** Lorong sayap barat di sepanjang dinding aula; semua pintu ruangan menghadap ke lorong ini. */
export const LORONG_SAYAP = { x0: 10.8, x: 11.2 } as const;
/** Pintu dari aula ke lorong sayap (y tengah): [ke toilet, ke musholla], selebar LEBAR_PINTU_SAYAP. */
export const PINTU_SAYAP: readonly [number, number] = [12.85, 14.05];
export const LEBAR_PINTU_SAYAP = 0.34;
/** Garis x di aula (di depan dinding barat) untuk berjalan ke/dari pintu sayap. */
export const X_DEPAN_SAYAP = GEDUNG.x0 + 0.3;
/** Sekat antara tempat wudhu (timur) dan musholla (barat). */
const X_SEKAT_WUDHU = 9.4;

/**
 * Ruang sayap barat berderet utara → selatan: toilet pria, toilet wanita,
 * lalu wudhu+musholla pria dan wudhu+musholla wanita. Musholla di sisi barat
 * (kiblat ke barat), tempat wudhu di antara lorong dan musholla.
 */
export const RUANG_SAYAP: {
  readonly toilet: Readonly<Record<JenisKelamin, RuangSayap>>;
  readonly wudhu: Readonly<Record<JenisKelamin, RuangSayap>>;
  readonly musholla: Readonly<Record<JenisKelamin, RuangSayap>>;
} = {
  toilet: {
    pria: { x0: SAYAP_BARAT.x0, y0: 11.2, x1: LORONG_SAYAP.x0, y1: 12.2, yPintu: 11.8 },
    wanita: { x0: SAYAP_BARAT.x0, y0: 12.2, x1: LORONG_SAYAP.x0, y1: 13.2, yPintu: 12.8 },
  },
  wudhu: {
    pria: { x0: X_SEKAT_WUDHU, y0: 13.2, x1: LORONG_SAYAP.x0, y1: 14.1, yPintu: 13.7 },
    wanita: { x0: X_SEKAT_WUDHU, y0: 14.1, x1: LORONG_SAYAP.x0, y1: 15.0, yPintu: 14.6 },
  },
  musholla: {
    pria: { x0: SAYAP_BARAT.x0, y0: 13.2, x1: X_SEKAT_WUDHU, y1: 14.1, yPintu: 13.7 },
    wanita: { x0: SAYAP_BARAT.x0, y0: 14.1, x1: X_SEKAT_WUDHU, y1: 15.0, yPintu: 14.6 },
  },
};

/** Ukuran bilik toilet (lebar x, dalam y) di dinding utara tiap ruang toilet. */
export const BILIK = { lebar: 0.3, dalam: 0.4 } as const;

/** Pusat bilik toilet (x) dan jumlahnya: pria lebih sedikit (ada urinoir). */
export function xBilik(jk: JenisKelamin): number[] {
  const n = jk === 'pria' ? 6 : 8;
  return Array.from({ length: n }, (_, i) => SAYAP_BARAT.x0 + 0.25 + i * (BILIK.lebar + 0.02));
}
/** Urinoir di dinding utara toilet pria, di timur deretan bilik. */
export const X_URINOIR: readonly number[] = [9.2, 9.45, 9.7, 9.95];
/** Keran wastafel di dinding selatan tiap ruang toilet, dekat pintu. */
export const X_WASTAFEL: readonly number[] = [9.55, 9.85, 10.15, 10.45];
/** Keran wudhu di dinding utara tiap tempat wudhu. */
export const X_KERAN_WUDHU: readonly number[] = [9.6, 9.83, 10.06, 10.29, 10.52];
/** Shaf sajadah di musholla (x, dari dinding kiblat ke timur) dan tempat tiap orang dalam shaf (y relatif y0 ruangan). */
export const X_SHAF: readonly number[] = [6.95, 7.3, 7.65, 8.0, 8.35, 8.7];
export const DY_SAJADAH: readonly number[] = [0.2, 0.37, 0.54, 0.71];

// ---------------------------------------------------------------------------
// Tempat singgah & rute kunjungannya (murni; dunia-visual.ts yang menjalankan)

/**
 * Jenis kegiatan di satu titik singgah:
 * - diam: berdiri (belanja, ATM, wastafel, wudhu, urinoir);
 * - bilik: masuk bilik toilet (tidak terlihat);
 * - sholat: berdiri & duduk bergantian menghadap kiblat.
 */
export type GayaSinggah = 'diam' | 'bilik' | 'sholat';

/** Satu titik singgah: tempat berdiri + jalan masuk/keluar dari lorong ruangannya. */
export interface TitikSinggah {
  /** Jalan dari lorong ruangan ke tempat berdiri (langkah terakhir menentukan arah hadap). */
  readonly masuk: readonly Titik[];
  /** Jalan kembali ke lorong ruangan. */
  readonly keluar: readonly Titik[];
  readonly gaya: GayaSinggah;
}

/** Kelompok titik singgah yang setara (mis. semua bilik toilet wanita); satu orang per titik. */
export interface KelompokSinggah {
  readonly nama: string;
  readonly titik: readonly TitikSinggah[];
  /** Lama singgah [min, maks] detik main. */
  readonly lama: readonly [number, number];
}

const titik = (lorong: Titik, jalan: readonly Titik[], gaya: GayaSinggah = 'diam'): TitikSinggah => ({
  masuk: [lorong, ...jalan],
  keluar: [...jalan].reverse().slice(1).concat([lorong]),
  gaya,
});

function kelompokToilet(jk: JenisKelamin): { bilik: KelompokSinggah; wastafel: KelompokSinggah; urinoir: KelompokSinggah | null } {
  const r = RUANG_SAYAP.toilet[jk];
  const yLorong = r.yPintu;
  const yBilik = r.y0 + 0.2;
  const yWastafel = r.y1 - 0.2;
  return {
    bilik: { nama: `bilik ${jk}`, lama: [9, 18], titik: xBilik(jk).map((x) => titik([x, yLorong], [[x, yBilik]], 'bilik')) },
    wastafel: { nama: `wastafel ${jk}`, lama: [3, 5], titik: X_WASTAFEL.map((x) => titik([x, yLorong], [[x, yWastafel]])) },
    urinoir: jk === 'pria' ? { nama: 'urinoir', lama: [5, 8], titik: X_URINOIR.map((x) => titik([x, yLorong], [[x, r.y0 + 0.17]])) } : null,
  };
}

function kelompokMusholla(jk: JenisKelamin): { wudhu: KelompokSinggah; sholat: KelompokSinggah } {
  const w = RUANG_SAYAP.wudhu[jk];
  const m = RUANG_SAYAP.musholla[jk];
  const yKeran = w.y0 + 0.22;
  return {
    wudhu: { nama: `wudhu ${jk}`, lama: [8, 12], titik: X_KERAN_WUDHU.map((x) => titik([x, w.yPintu], [[x, yKeran]])) },
    // Masuk lewat bukaan sekat, menyusuri sisi timur shaf, lalu melangkah ke barat ke sajadah (menghadap kiblat).
    sholat: {
      nama: `musholla ${jk}`,
      lama: [26, 40],
      titik: X_SHAF.flatMap((x) => DY_SAJADAH.map((dy) => titik([X_SEKAT_WUDHU - 0.2, m.yPintu], [[x + 0.15, m.yPintu], [x + 0.15, m.y0 + dy], [x, m.y0 + dy]], 'sholat'))),
    },
  };
}

/** Kelompok titik singgah per tempat. */
export const SINGGAH = {
  toilet: { pria: kelompokToilet('pria'), wanita: kelompokToilet('wanita') },
  musholla: { pria: kelompokMusholla('pria'), wanita: kelompokMusholla('wanita') },
  atm: { nama: 'ATM', lama: [7, 12], titik: X_ATM.map((x) => titik([x, Y_LORONG_LOKET], [[x, 11.66]])) } as KelompokSinggah,
  minimarket: {
    nama: 'minimarket',
    lama: [7, 12],
    titik: [TOKO_AULA[0]!.x0 + 0.2, TOKO_AULA[0]!.x0 + 0.8].map((x) => titik([TOKO_AULA[0]!.x0 + 0.47, Y_LORONG_LOKET], [[TOKO_AULA[0]!.x0 + 0.47, 11.92], [x, 11.88]])),
  } as KelompokSinggah,
  apotek: {
    nama: 'apotek',
    lama: [6, 10],
    titik: [TOKO_AULA[1]!.x0 + 0.47].map((x) => titik([x, Y_LORONG_LOKET], [[x, 11.9]])),
  } as KelompokSinggah,
  // Kios ruang tunggu: dua pembeli per kios, melangkah terakhir ke barat (menghadap penjual).
  kios: KIOS_TUNGGU.map(([ya, yb], i): KelompokSinggah => ({
    nama: `kios ${i + 1}`,
    lama: [6, 11],
    titik: [ya + 0.28, yb - 0.28].map((y) => titik([X_MUKA_KIOS + 0.45, Y_LORONG_TUNGGU], [[X_MUKA_KIOS + 0.45, y], [X_MUKA_KIOS + 0.25, y]])),
  })),
} as const;

/** Dari lorong loket (di x tertentu) ke dalam lorong sayap lewat pintu aula ke-i, lalu ke pintu ruangan (y). */
export function ruteMasukSayap(i: 0 | 1, yRuang: number): Titik[] {
  const y = PINTU_SAYAP[i];
  return [
    [X_DEPAN_SAYAP, Y_LORONG_LOKET],
    [X_DEPAN_SAYAP, y],
    [LORONG_SAYAP.x, y],
    [LORONG_SAYAP.x, yRuang],
    [LORONG_SAYAP.x0 - 0.25, yRuang],
  ];
}

/** Kebalikan ruteMasukSayap: dari dalam ruangan kembali ke lorong loket. */
export function ruteKeluarSayap(i: 0 | 1, yRuang: number): Titik[] {
  return ruteMasukSayap(i, yRuang).reverse();
}

/**
 * Batas orang di model keramaian. Karena orang berjalan dengan laju alami,
 * tiap orang lebih lama di layar, jadi kerumunannya lebih ramai.
 */
export const MAKS_ORANG = 480;
/**
 * Laju jalan orang (petak/detik), sama dengan rata-rata pejalan kaki di trotoar:
 * langkah alami ±2,5 langkah/detik (lihat SIKLUS_LANGKAH di orang3d.ts).
 * Tiap orang sedikit berbeda (± VARIASI_JALAN) supaya tidak berjalan serempak.
 */
export const KECEPATAN_JALAN = 0.45;
export const VARIASI_JALAN = 0.12;

// ---------------------------------------------------------------------------
// Zona tiap area (sorotan bottleneck, label)

/** Balok (lantai + tinggi, unit) yang membentuk sebuah zona. Tinggi 0 = hanya lantai. */
export interface BalokZona extends Persegi {
  readonly tinggi: number;
  /** Tinggi lantai area ini (sorotan bottleneck digambar di atasnya). Bawaan 0. */
  readonly hLantai?: number;
  /** Lantai terlihat dari kamera (sorotan & garis tepi digambar). Bawaan: tinggi ≤ 2. */
  readonly sorot?: boolean;
}

export interface Zona {
  /** Area untuk sorotan bottleneck. */
  readonly balok: readonly BalokZona[];
  /** Titik dunia (x, y, tinggi) tempat label nama area. */
  readonly label: readonly [number, number, number];
}

export const ZONA: Readonly<Record<AreaId, Zona>> = {
  peron: {
    balok: [{ x0: PERON.x0 - 0.2, y0: 4.4, x1: PERON.x1 + 0.2, y1: 7.2, tinggi: 1.5 }],
    label: [(PERON.x0 + PERON.x1) / 2, 5.8, 1.9],
  },
  loket: {
    balok: [
      // Lantai aula loket (labirin antrean + deretan jendela), terlihat lewat atap kaca.
      {
        x0: LABIRIN.xBarat - 0.4,
        y0: GEDUNG.y0 + 0.08,
        x1: X_LOKET[X_LOKET.length - 1]! + LOKET.setengahLebar,
        y1: LABIRIN.yLajur[2] + 0.22,
        tinggi: 0,
        hLantai: TINGGI_LANTAI_GEDUNG,
        sorot: true,
      },
      { x0: GEDUNG.x0, y0: GEDUNG.y0, x1: GEDUNG.x1, y1: GEDUNG.y1, tinggi: 3.0, sorot: false },
      // Atrium di tengah gedung (lihat ATRIUM di gedung3d.ts).
      { x0: PINTU_MASUK[0] - 1.6, y0: GEDUNG.y0 + 1.0, x1: PINTU_MASUK[0] + 1.6, y1: GEDUNG.y1 - 0.3, tinggi: 4.3, sorot: false },
    ],
    label: [PINTU_MASUK[0], GEDUNG.y1 - 0.3, 4.45],
  },
  keberangkatan: {
    balok: [
      { x0: RUANG_TUNGGU.x0, y0: 4.4, x1: RUANG_TUNGGU.x1, y1: RUANG_TUNGGU.y0, tinggi: 1.5 },
      { ...RUANG_TUNGGU, tinggi: 2.45, hLantai: TINGGI_PERON, sorot: true },
    ],
    label: [(RUANG_TUNGGU.x0 + RUANG_TUNGGU.x1) / 2, 6.0, 2.7],
  },
  // Pangkalan: label melayang di atas atap bus yang parkir (hanya tampil saat paling lambat, lihat zona3d.ts).
  pangkalan: {
    balok: [{ ...PANGKALAN, tinggi: 1.0 }],
    label: [(PANGKALAN.x0 + PANGKALAN.x1) / 2, PARKIR_SERONG.pusatY, 1.3],
  },
};

/** Titik-titik inti (x, y, tinggi) yang harus muat di tampilan awal kamera (landscape: seluruh terminal). */
export const TITIK_INTI: readonly (readonly [number, number, number])[] = [
  [PERON.x0, PERON.y1, 0],
  [PERON.x0, JALAN.y0, 0],
  [RUANG_TUNGGU.x1, LAJUR.sirkulasi, 0],
  [RUANG_TUNGGU.x1, RUANG_TUNGGU.y1, 0],
  // Mulut antrean dan ujung baris luapan di luar pintu masuk.
  [MULUT_ANTREAN[0], MULUT_ANTREAN[1] + 0.3, 0],
  [15.4, Y_LUAPAN, 0],
  [PINTU_MASUK[0], GEDUNG.y1 - 0.4, 4.25],
];

/**
 * Portrait lebih sempit: tampilan awal memuat pangkalan, gedung utama, dan
 * ruang tunggu; peron kedatangan di barat tinggal digeser.
 */
export const TITIK_INTI_POTRET: readonly (readonly [number, number, number])[] = [
  [PULAU_JURUSAN[1]! - 1, PANGKALAN.y0, 0],
  [PULAU_JURUSAN[1]! - 1, JALAN.y0, 0],
  ...TITIK_INTI.slice(2),
];

const di = (x: number, y: number, a: Persegi): boolean => x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1;

/** Orang di titik ini berdiri di lantai setinggi peron (peron kedatangan, peron keberangkatan, ruang tunggu). */
export function diPeron(x: number, y: number): boolean {
  return di(x, y, PERON) || di(x, y, PERON_BERANGKAT) || di(x, y, RUANG_TUNGGU);
}

/** Titik ini di dalam aula gedung utama. */
export function diGedung(x: number, y: number): boolean {
  return di(x, y, GEDUNG);
}

/**
 * Tinggi lantai bangunan tempat orang berpijak: peron & ruang tunggu, aula
 * gedung utama, atau bordes landai di depan pintu masuk. null = di luar bangunan.
 */
export function tinggiLantai(x: number, y: number): number | null {
  if (diPeron(x, y)) return TINGGI_PERON;
  if (di(x, y, GEDUNG) || di(x, y, SAYAP_BARAT)) return TINGGI_LANTAI_GEDUNG;
  if (di(x, y, BORDES)) return (TINGGI_LANTAI_GEDUNG * (BORDES.y1 - y)) / (BORDES.y1 - BORDES.y0);
  return null;
}
