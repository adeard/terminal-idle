/**
 * Ekonomi v2, penumpang & tiket per segmen (murni): tiap PO × jurusan aktif ×
 * kelas bus aktif adalah satu segmen. Mesinnya perluasan arusHarga v1 (jatah
 * kursi tetap, kursi kosong tidak diisi segmen lain), ditambah:
 * - jatah kursi PO sebanding loket yang disewanya;
 * - reputasi PO mengalikan minat;
 * - persaingan: di jurusan yang sama, PO yang lebih murah/bereputasi dari
 *   rata-rata pesaingnya mendapat bagian lebih besar;
 * - kejenuhan: makin banyak PO di satu jurusan, makin kecil bagian tiap PO
 *   (jurusan ramai menampung lebih banyak PO).
 * Satu PO saja dengan harga normal & faktor reputasi 1 = hasil v1.
 * Rancangan: bagian 6 documents/12-rancangan-ekonomi-po.md.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import type { KelasBusId, PoId } from './fitur';
import { faktorReputasi, jurusanAktif, kelasAktif, nilaiJurusan, nilaiTiketPo } from './mitra';

/** Satu PO terdaftar, sebagaimana dibutuhkan hitungan segmen. */
export interface PoSegmen {
  readonly id: PoId;
  readonly level: number;
  /** Loket yang disewa PO ini. */
  readonly loket: number;
  /** 0–100. */
  readonly reputasi: number;
  /** Harga per jurusan (indeks EKONOMI.jurusan → persen harga normal); yang tidak disebut = 100. */
  readonly harga?: Readonly<Partial<Record<number, number>>>;
}

export interface OpsiSegmen {
  /** Abaikan harga yang diatur pemain (semua 100 %): dasar hadiah & target, supaya tidak bisa digelembungkan lewat harga. */
  readonly hargaNormal?: boolean;
}

export interface HasilSegmenPo {
  readonly id: PoId;
  /** Bagian kursi terminal milik PO ini (loket ÷ semua loket terisi). */
  readonly kursi: number;
  /** Bagian kursi terminal yang terisi penumpang PO ini (≤ kursi). */
  readonly terisi: number;
  /** Uang tiket per detik per 1 pnp/dtk throughput yang masuk lewat PO ini (Rp). */
  readonly tiket: number;
  /** Harga rata-rata PO ini (persen harga normal, berbobot kursi), dasar reputasinya. */
  readonly hargaRataPersen: number;
  readonly jurusan: readonly number[];
  readonly kelas: readonly KelasBusId[];
}

export interface HasilSegmen {
  /** Bagian kursi terminal yang terisi (0–1): arus = throughput × terisi. */
  readonly terisi: number;
  /** Uang tiket per detik per 1 pnp/dtk throughput (Rp): pendapatan tiket = throughput × tiket. */
  readonly tiket: number;
  readonly po: readonly HasilSegmenPo[];
}

interface InfoPo {
  readonly p: PoSegmen;
  readonly kursi: number;
  readonly jurusan: number[];
  readonly kelas: KelasBusId[];
  readonly totalPeminatJurusan: number;
  readonly totalPeminatKelas: number;
  readonly faktor: number;
  readonly nilaiPo: number;
  readonly harga: (j: number) => number;
}

/**
 * Kursi terisi & uang tiket semua segmen pada permintaan tertentu.
 * @param permintaan calon penumpang dibanding kapasitas pada harga normal (1 = tepat penuh;
 *   Infinity = selalu penuh, untuk pendapatan potensial)
 * @param kelasTerminal kelas terminal sekarang (membatasi jurusan antarpulau & kelas bus)
 */
export function hitungSegmen(daftar: readonly PoSegmen[], permintaan: number, kelasTerminal: number, cfg: KonfigEkonomi = EKONOMI, opsi: OpsiSegmen = {}): HasilSegmen {
  const m = cfg.mitra;
  const nTerisi = daftar.reduce((a, p) => a + Math.max(0, p.loket), 0);
  if (!(nTerisi > 0)) {
    return { terisi: 0, tiket: 0, po: daftar.map((p) => ({ id: p.id, kursi: 0, terisi: 0, tiket: 0, hargaRataPersen: 100, jurusan: [], kelas: [] })) };
  }

  const info: InfoPo[] = daftar.map((p) => {
    const ada = p.loket > 0;
    const jurusan = ada ? jurusanAktif(p.id, p.level, kelasTerminal, cfg) : [];
    const kelas = ada ? kelasAktif(p.id, p.level, kelasTerminal, cfg) : [];
    return {
      p,
      kursi: Math.max(0, p.loket) / nTerisi,
      jurusan,
      kelas,
      totalPeminatJurusan: jurusan.reduce((a, j) => a + cfg.jurusan[j]!.peminat, 0),
      totalPeminatKelas: kelas.reduce((a, k) => a + cfg.kelasBus[k].peminat, 0),
      faktor: faktorReputasi(p.reputasi, cfg),
      nilaiPo: nilaiTiketPo(p.level, cfg),
      harga: (j: number) => (opsi.hargaNormal ? 100 : (p.harga?.[j] ?? 100)),
    };
  });

  // Per jurusan: bobot kursi semua PO yang melayaninya, rata-rata daya tariknya, dan jumlah PO.
  const perJurusan = new Map<number, { w: number; wa: number; n: number }>();
  const dayaTarik = (x: InfoPo, j: number): number => x.faktor * Math.pow(x.harga(j) / 100, -cfg.jurusan[j]!.elastisitas);
  for (const x of info) {
    if (x.kelas.length === 0) continue;
    for (const j of x.jurusan) {
      const w = x.kursi * (cfg.jurusan[j]!.peminat / x.totalPeminatJurusan);
      const e = perJurusan.get(j) ?? { w: 0, wa: 0, n: 0 };
      e.w += w;
      e.wa += w * dayaTarik(x, j);
      e.n += 1;
      perJurusan.set(j, e);
    }
  }

  let terisi = 0;
  let tiket = 0;
  const hasilPo: HasilSegmenPo[] = info.map((x) => {
    let isiPo = 0;
    let tiketPo = 0;
    let bobotHarga = 0;
    let jumlahHarga = 0;
    if (x.kelas.length > 0) {
      for (const j of x.jurusan) {
        const cj = cfg.jurusan[j]!;
        const e = perJurusan.get(j)!;
        const h = x.harga(j);
        const persaingan = Math.pow(dayaTarik(x, j) / (e.wa / e.w), m.persaingan.gamma);
        const kejenuhan = 1 / (1 + (m.persaingan.kejenuhan / cj.peminat) * (e.n - 1));
        const bobotJ = cj.peminat / x.totalPeminatJurusan;
        bobotHarga += bobotJ;
        jumlahHarga += bobotJ * h;
        for (const k of x.kelas) {
          const ck = cfg.kelasBus[k];
          const w = x.kursi * bobotJ * (ck.peminat / x.totalPeminatKelas);
          const elastisitas = (cj.elastisitas + ck.elastisitas) / 2;
          const minat = permintaan * x.faktor * Math.pow(h / 100, -elastisitas) * persaingan * kejenuhan;
          const isi = Math.min(1, minat);
          isiPo += w * isi;
          tiketPo += w * isi * cfg.nilaiPerPenumpang * nilaiJurusan(j, cfg) * m.kelas[k].nilai * x.nilaiPo * (h / 100);
        }
      }
    }
    terisi += isiPo;
    tiket += tiketPo;
    return {
      id: x.p.id,
      kursi: x.kursi,
      terisi: isiPo,
      tiket: tiketPo,
      hargaRataPersen: bobotHarga > 0 ? jumlahHarga / bobotHarga : 100,
      jurusan: x.jurusan,
      kelas: x.kelas,
    };
  });
  return { terisi, tiket, po: hasilPo };
}
