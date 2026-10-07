/**
 * Alur iklan berhadiah Google H5 Games Ads (Ad Placement API) tanpa DOM, jadi
 * bisa dites di Node; skrip Google & `adBreak` sungguhan dipasang di
 * platform/iklan.ts. Polanya mengikuti dokumentasi Google untuk iklan reward:
 *
 * - Game meminta jeda iklan lebih dulu ("siaga"). Kalau Google punya iklan,
 *   `beforeReward(showAdFn)` dipanggil → tombol hadiah boleh tampil (`siap()`).
 * - Pemain mengetuk tombol → `showAdFn()` dipanggil langsung di dalam ketukan itu
 *   (syarat Google), hasilnya dari `adViewed` / `adDismissed`, dan `adBreakDone`
 *   menutup jeda itu. Lalu siaga berikutnya diminta.
 * - Tanpa iklan (situs belum disetujui, stok kosong, dibatasi frekuensi) hanya
 *   `adBreakDone` yang dipanggil: siaga dicoba lagi dengan jeda yang makin panjang.
 *   Skrip yang diblokir pemain (ad blocker) = tidak pernah siap, tombol tetap tersembunyi.
 */
import type { HasilIklan, PenyediaIklan } from './iklan';

/** Argumen `adBreak` yang dipakai (lihat developers.google.com/ad-placement/apis). */
export interface JedaReward {
  readonly type: 'reward';
  readonly name: string;
  readonly beforeAd: () => void;
  readonly afterAd: () => void;
  readonly beforeReward: (showAdFn: () => void) => void;
  readonly adDismissed: () => void;
  readonly adViewed: () => void;
  readonly adBreakDone: (info?: { readonly breakStatus?: string }) => void;
}

export interface Penjadwal {
  setTimeout(f: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

export interface OpsiPengaturH5 {
  readonly adBreak: (o: JedaReward) => void;
  readonly penjadwal: Penjadwal;
  /** Sebelum & sesudah iklan diputar (mis. membisukan suara game). */
  readonly sebelum?: (() => void) | undefined;
  readonly sesudah?: (() => void) | undefined;
}

/** Jeda sebelum siaga diminta lagi setelah Google tidak punya iklan (makin panjang, paling lama 5 menit). */
export const JEDA_ULANG_MS: readonly number[] = [15_000, 30_000, 60_000, 120_000, 300_000];
/** Setelah satu iklan selesai, siaga berikutnya diminta segera. */
export const JEDA_SETELAH_IKLAN_MS = 1_000;
/** showAdFn dipanggil tapi iklan tidak mulai sama sekali: dianggap gagal setelah sekian. */
export const BATAS_MULAI_MS = 15_000;
/** Siaga yang tidak dijawab Google sama sekali (skrip belum termuat dsb.): dicoba lagi. */
export const BATAS_SIAGA_MS = 60_000;

export class PengaturIklanH5 implements PenyediaIklan {
  readonly nama = 'h5';
  /** showAdFn dari jeda siaga yang sedang ditawarkan Google. */
  private tampilkan: (() => void) | null = null;
  /** Nomor jeda terakhir; panggilan balik dari jeda lama diabaikan. */
  private urutan = 0;
  private siaga = false;
  private aktif: { readonly selesai: (h: HasilIklan) => void; hasil: HasilIklan | null; mulai: boolean } | null = null;
  private bisu = false;
  private gagalBeruntun = 0;
  private timerSiaga = 0;
  private timerMulai = 0;
  private timerUlang = 0;

  constructor(private readonly o: OpsiPengaturH5) {}

  /** Minta siaga pertama (aman dipanggil berkali-kali). */
  mulai(): void {
    this.minta();
  }

  siap(): boolean {
    return this.tampilkan !== null && this.aktif === null;
  }

  /** Harus dipanggil langsung dari ketukan pemain (showAdFn dijalankan sinkron di sini). */
  tonton(): Promise<HasilIklan> {
    const tampilkan = this.tampilkan;
    if (!tampilkan || this.aktif) return Promise.resolve('gagal');
    this.tampilkan = null;
    return new Promise<HasilIklan>((selesai) => {
      this.aktif = { selesai, hasil: null, mulai: false };
      const nomor = this.urutan;
      this.timerMulai = this.o.penjadwal.setTimeout(() => {
        if (nomor === this.urutan && this.aktif && !this.aktif.mulai) this.akhiri('gagal');
      }, BATAS_MULAI_MS);
      try {
        tampilkan();
      } catch {
        this.akhiri('gagal');
      }
    });
  }

  private minta(): void {
    if (this.siaga || this.tampilkan || this.aktif) return;
    this.o.penjadwal.clearTimeout(this.timerUlang);
    this.siaga = true;
    const nomor = ++this.urutan;
    const masihIni = (): boolean => nomor === this.urutan;
    this.timerSiaga = this.o.penjadwal.setTimeout(() => {
      if (!masihIni() || !this.siaga) return;
      this.siaga = false;
      this.urutan++;
      this.ulangNanti();
    }, BATAS_SIAGA_MS);
    this.o.adBreak({
      type: 'reward',
      name: 'hadiah',
      beforeAd: () => {
        if (!masihIni()) return;
        if (this.aktif) this.aktif.mulai = true;
        this.bisu = true;
        this.o.sebelum?.();
      },
      afterAd: () => {
        if (!masihIni()) return;
        this.pulihkanSuara();
      },
      beforeReward: (showAdFn) => {
        if (!masihIni()) return;
        this.o.penjadwal.clearTimeout(this.timerSiaga);
        this.siaga = false;
        this.gagalBeruntun = 0;
        this.tampilkan = showAdFn;
      },
      adDismissed: () => {
        if (masihIni() && this.aktif) this.aktif.hasil = 'dilewati';
      },
      adViewed: () => {
        if (masihIni() && this.aktif) this.aktif.hasil = 'ditonton';
      },
      adBreakDone: () => {
        if (!masihIni()) return;
        this.o.penjadwal.clearTimeout(this.timerSiaga);
        this.siaga = false;
        if (this.aktif) {
          this.akhiri(this.aktif.hasil ?? 'gagal');
          return;
        }
        // Tidak ada iklan untuk siaga ini (atau tawarannya berakhir): coba lagi nanti.
        this.tampilkan = null;
        this.urutan++;
        this.ulangNanti();
      },
    });
  }

  /** Selesaikan iklan yang sedang diputar, lalu siapkan iklan berikutnya. */
  private akhiri(hasil: HasilIklan): void {
    this.o.penjadwal.clearTimeout(this.timerMulai);
    const a = this.aktif;
    this.aktif = null;
    this.urutan++;
    this.siaga = false;
    this.pulihkanSuara();
    a?.selesai(hasil);
    this.timerUlang = this.o.penjadwal.setTimeout(() => this.minta(), JEDA_SETELAH_IKLAN_MS);
  }

  private ulangNanti(): void {
    this.gagalBeruntun++;
    const ms = JEDA_ULANG_MS[Math.min(this.gagalBeruntun, JEDA_ULANG_MS.length) - 1]!;
    this.timerUlang = this.o.penjadwal.setTimeout(() => this.minta(), ms);
  }

  private pulihkanSuara(): void {
    if (!this.bisu) return;
    this.bisu = false;
    this.o.sesudah?.();
  }
}
