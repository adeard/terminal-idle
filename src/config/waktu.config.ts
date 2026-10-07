/**
 * Jam terminal: siang–malam, hari Senin–Minggu, jam 24 jam. Mengatur
 * pencahayaan adegan, HUD, dan ritme keramaian (yang juga menentukan
 * permintaan penumpang di ekonomi). Jam berjalan dari waktu main aktif
 * (statistik.waktuMainDetik), jadi ikut tersimpan di save dan berhenti saat
 * game ditutup.
 */
export interface KonfigWaktu {
  /** Detik nyata untuk satu jam di terminal (60 → satu hari = 24 menit nyata). */
  readonly detikPerJam: number;
  /** Jam terminal saat game baru dimulai (hari pertama = Senin). */
  readonly jamAwal: number;
  /** Matahari terbit & terbenam (jam), batas siang–malam di HUD. */
  readonly jamTerbit: number;
  readonly jamTerbenam: number;
}

/**
 * Pilihan kecepatan permainan (pengali waktu main): jam terminal, bus, orang,
 * dan simulasi (termasuk pendapatan per detik nyata) berjalan sekian kali lebih
 * cepat. Penghasilan offline tetap dihitung dari waktu nyata.
 */
export const PILIHAN_KECEPATAN: readonly number[] = [1, 2, 3];

export const WAKTU: KonfigWaktu = {
  detikPerJam: 60,
  jamAwal: 6,
  jamTerbit: 6,
  jamTerbenam: 18,
};

/**
 * Ritme keramaian penumpang sepanjang hari (0–1, 1 = jam sibuk tersibuk).
 * Mengatur berapa banyak bus & calon penumpang yang datang di adegan (lihat
 * game/laju.ts) dan, dilandaikan (`permintaan.ritmeMin` di economy.config.ts),
 * permintaan penumpang di ekonomi: malam berangsur sepi, arus & pendapatan ikut
 * turun. Kapasitas tahap tidak berubah.
 */
export interface KonfigRitme {
  /** Keramaian hari biasa per jam [jam, keramaian], diinterpolasi halus; jam 24 = jam 0. */
  readonly jam: readonly (readonly [number, number])[];
  /**
   * Penyesuaian per hari (indeks 0 = Senin): [jamMulai, jamSelesai, tambahan].
   * Tepi rentang dilandaikan ±1,5 jam; jangan melewati tengah malam.
   */
  readonly hari: readonly (readonly (readonly [number, number, number])[])[];
  /** Batas bawah label HUD: jam sibuk, ramai, sedang (di bawahnya sepi). */
  readonly ambangLabel: { readonly sibuk: number; readonly ramai: number; readonly sedang: number };
}

export const RITME: KonfigRitme = {
  jam: [
    [0, 0.16],
    [2, 0.11],
    [4, 0.14],
    [5, 0.36],
    [6, 0.7],
    [7.25, 0.9],
    [8.5, 0.84],
    [10, 0.62],
    [12, 0.56],
    [14, 0.6],
    [16, 0.8],
    [17.5, 0.9],
    [19, 0.78],
    [20.5, 0.6],
    [22, 0.36],
    [23, 0.24],
    [24, 0.16],
  ],
  hari: [
    [[4, 10, 0.15]], // Senin pagi: arus balik ke kota
    [],
    [],
    [],
    [[13, 21, 0.15]], // Jumat sore: pulang akhir pekan
    [[7, 15, 0.12]], // Sabtu: bepergian & wisata
    [
      [5, 10, -0.12], // Minggu pagi lengang
      [13, 22, 0.15], // Minggu sore: arus balik
    ],
  ],
  ambangLabel: { sibuk: 0.85, ramai: 0.6, sedang: 0.35 },
};
