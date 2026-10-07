/**
 * Cuaca terminal (murni tampilan): berapa hari hujan dalam sepekan, kapan
 * turunnya, seberapa deras, dan seberapa sering petir. Tiap pekan (Senin–Minggu)
 * diacak dari benih cuaca di save, jadi berbeda di tiap game tapi tetap sama
 * saat game dibuka ulang.
 */
export interface WaktuHujan {
  readonly nama: 'pagi' | 'siang' | 'malam';
  /** Bobot peluang hujan turun di waktu ini (relatif terhadap waktu lain). */
  readonly bobot: number;
  /** Rentang jam mulai [awal, akhir). */
  readonly mulai: readonly [number, number];
  /** Rentang lama hujan (jam). Hujan selalu reda sebelum pergantian hari. */
  readonly lama: readonly [number, number];
  /** Rentang puncak intensitas (0–1). */
  readonly deras: readonly [number, number];
}

export interface KonfigCuaca {
  /** Jumlah hari hujan dalam sepekan dan bobot peluangnya: [jumlah hari, bobot]. */
  readonly hariHujanPerPekan: readonly (readonly [number, number])[];
  /** Waktu hujan pada hari yang hujan (satu kali hujan per hari). */
  readonly waktu: readonly WaktuHujan[];
  /** Hujan paling lambat reda pada jam ini (supaya hari hujan tidak meluber ke hari berikutnya). */
  readonly redaSebelumJam: number;
  /** Hujan menguat & mereda selama sekian jam di awal/akhir. */
  readonly landai: number;
  /** Langit mulai mendung sekian jam sebelum hujan dan cerah kembali sekian jam sesudahnya. */
  readonly mendungSebelum: number;
  readonly mendungSesudah: number;
  /** Petir: dicek per slot sekian detik main; hanya saat hujan cukup deras. */
  readonly slotPetirDetik: number;
  readonly ambangPetir: number;
  /** Peluang petir per slot saat hujan paling deras. */
  readonly peluangPetir: number;
}

export const CUACA: KonfigCuaca = {
  hariHujanPerPekan: [
    [1, 0.3],
    [2, 0.45],
    [3, 0.25],
  ],
  waktu: [
    // Gerimis sampai hujan sedang di pagi hari.
    { nama: 'pagi', bobot: 0.3, mulai: [5, 9], lama: [1, 2.5], deras: [0.3, 0.7] },
    // Hujan siang–sore, paling deras, sering disertai petir.
    { nama: 'siang', bobot: 0.4, mulai: [11.5, 15.5], lama: [1.2, 3], deras: [0.55, 1] },
    { nama: 'malam', bobot: 0.3, mulai: [18.5, 21.3], lama: [1, 2.5], deras: [0.35, 0.85] },
  ],
  redaSebelumJam: 23.8,
  landai: 0.35,
  mendungSebelum: 1,
  mendungSesudah: 0.6,
  slotPetirDetik: 6,
  ambangPetir: 0.6,
  peluangPetir: 0.3,
};
