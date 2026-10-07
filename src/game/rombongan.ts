/**
 * Rombongan: sebagian penumpang bepergian bersama anak atau pendamping dewasa.
 * Pengikut bukan agen di DuniaVisual (tidak memakai slot antrean, jendela
 * loket, atau kursi): ia menapak jejak orang yang diikutinya, sedikit di
 * belakang-sampingnya seperti bergandengan tangan. Karena mengikuti jejak,
 * pengikut tidak memotong tali labirin atau blok kursi yang dihindari
 * pemimpinnya. Saat pemimpinnya duduk di ruang tunggu, pengikut duduk di kursi
 * sebelahnya yang sudah dipesan (dunia-visual.ts).
 *
 * Pengantar: ikut menemani sampai gerbang keberangkatan. Begitu penumpangnya
 * keluar gerbang menuju bus, pengantar berhenti di dalam ruang tunggu di
 * samping gerbang dan melambaikan tangan sampai busnya berangkat, lalu pulang:
 * menyusuri ruang tunggu dan aula ke pintu masuk, keluar gerbang pagar, dan
 * menghilang di trotoar. Murni TypeScript supaya bisa dites.
 */
import {
  GEDUNG,
  GERBANG_MASUK_X,
  GERBANG_X,
  KECEPATAN_JALAN,
  KURSI_TUNGGU,
  PINTU_MASUK,
  PINTU_RUANG_TUNGGU,
  SINGGAH_GERBANG_MASUK,
  TITIK_PINTU_LUAR,
  VARIASI_JALAN,
  Y_DEPAN_GERBANG,
  Y_LORONG_LOKET,
  Y_LORONG_TUNGGU,
  Y_PAGAR,
  Y_TROTOAR_BELAKANG,
  type Titik,
} from './tata-letak';

export type PeranPengikut = 'anak' | 'dewasa' | 'pengantar';

export interface Pengikut {
  /** Id unik & stabil (dipakai renderer untuk arah hadap & fase langkah). */
  readonly id: number;
  readonly idPemimpin: number;
  readonly peran: PeranPengikut;
  /** Urutan di rombongan (0 = paling dekat pemimpin). */
  readonly urutan: number;
  x: number;
  y: number;
  /** Sudah duduk di kursi rombongan di sebelah pemimpinnya. */
  duduk: boolean;
  /** Pengantar yang sudah berpisah dari penumpangnya (tidak lagi mengikuti). */
  bebas: boolean;
  /** Sedang berdiri melambaikan tangan ke bus. */
  lambai: boolean;
}

/** Bus yang dipantau pengantar (sudah berangkat atau belum). */
interface BusPantau {
  readonly id: number;
  readonly fase: string;
}

interface Perpisahan {
  readonly f: Pengikut;
  readonly busId: number;
  /** Garis gerbang (x) tempat penumpangnya keluar; jalur pulang menyusuri garis ini. */
  readonly gerbang: number;
  /** Tempat berdiri melambai (di dalam ruang tunggu, di samping gerbang). */
  readonly tempat: Titik;
  /** Sisa detik melambai setelah busnya berangkat. */
  sisa: number;
  /** Rute pulang (null selama masih melambai). */
  rute: Titik[] | null;
}

interface Pemimpin {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly fase?: string;
  /** Kursi yang dipesan untuk anggota rombongan (berlaku selama pemimpin duduk menunggu). */
  readonly kursiRombongan?: readonly number[];
  /** Bus yang akan dinaiki (saat dipanggil ke gerbang). */
  readonly busId?: number;
}

/** Id pengikut = ID_PENGIKUT + 3 × id pemimpin + urutan. */
const ID_PENGIKUT = 4_000_000;
/** Jarak di sepanjang jejak dari pemimpin ke pengikut ke-k. */
const JARAK_JEJAK = [0.13, 0.25] as const;
/** Geser ke samping jejak: anak di sisi kanan (digandeng), pendamping di kiri. */
const GESER_SAMPING: Readonly<Record<PeranPengikut, number>> = { anak: 0.035, dewasa: -0.04, pengantar: -0.04 };
/** Pengantar melambai sekian detik lagi setelah busnya berangkat. */
const LAMBAI_SETELAH_BERANGKAT = 4;
/** Jarak tempat melambai dari garis gerbang (ke samping) dan dari dinding gerbang (ke dalam). */
const TEMPAT_LAMBAI = { samping: 0.4, dalam: 0.1 } as const;
/** Titik jejak dicatat tiap pemimpin bergerak sejauh ini; jejak disimpan sepanjang ini. */
const LANGKAH_JEJAK = 0.02;
const PANJANG_JEJAK = 0.45;
/** Pengikut mengejar titiknya paling cepat sekian × laju jalan tercepat (tidak pernah melompat). */
export const LAJU_KEJAR_MAKS = KECEPATAN_JALAN * (1 + VARIASI_JALAN) * 1.6;

const pecahan = (v: number): number => ((v % 1) + 1) % 1;

/**
 * Anggota rombongan orang ini (selain dirinya), tetap per id: ±7 % bersama satu
 * anak, ±3 % dua anak, ±4 % pendamping dewasa, ±2 % pendamping dewasa & anak,
 * ±5 % diantar sampai gerbang keberangkatan.
 */
export function anggotaRombongan(id: number): readonly PeranPengikut[] {
  const r = pecahan(id * 0.7548776662 + 0.1);
  if (r < 0.07) return ['anak'];
  if (r < 0.1) return ['anak', 'anak'];
  if (r < 0.14) return ['dewasa'];
  if (r < 0.16) return ['dewasa', 'anak'];
  if (r < 0.21) return ['pengantar'];
  return [];
}

/**
 * Rute pengantar pulang dari tempatnya melambai: menyusuri lorong gerbang ke
 * belakang ruang tunggu, lewat pintu ke aula, menyusuri lorong loket (di utara
 * labirin) dan sisi barat labirin ke pintu masuk, lalu keluar gerbang pagar
 * MASUK ke trotoar jalan belakang dan menjauh.
 */
export function rutePulangPengantar(xGerbang: number, arah: 1 | -1): Titik[] {
  const yLorong = Y_LORONG_LOKET + 0.06;
  const yTrotoar = Y_TROTOAR_BELAKANG + 0.04;
  return [
    [xGerbang, Y_DEPAN_GERBANG + TEMPAT_LAMBAI.dalam],
    [xGerbang, Y_LORONG_TUNGGU],
    [PINTU_RUANG_TUNGGU[0] + 0.96, Y_LORONG_TUNGGU + 1.45],
    PINTU_RUANG_TUNGGU,
    [GEDUNG.x1 - 0.15, PINTU_RUANG_TUNGGU[1]],
    [GEDUNG.x1 - 0.45, yLorong],
    [18.4, yLorong],
    [18.4, 14.7],
    [PINTU_MASUK[0], 14.7],
    TITIK_PINTU_LUAR,
    SINGGAH_GERBANG_MASUK,
    [GERBANG_MASUK_X + 0.15, Y_PAGAR],
    [GERBANG_MASUK_X + 0.15, yTrotoar],
    [GERBANG_MASUK_X + arah * 3, yTrotoar],
  ];
}

export class Rombongan {
  readonly pengikut: Pengikut[] = [];
  /** Jejak tiap pemimpin, titik terbaru di depan. */
  private readonly jejak = new Map<number, Titik[]>();
  private readonly peta = new Map<number, Pengikut>();
  /** Pengantar yang sudah berpisah dari penumpangnya (melambai lalu pulang). */
  private readonly berpisah = new Map<number, Perpisahan>();

  /**
   * Perbarui jejak & posisi pengikut dari posisi pemimpin sekarang.
   * @param bus bus di terminal (untuk pengantar: melambai sampai busnya berangkat)
   */
  perbarui(pemimpin: Iterable<Pemimpin>, dt: number, bus: readonly BusPantau[] = []): void {
    const hidup = new Set<number>();
    this.pengikut.length = 0;
    for (const p of pemimpin) {
      const anggota = anggotaRombongan(p.id);
      if (anggota.length === 0) continue;
      hidup.add(p.id);
      const jejak = this.catatJejak(p);
      anggota.forEach((peran, k) => {
        const id = ID_PENGIKUT + p.id * 3 + k;
        if (this.berpisah.has(id)) return;
        // Penumpang keluar gerbang menuju bus: pengantar berhenti di dalam, di samping gerbang.
        if (peran === 'pengantar' && p.fase === 'naikBus' && p.y < Y_DEPAN_GERBANG - 0.05) {
          const f = this.peta.get(id);
          if (f) this.pisahkan(f, p);
          return;
        }
        const kursi = p.fase === 'tungguBerangkat' ? p.kursiRombongan?.[k] : undefined;
        const [tx, ty] = kursi !== undefined ? [KURSI_TUNGGU[kursi]!.x, KURSI_TUNGGU[kursi]!.y] : titikDiJejak(p, jejak, JARAK_JEJAK[k] ?? 0.25, GESER_SAMPING[peran]);
        let f = this.peta.get(id);
        if (!f) {
          // Muncul bersama pemimpinnya (turun dari bus, masuk dari luar).
          f = { id, idPemimpin: p.id, peran, urutan: k, x: tx, y: ty, duduk: false, bebas: false, lambai: false };
          this.peta.set(id, f);
        } else {
          const dx = tx - f.x;
          const dy = ty - f.y;
          const jarak = Math.hypot(dx, dy);
          const langkah = Math.min(jarak, LAJU_KEJAR_MAKS * dt, jarak * Math.min(1, dt * 14));
          if (jarak > 1e-9) {
            f.x += (dx / jarak) * langkah;
            f.y += (dy / jarak) * langkah;
          }
        }
        f.duduk = kursi !== undefined && Math.hypot(tx - f.x, ty - f.y) < 0.01;
        this.pengikut.push(f);
      });
    }
    for (const id of this.jejak.keys()) if (!hidup.has(id)) this.jejak.delete(id);
    for (const [id, f] of this.peta) if (!hidup.has(f.idPemimpin)) this.peta.delete(id);
    this.perbaruiPerpisahan(dt, bus);
  }

  private pisahkan(f: Pengikut, p: Pemimpin): void {
    this.peta.delete(f.id);
    let gerbang = GERBANG_X[0]!;
    for (const g of GERBANG_X) if (Math.abs(g - p.x) < Math.abs(gerbang - p.x)) gerbang = g;
    // Di sisi barat gerbang (kecuali gerbang paling barat, supaya tetap di dalam ruang tunggu).
    const barat = Math.min(...GERBANG_X);
    const sisi = gerbang === barat ? 1 : -1;
    f.bebas = true;
    f.duduk = false;
    this.berpisah.set(f.id, {
      f,
      busId: p.busId ?? -1,
      gerbang,
      tempat: [gerbang + sisi * TEMPAT_LAMBAI.samping, Y_DEPAN_GERBANG + TEMPAT_LAMBAI.dalam],
      sisa: LAMBAI_SETELAH_BERANGKAT,
      rute: null,
    });
  }

  /** Pengantar yang sudah berpisah: ke tempat melambai, melambai, lalu pulang dan hilang. */
  private perbaruiPerpisahan(dt: number, bus: readonly BusPantau[]): void {
    for (const [id, q] of this.berpisah) {
      const f = q.f;
      if (!q.rute) {
        const [tx, ty] = q.tempat;
        const jarak = Math.hypot(tx - f.x, ty - f.y);
        const langkah = Math.min(jarak, KECEPATAN_JALAN * dt);
        if (jarak > 1e-9) {
          f.x += ((tx - f.x) / jarak) * langkah;
          f.y += ((ty - f.y) / jarak) * langkah;
        }
        f.lambai = jarak < 0.02;
        const b = bus.find((c) => c.id === q.busId);
        const masihDiHalte = b !== undefined && (b.fase === 'muat' || b.fase === 'keHalteBerangkat');
        if (!masihDiHalte) q.sisa -= dt;
        if (q.sisa <= 0) {
          f.lambai = false;
          q.rute = rutePulangPengantar(q.gerbang, id % 2 === 0 ? 1 : -1);
        }
      } else {
        let sisaLangkah = KECEPATAN_JALAN * dt;
        while (q.rute.length > 0 && sisaLangkah > 0) {
          const [tx, ty] = q.rute[0]!;
          const jarak = Math.hypot(tx - f.x, ty - f.y);
          if (jarak <= sisaLangkah) {
            f.x = tx;
            f.y = ty;
            sisaLangkah -= jarak;
            q.rute.shift();
          } else {
            f.x += ((tx - f.x) / jarak) * sisaLangkah;
            f.y += ((ty - f.y) / jarak) * sisaLangkah;
            sisaLangkah = 0;
          }
        }
        if (q.rute.length === 0) {
          this.berpisah.delete(id);
          continue;
        }
      }
      this.pengikut.push(f);
    }
  }

  private catatJejak(p: Pemimpin): Titik[] {
    let j = this.jejak.get(p.id);
    if (!j) {
      j = [[p.x, p.y]];
      this.jejak.set(p.id, j);
      return j;
    }
    const [lx, ly] = j[0]!;
    if (Math.hypot(p.x - lx, p.y - ly) >= LANGKAH_JEJAK) {
      j.unshift([p.x, p.y]);
      // Pangkas jejak yang sudah terlalu jauh di belakang.
      let total = 0;
      for (let i = 1; i < j.length; i++) {
        total += Math.hypot(j[i]![0] - j[i - 1]![0], j[i]![1] - j[i - 1]![1]);
        if (total > PANJANG_JEJAK) {
          j.length = i + 1;
          break;
        }
      }
    }
    return j;
  }
}

/**
 * Titik sejauh `jarak` di belakang pemimpin menyusuri jejaknya, digeser ke
 * samping arah jalan. Jejak yang masih pendek: berhenti di ujung jejak.
 */
function titikDiJejak(p: Pemimpin, jejak: readonly Titik[], jarak: number, samping: number): Titik {
  let ax = p.x;
  let ay = p.y;
  let sisa = jarak;
  let arahX = 0;
  let arahY = 0;
  for (const [bx, by] of jejak) {
    const d = Math.hypot(bx - ax, by - ay);
    if (d > 1e-9) {
      arahX = (ax - bx) / d;
      arahY = (ay - by) / d;
    }
    if (d >= sisa && d > 1e-9) {
      const u = sisa / d;
      return geser(ax + (bx - ax) * u, ay + (by - ay) * u, arahX, arahY, samping);
    }
    sisa -= d;
    ax = bx;
    ay = by;
  }
  return geser(ax, ay, arahX, arahY, samping);
}

/** Geser ke kanan arah jalan (arah = satuan maju). Tanpa arah (belum bergerak): tetap. */
function geser(x: number, y: number, arahX: number, arahY: number, samping: number): Titik {
  return [x - arahY * samping, y + arahX * samping];
}
