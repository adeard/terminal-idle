import { beforeAll, describe, expect, it, vi } from 'vitest';
import { idPublik, mingguSebelum, SELANG_MIN_SERVER_MS, type EntriPeringkat } from '../src/app/peringkat';
import { tengahMalamWib } from '../src/sim/event';
import { aman, tanganiKeluar, tanganiKirim, tanganiPapan, tanganiSaya, type BarisSkor, type Ketergantungan, type PenyimpanPeringkat } from '../server/peringkat';
import { buatVerifikator, type JwkRsa } from '../server/token-firebase';

const RABU = tengahMalamWib(2026, 9, 30) + 12 * 3_600_000;
const PROYEK = 'bustation-uji';

// ---------------------------------------------------------------------------
// Token Firebase tiruan, ditandatangani kunci RSA buatan tes

const b64url = (b: Uint8Array): string => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const teksB64url = (s: string): string => b64url(new TextEncoder().encode(s));

let kunci: CryptoKeyPair;
let jwk: JwkRsa;
let kunciLain: CryptoKeyPair;

beforeAll(async () => {
  const alg = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
  kunci = (await crypto.subtle.generateKey(alg, true, ['sign', 'verify'])) as CryptoKeyPair;
  kunciLain = (await crypto.subtle.generateKey(alg, true, ['sign', 'verify'])) as CryptoKeyPair;
  const pub = await crypto.subtle.exportKey('jwk', kunci.publicKey);
  jwk = { kid: 'kunci-1', kty: 'RSA', n: pub.n!, e: pub.e! };
});

async function buatToken(ubah: Record<string, unknown> = {}, o: { kid?: string; pasang?: CryptoKeyPair; detik?: number } = {}): Promise<string> {
  const detik = o.detik ?? Math.floor(RABU / 1000);
  const header = { alg: 'RS256', kid: o.kid ?? 'kunci-1', typ: 'JWT' };
  const isi = {
    iss: `https://securetoken.google.com/${PROYEK}`,
    aud: PROYEK,
    auth_time: detik - 100,
    user_id: 'uid-1',
    sub: 'uid-1',
    iat: detik - 10,
    exp: detik + 3500,
    firebase: { sign_in_provider: 'google.com' },
    ...ubah,
  };
  const tanpaTanda = `${teksB64url(JSON.stringify(header))}.${teksB64url(JSON.stringify(isi))}`;
  const tanda = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', (o.pasang ?? kunci).privateKey, new TextEncoder().encode(tanpaTanda));
  return `${tanpaTanda}.${b64url(new Uint8Array(tanda))}`;
}

describe('verifikasi token login Firebase', () => {
  const verifikator = (jam = RABU) => {
    let ambil = 0;
    const v = buatVerifikator({ projectId: PROYEK, jam: () => jam, ambilKunci: async () => (ambil++, { kunci: [jwk], berlakuMs: 3_600_000 }) });
    return { v, jumlahAmbil: () => ambil };
  };

  it('token sah → uid; kunci publik diambil sekali lalu disimpan', async () => {
    const { v, jumlahAmbil } = verifikator();
    expect(await v(await buatToken())).toBe('uid-1');
    expect(await v(await buatToken({ sub: 'uid-2' }))).toBe('uid-2');
    expect(jumlahAmbil()).toBe(1);
  });

  it('menolak token yang salah proyek, kedaluwarsa, bukan login Google, dipalsukan, atau rusak', async () => {
    const { v } = verifikator();
    const tolak = async (t: string | Promise<string>) => expect(v(await t)).rejects.toThrow(/Token login tidak sah/);
    await tolak(buatToken({ aud: 'proyek-lain' }));
    await tolak(buatToken({ iss: 'https://securetoken.google.com/proyek-lain' }));
    await tolak(buatToken({ exp: Math.floor(RABU / 1000) - 1 }));
    await tolak(buatToken({ iat: Math.floor(RABU / 1000) + 3600 }));
    await tolak(buatToken({ sub: '' }));
    await tolak(buatToken({ firebase: { sign_in_provider: 'anonymous' } }));
    await tolak(buatToken({}, { pasang: kunciLain }));
    await tolak(buatToken({}, { kid: 'kunci-tak-dikenal' }));
    await tolak('bukan.token');
    const sah = await buatToken();
    const [h, , s] = sah.split('.');
    await tolak(`${h}.${teksB64url(JSON.stringify({ sub: 'penyusup' }))}.${s}`);
  });

  it('kid baru: kunci diambil ulang (paling sering sekali per menit)', async () => {
    let jam = RABU;
    let daftar: JwkRsa[] = [];
    let ambil = 0;
    const v = buatVerifikator({ projectId: PROYEK, jam: () => jam, ambilKunci: async () => (ambil++, { kunci: daftar, berlakuMs: 3_600_000 }) });
    const token = await buatToken({}, { detik: Math.floor(RABU / 1000) + 120 });
    await expect(v(token)).rejects.toThrow();
    daftar = [jwk];
    jam += 30_000;
    await expect(v(token)).rejects.toThrow();
    expect(ambil).toBe(1);
    jam += 31_000;
    expect(await v(token)).toBe('uid-1');
    expect(ambil).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// API dengan penyimpanan di memori

function penyimpanMemori(): PenyimpanPeringkat & { baris: BarisSkor[]; larangan: Set<string> } {
  const baris: BarisSkor[] = [];
  const larangan = new Set<string>();
  const urut = (minggu: string) =>
    baris.filter((b) => b.minggu === minggu).sort((a, b) => b.skor - a.skor || a.diperbaruiMs - b.diperbaruiMs);
  return {
    baris,
    larangan,
    async ambil(minggu, uid) {
      return baris.find((b) => b.minggu === minggu && b.uid === uid) ?? null;
    },
    async simpan(b, buangSebelum) {
      const i = baris.findIndex((x) => x.minggu === b.minggu && x.uid === b.uid);
      if (i >= 0) baris[i] = { ...b, skor: Math.max(baris[i]!.skor, b.skor) };
      else baris.push(b);
      for (let j = baris.length - 1; j >= 0; j--) if (baris[j]!.minggu < buangSebelum) baris.splice(j, 1);
    },
    async teratas(minggu, n) {
      return urut(minggu)
        .slice(0, n)
        .map((b): EntriPeringkat => ({ id: idPublik(b.uid), nama: b.nama, kelas: b.kelas, skor: b.skor }));
    },
    async jumlah(minggu) {
      return urut(minggu).length;
    },
    async diAtas(minggu, skor, batas) {
      return Math.min(batas, urut(minggu).filter((b) => b.skor > skor).length);
    },
    async hapusPemain(uid) {
      for (let j = baris.length - 1; j >= 0; j--) if (baris[j]!.uid === uid) baris.splice(j, 1);
    },
    async dilarang(uid) {
      return larangan.has(uid);
    },
  };
}

function lingkungan() {
  const penyimpan = penyimpanMemori();
  let jam = RABU;
  const d: Ketergantungan = {
    penyimpan,
    // Token tes = "uid:<uid>"; selain itu ditolak (verifikasi sungguhan dites di atas).
    verifikasi: async (t) => {
      if (!t.startsWith('uid:')) throw new Error('tidak sah');
      return t.slice(4);
    },
    jam: () => jam,
  };
  const minta = (metode: string, jalur: string, o: { uid?: string; isi?: unknown } = {}): Request =>
    new Request(`https://bustation.games${jalur}`, {
      method: metode,
      headers: { ...(o.uid ? { Authorization: `Bearer uid:${o.uid}` } : {}), 'Content-Type': 'application/json' },
      ...(o.isi === undefined ? {} : { body: typeof o.isi === 'string' ? o.isi : JSON.stringify(o.isi) }),
    });
  const kirim = (uid: string, skor: number, nama = `Terminal ${uid}`, kelas = 0) => tanganiKirim(minta('POST', '/api/peringkat', { uid, isi: { minggu: '2026-09-28', skor, kelas, nama } }), d);
  return { d, penyimpan, minta, kirim, maju: (ms: number) => (jam += ms) };
}

describe('API papan peringkat', () => {
  it('kirim skor butuh login; isinya diperiksa', async () => {
    const { d, minta, kirim } = lingkungan();
    expect((await tanganiKirim(minta('POST', '/api/peringkat', { isi: { minggu: '2026-09-28', skor: 1, kelas: 0, nama: 'A' } }), d)).status).toBe(401);
    expect((await tanganiKirim(minta('POST', '/api/peringkat', { uid: 'a', isi: '{rusak' }), d)).status).toBe(400);
    const tolak = await kirim('a', 10, 'Anjing');
    expect(tolak.status).toBe(422);
    expect(await tolak.json()).toEqual({ galat: 'nama-ditolak' });
    const ok = await kirim('a', 10.7, 'Terminal Sukamaju', 1);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ minggu: '2026-09-28', skor: 10 });
  });

  it('kiriman terlalu rapat ditolak; skor tidak pernah turun; skor yang mustahil ditolak; akun terlarang ditolak', async () => {
    const { penyimpan, kirim, maju } = lingkungan();
    await kirim('a', 100);
    maju(5_000);
    const rapat = await kirim('a', 120);
    expect(rapat.status).toBe(429);
    expect(Number(rapat.headers.get('Retry-After'))).toBe(Math.ceil((SELANG_MIN_SERVER_MS - 5_000) / 1000));
    maju(SELANG_MIN_SERVER_MS);
    expect(await (await kirim('a', 50)).json()).toEqual({ minggu: '2026-09-28', skor: 100 });
    maju(SELANG_MIN_SERVER_MS);
    expect((await kirim('a', 1e15)).status).toBe(422);
    penyimpan.larangan.add('b');
    expect((await kirim('b', 1)).status).toBe(403);
  });

  it('papan publik: urut skor, jumlah peserta, minggu lalu boleh diminta, minggu lain → minggu ini; bisa dibaca dari APK', async () => {
    const { d, minta, kirim, penyimpan } = lingkungan();
    await kirim('a', 300, 'Alpha');
    await kirim('b', 900, 'Beta', 2);
    await kirim('c', 500, 'Gamma');
    penyimpan.baris.push({ minggu: '2026-09-21', uid: 'a', nama: 'Alpha', kelas: 0, skor: 42, diperbaruiMs: 0 });
    const res = await tanganiPapan(minta('GET', '/api/peringkat'), d);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
    const papan = (await res.json()) as { minggu: string; jumlah: number; daftar: EntriPeringkat[] };
    expect(papan.minggu).toBe('2026-09-28');
    expect(papan.jumlah).toBe(3);
    expect(papan.daftar.map((e) => [e.nama, e.skor, e.kelas])).toEqual([
      ['Beta', 900, 2],
      ['Gamma', 500, 0],
      ['Alpha', 300, 0],
    ]);
    expect(papan.daftar[0]!.id).toBe(idPublik('b'));
    expect(JSON.stringify(papan)).not.toContain('"b"');
    const lalu = (await (await tanganiPapan(minta('GET', `/api/peringkat?minggu=${mingguSebelum('2026-09-28')}`), d)).json()) as { minggu: string; daftar: EntriPeringkat[] };
    expect(lalu.minggu).toBe('2026-09-21');
    expect(lalu.daftar.map((e) => e.skor)).toEqual([42]);
    const asing = (await (await tanganiPapan(minta('GET', '/api/peringkat?minggu=2020-01-06'), d)).json()) as { minggu: string };
    expect(asing.minggu).toBe('2026-09-28');
  });

  it('peringkat sendiri & keluar papan', async () => {
    const { d, minta, kirim } = lingkungan();
    await kirim('a', 300);
    await kirim('b', 900);
    expect((await tanganiSaya(minta('GET', '/api/peringkat/saya'), d)).status).toBe(401);
    expect(await (await tanganiSaya(minta('GET', '/api/peringkat/saya', { uid: 'a' }), d)).json()).toEqual({ minggu: '2026-09-28', skor: 300, peringkat: 2, jumlah: 2 });
    expect(await (await tanganiSaya(minta('GET', '/api/peringkat/saya', { uid: 'z' }), d)).json()).toEqual({ minggu: '2026-09-28', skor: null, peringkat: null, jumlah: 2 });
    expect((await tanganiKeluar(minta('DELETE', '/api/peringkat', { uid: 'a' }), d)).status).toBe(204);
    expect(await (await tanganiSaya(minta('GET', '/api/peringkat/saya', { uid: 'a' }), d)).json()).toMatchObject({ skor: null, jumlah: 1 });
  });

  it('galat tak terduga → 500 tanpa isi galat', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await aman(async () => {
      throw new Error('rahasia server');
    });
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('rahasia');
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
