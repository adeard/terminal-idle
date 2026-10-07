/**
 * Sesi permainan: muat save, beri penghasilan offline, autosave, pause/resume.
 * Tidak menyentuh DOM/Capacitor: slot save, jam, dan logger dimasukkan dari luar
 * (platform/ & akun.ts), jadi seluruh alur ini bisa dites di Node.
 *
 * Aturan penting supaya waktu tidak dihitung dua kali:
 * - Simulasi berhenti selama pause (detak() diabaikan).
 * - Offline hanya diberikan saat start, saat resume SETELAH pause, dan saat
 *   state diganti save lain (mis. dari perangkat lain) sejak save itu terakhir aktif.
 * - Setelah offline diterapkan, state langsung disimpan dengan timestamp baru.
 */
import { EKONOMI, SIMULASI, type KonfigEkonomi, type KonfigSimulasi } from '../config/economy.config';
import { deserialisasi, muatAtauBaru, serialisasi } from '../sim/save';
import type { EventId } from '../sim/fitur';
import { perbaruiJamNyata, tandaiWaktu, terapkanOffline, type GameState, type LaporanOffline } from '../sim/state';
import { PengendaliGame } from './pengendali';

// Awalan kunci penyimpanan memakai nama lama game dan sengaja TIDAK diganti:
// mengganti kunci berarti progres pemain yang sudah ada tidak terbaca lagi.
/** Slot save tamu (tanpa login). */
export const KUNCI_SAVE = 'terminal-bus-tycoon/save';
/** Salinan save yang gagal dibaca, supaya bisa diselidiki/dipulihkan manual. */
export const KUNCI_SAVE_KORUP = 'terminal-bus-tycoon/save-korup';

/** Diimplementasikan di platform/ (Capacitor Preferences atau localStorage). */
export interface Penyimpanan {
  baca(kunci: string): Promise<string | null>;
  tulis(kunci: string, nilai: string): Promise<void>;
  hapus(kunci: string): Promise<void>;
}

/**
 * - rutin: autosave berkala; slot boleh menunda sinkron cloud.
 * - penting: app ke background, sebelum reload, dsb.; slot menyinkronkan segera.
 */
export type AlasanSimpan = 'rutin' | 'penting';

/**
 * Tempat save satu pemain: tamu (`slotLokal`) atau akun (`SlotAkun` di akun.ts,
 * lokal + cloud). Semua method boleh throw; SesiGame yang me-log.
 */
export interface SlotSave {
  /** Save mentah untuk dimuat saat mulai; null = belum ada save. */
  baca(): Promise<string | null>;
  /**
   * Tulis save. Mengembalikan save PENGGANTI kalau state harus diganti (mis.
   * pemain memilih progres dari perangkat lain saat konflik), selain itu null.
   */
  tulis(isi: string, alasan: AlasanSimpan): Promise<string | null>;
  /** Simpan salinan save yang gagal dibaca. */
  simpanKorup(isi: string): Promise<void>;
  /** App aktif lagi: save pengganti kalau di tempat lain ada versi lebih baru, selain itu null. */
  perbarui?(): Promise<string | null>;
}

/** Slot tamu: hanya storage lokal perangkat ini. */
export function slotLokal(penyimpanan: Penyimpanan, kunci = KUNCI_SAVE, kunciKorup = KUNCI_SAVE_KORUP): SlotSave {
  return {
    baca: () => penyimpanan.baca(kunci),
    tulis: async (isi) => {
      await penyimpanan.tulis(kunci, isi);
      return null;
    },
    simpanKorup: (isi) => penyimpanan.tulis(kunciKorup, isi),
  };
}

export type Logger = (pesan: string, detail?: unknown) => void;

/** 100 × 0,1 = 9,9999…; toleransi supaya autosave tidak telat satu frame. */
const EPSILON_WAKTU = 1e-9;

/** Dibaca saat dipanggil (bukan referensi tersimpan), jadi jam bisa diganti saat debug/test. */
const jamDinding = (): number => Date.now();

export interface OpsiSesi {
  readonly slot: SlotSave;
  /** Jam dinding dalam ms epoch. Default Date.now. */
  readonly jam?: () => number;
  readonly logGalat?: Logger;
  /** State diganti save lain di tengah permainan (lihat SlotSave.tulis); laporan = offline sejak save itu. */
  readonly saatSaveDiganti?: (laporan: LaporanOffline) => void;
  readonly cfg?: KonfigEkonomi;
  readonly cfgSim?: KonfigSimulasi;
  /** Paksa event musiman (server dev, ?event=…); null = menurut tanggal. */
  readonly eventUji?: EventId | null;
}

/** Event musiman dicocokkan dengan jam dinding tiap sekian detik nyata. */
const SELANG_CEK_EVENT_DETIK = 30;

export type StatusMuat = 'baru' | 'dimuat' | 'korup';

export class SesiGame {
  readonly pengendali: PengendaliGame;
  private dijeda = false;
  /** Setelah hentikan(): tidak ada simpan/resume lagi. */
  private berhenti = false;
  /** Naik tiap jeda/lanjut: lanjut yang tersusul jeda saat menunggu slot tidak membuka jeda. */
  private giliranSiklus = 0;
  private detikSejakSimpan = 0;
  private detikSejakCekEvent = 0;
  private readonly jam: () => number;
  private readonly eventUji: EventId | null;
  private readonly logGalat: Logger;
  private readonly saatSaveDiganti: (laporan: LaporanOffline) => void;
  private readonly cfg: KonfigEkonomi;
  private readonly cfgSim: KonfigSimulasi;

  private constructor(
    state: GameState,
    private readonly slot: SlotSave,
    opsi: OpsiSesi,
  ) {
    this.pengendali = new PengendaliGame(state);
    this.jam = opsi.jam ?? jamDinding;
    this.logGalat = opsi.logGalat ?? (() => {});
    this.saatSaveDiganti = opsi.saatSaveDiganti ?? (() => {});
    this.cfg = opsi.cfg ?? EKONOMI;
    this.cfgSim = opsi.cfgSim ?? SIMULASI;
    this.eventUji = opsi.eventUji ?? null;
  }

  /**
   * Muat save (atau mulai baru), terapkan penghasilan offline, lalu simpan.
   * Tidak pernah throw: storage rusak/korup → game baru + log.
   */
  static async mulai(opsi: OpsiSesi): Promise<{ sesi: SesiGame; status: StatusMuat; laporan: LaporanOffline | null }> {
    const jam = opsi.jam ?? jamDinding;
    const log = opsi.logGalat ?? (() => {});
    const cfg = opsi.cfg ?? EKONOMI;

    let raw: string | null = null;
    try {
      raw = await opsi.slot.baca();
    } catch (e) {
      log('Gagal membaca save; mulai game baru.', e);
    }

    const sekarang = jam();
    const hasil = muatAtauBaru(raw, sekarang, cfg);
    if (hasil.status === 'korup') {
      log('Save korup; mulai game baru. Salinan disimpan terpisah.', hasil.error);
      if (raw !== null) {
        try {
          await opsi.slot.simpanKorup(raw);
        } catch (e) {
          log('Gagal menyimpan salinan save korup.', e);
        }
      }
    }

    let state = hasil.state;
    let laporan: LaporanOffline | null = null;
    if (hasil.status === 'dimuat') {
      const offline = terapkanOffline(state, sekarang, cfg);
      state = offline.state;
      laporan = offline.laporan;
    }
    state = perbaruiJamNyata(state, sekarang, cfg, opsi.eventUji ?? null);

    const sesi = new SesiGame(state, opsi.slot, opsi);
    await sesi.simpan();
    return { sesi, status: hasil.status, laporan };
  }

  get sedangDijeda(): boolean {
    return this.dijeda;
  }

  /** True setelah hentikan(): halaman perlu dimuat ulang supaya game jalan lagi. */
  get sudahDihentikan(): boolean {
    return this.berhenti;
  }

  /**
   * Dipanggil tiap frame dengan waktu nyata. Menjalankan sim (`kecepatan` kali
   * lebih cepat, lihat PILIHAN_KECEPATAN) dan autosave (tetap per waktu nyata).
   */
  detak(dtDetik: number, kecepatan = 1): void {
    if (this.dijeda) return;
    this.pengendali.majukan(dtDetik * Math.max(0, kecepatan));
    this.detikSejakCekEvent += Math.max(dtDetik, 0);
    if (this.detikSejakCekEvent >= SELANG_CEK_EVENT_DETIK) {
      this.detikSejakCekEvent = 0;
      this.cocokkanEvent();
    }
    this.detikSejakSimpan += Math.min(Math.max(dtDetik, 0), this.cfgSim.maksKejarDetik);
    if (this.detikSejakSimpan + EPSILON_WAKTU >= this.cfgSim.intervalSimpanDetik) {
      this.detikSejakSimpan = 0;
      void this.simpan();
    }
  }

  /** Catat timestamp lalu tulis save. Tidak pernah throw. */
  async simpan(alasan: AlasanSimpan = 'rutin'): Promise<void> {
    if (!this.berhenti) await this.tulisSave(alasan);
  }

  /** App ke background / ditutup: hentikan sim dan simpan. */
  async jeda(): Promise<void> {
    this.giliranSiklus++;
    if (this.dijeda || this.berhenti) return;
    this.dijeda = true;
    await this.simpan('penting');
  }

  /**
   * Simpan terakhir lalu berhenti permanen, sebelum ganti akun / muat ulang
   * halaman: tidak ada autosave atau resume lagi yang bisa menulis slot ini.
   */
  async hentikan(): Promise<void> {
    if (this.berhenti) return;
    this.berhenti = true;
    this.dijeda = true;
    this.giliranSiklus++;
    await this.tulisSave('penting');
  }

  /**
   * App kembali aktif. Offline hanya dihitung kalau sebelumnya benar-benar
   * dijeda; resume tanpa pause diabaikan supaya waktu yang sudah
   * disimulasikan tidak dibayar dua kali. Kalau slot punya save lebih baru
   * (perangkat lain), state diganti dulu dan laporannya dihitung dari save itu.
   */
  async lanjut(): Promise<LaporanOffline | null> {
    if (!this.dijeda || this.berhenti) return null;
    const giliran = ++this.giliranSiklus;
    let pengganti: string | null = null;
    try {
      pengganti = (await this.slot.perbarui?.()) ?? null;
    } catch (e) {
      this.logGalat('Gagal memeriksa save terbaru.', e);
    }
    const laporanPengganti = pengganti === null ? null : this.gantiState(pengganti);
    if (giliran !== this.giliranSiklus) {
      // Sudah dijeda lagi selama menunggu slot: tetap dijeda, tapi pengganti jangan sampai hilang.
      if (laporanPengganti) await this.tulisSave('rutin');
      return null;
    }
    this.dijeda = false;
    this.detikSejakSimpan = 0;
    const hasil = terapkanOffline(this.pengendali.state, this.jam(), this.cfg);
    this.pengendali.ubah(() => hasil.state);
    this.cocokkanEvent();
    await this.simpan();
    return laporanPengganti ?? hasil.laporan;
  }

  /** Mulai, lanjutkan, atau akhiri event musiman menurut jam dinding. */
  private cocokkanEvent(): void {
    this.pengendali.ubah((s) => perbaruiJamNyata(s, this.jam(), this.cfg, this.eventUji));
  }

  /** Apakah laporan offline layak ditampilkan sebagai popup. */
  perluPopup(laporan: LaporanOffline | null): laporan is LaporanOffline {
    return laporan !== null && laporan.detik >= this.cfgSim.minDetikPopupOffline;
  }

  private async tulisSave(alasan: AlasanSimpan): Promise<void> {
    this.pengendali.ubah((s) => tandaiWaktu(s, this.jam()));
    let pengganti: string | null = null;
    try {
      pengganti = await this.slot.tulis(serialisasi(this.pengendali.state), alasan);
    } catch (e) {
      this.logGalat('Gagal menyimpan game.', e);
    }
    if (pengganti === null) return;
    const laporan = this.gantiState(pengganti);
    if (!laporan) return;
    // Tetap ditulis walau sesi sudah dihentikan: pilihan pemain tidak boleh hilang.
    await this.tulisSave('rutin');
    this.saatSaveDiganti(laporan);
  }

  /**
   * Ganti state dengan save lain, lalu beri penghasilan offline sejak save itu
   * terakhir aktif. Belum disimpan. Null (state tetap) kalau save tidak valid.
   */
  private gantiState(isi: string): LaporanOffline | null {
    let state: GameState;
    try {
      state = deserialisasi(isi, this.jam(), this.cfg);
    } catch (e) {
      this.logGalat('Save pengganti tidak valid; diabaikan.', e);
      return null;
    }
    const hasil = terapkanOffline(state, this.jam(), this.cfg);
    this.pengendali.setel(perbaruiJamNyata(hasil.state, this.jam(), this.cfg, this.eventUji));
    this.detikSejakSimpan = 0;
    return hasil.laporan;
  }
}
