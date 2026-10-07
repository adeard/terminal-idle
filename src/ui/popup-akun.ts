/**
 * Menu akun. Tamu: ajakan masuk dengan Google. Sudah login: nama, status
 * sinkron cloud, Keluar, dan Hapus akun (masing-masing dengan konfirmasi).
 * Aksinya dijalankan pemanggil (main.ts); popup hanya menampilkan dan
 * menangkap galat. Aksi yang berhasil memuat ulang halaman.
 */
import { TEKS } from './teks';

export interface InfoAkunTampil {
  readonly nama: string | null;
  readonly email: string | null;
}

export interface OpsiPopupAkun {
  /** True kalau perangkat ini sedang login (akun aktif). */
  readonly masuk: boolean;
  /** Muat layanan akun. Untuk akun: pengguna yang login, atau null kalau sesi login berakhir. */
  siapkan(): Promise<InfoAkunTampil | null>;
  /** Simpan & unggah sekarang; true kalau progres sudah tersimpan di cloud. */
  sinkronkan(): Promise<boolean>;
  /** Dipanggil langsung dari klik (membuka popup Google). */
  masukGoogle(): Promise<void>;
  keluar(): Promise<void>;
  /** Dipanggil langsung dari klik (membuka popup Google untuk konfirmasi). */
  hapus(): Promise<void>;
  /** Teks galat untuk pemain, atau null kalau tidak perlu ditampilkan (mis. popup Google ditutup). */
  pesanGalat(e: unknown, bawaan: string): string | null;
  saatTutup(): void;
}

const SVG_GOOGLE =
  '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

/** Halaman kebijakan privasi (public/privasi.html; di situs juga bisa dibuka sebagai /privasi). */
const URL_PRIVASI = '/privasi.html';

/** Tautan ke kebijakan privasi, dibuka di tab baru supaya game tetap berjalan. */
function tautanPrivasi(): HTMLAnchorElement {
  const a = el('a', undefined, TEKS.akunPrivasi);
  a.href = URL_PRIVASI;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

function tombol(kelas: string, teks: string): HTMLButtonElement {
  const b = el('button', kelas, teks);
  b.type = 'button';
  return b;
}

type Tampilan = 'utama' | 'keluar' | 'hapus';

export function tampilkanPopupAkun(akar: HTMLElement, o: OpsiPopupAkun): void {
  akar.querySelector('.popup-latar.latar-akun')?.remove();
  const latar = el('div', 'popup-latar latar-akun');
  const kotak = el('div', 'popup popup-akun');
  kotak.setAttribute('role', 'dialog');
  kotak.setAttribute('aria-modal', 'true');
  kotak.setAttribute('aria-labelledby', 'popup-akun-judul');
  latar.append(kotak);
  akar.append(latar);

  let sibuk = false;
  let siap = false;
  let info: InfoAkunTampil | null = null;
  let galat = '';
  /** null = belum dicek; lalu hasil sinkron terakhir. */
  let tersinkron: boolean | null = null;
  let tampilan: Tampilan = 'utama';

  const tutup = (): void => {
    if (sibuk) return;
    window.removeEventListener('keydown', saatTombol);
    latar.remove();
    o.saatTutup();
  };
  const saatTombol = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') tutup();
  };
  latar.addEventListener('click', (e) => {
    if (e.target === latar) tutup();
  });
  window.addEventListener('keydown', saatTombol);

  /** Jalankan aksi (dimulai sinkron di dalam klik); sukses = halaman dimuat ulang. */
  const jalankan = async (b: HTMLButtonElement, aksi: () => Promise<void>, galatBawaan: string): Promise<void> => {
    sibuk = true;
    galat = '';
    const teksAsli = b.textContent ?? '';
    for (const x of kotak.querySelectorAll('button')) x.disabled = true;
    b.textContent = TEKS.akunMemproses;
    try {
      await aksi();
      b.textContent = TEKS.akunMuatUlang;
    } catch (e) {
      sibuk = false;
      galat = o.pesanGalat(e, galatBawaan) ?? '';
      b.textContent = teksAsli;
      render();
    }
  };

  const tombolGoogle = (teks: string): HTMLButtonElement => {
    const b = tombol('tombol tombol-google popup-tombol', '');
    b.innerHTML = SVG_GOOGLE;
    b.append(el('span', undefined, siap ? teks : TEKS.akunMemuat));
    b.disabled = !siap;
    b.addEventListener('click', () => void jalankan(b, () => o.masukGoogle(), TEKS.akunGagalMasuk));
    return b;
  };

  const judul = (teks: string): HTMLElement => {
    const h = el('h2', undefined, teks);
    h.id = 'popup-akun-judul';
    return h;
  };

  const render = (): void => {
    const isi: HTMLElement[] = [];
    const tutupB = tombol('pembaruan-nanti', TEKS.akunTutup);
    tutupB.addEventListener('click', tutup);

    if (!o.masuk) {
      const setuju = el('p', 'popup-catatan akun-privasi', TEKS.akunSetujuPrivasi);
      setuju.append(tautanPrivasi(), '.');
      isi.push(judul(TEKS.akunJudulTamu), el('p', 'popup-catatan akun-teks', TEKS.akunPenjelasanTamu), tombolGoogle(TEKS.akunMasuk), setuju);
    } else if (tampilan === 'utama') {
      isi.push(judul(TEKS.akunJudul));
      if (info?.nama) isi.push(el('p', 'akun-nama', info.nama));
      if (info?.email) isi.push(el('p', 'akun-email', info.email));
      const sesiBerakhir = siap && info === null;
      const status = !siap
        ? TEKS.akunMemuat
        : sesiBerakhir
          ? TEKS.akunSesiBerakhir
          : tersinkron === null
            ? TEKS.akunMenyinkronkan
            : tersinkron
              ? TEKS.akunTersinkron
              : TEKS.akunBelumTersinkron;
      const p = el('p', 'popup-catatan akun-status', status);
      p.classList.toggle('ok', tersinkron === true && !sesiBerakhir);
      isi.push(p);
      if (sesiBerakhir) isi.push(tombolGoogle(TEKS.akunMasukLagi));
      const keluarB = tombol('tombol tombol-kedua popup-tombol', TEKS.akunKeluar);
      keluarB.addEventListener('click', () => {
        galat = '';
        tampilan = 'keluar';
        render();
      });
      isi.push(keluarB);
      if (siap && !sesiBerakhir) {
        const hapusB = tombol('akun-hapus', TEKS.akunHapus);
        hapusB.addEventListener('click', () => {
          galat = '';
          tampilan = 'hapus';
          render();
        });
        isi.push(hapusB);
      }
      const privasi = el('p', 'popup-catatan akun-privasi');
      privasi.append(tautanPrivasi());
      isi.push(privasi);
    } else {
      const hapus = tampilan === 'hapus';
      isi.push(judul(hapus ? TEKS.akunJudulHapus : TEKS.akunJudulKeluar), el('p', 'popup-catatan akun-teks', hapus ? TEKS.akunTeksHapus : TEKS.akunTeksKeluar));
      const ya = tombol('tombol tombol-bahaya popup-tombol', hapus ? TEKS.akunYaHapus : TEKS.akunYaKeluar);
      ya.addEventListener('click', () => void jalankan(ya, hapus ? () => o.hapus() : () => o.keluar(), hapus ? TEKS.akunGagalHapus : TEKS.akunGagalKeluar));
      const batal = tombol('pembaruan-nanti', TEKS.akunBatal);
      batal.addEventListener('click', () => {
        galat = '';
        tampilan = 'utama';
        render();
      });
      isi.push(ya, batal);
    }

    if (galat) isi.push(el('p', 'akun-galat', galat));
    if (tampilan === 'utama') isi.push(tutupB);
    kotak.replaceChildren(...isi);
  };

  render();
  o.siapkan().then(
    (i) => {
      siap = true;
      info = i;
      if (!sibuk) render();
      if (!o.masuk || i === null) return;
      void o.sinkronkan().then((ok) => {
        tersinkron = ok;
        if (!sibuk) render();
      });
    },
    (e: unknown) => {
      galat = o.pesanGalat(e, TEKS.akunGagalMuat) ?? TEKS.akunGagalMuat;
      if (!sibuk) render();
    },
  );
}
