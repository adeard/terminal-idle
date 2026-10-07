// Cloudflare Pages Function: /api/peringkat (papan peringkat mingguan, lihat server/peringkat.ts).
import { buatPenyimpanD1, type EnvPeringkat } from '../../../server/d1';
import { aman, tanganiKeluar, tanganiKirim, tanganiPapan, type Ketergantungan } from '../../../server/peringkat';
import { verifikasiToken } from '../../../server/pages';

type Konteks = { readonly request: Request; readonly env: EnvPeringkat };

function ketergantungan(env: EnvPeringkat): Ketergantungan {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default ?? null;
  return { penyimpan: buatPenyimpanD1(env.DB), verifikasi: verifikasiToken, cache };
}

export const onRequestGet = ({ request, env }: Konteks): Promise<Response> => aman(() => tanganiPapan(request, ketergantungan(env)));
export const onRequestPost = ({ request, env }: Konteks): Promise<Response> => aman(() => tanganiKirim(request, ketergantungan(env)));
export const onRequestDelete = ({ request, env }: Konteks): Promise<Response> => aman(() => tanganiKeluar(request, ketergantungan(env)));
