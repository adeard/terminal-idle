/**
 * Tutorial terpandu (logika di app/tutorial.ts): gelembung penjelasan di bawah
 * adegan dan sorotan berkedip pada tombol yang dituju. Tidak pernah
 * menghalangi: pemain boleh melakukan apa saja, dan langkah maju sendiri
 * begitu syaratnya terpenuhi. Sambutan di awal, "Lewati" kapan saja.
 * Sasarannya dicari di DOM overlay (data-tab, data-bangunan, data-po, data-petugas),
 * jadi ikut berpindah bila pemain berganti tab atau meringkas panel.
 */
import type { Analitik } from '../app/analitik';
import type { PengendaliGame } from '../app/pengendali';
import {
  cocokUntukTutorial,
  langkahBerikut,
  langkahTerpenuhi,
  LANGKAH_TUTORIAL,
  sasaranLangkah,
  type SasaranTutorial,
  type StatusTutorial,
} from '../app/tutorial';
import type { GameState } from '../sim/state';
import { formatUang } from './format';
import { NAMA_PO, TEKS } from './teks';

export interface OpsiTutorial {
  /** Akar overlay (#ui): tempat mencari tombol yang disorot. */
  readonly akar: HTMLElement;
  /** Area adegan: tempat gelembung penjelasan. */
  readonly area: HTMLElement;
  readonly pengendali: PengendaliGame;
  /** Status tersimpan di perangkat ini (null = belum pernah). */
  readonly status: StatusTutorial | null;
  readonly simpan: (status: StatusTutorial) => void;
  readonly analitik: Analitik;
}

const KELAS_SOROT = 'sorot-tutorial';

function judulLangkah(s: SasaranTutorial): string {
  switch (s.jenis) {
    case 'jendela':
      return TEKS.tutorialJendelaJudul;
    case 'po':
      return TEKS.tutorialPoJudul;
    case 'petugas':
      return TEKS.tutorialPetugasJudul;
    case 'jalur':
      return TEKS.tutorialJalurJudul;
  }
}

function teksLangkah(s: SasaranTutorial): string {
  switch (s.jenis) {
    case 'jendela':
      return TEKS.tutorialJendela(s.po ? NAMA_PO[s.po].nama : '');
    case 'po':
      return TEKS.tutorialPo(NAMA_PO[s.po].nama);
    case 'petugas':
      return TEKS.tutorialPetugas;
    case 'jalur':
      return TEKS.tutorialJalur;
  }
}

/** Kemajuan menuju biaya langkah ("Kas Rp 1,2 jt / Rp 2 jt"); laba terus masuk dengan sendirinya. */
function teksKemajuan(state: GameState, s: SasaranTutorial): string {
  if (s.biaya <= 0) return TEKS.tutorialGaji;
  return state.kas >= s.biaya ? TEKS.tutorialUangCukup : TEKS.tutorialUang(formatUang(Math.floor(state.kas)), formatUang(s.biaya));
}

/**
 * Tombol yang disorot. Bila tombolnya sedang tidak terlihat (panel diringkas,
 * atau tab lain terbuka), yang disorot adalah jalan ke sana: tombol buka panel
 * atau tab yang tepat.
 */
export function elemenSasaran(akar: HTMLElement, s: SasaranTutorial): HTMLElement[] {
  const q = (sel: string): HTMLElement[] => [...akar.querySelectorAll<HTMLElement>(sel)];
  const ringkas = akar.classList.contains('panel-ringkas');
  const tab = akar.querySelector<HTMLElement>('.tab.aktif')?.dataset['tab'] ?? 'bangun';
  if (ringkas) return q('.tombol-ringkas');
  switch (s.jenis) {
    case 'jendela':
    case 'jalur':
      if (tab !== 'bangun') return q('.tab[data-tab="bangun"]');
      return q(`.item-bangun[data-bangunan="${s.jenis}"] .tombol-beli`);
    case 'po':
      if (tab !== 'po') return q('.tab[data-tab="po"]');
      return q(`.item-po[data-po="${s.po}"] .tombol-beli`);
    case 'petugas':
      if (tab !== 'petugas') return q('.tab[data-tab="petugas"]');
      return q('.item-petugas[data-petugas="peron"] .tombol-tambah');
  }
}

export function pasangTutorial(o: OpsiTutorial): void {
  if (o.status === 'selesai' || o.status === 'dilewati') return;
  // Pemain lama (save sudah berjalan) tidak diganggu tutorial.
  if (o.status === null && !cocokUntukTutorial(o.pengendali.state)) {
    o.simpan('selesai');
    return;
  }

  const gelembung = el('section', 'tutorial');
  gelembung.setAttribute('aria-live', 'polite');
  const nomor = el('div', 'tutorial-nomor');
  const judul = el('div', 'tutorial-judul');
  const teks = el('div', 'tutorial-teks');
  const kemajuan = el('div', 'tutorial-kemajuan');
  const baris = el('div', 'tutorial-tombol');
  const lewati = el('button', 'tutorial-lewati', TEKS.tutorialLewati);
  lewati.type = 'button';
  const utama = el('button', 'tutorial-utama');
  utama.type = 'button';
  baris.append(lewati, utama);
  gelembung.append(nomor, judul, teks, kemajuan, baris);
  o.area.append(gelembung);
  o.akar.classList.add('tutorial-aktif');

  let tahap: 'sambutan' | 'langkah' | 'selesai' = o.status === 'aktif' ? 'langkah' : 'sambutan';
  const terpenuhi = new Set(LANGKAH_TUTORIAL.filter((id) => langkahTerpenuhi(id, o.pengendali.state)));
  let disorot: HTMLElement[] = [];
  let lepas: (() => void) | null = null;
  let selesai = false;

  const sorot = (daftar: HTMLElement[]): void => {
    for (const e of disorot) if (!daftar.includes(e)) e.classList.remove(KELAS_SOROT);
    for (const e of daftar) {
      if (e.classList.contains(KELAS_SOROT)) continue;
      e.classList.add(KELAS_SOROT);
      // Tombol di dalam daftar yang bergulir (mis. PO di bawah kartu PO terdaftar): gulir sampai terlihat.
      if (e.closest('.isi-tab')) e.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    disorot = daftar;
  };
  const tampil = (isi: { nomor: string; judul: string; teks: string; kemajuan: string; utama: string | null; lewati: boolean }): void => {
    setTeks(nomor, isi.nomor);
    nomor.hidden = isi.nomor === '';
    setTeks(judul, isi.judul);
    setTeks(teks, isi.teks);
    setTeks(kemajuan, isi.kemajuan);
    kemajuan.hidden = isi.kemajuan === '';
    setTeks(utama, isi.utama ?? '');
    utama.hidden = isi.utama === null;
    lewati.hidden = !isi.lewati;
  };
  const tutup = (): void => {
    if (selesai) return;
    selesai = true;
    sorot([]);
    gelembung.remove();
    o.akar.classList.remove('tutorial-aktif');
    lepas?.();
  };

  const perbarui = (s: GameState): void => {
    if (selesai) return;
    // Langkah boleh terpenuhi dalam urutan apa pun; masing-masing dicatat sekali.
    LANGKAH_TUTORIAL.forEach((id, i) => {
      if (terpenuhi.has(id) || !langkahTerpenuhi(id, s)) return;
      terpenuhi.add(id);
      o.analitik.catat('tutorial_langkah', { langkah: id, nomor: i + 1 });
    });
    if (tahap === 'sambutan') {
      tampil({ nomor: '', judul: TEKS.tutorialSambutanJudul, teks: TEKS.tutorialSambutan, kemajuan: '', utama: TEKS.tutorialMulai, lewati: true });
      return;
    }
    if (tahap === 'selesai') return;
    const id = langkahBerikut(s);
    if (id === null) {
      tahap = 'selesai';
      o.simpan('selesai');
      o.analitik.catat('tutorial_complete');
      sorot([]);
      o.akar.classList.remove('tutorial-aktif');
      tampil({ nomor: '', judul: TEKS.tutorialSelesaiJudul, teks: TEKS.tutorialSelesai, kemajuan: '', utama: TEKS.tutorialOke, lewati: false });
      return;
    }
    const sasaran = sasaranLangkah(id, s);
    tampil({
      nomor: TEKS.tutorialNomor(LANGKAH_TUTORIAL.indexOf(id) + 1, LANGKAH_TUTORIAL.length),
      judul: judulLangkah(sasaran),
      teks: teksLangkah(sasaran),
      kemajuan: teksKemajuan(s, sasaran),
      utama: null,
      lewati: true,
    });
    sorot(elemenSasaran(o.akar, sasaran));
  };

  lewati.addEventListener('click', () => {
    const s = o.pengendali.state;
    o.analitik.catat('tutorial_lewati', { langkah: tahap === 'langkah' ? (langkahBerikut(s) ?? 'selesai') : tahap });
    o.simpan('dilewati');
    tutup();
  });
  utama.addEventListener('click', () => {
    if (tahap === 'sambutan') {
      tahap = 'langkah';
      o.simpan('aktif');
      o.analitik.catat('tutorial_begin');
      perbarui(o.pengendali.state);
    } else if (tahap === 'selesai') {
      tutup();
    }
  });
  lepas = o.pengendali.berlangganan(perbarui);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

function setTeks(e: HTMLElement, teks: string): void {
  if (e.textContent !== teks) e.textContent = teks;
}
