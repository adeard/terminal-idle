/**
 * Slot sel di lembar tekstur yang dipakai bergantian (murni, tanpa DOM &
 * three.js). Tiap kunci (mis. kelas bus + livery) menempati satu slot selama
 * masih ada yang memakainya; slot yang tidak dipakai lagi diisi kunci baru,
 * yang paling lama tidak dipakai lebih dulu, jadi sel yang sering muncul
 * tetap tersimpan dan tidak perlu dilukis ulang.
 */
export interface PesananSel {
  readonly slot: number;
  /** Slot baru diisi kunci ini: selnya perlu dilukis (dan diunggah). */
  readonly baru: boolean;
}

export class CacheSel {
  private readonly kunci: (string | null)[];
  private readonly pemakai: number[];
  private readonly terakhir: number[];
  private readonly slotKunci = new Map<string, number>();
  private jam = 0;

  constructor(readonly kapasitas: number) {
    this.kunci = Array.from({ length: kapasitas }, () => null);
    this.pemakai = Array.from({ length: kapasitas }, () => 0);
    this.terakhir = Array.from({ length: kapasitas }, () => 0);
  }

  /**
   * Pakai slot kunci ini (pemakainya bertambah satu): slot yang sudah berisi
   * kunci itu, atau slot kosong / yang paling lama tidak dipakai. null = semua
   * slot sedang dipakai kunci lain.
   */
  pesan(kunci: string): PesananSel | null {
    this.jam++;
    const ada = this.slotKunci.get(kunci);
    if (ada !== undefined) {
      this.pemakai[ada]!++;
      this.terakhir[ada] = this.jam;
      return { slot: ada, baru: false };
    }
    let pilih = -1;
    for (let i = 0; i < this.kapasitas; i++) {
      if (this.pemakai[i]! > 0) continue;
      if (this.kunci[i] === null) {
        pilih = i;
        break;
      }
      if (pilih < 0 || this.terakhir[i]! < this.terakhir[pilih]!) pilih = i;
    }
    if (pilih < 0) return null;
    const lama = this.kunci[pilih];
    if (lama != null) this.slotKunci.delete(lama);
    this.kunci[pilih] = kunci;
    this.slotKunci.set(kunci, pilih);
    this.pemakai[pilih] = 1;
    this.terakhir[pilih] = this.jam;
    return { slot: pilih, baru: true };
  }

  /** Satu pemakai berhenti memakai slot ini (kuncinya tetap tersimpan sampai slotnya diisi ulang). */
  lepas(slot: number): void {
    if (this.pemakai[slot]! > 0) this.pemakai[slot]!--;
    this.terakhir[slot] = ++this.jam;
  }

  /** Kunci tersimpan yang cocok (untuk berbagi sel saat semua slot terpakai); `acak` 0–1 memilih di antaranya. */
  cari(cocok: (kunci: string) => boolean, acak = 0): string | null {
    const daftar = [...this.slotKunci.keys()].filter(cocok);
    if (daftar.length === 0) return null;
    return daftar[Math.min(daftar.length - 1, Math.floor(acak * daftar.length))]!;
  }

  kunciDi(slot: number): string | null {
    return this.kunci[slot] ?? null;
  }

  pemakaiDi(slot: number): number {
    return this.pemakai[slot] ?? 0;
  }
}
