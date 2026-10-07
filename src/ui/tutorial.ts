/**
 * Tutorial terpandu (logika di app/tutorial.ts): gelembung penjelasan di bawah
 * adegan dan sorotan berkedip pada tombol yang dituju. Tidak pernah
 * menghalangi: pemain boleh melakukan apa saja, dan langkah maju sendiri
 * begitu syaratnya terpenuhi. Sambutan di awal, "Lewati" kapan saja.
 * Sasarannya dicari di DOM overlay (data-tahap, data-tab, data-fasilitas),
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
  type IdLangkahTutorial,
  type SasaranTutorial,
  type StatusTutorial,
} from '../app/tutorial';
import type { GameState } from '../sim/state';
import { formatUang } from './format';
import { NAMA_TAHAP, TEKS } from './teks';

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

const JUDUL: Readonly<Record<IdLangkahTutorial, string>> = {
  upgrade: TEKS.tutorialUpgradeJudul,
  kepala: TEKS.tutorialKepalaJudul,
  fasilitas: TEKS.tutorialFasilitasJudul,
  jalur: TEKS.tutorialJalurJudul,
};

function teksLangkah(s: SasaranTutorial): string {
  switch (s.jenis) {
    case 'upgrade':
      return TEKS.tutorialUpgrade(NAMA_TAHAP[s.tahap]);
    case 'kepala':
      return TEKS.tutorialKepala(NAMA_TAHAP[s.tahap]);
    case 'fasilitas':
      return TEKS.tutorialFasilitas;
    case 'jalur':
      return TEKS.tutorialJalur;
  }
}

/** Kemajuan menuju biaya langkah ("Uang Rp 12 / Rp 22"); uang terus masuk dengan sendirinya. */
function teksKemajuan(state: GameState, s: SasaranTutorial): string {
  return state.uang.gte(s.biaya) ? TEKS.tutorialUangCukup : TEKS.tutorialUang(formatUang(state.uang), formatUang(s.biaya));
}

/**
 * Tombol yang disorot. Bila tombolnya sedang tidak terlihat (panel diringkas,
 * atau tab lain terbuka), yang disorot adalah jalan ke sana: tombol buka panel
 * atau tab yang tepat.
 */
export function elemenSasaran(akar: HTMLElement, s: SasaranTutorial): HTMLElement[] {
  const q = (sel: string): HTMLElement[] => [...akar.querySelectorAll<HTMLElement>(sel)];
  const ringkas = akar.classList.contains('panel-ringkas');
  const tab = akar.querySelector<HTMLElement>('.tab.aktif')?.dataset['tab'] ?? 'tahap';
  switch (s.jenis) {
    case 'upgrade':
    case 'kepala':
      if (ringkas) return q('.tombol-ringkas');
      if (tab !== 'tahap') return q('.tab[data-tab="tahap"]');
      return q(`.panel[data-tahap="${s.tahap}"] .tombol-${s.jenis}`);
    case 'fasilitas':
      if (ringkas) return q('.tombol-ringkas');
      if (tab !== 'fasilitas') return q('.tab[data-tab="fasilitas"]');
      return q(`[data-fasilitas="${s.fasilitas}"] .tombol-beli`);
    case 'jalur':
      if (ringkas) return q('.tombol-ringkas');
      if (tab !== 'fasilitas') return q('.tab[data-tab="fasilitas"]');
      return q('[data-jalur] .tombol-beli');
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
    for (const e of daftar) e.classList.add(KELAS_SOROT);
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
      judul: JUDUL[id],
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
