/**
 * Jadwal keberangkatan di papan jadwal (aula & ruang tunggu): diambil dari bus
 * yang benar-benar ada di terminal. Tiap bus mendapat jam berangkat tetap
 * begitu diparkir di pangkalan jurusannya (perkiraan: sisa cuci + menunggu
 * jadwal + perjalanan ke halte + ngetem, dibulatkan ke atas per 5 menit), lalu
 * statusnya mengikuti keadaan bus: PERSIAPAN (dicuci/menunggu), SIAP (menuju
 * jalur), NAIK (memuat penumpang), BERANGKAT, atau TERLAMBAT bila jam
 * jadwalnya sudah lewat sebelum bus mulai memuat. Murni supaya bisa dites.
 */
import { WAKTU } from '../config/waktu.config';
import type { BusVisual } from './dunia-visual';
import { CUCI, ISTIRAHAT_DETIK, MAKS_NGETEM_DETIK, TUJUAN_BUS } from './tata-letak';

export type StatusJadwal = 'NAIK' | 'SIAP' | 'PERSIAPAN' | 'BERANGKAT' | 'TERLAMBAT';

export interface BarisJadwal {
  readonly busId: number;
  /** "HH.MM". */
  readonly jam: string;
  readonly tujuan: string;
  /** Nomor jalur (halte keberangkatan), "-" kalau belum ditentukan. */
  readonly jalur: string;
  readonly status: StatusJadwal;
}

/** Perkiraan waktu perjalanan pangkalan → halte keberangkatan (detik main). */
const DETIK_KE_HALTE = 12;
/** Jadwal dibulatkan ke atas ke kelipatan sekian menit terminal. */
const PEMBULATAN_MENIT = 5;

const duaDigit = (n: number): string => String(n).padStart(2, '0');

/** Jam mutlak (sejak hari 0) → "HH.MM" dalam 24 jam. */
export function formatJamJadwal(jamMutlak: number): string {
  const menitTotal = Math.round(jamMutlak * 60);
  const menitHari = ((menitTotal % 1440) + 1440) % 1440;
  return `${duaDigit(Math.floor(menitHari / 60))}.${duaDigit(menitHari % 60)}`;
}

/** Sisa detik main sampai bus ini (perkiraan) berangkat, dari keadaannya sekarang. */
export function perkiraanSisaDetik(b: BusVisual): number {
  switch (b.fase) {
    case 'parkir':
      return (1 - b.cuci) * CUCI.detik + (1 - b.istirahat) * ISTIRAHAT_DETIK + DETIK_KE_HALTE + MAKS_NGETEM_DETIK;
    case 'keHalteBerangkat':
      return DETIK_KE_HALTE / 2 + MAKS_NGETEM_DETIK;
    case 'muat':
      return Math.max(0, MAKS_NGETEM_DETIK - b.tunggu);
    default:
      return 0;
  }
}

export class JadwalKeberangkatan {
  /** Jam mutlak (sejak hari 0 pukul 00.00) jadwal tiap bus. */
  private readonly jadwal = new Map<number, number>();

  /**
   * @param jamMutlak jam terminal sekarang (sejak hari 0 pukul 00.00)
   * @param maks jumlah baris paling banyak (urut jam berangkat)
   */
  perbarui(bus: readonly BusVisual[], jamMutlak: number, maks = 5): BarisJadwal[] {
    const ada = new Set<number>();
    const baris: { jam: number; b: BarisJadwal }[] = [];
    for (const b of bus) {
      if (b.jenis !== 'terminal' || b.tujuan < 0) continue;
      const berangkat = b.fase === 'keluar';
      const terjadwal = b.fase === 'parkir' || b.fase === 'keHalteBerangkat' || b.fase === 'muat';
      if (!terjadwal && !(berangkat && this.jadwal.has(b.id))) continue;
      ada.add(b.id);
      let jam = this.jadwal.get(b.id);
      if (jam === undefined) {
        const perkiraan = jamMutlak + perkiraanSisaDetik(b) / WAKTU.detikPerJam;
        jam = Math.ceil((perkiraan * 60) / PEMBULATAN_MENIT) * (PEMBULATAN_MENIT / 60);
        this.jadwal.set(b.id, jam);
      }
      // Bus yang sedang memuat selalu NAIK (walau lewat jadwal); selain itu lewat jadwal = TERLAMBAT.
      const status: StatusJadwal = berangkat
        ? 'BERANGKAT'
        : b.fase === 'muat'
          ? 'NAIK'
          : jamMutlak > jam + 1e-9
            ? 'TERLAMBAT'
            : b.fase === 'keHalteBerangkat'
              ? 'SIAP'
              : 'PERSIAPAN';
      baris.push({
        jam,
        b: {
          busId: b.id,
          jam: formatJamJadwal(jam),
          tujuan: TUJUAN_BUS[b.tujuan] ?? '-',
          jalur: b.halte >= 0 && (b.fase === 'muat' || b.fase === 'keHalteBerangkat') ? String(b.halte + 1) : '-',
          status,
        },
      });
    }
    for (const id of [...this.jadwal.keys()]) if (!ada.has(id)) this.jadwal.delete(id);
    baris.sort((a, c) => a.jam - c.jam || a.b.busId - c.b.busId);
    return baris.slice(0, maks).map((x) => x.b);
  }
}
