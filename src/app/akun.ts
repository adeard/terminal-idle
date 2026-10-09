/**
 * Save akun (login Google). Save lokal tetap tempat simpan utama; kalau login,
 * salinannya disinkronkan ke cloud. Tidak menyentuh Firebase/DOM: cloud,
 * storage, jam, dan dialog pilihan dimasukkan dari luar (platform/ & ui/),
 * jadi seluruh alur bisa dites di Node.
 *
 * Aturan:
 * - Tiap unggahan membawa revisi dasar; cloud menolak kalau revisinya sudah
 *   berubah (perangkat lain menulis). Jam HP tidak dipakai untuk membandingkan.
 * - Save perangkat ini yang belum berubah sejak unggahan terakhir boleh diganti
 *   versi cloud yang lebih baru tanpa bertanya (pindah perangkat biasa).
 * - Dua save yang sama-sama punya progres dan berbeda → pemain SELALU ditanya.
 * - Saat login, save tamu dipindah ke akun (slot tamu dikosongkan), jadi
 *   logout = mulai sebagai tamu baru. Save akun tetap tersimpan di perangkat.
 */
import { SIMULASI, type KonfigSimulasi } from '../config/economy.config';
import { deserialisasi } from '../sim/save';
import { kelasTerminal, levelTerminal, type GameState } from '../sim/state';
import { KUNCI_SAVE, type AlasanSimpan, type Logger, type Penyimpanan, type SlotSave } from './sesi';

/** uid akun yang sedang login; tidak ada = tamu. Firebase cukup dimuat kalau ini ada. */
export const KUNCI_AKUN_AKTIF = 'terminal-bus-tycoon/akun-aktif';
/** Save yang tidak dipilih saat login (ditimpa tiap kali), untuk pemulihan manual. */
export const KUNCI_SAVE_CADANGAN = 'terminal-bus-tycoon/save-cadangan';

export function kunciSaveAkun(uid: string): { readonly save: string; readonly korup: string } {
  const awalan = `terminal-bus-tycoon/akun/${uid}`;
  return { save: `${awalan}/save`, korup: `${awalan}/save-korup` };
}

// ---------------------------------------------------------------------------
// Kontrak cloud & dialog

export interface SaveAwan {
  /** String save (hasil `serialisasi`), sama persis dengan save lokal. */
  readonly isi: string;
  /** Naik 1 tiap unggahan berhasil. */
  readonly revisi: number;
}

export type HasilUnggah =
  | { readonly status: 'ok'; readonly revisi: number }
  /** Revisi cloud bukan revisi dasar (perangkat lain sudah menulis). `awan` null = dokumen tidak ada. */
  | { readonly status: 'konflik'; readonly awan: SaveAwan | null };

/**
 * Cloud save milik SATU akun (uid terikat di implementasinya, lihat platform/).
 * Galat jaringan dilempar. `unduh` wajib menyerah dalam beberapa detik supaya
 * game tidak lama tertahan saat tidak ada sinyal.
 */
export interface PenyimpananAwan {
  unduh(): Promise<SaveAwan | null>;
  /** Tulis bersyarat: hanya berhasil kalau revisi di cloud masih `revisiDasar` (dokumen belum ada = 0). */
  unggah(isi: string, revisiDasar: number): Promise<HasilUnggah>;
  hapus(): Promise<void>;
}

/** Yang ditampilkan dialog pilihan save. */
export interface RingkasanSave {
  /** Kas & total pendapatan operasi sepanjang permainan (Rp). */
  readonly kas: number;
  readonly totalPendapatan: number;
  /** Level terminal & kelas yang mengikutinya. */
  readonly levelTerminal: number;
  readonly kelasTerminal: number;
  readonly waktuMainDetik: number;
  readonly waktuTerakhirMs: number;
}

/**
 * - masuk: `lokal` = save tamu di perangkat ini, `awan` = save akun.
 * - sinkron: `lokal` = save akun di perangkat ini, `awan` = save akun dari perangkat lain.
 */
export type SituasiKonflik = 'masuk' | 'sinkron';
export type PilihanKonflik = 'lokal' | 'awan';

export interface PertanyaanKonflik {
  readonly situasi: SituasiKonflik;
  readonly lokal: RingkasanSave;
  readonly awan: RingkasanSave;
}

/**
 * Diimplementasikan UI: dialog berisi kedua ringkasan; save yang tidak dipilih
 * ditimpa. Boleh reject saat login (pemain membatalkan): login batal tanpa perubahan.
 */
export type TanyaKonflik = (p: PertanyaanKonflik) => Promise<PilihanKonflik>;

export type Keputusan =
  | { readonly pakai: PilihanKonflik }
  | { readonly pakai: 'tanya'; readonly lokal: RingkasanSave; readonly awan: RingkasanSave };

/** Save akun di storage lokal, bersama keadaan sinkronnya. */
export interface CatatanSinkron {
  readonly isi: string;
  /** Revisi cloud yang menjadi dasar `isi`. */
  readonly revisi: number;
  /** True kalau `isi` sama persis dengan cloud pada `revisi` (tidak ada perubahan yang belum diunggah). */
  readonly bersih: boolean;
}

// ---------------------------------------------------------------------------
// Keputusan (murni)

/** Null kalau kosong atau tidak valid. */
export function ringkasSave(isi: string | null): RingkasanSave | null {
  if (isi === null || isi === '') return null;
  let s: GameState;
  try {
    s = deserialisasi(isi, 0);
  } catch {
    return null;
  }
  return {
    kas: s.kas,
    totalPendapatan: s.statistik.totalPendapatan,
    levelTerminal: levelTerminal(s),
    kelasTerminal: kelasTerminal(s),
    waktuMainDetik: s.statistik.waktuMainDetik,
    waktuTerakhirMs: s.waktuTerakhirMs,
  };
}

/** Save tanpa pendapatan sama sekali (baru, kosong, atau korup) boleh ditimpa tanpa bertanya. */
export function adaProgres(r: RingkasanSave | null): r is RingkasanSave {
  return r !== null && (r.totalPendapatan > 0 || r.levelTerminal > 1);
}

/** Dua save berbeda: pilih otomatis kalau salah satunya tanpa progres, selain itu tanya. */
function bandingkan(isiLokal: string | null, isiAwan: string | null): Keputusan {
  const lokal = ringkasSave(isiLokal);
  const awan = ringkasSave(isiAwan);
  if (!adaProgres(awan)) return { pakai: 'lokal' };
  if (!adaProgres(lokal)) return { pakai: 'awan' };
  return { pakai: 'tanya', lokal, awan };
}

/** Save akun di perangkat ini (null = belum ada) vs di cloud (null = belum ada). */
export function putuskanSinkron(lokal: CatatanSinkron | null, awan: SaveAwan | null): Keputusan {
  if (awan === null) return { pakai: 'lokal' };
  if (lokal === null || lokal.isi === awan.isi) return { pakai: 'awan' };
  if (awan.revisi === lokal.revisi) return { pakai: 'lokal' };
  // Hanya cloud yang berubah sejak sinkron terakhir: pindah perangkat biasa.
  if (awan.revisi > lokal.revisi && lokal.bersih) return { pakai: 'awan' };
  return bandingkan(lokal.isi, awan.isi);
}

/** Saat login: save tamu di perangkat ini vs save akun (`awan`). */
export function putuskanMasuk(isiTamu: string | null, isiAkun: string | null): Keputusan {
  if (isiTamu === isiAkun || !adaProgres(ringkasSave(isiTamu))) return { pakai: 'awan' };
  return bandingkan(isiTamu, isiAkun);
}

// ---------------------------------------------------------------------------
// Slot akun

export interface OpsiAkun {
  readonly uid: string;
  readonly penyimpanan: Penyimpanan;
  readonly awan: PenyimpananAwan;
  readonly tanya: TanyaKonflik;
  /** Jam dinding dalam ms epoch. Default Date.now. */
  readonly jam?: () => number;
  readonly logGalat?: Logger;
  readonly cfgSim?: KonfigSimulasi;
}

/**
 * Slot save pemain yang login. Tiap autosave ditulis ke storage lokal (bersama
 * revisi cloud yang menjadi dasarnya), lalu diunggah paling sering tiap
 * `intervalUnggahDetik`, atau segera untuk simpan 'penting'.
 */
export class SlotAkun implements SlotSave {
  private isi: string | null = null;
  /** Revisi cloud yang menjadi dasar `isi`. */
  private revisi = 0;
  /** Isi cloud pada `revisi`, kalau diketahui. */
  private isiDiAwan: string | null = null;
  private unggahTerakhirMs: number;
  /** Unggahan & pemeriksaan cloud dijalankan satu per satu. */
  private antrean: Promise<unknown> = Promise.resolve();
  private jumlahAntre = 0;
  private readonly kunci: { readonly save: string; readonly korup: string };
  private readonly jam: () => number;
  private readonly log: Logger;
  private readonly intervalUnggahMs: number;

  constructor(private readonly o: OpsiAkun) {
    this.kunci = kunciSaveAkun(o.uid);
    this.jam = o.jam ?? (() => Date.now());
    this.log = o.logGalat ?? (() => {});
    this.intervalUnggahMs = (o.cfgSim ?? SIMULASI).intervalUnggahDetik * 1000;
    this.unggahTerakhirMs = this.jam();
  }

  private get bersih(): boolean {
    return this.isi !== null && this.isi === this.isiDiAwan;
  }

  /** True kalau save terakhir sudah ada di cloud (untuk status di menu akun). */
  get tersinkron(): boolean {
    return this.bersih;
  }

  /** Saat mulai: save akun di perangkat ini dicocokkan dengan cloud. Cloud tak terjangkau → pakai lokal. */
  baca(): Promise<string | null> {
    return this.muat(false);
  }

  async tulis(isi: string, alasan: AlasanSimpan): Promise<string | null> {
    this.isi = isi;
    await this.tulisLokal();
    const jatuhTempo = this.jam() - this.unggahTerakhirMs >= this.intervalUnggahMs;
    if (alasan === 'rutin' && (!jatuhTempo || this.jumlahAntre > 0)) return null;
    return this.antre(() => this.unggah(true));
  }

  simpanKorup(isi: string): Promise<void> {
    return this.o.penyimpanan.tulis(this.kunci.korup, isi);
  }

  /** App aktif lagi: ambil versi cloud kalau perangkat lain menulis selama app di background. */
  async perbarui(): Promise<string | null> {
    // Unggahan (atau dialog konflik) masih berjalan: hasilnya ditangani di sana.
    if (this.jumlahAntre > 0) return null;
    return this.antre(async () => {
      let awan: SaveAwan | null;
      try {
        awan = await this.o.awan.unduh();
      } catch (e) {
        this.log('Cloud save tidak terjangkau; lanjut dengan save di perangkat ini.', e);
        return null;
      }
      return (await this.selaraskan(awan)) ? this.isi : null;
    });
  }

  /** Untuk login: seperti `baca`, tapi cloud wajib terjangkau (galatnya dilempar). */
  muatUntukMasuk(): Promise<string | null> {
    return this.muat(true);
  }

  /** Untuk login: jadikan `isi` save akun di perangkat ini; diunggah pada sinkron berikutnya. */
  async tetapkan(isi: string): Promise<void> {
    this.isi = isi;
    await this.tulisLokal();
  }

  private async muat(wajibAwan: boolean): Promise<string | null> {
    let raw: string | null = null;
    try {
      raw = await this.o.penyimpanan.baca(this.kunci.save);
    } catch (e) {
      this.log('Gagal membaca save akun di perangkat ini.', e);
    }
    const catatan = bacaCatatan(raw);
    if (catatan) {
      this.isi = catatan.isi;
      this.revisi = catatan.revisi;
      this.isiDiAwan = catatan.bersih ? catatan.isi : null;
    } else if (raw !== null && raw !== '') {
      this.log('Save akun di perangkat ini korup; salinan disimpan terpisah.');
      await this.simpanKorup(raw).catch((e: unknown) => this.log('Gagal menyimpan salinan save korup.', e));
    }

    let awan: SaveAwan | null;
    try {
      awan = await this.o.awan.unduh();
    } catch (e) {
      if (wajibAwan) throw e;
      this.log('Cloud save tidak terjangkau; pakai save di perangkat ini.', e);
      return this.isi;
    }
    await this.selaraskan(awan);
    return this.isi;
  }

  /**
   * Cocokkan save perangkat ini dengan versi cloud, bertanya ke pemain kalau
   * perlu. True kalau `isi` diganti versi cloud.
   */
  private async selaraskan(awan: SaveAwan | null): Promise<boolean> {
    const lokal = this.isi === null ? null : { isi: this.isi, revisi: this.revisi, bersih: this.bersih };
    const k = putuskanSinkron(lokal, awan);
    const pakai = k.pakai === 'tanya' ? await this.o.tanya({ situasi: 'sinkron', lokal: k.lokal, awan: k.awan }) : k.pakai;
    if (awan === null) {
      // Belum pernah diunggah (atau sudah dihapus): unggahan berikutnya membuat dokumen baru.
      this.revisi = 0;
      this.isiDiAwan = null;
      return false;
    }
    // Save perangkat ini yang dipakai → unggahan berikutnya menimpa revisi cloud ini.
    this.revisi = awan.revisi;
    this.isiDiAwan = awan.isi;
    if (pakai === 'lokal' || this.isi === awan.isi) return false;
    this.isi = awan.isi;
    return true;
  }

  /** Unggah `isi` kalau belum ada di cloud. Mengembalikan save pengganti kalau pemain memilih versi cloud. */
  private async unggah(bolehUlang: boolean): Promise<string | null> {
    const isi = this.isi;
    if (isi === null || this.bersih) return null;
    this.unggahTerakhirMs = this.jam();
    let hasil: HasilUnggah;
    try {
      hasil = await this.o.awan.unggah(isi, this.revisi);
    } catch (e) {
      this.log('Gagal mengunggah save; dicoba lagi nanti.', e);
      return null;
    }
    if (hasil.status === 'ok') {
      this.revisi = hasil.revisi;
      this.isiDiAwan = isi;
      await this.tulisLokal();
      return null;
    }
    if (await this.selaraskan(hasil.awan)) return this.isi;
    // Save perangkat ini yang dipakai: timpa cloud di atas revisi terbarunya (sekali saja).
    return bolehUlang ? this.unggah(false) : null;
  }

  private antre(tugas: () => Promise<string | null>): Promise<string | null> {
    this.jumlahAntre++;
    const hasil = this.antrean.then(tugas).finally(() => {
      this.jumlahAntre--;
    });
    this.antrean = hasil.catch(() => undefined);
    return hasil;
  }

  private async tulisLokal(): Promise<void> {
    if (this.isi === null) return;
    const catatan: CatatanSinkron = { isi: this.isi, revisi: this.revisi, bersih: this.bersih };
    await this.o.penyimpanan.tulis(this.kunci.save, JSON.stringify(catatan));
  }
}

function bacaCatatan(raw: string | null): CatatanSinkron | null {
  if (raw === null || raw === '') return null;
  try {
    const o: unknown = JSON.parse(raw);
    if (typeof o !== 'object' || o === null) return null;
    const { isi, revisi, bersih } = o as Record<string, unknown>;
    if (typeof isi === 'string' && typeof revisi === 'number' && Number.isSafeInteger(revisi) && revisi >= 0 && typeof bersih === 'boolean') {
      return { isi, revisi, bersih };
    }
  } catch {
    // JSON rusak: ditangani pemanggil sebagai korup.
  }
  return null;
}

// ---------------------------------------------------------------------------
// Login, logout, hapus akun

/** uid akun yang login di perangkat ini, atau null (tamu). */
export async function bacaAkunAktif(penyimpanan: Penyimpanan): Promise<string | null> {
  const uid = await penyimpanan.baca(KUNCI_AKUN_AKTIF);
  return uid === null || uid === '' ? null : uid;
}

export interface OpsiMasuk extends OpsiAkun {
  /**
   * Hentikan sesi tamu yang sedang berjalan (simpan terakhir, lalu tidak
   * menulis lagi). Dipanggil setelah semua langkah yang bisa gagal/batal
   * (jaringan, dialog) selesai, jadi login yang batal tidak menghentikan game.
   */
  readonly hentikanTamu?: () => Promise<void>;
}

/**
 * Login: pindahkan pemain dari slot tamu ke akun, lalu pemanggil memulai sesi
 * baru dengan `SlotAkun` (mis. muat ulang halaman). Cloud tidak terjangkau
 * atau pemain membatalkan dialog → throw; slot tamu dan status login tidak berubah.
 */
export async function masukAkun(o: OpsiMasuk): Promise<void> {
  const slot = new SlotAkun(o);
  const isiAkun = await slot.muatUntukMasuk();
  const k = putuskanMasuk(await o.penyimpanan.baca(KUNCI_SAVE), isiAkun);
  const pakai = k.pakai === 'tanya' ? await o.tanya({ situasi: 'masuk', lokal: k.lokal, awan: k.awan }) : k.pakai;
  await o.hentikanTamu?.();
  // Save tamu final (sesi tamu mungkin masih menyimpan selama dialog terbuka).
  const isiTamu = await o.penyimpanan.baca(KUNCI_SAVE);
  const [dipakai, dibuang] = pakai === 'lokal' ? [isiTamu, isiAkun] : [isiAkun, isiTamu];
  if (dipakai !== null) await slot.tetapkan(dipakai);
  if (dibuang !== null && dibuang !== dipakai && adaProgres(ringkasSave(dibuang))) {
    await o.penyimpanan.tulis(KUNCI_SAVE_CADANGAN, dibuang);
  }
  await o.penyimpanan.hapus(KUNCI_SAVE);
  await o.penyimpanan.tulis(KUNCI_AKUN_AKTIF, o.uid);
}

/**
 * Logout: kembali ke slot tamu, yang sudah kosong sejak login → game baru.
 * Save akun tetap di perangkat (login lagi = lanjut). Panggil setelah sesi
 * dijeda supaya unggahan terakhir sempat jalan.
 */
export async function keluarAkun(penyimpanan: Penyimpanan): Promise<void> {
  await penyimpanan.hapus(KUNCI_AKUN_AKTIF);
}

/**
 * Hapus data akun di server (skor papan peringkat, lalu cloud save) dan di
 * perangkat ini, lalu logout. Akun Firebase-nya sendiri dihapus di platform/.
 * Server gagal → throw sebelum data lokal disentuh (pemain bisa mencoba lagi).
 */
export async function hapusDataAkun(o: Pick<OpsiAkun, 'uid' | 'penyimpanan' | 'awan'> & { readonly hapusPeringkat?: () => Promise<void> }): Promise<void> {
  await o.hapusPeringkat?.();
  await o.awan.hapus();
  const kunci = kunciSaveAkun(o.uid);
  await o.penyimpanan.hapus(kunci.save);
  await o.penyimpanan.hapus(kunci.korup);
  await keluarAkun(o.penyimpanan);
}
