/**
 * Pemegang GameState saat runtime. Menjalankan fixed timestep dan menerapkan
 * aksi pemain, lalu memberi tahu pelanggan (UI). Tidak menyentuh Phaser/DOM,
 * jadi bisa dites di Node.
 */
import { terapkanAksi, type Aksi } from '../sim/aksi';
import { majukanWaktu } from '../sim/loop';
import type { GameState } from '../sim/state';

/** Akses baca saja. Scene Phaser hanya menerima ini, jadi tidak bisa mengubah state. */
export interface PembacaState {
  readonly state: GameState;
}

export type Pendengar = (state: GameState) => void;
/** Aksi pemain yang berlaku, dengan state sebelum & sesudahnya (mis. untuk analitik). */
export type PemantauAksi = (aksi: Aksi, lama: GameState, baru: GameState) => void;

export class PengendaliGame implements PembacaState {
  private _state: GameState;
  private akumulatorDetik = 0;
  private readonly pendengar = new Set<Pendengar>();
  private readonly pemantauAksi = new Set<PemantauAksi>();

  constructor(stateAwal: GameState) {
    this._state = stateAwal;
  }

  get state(): GameState {
    return this._state;
  }

  /** Majukan waktu nyata; hanya memberi tahu pelanggan kalau ada tick yang jalan. */
  majukan(dtDetik: number): void {
    const hasil = majukanWaktu(this._state, this.akumulatorDetik, dtDetik);
    this.akumulatorDetik = hasil.akumulatorDetik;
    if (hasil.jumlahTick > 0) this.ganti(hasil.state);
  }

  /** @returns true kalau aksi berlaku dan state berubah. */
  kirim(aksi: Aksi): boolean {
    const lama = this._state;
    const baru = terapkanAksi(lama, aksi);
    if (baru === lama) return false;
    this.ganti(baru);
    for (const fn of this.pemantauAksi) fn(aksi, lama, baru);
    return true;
  }

  /** Dipanggil tiap aksi pemain yang berlaku (setelah pelanggan state diberi tahu). */
  pantauAksi(fn: PemantauAksi): () => void {
    this.pemantauAksi.add(fn);
    return () => this.pemantauAksi.delete(fn);
  }

  /** Terapkan transformasi murni (mis. tandaiWaktu) tanpa mereset akumulator tick. */
  ubah(fn: (state: GameState) => GameState): void {
    const baru = fn(this._state);
    if (baru !== this._state) this.ganti(baru);
  }

  /** Ganti seluruh state (mis. setelah load save). */
  setel(state: GameState): void {
    this.akumulatorDetik = 0;
    this.ganti(state);
  }

  /** Pendengar langsung dipanggil sekali dengan state saat ini. */
  berlangganan(fn: Pendengar): () => void {
    this.pendengar.add(fn);
    fn(this._state);
    return () => this.pendengar.delete(fn);
  }

  private ganti(state: GameState): void {
    this._state = state;
    for (const fn of this.pendengar) fn(state);
  }
}
