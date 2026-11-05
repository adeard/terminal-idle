/**
 * Foto terminal: tombol kamera di kolom kontrol → gambar adegan 3D (tanpa
 * label & tombol) diberi bingkai berisi ikon & nama game, keterangan terminal
 * pemain, dan alamat situs, lalu dibagikan (Web Share) atau disimpan. Pemain
 * bisa mengatur kamera (geser, putar, zoom) dulu sebelum memotret.
 */
import type { Analitik } from '../app/analitik';
import type { PembacaState } from '../app/pengendali';
import type { TemaMusimId } from '../config/musim.config';
import { lencanaMusim, musimDariId, temaHiasan, tingkatRapor } from '../sim/musim';
import type { GameState } from '../sim/state';
import { formatAngka } from './format';
import { buatModel } from './model';
import { namaKelas, namaMusimTahun, NAMA_LENCANA, TEKS } from './teks';

export interface OpsiFoto {
  /** Akar overlay (#ui) tempat popup. */
  readonly akar: HTMLElement;
  readonly pembaca: PembacaState;
  /** Gambar adegan sekarang (tanpa label DOM). */
  readonly ambil: () => HTMLCanvasElement;
  readonly analitik: Analitik;
  /** Berbagi berkas (Web Share); null = tidak didukung, hanya bisa disimpan. */
  readonly bagikan: ((berkas: File) => Promise<'dibagikan' | 'batal'>) | null;
  readonly bisaBagikan: (berkas: File) => boolean;
  readonly unduh: (berkas: Blob, nama: string) => void;
}

const IKON_KAMERA =
  '<path d="M4 7.5h3l1.6-2.5h6.8L17 7.5h3a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/>';
const NAMA_BERKAS = 'bustation-terminal.jpg';
const KUALITAS_JPEG = 0.9;
/** Ukuran rancangan bingkai: semua ukuran dihitung terhadap lebar ini lalu diskalakan. */
const LEBAR_RANCANGAN = 1080;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

export function pasangTombolFoto(induk: HTMLElement, o: OpsiFoto): void {
  const b = el('button', 'tombol-kamera tombol-foto');
  b.type = 'button';
  b.title = TEKS.fotoTombol;
  b.setAttribute('aria-label', TEKS.fotoTombol);
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${IKON_KAMERA}</svg>`;
  let sibuk = false;
  b.addEventListener('click', () => {
    if (sibuk) return;
    sibuk = true;
    void bukaFoto(o).finally(() => (sibuk = false));
  });
  induk.append(b);
}

/** Keterangan terminal pemain di bingkai foto: kelas, jurusan yang dilayani, arus penumpang, mitra PO. */
export function keteranganFoto(pembaca: PembacaState): string {
  const m = buatModel(pembaca.state);
  const jurusan = new Set(m.mitra.terdaftar.flatMap((p) => p.jurusan.filter((j) => j.aktif).map((j) => j.jurusan))).size;
  return TEKS.fotoKeterangan(namaKelas(m.terminal.kelas), jurusan, formatAngka(Math.round(m.bangun.arusPuncak)), m.mitra.terdaftar.length, m.terminal.nama);
}

/** Bingkai foto musim yang dipakai (documents/17 bagian 4.1, 8): warna bingkai & baris "MUSIM HUJAN 2026 · Lencana Lulus". */
export interface BingkaiFoto {
  readonly warna: string;
  readonly baris: string;
}

/** Warna bingkai tiap tema musim; bingkai emas tingkat 30. */
const WARNA_BINGKAI: Readonly<Record<TemaMusimId, string>> = { hujan: '#38bdf8', imlek: '#ef4444', mudik: '#22c55e' };
const WARNA_EMAS = '#f5c542';

/**
 * Bingkai foto dari hiasan yang dipakai (null = bingkai bawaan). Barisnya menyebut musim yang sedang diikuti
 * dan lencana tertingginya; bila musim ini belum berlencana, musim terakhir di riwayat.
 */
export function bingkaiFoto(state: GameState): BingkaiFoto | null {
  const m = state.musim;
  const item = m.pakai.bingkai;
  if (item === null) return null;
  const tema = temaHiasan(item);
  const warna = tema ? WARNA_BINGKAI[tema] : WARNA_EMAS;
  const kini = m.id !== null ? { id: m.id, tingkat: tingkatRapor(m.poin) } : null;
  const acuan = kini && lencanaMusim(kini.tingkat) ? kini : (m.riwayat[m.riwayat.length - 1] ?? kini);
  const mu = acuan ? musimDariId(acuan.id) : null;
  if (!acuan || !mu) return { warna, baris: '' };
  const lencana = lencanaMusim(acuan.tingkat);
  const nama = namaMusimTahun(mu.tema, mu.tahun).toUpperCase();
  return { warna, baris: lencana ? TEKS.fotoMusim(nama, `Lencana ${NAMA_LENCANA[lencana]}`) : nama };
}

async function bukaFoto(o: OpsiFoto): Promise<void> {
  const adegan = o.ambil();
  const ikon = await muatGambar('ikon-192.png').catch(() => null);
  const kanvas = susunFoto(adegan, keteranganFoto(o.pembaca), ikon, bingkaiFoto(o.pembaca.state));
  const berkas = await keBerkas(kanvas);
  o.analitik.catat('foto_terminal');
  tampilkanPopupFoto(o, berkas);
}

function muatGambar(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

function keBerkas(kanvas: HTMLCanvasElement): Promise<File> {
  return new Promise((selesai, gagal) =>
    kanvas.toBlob((blob) => (blob ? selesai(new File([blob], NAMA_BERKAS, { type: 'image/jpeg' })) : gagal(new Error('Foto gagal dibuat'))), 'image/jpeg', KUALITAS_JPEG),
  );
}

/** Adegan + bingkai bawah: ikon, nama game, keterangan terminal, (baris musim), alamat situs; bingkai musim bila dipakai. */
export function susunFoto(adegan: HTMLCanvasElement, keterangan: string, ikon: HTMLImageElement | null, bingkai: BingkaiFoto | null = null): HTMLCanvasElement {
  const w = adegan.width;
  const h = adegan.height;
  const k = w / LEBAR_RANCANGAN;
  const c = el('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(adegan, 0, 0);
  // Baris musim menambah satu baris teks di atas alamat situs: blok teks naik sebanyak itu.
  const tambah = bingkai?.baris ? 40 * k : 0;
  const tinggiBingkai = Math.min(h * 0.4, 300 * k) + tambah;
  const gradasi = ctx.createLinearGradient(0, h - tinggiBingkai, 0, h);
  gradasi.addColorStop(0, 'rgba(10, 14, 20, 0)');
  gradasi.addColorStop(0.45, 'rgba(10, 14, 20, 0.62)');
  gradasi.addColorStop(1, 'rgba(10, 14, 20, 0.9)');
  ctx.fillStyle = gradasi;
  ctx.fillRect(0, h - tinggiBingkai, w, tinggiBingkai);

  const tepi = 40 * k;
  const sisiIkon = 112 * k;
  const yIkon = h - tepi - sisiIkon - tambah;
  let xTeks = tepi;
  if (ikon) {
    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(tepi, yIkon, sisiIkon, sisiIkon, 24 * k);
    else ctx.rect(tepi, yIkon, sisiIkon, sisiIkon);
    ctx.clip();
    ctx.drawImage(ikon, tepi, yIkon, sisiIkon, sisiIkon);
    ctx.restore();
    xTeks += sisiIkon + 26 * k;
  }
  const lebarTeks = w - xTeks - tepi;
  const huruf = (tebal: number, ukuran: number): string => `${tebal} ${Math.round(ukuran * k)}px system-ui, 'Segoe UI', sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = huruf(900, 50);
  ctx.fillText(TEKS.judul, xTeks, yIkon + 44 * k, lebarTeks);
  ctx.fillStyle = '#fde68a';
  ctx.font = huruf(700, 28);
  ctx.fillText(keterangan, xTeks, yIkon + 84 * k, lebarTeks);
  if (bingkai?.baris) {
    ctx.fillStyle = bingkai.warna;
    ctx.font = huruf(800, 24);
    ctx.fillText(bingkai.baris, xTeks, yIkon + 120 * k, lebarTeks);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = huruf(700, 26);
  ctx.fillText(TEKS.fotoAjakan, xTeks, yIkon + sisiIkon + tambah, lebarTeks);
  if (bingkai) {
    // Bingkai musim: garis berwarna tema di tepi foto (kanvas 2D, tanpa beban adegan).
    const tebal = 16 * k;
    ctx.strokeStyle = bingkai.warna;
    ctx.lineWidth = tebal;
    ctx.strokeRect(tebal / 2, tebal / 2, w - tebal, h - tebal);
  }
  return c;
}

function tampilkanPopupFoto(o: OpsiFoto, berkas: File): void {
  o.akar.querySelector('.popup-latar.latar-foto')?.remove();
  const url = URL.createObjectURL(berkas);
  const latar = el('div', 'popup-latar latar-foto');
  const kotak = el('div', 'popup popup-foto');
  kotak.setAttribute('role', 'dialog');
  kotak.setAttribute('aria-modal', 'true');
  kotak.setAttribute('aria-labelledby', 'popup-foto-judul');
  const judul = el('h2', undefined, TEKS.fotoJudul);
  judul.id = 'popup-foto-judul';
  const gambar = el('img', 'foto-pratinjau');
  gambar.src = url;
  gambar.alt = TEKS.fotoAlt;
  const pesan = el('p', 'foto-pesan');
  const bisaBagikan = o.bagikan !== null && o.bisaBagikan(berkas);
  const tombolBagikan = el('button', 'tombol tombol-hijau popup-tombol', TEKS.fotoBagikan);
  tombolBagikan.type = 'button';
  // Tanpa Web Share (desktop), menyimpan jadi tombol utama.
  const tombolSimpan = el('button', `tombol popup-tombol ${bisaBagikan ? 'tombol-kedua' : 'tombol-hijau'}`, TEKS.fotoSimpan);
  tombolSimpan.type = 'button';
  const tutupB = el('button', 'pembaruan-nanti', TEKS.fotoTutup);
  tutupB.type = 'button';
  kotak.append(judul, gambar);
  if (bisaBagikan) kotak.append(tombolBagikan);
  kotak.append(tombolSimpan, pesan, tutupB);
  latar.append(kotak);
  o.akar.append(latar);

  const tutup = (): void => {
    window.removeEventListener('keydown', saatTombol);
    latar.remove();
    URL.revokeObjectURL(url);
  };
  const saatTombol = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') tutup();
  };
  tombolBagikan.addEventListener('click', () => {
    if (!o.bagikan) return;
    tombolBagikan.disabled = true;
    void o
      .bagikan(berkas)
      .then(
        (hasil) => {
          if (hasil === 'dibagikan') o.analitik.catat('share', { method: 'web_share', content_type: 'foto_terminal' });
        },
        () => (pesan.textContent = TEKS.fotoGagalBagikan),
      )
      .finally(() => (tombolBagikan.disabled = false));
  });
  tombolSimpan.addEventListener('click', () => {
    o.unduh(berkas, NAMA_BERKAS);
    pesan.textContent = TEKS.fotoTersimpan;
    o.analitik.catat('share', { method: 'unduh', content_type: 'foto_terminal' });
  });
  tutupB.addEventListener('click', tutup);
  latar.addEventListener('click', (e) => {
    if (e.target === latar) tutup();
  });
  window.addEventListener('keydown', saatTombol);
}
