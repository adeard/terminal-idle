// Cloudflare Pages Function: /api/peringkat/saya (skor & peringkat pemain yang login, lihat server/peringkat.ts).
import { buatPenyimpanD1, type EnvPeringkat } from '../../../server/d1';
import { aman, tanganiSaya } from '../../../server/peringkat';
import { verifikasiToken } from '../../../server/pages';

type Konteks = { readonly request: Request; readonly env: EnvPeringkat };

export const onRequestGet = ({ request, env }: Konteks): Promise<Response> =>
  aman(() => tanganiSaya(request, { penyimpan: buatPenyimpanD1(env.DB), verifikasi: verifikasiToken }));
