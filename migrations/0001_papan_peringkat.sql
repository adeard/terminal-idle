-- Papan peringkat mingguan (server/d1.ts). Pasang dengan:
--   npx wrangler d1 migrations apply bustation-peringkat --remote   (produksi)
--   npx wrangler d1 migrations apply bustation-peringkat --local    (wrangler pages dev)

-- Satu baris per pemain per minggu WIB ("2026-09-28" = Senin). Hanya minggu ini & minggu lalu disimpan.
CREATE TABLE papan (
  minggu TEXT NOT NULL,
  uid TEXT NOT NULL,          -- uid akun Firebase (tidak pernah dikirim ke pemain lain)
  id_publik TEXT NOT NULL,    -- hash uid untuk menandai baris sendiri (src/app/peringkat.ts idPublik)
  nama TEXT NOT NULL,         -- nama terminal (sudah dirapikan & disaring)
  kelas INTEGER NOT NULL,     -- kelas terminal: 0 = Tipe C, 1 = Tipe B, …
  skor INTEGER NOT NULL,      -- penumpang minggu ini
  diperbarui INTEGER NOT NULL, -- ms epoch kiriman terakhir
  PRIMARY KEY (minggu, uid)
);
CREATE INDEX papan_urut ON papan (minggu, skor DESC, diperbarui);
CREATE INDEX papan_uid ON papan (uid);

-- Banyaknya peserta per minggu (supaya tidak perlu COUNT(*) seluruh papan).
CREATE TABLE peserta (
  minggu TEXT PRIMARY KEY,
  jumlah INTEGER NOT NULL
);

-- Akun yang diblokir dari papan (diisi manual, lihat README "Papan peringkat").
CREATE TABLE larangan (
  uid TEXT PRIMARY KEY,
  alasan TEXT NOT NULL DEFAULT '',
  dibuat INTEGER NOT NULL
);
