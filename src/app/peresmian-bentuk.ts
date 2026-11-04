/**
 * Perayaan yang tidak terjadi di sesi aktif (documents/16 bagian 7, murni):
 * - Peresmian susulan: pemain yang menyelesaikan Perluasan 3 sebelum gedungnya digambar mendapat kembang
 *   api & toast sekali per perangkat. Tahap 4–5 pun hanya menampilkan gedung itu, jadi yang dirayakan
 *   selalu proyek tahap 3.
 * - Proyek yang selesai saat offline: kembang api tahap itu sesudah popup offline ditutup.
 *
 * Bila keduanya jatuh di satu muat, kembang apinya tidak boleh bertabrakan:
 * - Proyek tahap 3: gedungnya sama, jadi satu kembang api saja, dengan toast susulan.
 * - Proyek tahap lain: proyek dulu (menjawab popup yang baru ditutup), lalu susulan sesudah jeda.
 */
export const TAHAP_SAYAP_2_LANTAI = 3;

/** Jeda antar dua kembang api: satu rangkaian KembangApi habis dalam ±5,9 detik jamnya. */
export const JEDA_PERAYAAN_DETIK = 6;

/**
 * Batas dt per frame, sama dengan Terminal3D.perbarui: jeda memakai jam kembang api, bukan jam dinding.
 * Frame panjang (kompilasi shader di frame pertama, HP lambat) memajukan kembang api paling banyak sekian.
 */
const MAKS_DT_DETIK = 0.1;

/**
 * @param perluasan tahap perluasan yang sudah selesai.
 * @param sudah tanda lokal di perangkat ini sudah ada.
 */
export function perluPeresmianSusulan(perluasan: number, sudah: boolean): boolean {
  return perluasan >= TAHAP_SAYAP_2_LANTAI && !sudah;
}

export interface TayanganPerayaan {
  /** Tahap yang kembang apinya harus dipanggil; null = adegan sudah menjadwalkannya sendiri. */
  readonly kembangApi: number | null;
  /** Ini peresmian susulan: tulis tanda & tampilkan toastnya. */
  readonly susulan: boolean;
}

export class AntreanPerayaan {
  private tahapOffline: number | null = null;
  private adeganSendiri = false;
  private jeda = 0;

  /** @param sudah pemain ini tidak perlu peresmian susulan lagi di perangkat ini. */
  constructor(private sudah: boolean) {}

  /**
   * Popup offline yang memuat proyek selesai dipasang. Satu laporan memuat paling banyak satu tahap,
   * karena proyek berikutnya hanya bisa dimulai lewat aksi pemain.
   * @param adeganBerjalan adegan sudah ada saat state maju (resume): ia melihat perluasan naik dan
   *   menjadwalkan kembang apinya sendiri. Di muat dingin ia dibuat dari state yang sudah maju.
   */
  catatProyekOffline(tahap: number, adeganBerjalan: boolean): void {
    this.tahapOffline = tahap;
    this.adeganSendiri = adeganBerjalan;
    this.jeda = 0;
  }

  /** Waktu adegan ditahan: kembang api yang dijadwalkan adegan sendiri baru berjalan sesudah popup ditutup. */
  get tahanAdegan(): boolean {
    return this.tahapOffline !== null && this.adeganSendiri;
  }

  /**
   * Dipanggil tiap frame selama adegan terlihat.
   * @param dt detik nyata sejak frame lalu.
   * @param perluasan tahap perluasan yang sudah selesai.
   * @param terhalang adegan masih tertutup; `susulan` = tayangan ini membawa toast susulan.
   * @returns yang harus ditayangkan sekarang, null bila tidak ada.
   */
  ambil(dt: number, perluasan: number, terhalang: (susulan: boolean) => boolean): TayanganPerayaan | null {
    this.jeda = Math.max(0, this.jeda - Math.min(dt, MAKS_DT_DETIK));
    const offline = this.tahapOffline;
    const perluSusulan = perluPeresmianSusulan(perluasan, this.sudah);
    if ((offline === null && !perluSusulan) || this.jeda > 0) return null;
    const susulan = perluSusulan && (offline === null || offline === TAHAP_SAYAP_2_LANTAI);
    if (terhalang(susulan)) return null;
    const kembangApi = offline !== null && this.adeganSendiri ? null : (offline ?? TAHAP_SAYAP_2_LANTAI);
    this.tahapOffline = null;
    this.jeda = JEDA_PERAYAAN_DETIK;
    if (susulan) this.sudah = true;
    return { kembangApi, susulan };
  }
}
