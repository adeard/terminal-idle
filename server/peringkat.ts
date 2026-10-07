/**
 * API papan peringkat (Cloudflare Pages Functions, lihat functions/api/peringkat/):
 *
 *   GET    /api/peringkat?minggu=YYYY-MM-DD  publik: baris teratas minggu ini (atau minggu lalu), di-cache 60 dtk
 *   GET    /api/peringkat/saya               login: skor & peringkat sendiri minggu ini
 *   POST   /api/peringkat                    login: kirim skor {minggu, skor, kelas, nama}
 *   DELETE /api/peringkat                    login: hapus semua skor sendiri (keluar papan / hapus akun)
 *
 * Login = header `Authorization: Bearer <ID token Firebase>`. Penyimpanan &
 * verifikasi token dimasukkan dari luar (D1 & kunci Google di produksi, tiruan
 * di tes). Validasi kiriman ada di src/app/peringkat.ts (dipakai game juga).
 */
import {
  BATAS_PERINGKAT,
  JUMLAH_PAPAN,
  mingguSebelum,
  mulaiMinggu,
  SELANG_MIN_SERVER_MS,
  skorMaksWajar,
  validasiKiriman,
  type EntriPeringkat,
  type KodeGalatPeringkat,
  type PapanPeringkat,
  type PeringkatSaya,
} from '../src/app/peringkat';
import { mingguWib } from '../src/sim/tantangan';

export interface BarisSkor {
  readonly minggu: string;
  readonly uid: string;
  readonly nama: string;
  readonly kelas: number;
  readonly skor: number;
  readonly diperbaruiMs: number;
}

export interface PenyimpanPeringkat {
  ambil(minggu: string, uid: string): Promise<BarisSkor | null>;
  /** Simpan baris (skor tidak pernah turun) lalu buang minggu sebelum `buangSebelum`. */
  simpan(b: BarisSkor, buangSebelum: string): Promise<void>;
  /** Baris teratas: skor terbesar dulu, skor sama → yang lebih dulu mencapainya. */
  teratas(minggu: string, n: number): Promise<EntriPeringkat[]>;
  jumlah(minggu: string): Promise<number>;
  /** Banyaknya skor di atas `skor`, dihitung paling banyak sampai `batas`. */
  diAtas(minggu: string, skor: number, batas: number): Promise<number>;
  hapusPemain(uid: string): Promise<void>;
  dilarang(uid: string): Promise<boolean>;
}

export interface Ketergantungan {
  readonly penyimpan: PenyimpanPeringkat;
  /** uid dari ID token Firebase; token tidak sah → throw. */
  readonly verifikasi: (token: string) => Promise<string>;
  /** Jam dinding (ms epoch). */
  readonly jam?: () => number;
  /** Cache edge Cloudflare untuk GET papan (tidak ada di tes). */
  readonly cache?: Cache | null;
}

const STATUS_GALAT: Readonly<Record<KodeGalatPeringkat, number>> = {
  token: 401,
  dilarang: 403,
  'terlalu-sering': 429,
  'minggu-lain': 409,
  'nama-kosong': 422,
  'nama-ditolak': 422,
  'skor-tidak-wajar': 422,
  'data-salah': 400,
  server: 500,
  jaringan: 503,
};

function json(isi: unknown, status = 200, header: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(isi), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...header },
  });
}

export function jawabGalat(kode: KodeGalatPeringkat, header: Record<string, string> = {}): Response {
  return json({ galat: kode }, STATUS_GALAT[kode], header);
}

/** Jalankan handler; galat tak terduga → 500 tanpa membocorkan isinya. */
export async function aman(f: () => Promise<Response>): Promise<Response> {
  try {
    return await f();
  } catch (e) {
    console.error('[peringkat]', e);
    return jawabGalat('server');
  }
}

async function uidDari(req: Request, d: Ketergantungan): Promise<string | null> {
  const m = /^Bearer\s+(\S+)$/.exec(req.headers.get('Authorization') ?? '');
  if (!m) return null;
  try {
    return await d.verifikasi(m[1]!);
  } catch {
    return null;
  }
}

/** GET /api/peringkat: publik, di-cache di edge (minggu ini 60 dtk, minggu lalu 10 menit). */
export async function tanganiPapan(req: Request, d: Ketergantungan): Promise<Response> {
  const ini = mingguWib((d.jam ?? Date.now)()).kunci;
  const diminta = new URL(req.url).searchParams.get('minggu');
  const minggu = diminta !== null && diminta === mingguSebelum(ini) ? diminta : ini;
  const kunciCache = new Request(new URL(`/api/peringkat?minggu=${minggu}`, req.url).toString());
  const simpanan = d.cache ? await d.cache.match(kunciCache).catch(() => undefined) : undefined;
  if (simpanan) return simpanan;
  const [daftar, jumlah] = await Promise.all([d.penyimpan.teratas(minggu, JUMLAH_PAPAN), d.penyimpan.jumlah(minggu)]);
  const isi: PapanPeringkat = { minggu, daftar, jumlah };
  const res = json(isi, 200, { 'Cache-Control': `public, max-age=${minggu === ini ? 60 : 600}`, 'Access-Control-Allow-Origin': '*' });
  if (d.cache) await d.cache.put(kunciCache, res.clone()).catch(() => undefined);
  return res;
}

/** POST /api/peringkat: kirim skor minggu ini (nama & kelas ikut diperbarui). */
export async function tanganiKirim(req: Request, d: Ketergantungan): Promise<Response> {
  const uid = await uidDari(req, d);
  if (uid === null) return jawabGalat('token');
  let isi: unknown;
  try {
    isi = await req.json();
  } catch {
    return jawabGalat('data-salah');
  }
  const sekarang = (d.jam ?? Date.now)();
  const v = validasiKiriman(isi, sekarang);
  if (!v.ok) return jawabGalat(v.kode);
  const k = v.kiriman;
  const [dilarang, lama] = await Promise.all([d.penyimpan.dilarang(uid), d.penyimpan.ambil(k.minggu, uid)]);
  if (dilarang) return jawabGalat('dilarang');
  if (lama && sekarang - lama.diperbaruiMs < SELANG_MIN_SERVER_MS) {
    const tunggu = Math.ceil((SELANG_MIN_SERVER_MS - (sekarang - lama.diperbaruiMs)) / 1000);
    return jawabGalat('terlalu-sering', { 'Retry-After': String(tunggu) });
  }
  if (k.skor > skorMaksWajar(lama?.skor ?? 0, lama ? lama.diperbaruiMs : mulaiMinggu(k.minggu), sekarang)) return jawabGalat('skor-tidak-wajar');
  const skor = Math.max(k.skor, lama?.skor ?? 0);
  // Simpan minggu ini & minggu lalu saja (papan "minggu lalu"); yang lebih tua dibuang.
  const ini = mingguWib(sekarang).kunci;
  await d.penyimpan.simpan({ minggu: k.minggu, uid, nama: k.nama, kelas: k.kelas, skor, diperbaruiMs: sekarang }, mingguSebelum(ini) ?? ini);
  return json({ minggu: k.minggu, skor });
}

/** GET /api/peringkat/saya: skor & peringkat sendiri minggu ini (peringkat dihitung sampai BATAS_PERINGKAT). */
export async function tanganiSaya(req: Request, d: Ketergantungan): Promise<Response> {
  const uid = await uidDari(req, d);
  if (uid === null) return jawabGalat('token');
  const minggu = mingguWib((d.jam ?? Date.now)()).kunci;
  const [b, jumlah] = await Promise.all([d.penyimpan.ambil(minggu, uid), d.penyimpan.jumlah(minggu)]);
  let peringkat: number | null = null;
  if (b) {
    const diAtas = await d.penyimpan.diAtas(minggu, b.skor, BATAS_PERINGKAT);
    peringkat = diAtas < BATAS_PERINGKAT ? diAtas + 1 : null;
  }
  const isi: PeringkatSaya = { minggu, skor: b?.skor ?? null, peringkat, jumlah };
  return json(isi);
}

/** DELETE /api/peringkat: hapus semua skor pemain ini (semua minggu). */
export async function tanganiKeluar(req: Request, d: Ketergantungan): Promise<Response> {
  const uid = await uidDari(req, d);
  if (uid === null) return jawabGalat('token');
  await d.penyimpan.hapusPemain(uid);
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
