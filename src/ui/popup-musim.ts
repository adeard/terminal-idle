/**
 * Popup Musim Terminal (documents/17 bagian 3.5, 7.1, 8): sambutan saat musim pertama kali terbuka,
 * Rapor Musim saat musim berganti (sesudah popup offline), dan pilihan PO untuk Surat Armada. Popup hanya
 * menampilkan & mengembalikan pilihan; aksinya dikirim pemanggil (main.ts, ui/menu.ts).
 */
import type { PoId } from '../sim/fitur';
import { musimDariId, nilaiRapor, type MusimKalender, type RaporMusim } from '../sim/musim';
import type { TemaMusimId } from '../config/musim.config';
import { MUSIM } from '../config/musim.config';
import { formatAngka } from './format';
import type { ModelSuratPo } from './model';
import { daftarHiasanPendek, namaMusimTahun, NAMA_NILAI_RAPOR, NAMA_PO, NAMA_TEMA_MUSIM, TEKS } from './teks';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

/** Kerangka popup (latar, kotak, judul); `tutup` melepas Esc & latar. */
function bukaPopup(akar: HTMLElement, kelas: string, judul: string): { readonly latar: HTMLElement; readonly kotak: HTMLElement; pasangTutup(tutup: () => void): () => void } {
  akar.querySelector(`.popup-latar.latar-${kelas}`)?.remove();
  const latar = el('div', `popup-latar latar-${kelas}`);
  const kotak = el('div', `popup popup-musim popup-${kelas}`);
  kotak.setAttribute('role', 'dialog');
  kotak.setAttribute('aria-modal', 'true');
  kotak.setAttribute('aria-labelledby', `popup-${kelas}-judul`);
  const h = el('h2', undefined, judul);
  h.id = `popup-${kelas}-judul`;
  kotak.append(h);
  latar.append(kotak);
  akar.append(latar);
  return {
    latar,
    kotak,
    pasangTutup(tutup) {
      const saatTombol = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') tutup();
      };
      window.addEventListener('keydown', saatTombol);
      latar.addEventListener('click', (e) => {
        if (e.target === latar) tutup();
      });
      return () => {
        window.removeEventListener('keydown', saatTombol);
        latar.remove();
      };
    },
  };
}

/** Sambutan sekali saat musim pertama kali terbuka: "Lihat tugas" membuka tab Target. */
export function tampilkanPopupSambutanMusim(akar: HTMLElement, tema: TemaMusimId): Promise<'lihat' | 'nanti'> {
  const t = NAMA_TEMA_MUSIM[tema];
  const p = bukaPopup(akar, 'sambutan-musim', TEKS.sambutanMusimJudul(t.ikon));
  const isi = el('p', 'popup-catatan musim-isi', TEKS.sambutanMusimIsi(t.nama));
  const lihat = el('button', 'tombol tombol-upgrade popup-tombol', TEKS.sambutanMusimLihat);
  lihat.type = 'button';
  const nanti = el('button', 'pembaruan-nanti', TEKS.sambutanMusimNanti);
  nanti.type = 'button';
  p.kotak.append(isi, lihat, nanti);
  lihat.focus({ preventScroll: true });
  return new Promise((selesai) => {
    let lepas: () => void = () => {};
    const tutup = (pilihan: 'lihat' | 'nanti'): void => {
      lepas();
      selesai(pilihan);
    };
    lepas = p.pasangTutup(() => tutup('nanti'));
    lihat.addEventListener('click', () => tutup('lihat'));
    nanti.addEventListener('click', () => tutup('nanti'));
  });
}

/**
 * Isi popup rapor (murni): nilai (baris besar) dan tingkatnya (baris kecil di bawahnya), lalu tugas & tantangan,
 * level terminal, penumpang saat bermain (tanpa baris bila 0), hiasan baru, musim baru.
 */
export function isiRapor(r: RaporMusim, musimBaru: MusimKalender | null): { readonly nilai: string; readonly tingkat: string; readonly baris: readonly string[] } {
  const baris = [TEKS.raporTugas(r.tugas, r.tantangan), TEKS.raporTerminal(r.lvAwal, r.lvAkhir)];
  if (r.penumpang >= 1) baris.push(TEKS.raporPenumpang(formatAngka(r.penumpang)));
  if (r.hiasan.length > 0) baris.push(TEKS.raporHiasan(daftarHiasanPendek(r.hiasan)));
  if (musimBaru) baris.push(TEKS.raporMusimBaru(NAMA_TEMA_MUSIM[musimBaru.tema].ikon, NAMA_TEMA_MUSIM[musimBaru.tema].nama));
  return { nilai: NAMA_NILAI_RAPOR[nilaiRapor(r.tingkat)], tingkat: TEKS.raporTingkat(r.tingkat, MUSIM.poin.tingkat), baris };
}

/** Judul rapor: "🎓 Rapor Musim Hujan 2026". */
export function judulRapor(r: RaporMusim): string {
  const m = musimDariId(r.id);
  return TEKS.raporJudul(m ? namaMusimTahun(m.tema, m.tahun) : r.id);
}

/** Rapor Musim sekali per musim (pemanggil mengirim tutupRapor sesudahnya). */
export function tampilkanPopupRapor(akar: HTMLElement, r: RaporMusim, musimBaru: MusimKalender | null): Promise<void> {
  const p = bukaPopup(akar, 'rapor-musim', judulRapor(r));
  const isi = isiRapor(r, musimBaru);
  p.kotak.append(el('div', 'popup-jumlah musim-nilai', isi.nilai), el('div', 'musim-tingkat-rapor', isi.tingkat));
  for (const b of isi.baris) p.kotak.append(el('p', 'popup-catatan musim-isi', b));
  const oke = el('button', 'tombol tombol-upgrade popup-tombol', TEKS.raporOke);
  oke.type = 'button';
  p.kotak.append(oke);
  oke.focus({ preventScroll: true });
  return new Promise((selesai) => {
    let lepas: () => void = () => {};
    const tutup = (): void => {
      lepas();
      selesai();
    };
    lepas = p.pasangTutup(tutup);
    oke.addEventListener('click', tutup);
  });
}

/** Teks satu PO di popup Surat Armada: "Peuyeum Kilat · Lv 6 → 50% ke Lv 7" (atau "→ Lv 7" bila naik level); satu baris. */
export function teksSuratPo(p: ModelSuratPo): string {
  const sesudah = p.levelSesudah > p.level ? TEKS.musimSuratLevel(p.levelSesudah) : TEKS.musimSuratMenuju(Math.floor(p.rasioSesudah * 100), p.level + 1);
  return TEKS.musimSuratBaris(NAMA_PO[p.po].nama.replace(/^PO /, ''), p.level, sesudah);
}

/** Pilih PO terdaftar untuk Surat Armada; null = batal. */
export function tampilkanPopupSuratArmada(akar: HTMLElement, daftar: readonly ModelSuratPo[]): Promise<PoId | null> {
  const p = bukaPopup(akar, 'surat-armada', TEKS.musimSuratJudul);
  p.kotak.append(el('p', 'popup-catatan musim-isi', TEKS.musimSuratPilih));
  const wadah = el('div', 'musim-surat-daftar');
  const tombol = daftar.map((x) => {
    const b = el('button', 'tombol tombol-kedua musim-surat-po', teksSuratPo(x));
    b.type = 'button';
    b.dataset['po'] = x.po;
    wadah.append(b);
    return { b, po: x.po };
  });
  const batal = el('button', 'pembaruan-nanti', TEKS.musimSuratBatal);
  batal.type = 'button';
  p.kotak.append(wadah, batal);
  tombol[0]?.b.focus({ preventScroll: true });
  return new Promise((selesai) => {
    let lepas: () => void = () => {};
    const tutup = (po: PoId | null): void => {
      lepas();
      selesai(po);
    };
    lepas = p.pasangTutup(() => tutup(null));
    for (const { b, po } of tombol) b.addEventListener('click', () => tutup(po));
    batal.addEventListener('click', () => tutup(null));
  });
}
