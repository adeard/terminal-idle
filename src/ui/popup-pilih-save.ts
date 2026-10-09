/**
 * Dialog "Pilih progres": dua save berbeda yang sama-sama punya progres (lihat
 * app/akun.ts). Tiap kartu berisi ringkasan save dan tombolnya sendiri. Saat
 * login ada tombol Batal (login dibatalkan); saat sinkron tidak ada, karena
 * pemain harus memilih salah satu.
 */
import type { PertanyaanKonflik, PilihanKonflik, RingkasanSave } from '../app/akun';
import { formatAngka, formatDurasi, formatUang } from './format';
import { tungguPopupLain } from './popup-pembaruan';
import { namaKelas, TEKS } from './teks';

/** Pemain menekan Batal (hanya saat login). */
export class PilihanDibatalkan extends Error {
  constructor() {
    super('Pemain membatalkan pilihan progres');
    this.name = 'PilihanDibatalkan';
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

function teksTerakhir(waktuMs: number, sekarangMs: number): string {
  const detik = (sekarangMs - waktuMs) / 1000;
  if (detik < 60) return TEKS.pilihSaveBaruSaja;
  const lalu = detik < 86_400 ? formatDurasi(detik) : `${Math.floor(detik / 86_400)} hari`;
  return TEKS.pilihSaveTerakhir(lalu);
}

export async function tanyaPilihanSave(akar: HTMLElement, p: PertanyaanKonflik, sekarangMs = Date.now()): Promise<PilihanKonflik> {
  // Menu akun tidak ditunggu: dialog ini sering dipicu dari menu itu (login), yang
  // tetap terbuka di bawahnya menunggu jawaban. Menunggunya = macet selamanya.
  await tungguPopupLain(akar, '.latar-akun');
  const bolehBatal = p.situasi === 'masuk';

  const latar = el('div', 'popup-latar');
  const kotak = el('div', 'popup popup-pilih-save');
  kotak.setAttribute('role', 'dialog');
  kotak.setAttribute('aria-modal', 'true');
  kotak.setAttribute('aria-labelledby', 'popup-pilih-save-judul');

  const judul = el('h2', undefined, TEKS.pilihSaveJudul);
  judul.id = 'popup-pilih-save-judul';
  kotak.append(judul, el('p', 'popup-durasi', p.situasi === 'masuk' ? TEKS.pilihSaveTeksMasuk : TEKS.pilihSaveTeksSinkron));

  const tombol: HTMLButtonElement[] = [];
  const kartu = (pilihan: PilihanKonflik, nama: string, r: RingkasanSave): HTMLElement => {
    const k = el('div', 'kartu-save');
    k.append(
      el('div', 'kartu-save-nama', nama),
      el('div', 'kartu-save-uang', formatUang(Math.floor(r.kas))),
      el('div', 'kartu-save-baris', TEKS.pilihSavePendapatan(formatUang(Math.floor(r.totalPendapatan)))),
      el('div', 'kartu-save-baris', TEKS.pilihSaveTerminal(namaKelas(r.kelasTerminal), formatAngka(r.levelTerminal, { desimalKecil: 0 }))),
    );
    k.append(el('div', 'kartu-save-baris kartu-save-waktu', teksTerakhir(r.waktuTerakhirMs, sekarangMs)));
    const b = el('button', 'tombol tombol-upgrade kartu-save-tombol', TEKS.pilihSavePakai);
    b.type = 'button';
    b.dataset['pilihan'] = pilihan;
    tombol.push(b);
    k.append(b);
    return k;
  };
  const daftar = el('div', 'daftar-kartu-save');
  daftar.append(
    kartu('lokal', TEKS.pilihSaveLokal, p.lokal),
    kartu('awan', p.situasi === 'masuk' ? TEKS.pilihSaveAkun : TEKS.pilihSaveLain, p.awan),
  );
  kotak.append(daftar, el('p', 'popup-catatan', TEKS.pilihSaveCatatan));

  const batal = bolehBatal ? el('button', 'pembaruan-nanti', TEKS.akunBatal) : null;
  if (batal) {
    batal.type = 'button';
    kotak.append(batal);
  }
  latar.append(kotak);
  akar.append(latar);

  return new Promise((ok, gagal) => {
    const tutup = (): void => {
      window.removeEventListener('keydown', saatTombol);
      latar.remove();
    };
    const saatTombol = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && bolehBatal) {
        tutup();
        gagal(new PilihanDibatalkan());
      }
    };
    for (const b of tombol) {
      b.addEventListener('click', () => {
        tutup();
        ok(b.dataset['pilihan'] === 'awan' ? 'awan' : 'lokal');
      });
    }
    batal?.addEventListener('click', () => {
      tutup();
      gagal(new PilihanDibatalkan());
    });
    window.addEventListener('keydown', saatTombol);
  });
}
