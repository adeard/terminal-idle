/**
 * Papan peringkat dari sisi game (murni, tanpa DOM): papan yang sudah dimuat
 * (di-cache sebentar), peringkat sendiri, ikut/keluar papan, dan pengirim skor.
 * UI (ui/peringkat.ts) hanya memanggil ini; jaringannya lewat ApiPeringkat
 * (platform/peringkat.ts), jadi seluruh alurnya bisa dites di Node.
 */
import type { Aksi } from '../sim/aksi';
import type { GameState } from '../sim/state';
import { mingguWib } from '../sim/tantangan';
import { GalatPeringkat, idPublik, PengirimSkor, type ApiPeringkat, type PapanPeringkat, type PeringkatSaya } from './peringkat';

/** Papan yang sudah dimuat dipakai ulang selama ini (server pun men-cache 60 dtk). */
const SEGAR_PAPAN_MS = 60_000;
/** Peringkat sendiri di kartu tab Target diperbarui paling sering tiap 5 menit (hemat baca database). */
const SEGAR_SAYA_MS = 5 * 60_000;

export interface OpsiLayananPeringkat {
  readonly api: ApiPeringkat;
  /** uid akun yang login, atau null (tamu: hanya bisa melihat papan). */
  readonly uid: string | null;
  readonly ambilState: () => GameState;
  readonly kirimAksi: (aksi: Aksi) => void;
  /** Jam dinding (ms epoch). */
  readonly jam?: () => number;
}

export class LayananPeringkat {
  readonly pengirim: PengirimSkor;
  /** Id publik pemain ini (untuk menandai barisnya sendiri), null = tamu. */
  readonly idSaya: string | null;
  private readonly papanTersimpan = new Map<string, { readonly papan: PapanPeringkat; readonly ms: number }>();
  private sayaTersimpan: { readonly saya: PeringkatSaya; readonly ms: number } | null = null;
  private memuatSaya = false;
  private readonly pendengar = new Set<() => void>();
  private readonly jam: () => number;

  constructor(private readonly o: OpsiLayananPeringkat) {
    this.jam = o.jam ?? (() => Date.now());
    this.pengirim = new PengirimSkor((k) => o.api.kirim(k), this.jam);
    this.idSaya = o.uid === null ? null : idPublik(o.uid);
    this.pengirim.berlangganan(() => this.beritahu());
  }

  /** Pemain login (bisa ikut papan). */
  get masuk(): boolean {
    return this.o.uid !== null;
  }

  /** Peringkat sendiri minggu ini yang terakhir dimuat, atau null. */
  get saya(): PeringkatSaya | null {
    const s = this.sayaTersimpan?.saya ?? null;
    return s !== null && s.minggu === mingguWib(this.jam()).kunci ? s : null;
  }

  /** Dipanggil saat peringkat sendiri atau status pengiriman berubah. */
  berlangganan(f: () => void): () => void {
    this.pendengar.add(f);
    return () => this.pendengar.delete(f);
  }

  /** Dipanggil tiap state berubah; `segera` saat game dijeda/ditutup. Tamu tidak pernah mengirim. */
  periksa(state: GameState, segera = false): void {
    if (this.masuk) this.pengirim.periksa(state, segera);
  }

  /** Papan sebuah minggu (`paksa` = abaikan yang tersimpan). Galat jaringan dilempar. */
  async papan(minggu: string, paksa = false): Promise<PapanPeringkat> {
    const t = this.papanTersimpan.get(minggu);
    if (t && !paksa && this.jam() - t.ms < SEGAR_PAPAN_MS) return t.papan;
    const papan = await this.o.api.papan(minggu);
    this.papanTersimpan.set(minggu, { papan, ms: this.jam() });
    return papan;
  }

  /** Muat ulang peringkat sendiri (paling sering tiap 5 menit kecuali `paksa`); galat diabaikan. */
  async segarkanSaya(paksa = false): Promise<void> {
    if (!this.masuk || !this.o.ambilState().profil.ikutPeringkat || this.memuatSaya) return;
    if (!paksa && this.sayaTersimpan && this.jam() - this.sayaTersimpan.ms < SEGAR_SAYA_MS) return;
    this.memuatSaya = true;
    try {
      this.sayaTersimpan = { saya: await this.o.api.saya(), ms: this.jam() };
      this.beritahu();
    } catch {
      // Jaringan/server: kartu tetap memakai peringkat terakhir, dicoba lagi nanti.
    } finally {
      this.memuatSaya = false;
    }
  }

  /**
   * Ikut papan (pemain sudah menyetujui di UI): tandai di save, kirim skor
   * pertama, lalu muat ulang papan & peringkat. Galat kiriman pertama dilempar.
   */
  async ikut(): Promise<void> {
    if (!this.masuk) throw new GalatPeringkat('token');
    this.o.kirimAksi({ jenis: 'aturIkutPeringkat', ikut: true });
    await this.pengirim.kirimSekarang(this.o.ambilState());
    this.papanTersimpan.clear();
    await this.segarkanSaya(true);
  }

  /** Keluar papan: skor dihapus di server dulu; baru setelah berhasil ditandai di save. */
  async keluar(): Promise<void> {
    if (!this.masuk) return;
    await this.o.api.keluar();
    this.o.kirimAksi({ jenis: 'aturIkutPeringkat', ikut: false });
    this.pengirim.lupakan();
    this.sayaTersimpan = null;
    this.papanTersimpan.clear();
    this.beritahu();
  }

  private beritahu(): void {
    for (const f of this.pendengar) f();
  }
}
