/**
 * Verifikasi token login Firebase (ID token) di server Cloudflare tanpa SDK
 * Admin: JWT RS256 ditandatangani kunci publik Google yang berganti berkala.
 * Syarat dari dokumentasi Firebase ("Verify ID tokens using a third-party JWT
 * library"): alg RS256, kid dikenal, aud = project ID, iss =
 * https://securetoken.google.com/<project ID>, sub (uid) tidak kosong, exp di
 * masa depan, iat & auth_time di masa lalu. Tambahan: hanya login Google
 * (game tidak memakai metode login lain).
 */

/** Kunci publik penanda tangan ID token Firebase (format JWK). */
export const URL_JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/** Selisih jam yang ditoleransi untuk iat & auth_time (detik). */
const TOLERANSI_JAM_DETIK = 300;
/** Kunci dianggap berlaku sekian lama kalau Google tidak menyebut max-age. */
const BERLAKU_BAWAAN_MS = 60 * 60_000;
/** kid tidak dikenal: kunci diambil ulang paling sering sekali per menit (kunci baru Google). */
const AMBIL_ULANG_MIN_MS = 60_000;

export interface JwkRsa {
  readonly kid: string;
  readonly kty: string;
  readonly n: string;
  readonly e: string;
}

export interface KumpulanKunci {
  readonly kunci: readonly JwkRsa[];
  /** Lama kunci boleh dipakai (dari Cache-Control max-age). */
  readonly berlakuMs: number;
}

export class TokenTidakSah extends Error {
  constructor(alasan: string) {
    super(`Token login tidak sah: ${alasan}`);
    this.name = 'TokenTidakSah';
  }
}

export interface OpsiVerifikator {
  readonly projectId: string;
  /** Ambil kunci publik (bawaan: dari Google). */
  readonly ambilKunci?: () => Promise<KumpulanKunci>;
  /** Jam dinding (ms epoch). */
  readonly jam?: () => number;
}

/** Kunci publik Google beserta masa berlakunya. */
export async function ambilKunciGoogle(): Promise<KumpulanKunci> {
  const res = await fetch(URL_JWKS);
  if (!res.ok) throw new Error(`Kunci publik Google tidak bisa diambil (HTTP ${res.status})`);
  const isi = (await res.json()) as { keys?: unknown };
  const kunci = Array.isArray(isi.keys) ? (isi.keys as JwkRsa[]).filter((k) => typeof k.kid === 'string' && k.kty === 'RSA') : [];
  const maxAge = /max-age=(\d+)/.exec(res.headers.get('Cache-Control') ?? '');
  return { kunci, berlakuMs: maxAge ? Number(maxAge[1]) * 1000 : BERLAKU_BAWAAN_MS };
}

function bytesBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const biner = atob(b64);
  const hasil = new Uint8Array(new ArrayBuffer(biner.length));
  for (let i = 0; i < biner.length; i++) hasil[i] = biner.charCodeAt(i);
  return hasil;
}

function jsonBase64Url(s: string): Record<string, unknown> {
  const o: unknown = JSON.parse(new TextDecoder().decode(bytesBase64Url(s)));
  if (typeof o !== 'object' || o === null || Array.isArray(o)) throw new TokenTidakSah('bagian token bukan objek');
  return o as Record<string, unknown>;
}

/**
 * Buat fungsi verifikasi yang menyimpan kunci publik di memori (satu isolate
 * Worker melayani banyak permintaan). Mengembalikan uid; token tidak sah → throw.
 */
export function buatVerifikator(o: OpsiVerifikator): (token: string) => Promise<string> {
  const jam = o.jam ?? (() => Date.now());
  const ambil = o.ambilKunci ?? ambilKunciGoogle;
  let simpanan: { readonly kunci: Map<string, CryptoKey>; readonly habisMs: number; readonly diambilMs: number } | null = null;

  async function kunciUntuk(kid: string): Promise<CryptoKey | null> {
    const sekarang = jam();
    const perluAmbil = !simpanan || sekarang >= simpanan.habisMs || (!simpanan.kunci.has(kid) && sekarang - simpanan.diambilMs >= AMBIL_ULANG_MIN_MS);
    if (perluAmbil) {
      const { kunci, berlakuMs } = await ambil();
      const peta = new Map<string, CryptoKey>();
      for (const k of kunci) {
        peta.set(k.kid, await crypto.subtle.importKey('jwk', { kty: 'RSA', n: k.n, e: k.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
      }
      simpanan = { kunci: peta, habisMs: sekarang + berlakuMs, diambilMs: sekarang };
    }
    return simpanan?.kunci.get(kid) ?? null;
  }

  return async (token: string): Promise<string> => {
    const bagian = token.split('.');
    if (bagian.length !== 3) throw new TokenTidakSah('bukan JWT');
    const [h, p, tanda] = bagian as [string, string, string];
    const header = jsonBase64Url(h);
    const isi = jsonBase64Url(p);
    if (header['alg'] !== 'RS256' || typeof header['kid'] !== 'string') throw new TokenTidakSah('algoritma/kid');
    const detik = Math.floor(jam() / 1000);
    if (isi['aud'] !== o.projectId) throw new TokenTidakSah('aud');
    if (isi['iss'] !== `https://securetoken.google.com/${o.projectId}`) throw new TokenTidakSah('iss');
    const uid = isi['sub'];
    if (typeof uid !== 'string' || uid === '' || uid.length > 128) throw new TokenTidakSah('sub');
    const { exp, iat } = isi;
    const authTime = isi['auth_time'];
    if (typeof exp !== 'number' || exp <= detik) throw new TokenTidakSah('kedaluwarsa');
    if (typeof iat !== 'number' || iat > detik + TOLERANSI_JAM_DETIK) throw new TokenTidakSah('iat');
    if (typeof authTime !== 'number' || authTime > detik + TOLERANSI_JAM_DETIK) throw new TokenTidakSah('auth_time');
    const firebase = isi['firebase'];
    if (typeof firebase !== 'object' || firebase === null || (firebase as Record<string, unknown>)['sign_in_provider'] !== 'google.com') throw new TokenTidakSah('bukan login Google');
    const kunci = await kunciUntuk(header['kid']);
    if (!kunci) throw new TokenTidakSah('kid tidak dikenal');
    const sah = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', kunci, bytesBase64Url(tanda), new TextEncoder().encode(`${h}.${p}`));
    if (!sah) throw new TokenTidakSah('tanda tangan');
    return uid;
  };
}
