/**
 * Analitik permainan (murni): nama peristiwa & datanya, pemetaan aksi pemain
 * ke peristiwa, dan penyaring peristiwa yang cukup dicatat sekali per sesi.
 * Penyedia sungguhan (Google Analytics 4 lewat gtag.js) ada di
 * platform/analitik.ts; tanpa ID pengukuran semua peristiwa diabaikan.
 *
 * Tujuannya mengukur corong pemain baru (tutorial → upgrade → Kepala →
 * fasilitas → Jalur 2) dan hal yang membuat pemain bertahan. Retensi
 * (kembali esok hari / minggu depan) dihitung GA4 sendiri dari kunjungan.
 * Kejadian yang sering (bus datang, penumpang naik, uang masuk) tidak dicatat
 * satu per satu: cukup ringkasan tiap sesi (ringkasanSesi). Error dilaporkan
 * sebagai peristiwa `exception` GA4. Tidak ada data pribadi yang dikirim.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import type { Aksi } from '../sim/aksi';
import { kepuasanTerminal, type GameState } from '../sim/state';
import { TAHAP_IDS } from '../sim/tahap';

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

/** Level tahap & fasilitas yang dicatat (bukan tiap upgrade, supaya data tidak banjir). */
export const TONGGAK_LEVEL: ReadonlySet<number> = new Set([2, 5, 10, 25, 50, 100, 150, 200, 300, 400, 500]);

/**
 * Peristiwa yang cukup dicatat sekali per sesi untuk data yang sama (mis. klakson telolet
 * pertama, harga tiket tiap jurusan/kelas: pemain biasanya mengetuk +/− berkali-kali).
 */
const SEKALI_PER_SESI: ReadonlySet<string> = new Set(['telolet', 'atur_harga']);

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
 * orde pendapatan (log10, angka besar tetap bisa dibandingkan), jumlah
 * upgrade, dan keadaan terminal di akhir sesi. Untuk dasbor GA4: penumpang &
 * pendapatan per sesi, sebaran kelas/jalur/kepuasan.
 */
export function ringkasanSesi(awal: GameState, akhir: GameState, upgrade: number, detikNyata: number): DataAnalitik {
  const pendapatan = akhir.statistik.totalPendapatanSepanjangMasa.sub(awal.statistik.totalPendapatanSepanjangMasa);
  const level = TAHAP_IDS.reduce((a, id) => a + akhir.terminal.tahap[id].level, 0) / TAHAP_IDS.length;
  return {
    detik: Math.max(0, Math.round(detikNyata)),
    detik_main: Math.max(0, Math.round(akhir.statistik.waktuMainDetik - awal.statistik.waktuMainDetik)),
    penumpang: Math.max(0, Math.round(akhir.statistik.totalPenumpang - awal.statistik.totalPenumpang)),
    pendapatan_log10: pendapatan.gt(1) ? Math.round(pendapatan.log10() * 10) / 10 : 0,
    upgrade,
    kelas: akhir.prestige.jumlahReset,
    jalur: akhir.terminal.jalur,
    jurusan: akhir.terminal.jurusanBuka,
    level_rata: Math.round(level),
    kepuasan: Math.round(kepuasanTerminal(akhir).nilai * 100),
  };
}

/** Peristiwa dari satu aksi pemain yang berlaku (state berubah). */
export function peristiwaAksi(aksi: Aksi, lama: GameState, baru: GameState, cfg: KonfigEkonomi = EKONOMI): PeristiwaAnalitik[] {
  if (baru === lama) return [];
  switch (aksi.jenis) {
    case 'upgrade': {
      const level = baru.terminal.tahap[aksi.tahap].level;
      return TONGGAK_LEVEL.has(level) ? [{ nama: 'upgrade_tahap', data: { tahap: aksi.tahap, level } }] : [];
    }
    case 'rekrutKepala': {
      const jumlah = TAHAP_IDS.filter((id) => baru.terminal.tahap[id].kepala.direkrut).length;
      return [{ nama: 'rekrut_kepala', data: { tahap: aksi.tahap, jumlah_kepala: jumlah } }];
    }
    case 'bangunFasilitas': {
      const level = baru.terminal.fasilitas[aksi.fasilitas];
      return level === 1 || TONGGAK_LEVEL.has(level) ? [{ nama: 'bangun_fasilitas', data: { fasilitas: aksi.fasilitas, level } }] : [];
    }
    case 'bukaJurusan': {
      const jumlah = baru.terminal.jurusanBuka;
      return [{ nama: 'buka_jurusan', data: { jurusan: cfg.jurusan[jumlah - 1]?.nama ?? String(jumlah), jumlah } }];
    }
    case 'bukaJalur':
      return [{ nama: 'buka_jalur', data: { jalur: baru.terminal.jalur } }];
    case 'beliTeknologi':
      return [{ nama: 'beli_teknologi', data: { teknologi: aksi.teknologi } }];
    case 'beliKelasBus':
      return [{ nama: 'beli_kelas_bus', data: { kelas: aksi.kelas } }];
    case 'aturHargaJurusan':
      return [{ nama: 'atur_harga', data: { jurusan: cfg.jurusan[aksi.indeks]?.nama ?? String(aksi.indeks) } }];
    case 'aturTambahanKelas':
      return [{ nama: 'atur_harga', data: { kelas: aksi.kelas } }];
    case 'kontrakPo':
      return [{ nama: 'kontrak_po', data: { po: aksi.po } }];
    case 'klaimEvent':
      return [{ nama: 'klaim_event', data: { edisi: lama.event.edisi ?? '', tahap: baru.event.diklaim } }];
    case 'naikKelas':
      return [{ nama: 'naik_kelas', data: { kelas: baru.prestige.jumlahReset, poin: baru.prestige.poin.sub(lama.prestige.poin).toNumber() } }];
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
  /** Upgrade tahap sejak ringkasan sesi terakhir. */
  private jumlahUpgrade = 0;

  constructor(
    private readonly tujuan: Analitik,
    private readonly cfg: KonfigEkonomi = EKONOMI,
  ) {}

  catat(nama: string, data?: DataAnalitik): void {
    if (SEKALI_PER_SESI.has(nama)) {
      const kunci = `${nama}:${JSON.stringify(data ?? {})}`;
      if (this.sudah.has(kunci)) return;
      this.sudah.add(kunci);
    }
    this.tujuan.catat(nama, data);
  }

  catatAksi(aksi: Aksi, lama: GameState, baru: GameState): void {
    if (aksi.jenis === 'upgrade' && baru !== lama) this.jumlahUpgrade++;
    for (const p of peristiwaAksi(aksi, lama, baru, this.cfg)) this.catat(p.nama, p.data);
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
    this.tujuan.catat('ringkasan_sesi', ringkasanSesi(awal, akhir, this.jumlahUpgrade, detikNyata));
    this.jumlahUpgrade = 0;
  }
}
