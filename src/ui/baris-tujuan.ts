/**
 * Baris tujuan berikutnya di HUD (logikanya app/tujuan.ts): teks, gaya warna, dan
 * sasaran ketukan (tab + elemen yang disorot) tiap tujuan. Murni, tanpa DOM; dipasang
 * oleh overlay.ts. Teks ≤ 60 karakter (documents/14 bagian 3.4), dites di tests/tujuan.test.ts.
 */
import type { TujuanDinilai } from '../app/tujuan';
import { formatDurasi, formatUang } from './format';
import { wajahKepuasan } from './popup-kepuasan';
import { EFEK_PERLUASAN, namaKelas, NAMA_AREA, NAMA_BANGUNAN, NAMA_PENDEK_TEKNOLOGI, NAMA_PO, TEKS } from './teks';

/** Warna baris: tingkat 1 merah, 2–3 kuning (ada yang bisa dikerjakan), 4–5 netral (menunggu). */
export type GayaTujuan = 'bahaya' | 'siap' | 'netral';

export function gayaTujuan(t: TujuanDinilai): GayaTujuan {
  return t.tingkat === 1 ? 'bahaya' : t.tingkat <= 3 ? 'siap' : 'netral';
}

export function teksTujuan(t: TujuanDinilai): string {
  switch (t.jenis) {
    case 'kasMenipis': {
      const o = t.obat;
      switch (o.jenis) {
        case 'perpanjang':
          return TEKS.tujuanKasPerpanjang(NAMA_PO[o.po].nama);
        case 'sewakan':
          return TEKS.tujuanKasSewakan;
        case 'daftar':
          return TEKS.tujuanKasDaftar(NAMA_PO[o.po].nama, formatUang(o.nilai));
        case 'petugas':
          return TEKS.tujuanKasPetugas;
      }
    }
    case 'kontrakHampir':
      return TEKS.tujuanKontrakHampir(NAMA_PO[t.po].nama);
    case 'poMenolak':
      return t.sebab === 'kepuasan' && t.kepuasanMin !== null ? TEKS.tujuanMenolakKepuasan(NAMA_PO[t.po].nama, Math.round(t.kepuasanMin * 100)) : TEKS.tujuanMenolakMitra(NAMA_PO[t.po].nama);
    case 'perpanjang':
      return TEKS.tujuanPerpanjang(NAMA_PO[t.po].nama, formatUang(t.nilai));
    case 'sewakan':
      return TEKS.tujuanSewakan(t.jumlah);
    case 'daftarPo':
      return TEKS.tujuanDaftarPo(NAMA_PO[t.po].nama, formatUang(t.nilai));
    case 'perluasan':
      return TEKS.tujuanPerluasan(t.tahap, EFEK_PERLUASAN[t.tahap - 1] ?? '');
    case 'area': {
      const p = t.perbaikan;
      switch (p.jenis) {
        case 'rekrut':
          return TEKS.tujuanAreaRekrut(NAMA_AREA[t.area], p.petugas);
        case 'jendela':
          return TEKS.tujuanAreaJendela(formatUang(p.biaya));
        case 'teknologi':
          return TEKS.tujuanAreaModern(NAMA_AREA[t.area], NAMA_PENDEK_TEKNOLOGI[p.teknologi]);
        case 'jalur':
          return TEKS.tujuanAreaJalur(NAMA_AREA[t.area], p.nomor, formatUang(p.biaya));
      }
    }
    case 'kepuasan': {
      const w = wajahKepuasan(t.nilai);
      const p = t.perbaikan;
      if (p.jenis === 'rekrut') return p.petugas === 'kebersihan' ? TEKS.tujuanKebersihan(w) : p.petugas === 'petugasToilet' ? TEKS.tujuanToilet(w) : TEKS.tujuanKeamanan(w);
      return p.bangunan === 'kursi' ? TEKS.tujuanKursi(w, formatUang(p.biaya)) : TEKS.tujuanFasilitas(w, NAMA_BANGUNAN[p.bangunan].nama.toLowerCase(), formatUang(p.biaya));
    }
    case 'manajer':
      return TEKS.tujuanManajer;
    case 'proyek':
      return TEKS.tujuanProyek(t.tahap, formatDurasi(t.sisaDetik));
    case 'menabung':
      return (t.hanyaCadangan ? TEKS.tujuanMenabungCadangan : TEKS.tujuanMenabung)(t.tahap, formatUang(t.kekurangan));
    case 'naikLevel':
      return TEKS.tujuanNaikLevel(t.tahap, t.level, t.levelSekarang);
    case 'kelasBerikut':
      return TEKS.tujuanKelas(namaKelas(t.kelas), t.level, t.levelSekarang);
  }
}

export type TabTujuan = 'bangun' | 'petugas' | 'po' | 'terminal';

/** Ketukan membuka tab ini lalu menyorot elemen `selektor` (bila tidak ada di DOM: `cadangan`, lalu tab-nya). */
export interface SasaranTujuan {
  readonly tab: TabTujuan;
  readonly selektor: string;
  readonly cadangan?: string;
}

const tombolPetugas = (id: string): string => `.item-petugas[data-petugas="${id}"] .tombol-tambah`;
const tombolKurangiPetugas = (id: string): string => `.item-petugas[data-petugas="${id}"] .tombol-kurang`;
const KARTU_GAJI = '[data-kartu="gaji"]';
const tombolBangun = (id: string): string => `.item-bangun[data-bangunan="${id}"] .tombol-beli`;
const tombolDaftarPo = (po: string): string => `.item-po[data-po="${po}"] .tombol-beli`;
const tombolPerpanjang = (po: string): string => `.kartu-po[data-po="${po}"] .tombol-perpanjang`;
const TOMBOL_SEWAKAN = '.item-loket-kosong .tombol-beli';

/** Pemetaan tujuan → tab & sasaran (documents/14 bagian 3.5). */
export function sasaranTujuan(t: TujuanDinilai): SasaranTujuan {
  switch (t.jenis) {
    case 'kasMenipis': {
      const o = t.obat;
      if (o.jenis === 'perpanjang') return { tab: 'po', selektor: tombolPerpanjang(o.po) };
      if (o.jenis === 'daftar') return { tab: 'po', selektor: tombolDaftarPo(o.po) };
      if (o.jenis === 'sewakan') return { tab: 'po', selektor: TOMBOL_SEWAKAN };
      // Tombol − petugas yang terakhir direkrut (yang diberhentikan lebih dulu); cadangan: ringkasan gaji.
      return o.petugas ? { tab: 'petugas', selektor: tombolKurangiPetugas(o.petugas), cadangan: KARTU_GAJI } : { tab: 'petugas', selektor: KARTU_GAJI };
    }
    case 'kontrakHampir':
    case 'perpanjang':
      return { tab: 'po', selektor: tombolPerpanjang(t.po) };
    case 'poMenolak':
      return { tab: 'po', selektor: `.kartu-po[data-po="${t.po}"]` };
    case 'sewakan':
      return { tab: 'po', selektor: TOMBOL_SEWAKAN };
    case 'daftarPo':
      return { tab: 'po', selektor: tombolDaftarPo(t.po) };
    case 'perluasan':
    case 'proyek':
    case 'menabung':
      return { tab: 'terminal', selektor: '[data-kartu="perluasan"]' };
    case 'area': {
      const p = t.perbaikan;
      if (p.jenis === 'rekrut') return { tab: 'petugas', selektor: tombolPetugas(p.petugas) };
      if (p.jenis === 'teknologi') return { tab: 'bangun', selektor: `.item-modern[data-teknologi="${p.teknologi}"]` };
      return { tab: 'bangun', selektor: tombolBangun(p.jenis) };
    }
    case 'kepuasan': {
      const p = t.perbaikan;
      return p.jenis === 'rekrut' ? { tab: 'petugas', selektor: tombolPetugas(p.petugas) } : { tab: 'bangun', selektor: tombolBangun(p.bangunan) };
    }
    case 'manajer':
      return { tab: 'petugas', selektor: tombolPetugas('manajerOperasional') };
    case 'naikLevel':
    case 'kelasBerikut':
      return { tab: 'terminal', selektor: '[data-kartu="level"]' };
  }
}
