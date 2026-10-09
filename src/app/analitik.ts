/**
 * Analitik permainan (murni): nama peristiwa & datanya, pemetaan aksi pemain
 * ke peristiwa, dan penyaring peristiwa yang cukup dicatat sekali per sesi.
 * Penyedia sungguhan (Google Analytics 4 lewat gtag.js) ada di
 * platform/analitik.ts; tanpa ID pengukuran semua peristiwa diabaikan.
 *
 * Tujuannya mengukur corong pemain baru (tutorial → jendela loket → PO kedua →
 * petugas peron → Jalur 2) dan hal yang membuat pemain bertahan. Retensi
 * (kembali esok hari / minggu depan) dihitung GA4 sendiri dari kunjungan.
 * Kejadian yang sering (bus datang, penumpang naik, uang masuk) tidak dicatat
 * satu per satu: cukup ringkasan tiap sesi (ringkasanSesi). Error dilaporkan
 * sebagai peristiwa `exception` GA4. Tidak ada data pribadi yang dikirim.
 */
import type { Aksi } from '../sim/aksi';
import { jurusanDilayani, kelasTerminal, kepuasanTerminal, levelTerminal, type GameState } from '../sim/state';

export type NilaiAnalitik = string | number | boolean;
export type DataAnalitik = Readonly<Record<string, NilaiAnalitik>>;

export interface PeristiwaAnalitik {
  readonly nama: string;
  readonly data?: DataAnalitik;
}

export interface Analitik {
  catat(nama: string, data?: DataAnalitik): void;
}

export const TANPA_ANALITIK: Analitik = { catat: () => {} };

/**
 * Peristiwa yang cukup dicatat sekali per sesi untuk data yang sama (mis. klakson telolet
 * pertama, tarif terminal: pemain biasanya mengetuk +/− berkali-kali).
 */
const SEKALI_PER_SESI: ReadonlySet<string> = new Set(['telolet', 'atur_tarif', 'saran_tarif']);

/** Rupiah → juta, satu desimal (angka besar tetap enak dibandingkan di dasbor). */
const juta = (rp: number): number => Math.round(rp / 1e5) / 10;

/** Nilai parameter GA4 paling panjang sekian karakter. */
const MAKS_TEKS_GA4 = 100;
/** Error yang dilaporkan paling banyak sekian per sesi (yang sama hanya sekali). */
export const MAKS_GALAT_PER_SESI = 10;

/** Pesan dari nilai yang dilempar: Error ("TypeError: …"), string, atau lainnya. */
export function pesanGalat(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e) ?? String(e);
  } catch {
    return String(e);
  }
}

/** Ringkasan error untuk peristiwa `exception` GA4: pesan satu baris + berkas:baris, ≤ 100 karakter. */
export function ringkasGalat(pesan: string, sumber?: string, baris?: number): string {
  const berkas = sumber ? (sumber.split(/[?#]/)[0] ?? '').split('/').pop() ?? '' : '';
  const lokasi = berkas ? ` @${berkas}${baris ? `:${baris}` : ''}` : '';
  const teks = `${pesan.replace(/\s+/g, ' ').trim() || 'Error'}${lokasi}`;
  return teks.length > MAKS_TEKS_GA4 ? `${teks.slice(0, MAKS_TEKS_GA4 - 1)}…` : teks;
}

/**
 * Ringkasan satu sesi main (dari `awal` sampai `akhir`): lama, penumpang,
 * pendapatan & laba (juta Rp), jumlah unit yang dibangun, dan keadaan terminal
 * di akhir sesi. Untuk dasbor GA4: penumpang & laba per sesi, sebaran
 * kelas/jalur/petugas/kepuasan.
 */
export function ringkasanSesi(awal: GameState, akhir: GameState, bangun: number, detikNyata: number): DataAnalitik {
  const a = awal.statistik;
  const z = akhir.statistik;
  const pendapatan = z.totalPendapatan - a.totalPendapatan;
  return {
    detik: Math.max(0, Math.round(detikNyata)),
    detik_main: Math.max(0, Math.round(z.waktuMainDetik - a.waktuMainDetik)),
    penumpang: Math.max(0, Math.round(z.totalPenumpang - a.totalPenumpang)),
    pendapatan_juta: juta(pendapatan),
    laba_juta: juta(pendapatan - (z.totalBiaya - a.totalBiaya)),
    bangun,
    kas_juta: juta(akhir.kas),
    kelas: kelasTerminal(akhir),
    level_terminal: levelTerminal(akhir),
    jalur: akhir.terminal.bangunan.jalur,
    jurusan: jurusanDilayani(akhir).filter(Boolean).length,
    po: akhir.mitra.terdaftar.length,
    petugas: akhir.terminal.petugas.length,
    kepuasan: Math.round(kepuasanTerminal(akhir).nilai * 100),
  };
}

/** Peristiwa dari satu aksi pemain yang berlaku (state berubah). */
export function peristiwaAksi(aksi: Aksi, lama: GameState, baru: GameState): PeristiwaAnalitik[] {
  if (baru === lama) return [];
  switch (aksi.jenis) {
    case 'bangun':
      return [{ nama: 'bangun', data: { bangunan: aksi.bangunan, jumlah: baru.terminal.bangunan[aksi.bangunan] } }];
    case 'bongkar':
      return [{ nama: 'bongkar', data: { bangunan: aksi.bangunan, jumlah: baru.terminal.bangunan[aksi.bangunan] } }];
    case 'rekrut':
      return [{ nama: 'rekrut', data: { petugas: aksi.petugas, jumlah: baru.terminal.petugas.filter((p) => p === aksi.petugas).length } }];
    case 'berhentikan':
      return [{ nama: 'berhentikan', data: { petugas: aksi.petugas } }];
    case 'aturTarif':
      return [{ nama: 'atur_tarif', data: { tarif: aksi.tarif } }];
    case 'saranTarif':
      return [{ nama: 'saran_tarif', data: { tarif: aksi.tarif } }];
    case 'beliTeknologi':
      return [{ nama: 'beli_teknologi', data: { teknologi: aksi.teknologi } }];
    case 'isiJendelaKosong':
      return [];
    case 'daftarPo':
      return [{ nama: 'daftar_po', data: { po: aksi.po, jumlah: baru.mitra.terdaftar.length } }];
    case 'putusPo':
      return [{ nama: 'putus_po', data: { po: aksi.po } }];
    case 'perpanjangPo':
      return [{ nama: 'perpanjang_po', data: { po: aksi.po } }];
    case 'mulaiPerluasan':
      return [{ nama: 'mulai_perluasan', data: { tahap: baru.perkembangan.perluasan + 1 } }];
    case 'klaimEvent':
      return [{ nama: 'klaim_event', data: { edisi: lama.event.edisi ?? '', tahap: baru.event.diklaim } }];
    case 'klaimTantangan':
      return [{ nama: 'klaim_tantangan', data: { jenis: lama.tantangan.daftar[aksi.indeks]?.jenis ?? '', minggu: lama.tantangan.minggu ?? '' } }];
    case 'klaimTarget':
      return [{ nama: 'klaim_target', data: { ganda: aksi.ganda === true } }];
    case 'klaimPencapaian':
      return [{ nama: 'klaim_penghargaan', data: { penghargaan: aksi.pencapaian, ganda: aksi.ganda === true } }];
    case 'aktifkanBoost':
      return [{ nama: 'hadiah_boost' }];
    case 'klaimBusEmas':
      return [{ nama: 'hadiah_bus_emas' }];
    case 'klaimBonusOffline':
      return [{ nama: 'hadiah_offline_2x' }];
    case 'aturNamaTerminal':
      // Namanya sendiri tidak pernah dikirim.
      return [{ nama: 'nama_terminal', data: { ada: baru.profil.namaTerminal !== '' } }];
    case 'aturIkutPeringkat':
      return [{ nama: baru.profil.ikutPeringkat ? 'peringkat_ikut' : 'peringkat_keluar' }];
    case 'tahanBusEmas':
    case 'lepasBusEmas':
      return [];
  }
}

/** Pencatat untuk satu sesi: menyaring peristiwa sekali-per-sesi lalu meneruskannya ke penyedia. */
export class PencatatAnalitik implements Analitik {
  private readonly sudah = new Set<string>();
  private readonly galat = new Set<string>();
  /** Unit & modernisasi yang dibangun sejak ringkasan sesi terakhir. */
  private jumlahBangun = 0;

  constructor(private readonly tujuan: Analitik) {}

  catat(nama: string, data?: DataAnalitik): void {
    if (SEKALI_PER_SESI.has(nama)) {
      const kunci = `${nama}:${JSON.stringify(data ?? {})}`;
      if (this.sudah.has(kunci)) return;
      this.sudah.add(kunci);
    }
    this.tujuan.catat(nama, data);
  }

  catatAksi(aksi: Aksi, lama: GameState, baru: GameState): void {
    if ((aksi.jenis === 'bangun' || aksi.jenis === 'beliTeknologi') && baru !== lama) this.jumlahBangun++;
    for (const p of peristiwaAksi(aksi, lama, baru)) this.catat(p.nama, p.data);
  }

  /** Laporkan error (peristiwa `exception` GA4): tiap pesan sekali, paling banyak MAKS_GALAT_PER_SESI per sesi. */
  catatGalat(pesan: string, sumber?: string, baris?: number, fatal = false): void {
    const description = ringkasGalat(pesan, sumber, baris);
    if (this.galat.has(description) || this.galat.size >= MAKS_GALAT_PER_SESI) return;
    this.galat.add(description);
    this.tujuan.catat('exception', { description, fatal });
  }

  /** Kirim ringkasan sesi (lihat ringkasanSesi) lalu mulai menghitung sesi berikutnya. */
  catatRingkasanSesi(awal: GameState, akhir: GameState, detikNyata: number): void {
    this.tujuan.catat('ringkasan_sesi', ringkasanSesi(awal, akhir, this.jumlahBangun, detikNyata));
    this.jumlahBangun = 0;
  }
}
