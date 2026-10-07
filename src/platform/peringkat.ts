/**
 * Papan peringkat lewat HTTP ke /api/peringkat (Cloudflare Pages Functions di
 * situs sendiri, lihat server/peringkat.ts). Membaca papan tidak butuh login;
 * kirim skor, peringkat sendiri, dan keluar membawa ID token login Google.
 * Di `npm run dev`, /api diteruskan Vite ke `wrangler pages dev` (vite.config.ts).
 */
import { bacaPapan, bacaSaya, GalatPeringkat, isKodeGalatPeringkat, type ApiPeringkat, type KodeGalatPeringkat } from '../app/peringkat';

/** Batas tunggu tiap permintaan. */
const BATAS_MS = 10_000;

/** @param tokenId ID token login sekarang, atau null kalau tidak login. */
export function buatApiPeringkat(tokenId: () => Promise<string | null>, dasar = '/api/peringkat'): ApiPeringkat {
  async function minta(jalur: string, init: RequestInit = {}, login = false): Promise<Response> {
    const headers = new Headers(init.headers);
    if (login) {
      const token = await tokenId().catch(() => null);
      if (!token) throw new GalatPeringkat('token');
      headers.set('Authorization', `Bearer ${token}`);
    }
    const batal = new AbortController();
    const waktu = setTimeout(() => batal.abort(), BATAS_MS);
    let res: Response;
    try {
      res = await fetch(dasar + jalur, { ...init, headers, signal: batal.signal });
    } catch {
      throw new GalatPeringkat('jaringan');
    } finally {
      clearTimeout(waktu);
    }
    if (res.ok) return res;
    let kode: KodeGalatPeringkat = 'server';
    try {
      const isi = (await res.json()) as { galat?: unknown };
      if (isKodeGalatPeringkat(isi.galat)) kode = isi.galat;
    } catch {
      // Bukan jawaban API (mis. server dev tanpa wrangler): galat server.
    }
    throw new GalatPeringkat(kode, Number(res.headers.get('Retry-After') ?? 0) * 1000);
  }

  return {
    async papan(minggu) {
      return bacaPapan(await (await minta(`?minggu=${encodeURIComponent(minggu)}`)).json());
    },
    async saya() {
      return bacaSaya(await (await minta('/saya', {}, true)).json());
    },
    async kirim(k) {
      // keepalive: kiriman saat tab ditutup tetap sampai.
      await minta('', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(k) }, true);
    },
    async keluar() {
      await minta('', { method: 'DELETE' }, true);
    },
  };
}
