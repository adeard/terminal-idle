/**
 * Penyimpanan papan peringkat di Cloudflare D1 (SQLite). Skema di
 * migrations/0001_papan_peringkat.sql. Semua kueri memakai indeks dan dibatasi
 * (LIMIT), jadi baris yang dibaca per permintaan tetap kecil walau peserta banyak.
 */
import { idPublik, type EntriPeringkat } from '../src/app/peringkat';
import type { BarisSkor, PenyimpanPeringkat } from './peringkat';

// Tipe D1 yang dipakai saja (tanpa paket @cloudflare/workers-types).
export interface D1Hasil<T> {
  readonly results: T[];
}
export interface D1Pernyataan {
  bind(...nilai: unknown[]): D1Pernyataan;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Hasil<T>>;
  run(): Promise<unknown>;
}
export interface D1Database {
  prepare(sql: string): D1Pernyataan;
  /** Dijalankan berurutan sebagai satu transaksi. */
  batch(pernyataan: D1Pernyataan[]): Promise<unknown[]>;
}

/** Binding di wrangler.toml. */
export interface EnvPeringkat {
  readonly DB: D1Database;
}

export function buatPenyimpanD1(db: D1Database): PenyimpanPeringkat {
  return {
    async ambil(minggu, uid) {
      const r = await db
        .prepare('SELECT nama, kelas, skor, diperbarui FROM papan WHERE minggu = ?1 AND uid = ?2')
        .bind(minggu, uid)
        .first<{ nama: string; kelas: number; skor: number; diperbarui: number }>();
      return r ? { minggu, uid, nama: r.nama, kelas: r.kelas, skor: r.skor, diperbaruiMs: r.diperbarui } : null;
    },
    async simpan(b: BarisSkor, buangSebelum: string) {
      await db.batch([
        // Hitungan peserta naik hanya untuk baris baru (dicek sebelum baris disisipkan, dalam transaksi yang sama).
        db
          .prepare('INSERT INTO peserta (minggu, jumlah) SELECT ?1, 1 WHERE NOT EXISTS (SELECT 1 FROM papan WHERE minggu = ?1 AND uid = ?2) ON CONFLICT (minggu) DO UPDATE SET jumlah = jumlah + 1')
          .bind(b.minggu, b.uid),
        db
          .prepare(
            'INSERT INTO papan (minggu, uid, id_publik, nama, kelas, skor, diperbarui) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ' +
              'ON CONFLICT (minggu, uid) DO UPDATE SET nama = excluded.nama, kelas = excluded.kelas, skor = MAX(papan.skor, excluded.skor), diperbarui = excluded.diperbarui',
          )
          .bind(b.minggu, b.uid, idPublik(b.uid), b.nama, b.kelas, b.skor, b.diperbaruiMs),
        db.prepare('DELETE FROM papan WHERE minggu < ?1').bind(buangSebelum),
        db.prepare('DELETE FROM peserta WHERE minggu < ?1').bind(buangSebelum),
      ]);
    },
    async teratas(minggu, n) {
      const { results } = await db
        .prepare('SELECT id_publik AS id, nama, kelas, skor FROM papan WHERE minggu = ?1 ORDER BY skor DESC, diperbarui ASC LIMIT ?2')
        .bind(minggu, n)
        .all<EntriPeringkat>();
      return results;
    },
    async jumlah(minggu) {
      const r = await db.prepare('SELECT jumlah FROM peserta WHERE minggu = ?1').bind(minggu).first<{ jumlah: number }>();
      return r?.jumlah ?? 0;
    },
    async diAtas(minggu, skor, batas) {
      const r = await db
        .prepare('SELECT COUNT(*) AS n FROM (SELECT 1 FROM papan WHERE minggu = ?1 AND skor > ?2 LIMIT ?3)')
        .bind(minggu, skor, batas)
        .first<{ n: number }>();
      return r?.n ?? 0;
    },
    async hapusPemain(uid) {
      await db.batch([
        db.prepare('UPDATE peserta SET jumlah = jumlah - 1 WHERE jumlah > 0 AND minggu IN (SELECT minggu FROM papan WHERE uid = ?1)').bind(uid),
        db.prepare('DELETE FROM papan WHERE uid = ?1').bind(uid),
      ]);
    },
    async dilarang(uid) {
      return (await db.prepare('SELECT 1 AS ada FROM larangan WHERE uid = ?1').bind(uid).first()) !== null;
    },
  };
}
