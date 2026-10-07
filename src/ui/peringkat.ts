/**
 * Papan peringkat mingguan di UI: kartu di tab Target (penumpang minggu ini &
 * peringkat sendiri) dan popup papan (minggu ini / minggu lalu, ikut dengan
 * persetujuan, keluar). Datanya dari LayananPeringkat (app/layanan-peringkat.ts);
 * nama pemain lain selalu ditulis lewat textContent (tidak pernah sebagai HTML).
 */
import type { LayananPeringkat } from '../app/layanan-peringkat';
import { BATAS_PERINGKAT, GalatPeringkat, mingguSebelum, namaLayakPublik, peringkatBaris, type PapanPeringkat } from '../app/peringkat';
import { mingguWib } from '../sim/tantangan';
import { formatAngka, formatBulat } from './format';
import type { ModelPeringkat, ModelTampilan } from './model';
import { GALAT_PERINGKAT, namaKelas, rentangMinggu, sisaWaktuEvent, TEKS } from './teks';

export interface OpsiPeringkatUi {
  readonly layanan: LayananPeringkat;
  /** Model papan peringkat dari state sekarang. */
  readonly ambilModel: () => ModelPeringkat;
  /** Buka menu akun (tamu yang ingin ikut). */
  readonly bukaAkun: () => void;
  /** Minta nama terminal lewat popup nama; null = batal atau dikosongkan. */
  readonly mintaNama: () => Promise<string | null>;
  /** Dipanggil saat popup papan dibuka (analitik). */
  readonly saatBuka?: () => void;
}

const MEDALI = ['🥇', '🥈', '🥉'] as const;

/** Skor papan: lengkap sampai 10 juta (1.012.000) supaya selisih kecil terlihat, lalu disingkat (12,3 jt). */
function formatSkor(n: number): string {
  return n < 10_000_000 ? formatBulat(n) : formatAngka(n);
}

// ---------------------------------------------------------------------------
// Kartu tab Target

export interface KartuPeringkat {
  readonly elemen: HTMLElement;
  perbarui(m: ModelTampilan): void;
}

export function buatKartuPeringkat(akar: HTMLElement, o: OpsiPeringkatUi): KartuPeringkat {
  const elemen = el('div', 'target-kartu kartu-kolom peringkat-kartu');
  const judul = el('div', 'target-judul');
  const posisi = el('div', 'peringkat-posisi');
  const penumpang = el('div', 'kelas-berikut');
  const ajak = el('div', 'kelas-berikut', TEKS.peringkatAjak);
  const galat = el('div', 'kelas-berikut peringkat-galat');
  const tombol = el('button', 'tombol tombol-kedua peringkat-lihat', TEKS.peringkatLihat);
  tombol.type = 'button';
  tombol.addEventListener('click', () => tampilkanPopupPeringkat(akar, o));
  elemen.append(judul, posisi, penumpang, ajak, galat, tombol);
  let model: ModelPeringkat | null = null;

  const tulis = (): void => {
    const m = model;
    if (!m) return;
    setHidden(elemen, m.minggu === null);
    if (m.minggu === null) return;
    const l = o.layanan;
    const ikut = m.ikut && l.masuk;
    const sisa = m.selesaiMs - Date.now();
    setTeks(judul, sisa > 0 ? TEKS.peringkatJudul(sisaWaktuEvent(sisa)) : TEKS.peringkatJudulPopup);
    const saya = ikut ? l.saya : null;
    const teksPosisi =
      saya?.peringkat != null
        ? TEKS.peringkatPosisi(formatAngka(saya.peringkat), formatAngka(saya.jumlah))
        : saya && saya.skor !== null
          ? TEKS.peringkatLuar(formatAngka(BATAS_PERINGKAT), formatAngka(saya.jumlah))
          : '';
    setTeks(posisi, teksPosisi);
    setHidden(posisi, teksPosisi === '');
    setTeks(penumpang, TEKS.peringkatPenumpang(formatSkor(m.penumpang)));
    setHidden(ajak, ikut);
    const kode = ikut ? l.pengirim.galat : null;
    setTeks(galat, kode ? GALAT_PERINGKAT[kode] : '');
    setHidden(galat, kode === null);
  };
  o.layanan.berlangganan(tulis);

  return {
    elemen,
    perbarui(m) {
      model = m.peringkat;
      tulis();
      // Kartu sedang terlihat (tab Target terbuka): peringkat sendiri disegarkan sesekali.
      if (m.peringkat.ikut && elemen.offsetParent !== null) void o.layanan.segarkanSaya();
    },
  };
}

// ---------------------------------------------------------------------------
// Popup papan

export function tampilkanPopupPeringkat(akar: HTMLElement, o: OpsiPeringkatUi): void {
  akar.querySelector('.popup-latar.latar-peringkat')?.remove();
  o.saatBuka?.();
  const latar = el('div', 'popup-latar latar-peringkat');
  const kotak = el('div', 'popup popup-peringkat');
  kotak.setAttribute('role', 'dialog');
  kotak.setAttribute('aria-modal', 'true');
  kotak.setAttribute('aria-labelledby', 'popup-peringkat-judul');
  const judul = el('h2', undefined, TEKS.peringkatJudulPopup);
  judul.id = 'popup-peringkat-judul';
  const tab = el('div', 'peringkat-tab');
  tab.setAttribute('role', 'tablist');
  const tabIni = tombol('peringkat-tab-tombol', TEKS.peringkatMingguIni);
  const tabLalu = tombol('peringkat-tab-tombol', TEKS.peringkatMingguLalu);
  tab.append(tabIni, tabLalu);
  const info = el('p', 'peringkat-info');
  const daftar = el('ol', 'peringkat-daftar');
  const status = el('p', 'peringkat-status');
  const cobaLagi = tombol('pembaruan-nanti peringkat-coba', TEKS.peringkatCobaLagi);
  const kaki = el('div', 'peringkat-kaki');
  const tutupB = tombol('tombol tombol-kedua popup-tombol', TEKS.peringkatTutup);
  kotak.append(judul, tab, info, status, cobaLagi, daftar, kaki, tutupB);
  latar.append(kotak);
  akar.append(latar);

  let minggu: 'ini' | 'lalu' = 'ini';
  let papan: PapanPeringkat | null = null;
  let keadaan: 'memuat' | 'ok' | 'gagal' = 'memuat';
  let sibuk = false;
  let pesan = '';
  let yakinKeluar = false;
  let urutanMuat = 0;

  const kunciIni = (): string => o.ambilModel().minggu ?? mingguWib(Date.now()).kunci;
  const kunciTampil = (): string => (minggu === 'ini' ? kunciIni() : (mingguSebelum(kunciIni()) ?? kunciIni()));

  const barisEntri = (no: string, nama: string, kelas: number, skor: number, saya: boolean, medali: string | null): HTMLLIElement => {
    const li = el('li', saya ? 'peringkat-baris saya' : 'peringkat-baris');
    li.append(el('span', 'peringkat-no', medali ?? no), el('span', 'peringkat-nama', TEKS.peringkatNama(nama)), el('span', 'peringkat-kelas', namaKelas(kelas)), el('span', 'peringkat-skor', formatSkor(skor)));
    return li;
  };

  const tulisDaftar = (): void => {
    daftar.replaceChildren();
    tabIni.classList.toggle('aktif', minggu === 'ini');
    tabLalu.classList.toggle('aktif', minggu === 'lalu');
    tabIni.setAttribute('aria-selected', String(minggu === 'ini'));
    tabLalu.setAttribute('aria-selected', String(minggu === 'lalu'));
    setHidden(cobaLagi, keadaan !== 'gagal');
    if (keadaan !== 'ok' || !papan) {
      setTeks(info, '');
      setTeks(status, keadaan === 'memuat' ? TEKS.peringkatMemuat : TEKS.peringkatGagal);
      setHidden(status, false);
      return;
    }
    const m = o.ambilModel();
    const sisa = m.selesaiMs - Date.now();
    setTeks(info, minggu === 'ini' ? TEKS.peringkatInfo(sisaWaktuEvent(Math.max(0, sisa)), formatAngka(papan.jumlah)) : TEKS.peringkatInfoLalu(rentangMinggu(papan.minggu), formatAngka(papan.jumlah)));
    const kosong = papan.daftar.length === 0;
    setTeks(status, kosong ? (minggu === 'ini' ? TEKS.peringkatKosong : TEKS.peringkatKosongLalu) : '');
    setHidden(status, !kosong);
    const no = peringkatBaris(papan.daftar);
    const idSaya = o.layanan.idSaya;
    papan.daftar.forEach((e, i) => {
      const r = no[i]!;
      daftar.append(barisEntri(String(r), e.nama, e.kelas, e.skor, e.id === idSaya, r <= MEDALI.length ? MEDALI[r - 1]! : null));
    });
    // Pemain di luar baris teratas: barisnya sendiri di bawah, dengan peringkat dari server.
    const saya = minggu === 'ini' && m.ikut ? o.layanan.saya : null;
    if (saya && saya.skor !== null && !papan.daftar.some((e) => e.id === idSaya)) {
      daftar.append(el('li', 'peringkat-sela', '⋯'));
      const r = saya.peringkat === null ? TEKS.peringkatLuarDaftar(formatAngka(BATAS_PERINGKAT)) : String(saya.peringkat);
      daftar.append(barisEntri(r, m.nama, m.kelas, saya.skor, true, null));
    }
  };

  const tulisKaki = (): void => {
    kaki.replaceChildren();
    const m = o.ambilModel();
    const l = o.layanan;
    const teks = (isi: string, kelas = 'peringkat-catatan'): void => void kaki.append(el('p', kelas, isi));
    if (!l.masuk) {
      teks(TEKS.peringkatTamu);
      const masuk = tombol('tombol tombol-hijau peringkat-aksi', TEKS.peringkatMasuk);
      masuk.addEventListener('click', () => {
        tutup();
        o.bukaAkun();
      });
      kaki.append(masuk);
      return;
    }
    if (!m.ikut) {
      teks(TEKS.peringkatPersetujuan);
      if (pesan) teks(pesan, 'peringkat-catatan peringkat-galat');
      const ikut = tombol('tombol tombol-hijau peringkat-aksi', sibuk ? TEKS.peringkatMengirim : TEKS.peringkatIkut);
      ikut.disabled = sibuk;
      ikut.addEventListener('click', () => void ikutPapan());
      kaki.append(ikut);
      return;
    }
    const kode = l.pengirim.galat;
    const galat = pesan || (kode ? GALAT_PERINGKAT[kode] : '');
    if (galat) teks(galat, 'peringkat-catatan peringkat-galat');
    if (kode === 'nama-ditolak' || kode === 'nama-kosong') {
      const ganti = tombol('tombol tombol-kedua peringkat-aksi', TEKS.peringkatGantiNama);
      ganti.addEventListener('click', () => void o.mintaNama().then(() => tulisKaki()));
      kaki.append(ganti);
    }
    if (!yakinKeluar) {
      teks(TEKS.peringkatIkutTeks);
      const keluar = tombol('peringkat-tautan', TEKS.peringkatKeluar);
      keluar.disabled = sibuk;
      keluar.addEventListener('click', () => {
        yakinKeluar = true;
        tulisKaki();
      });
      kaki.append(keluar);
      return;
    }
    teks(TEKS.peringkatKeluarYakin);
    const baris = el('div', 'peringkat-pilihan');
    const ya = tombol('tombol tombol-merah peringkat-aksi', TEKS.peringkatKeluarYa);
    const batal = tombol('tombol tombol-kedua peringkat-aksi', TEKS.peringkatBatal);
    ya.disabled = batal.disabled = sibuk;
    ya.addEventListener('click', () => void keluarPapan());
    batal.addEventListener('click', () => {
      yakinKeluar = false;
      tulisKaki();
    });
    baris.append(batal, ya);
    kaki.append(baris);
  };

  const muat = async (paksa = false): Promise<void> => {
    const ke = ++urutanMuat;
    keadaan = 'memuat';
    papan = null;
    tulisDaftar();
    try {
      const hasil = await o.layanan.papan(kunciTampil(), paksa);
      if (ke !== urutanMuat) return;
      papan = hasil;
      keadaan = 'ok';
    } catch {
      if (ke !== urutanMuat) return;
      keadaan = 'gagal';
    }
    tulisDaftar();
  };

  const ikutPapan = async (): Promise<void> => {
    if (sibuk) return;
    pesan = '';
    let nama = o.ambilModel().nama;
    if (!nama) {
      nama = (await o.mintaNama()) ?? '';
      if (!nama) {
        pesan = GALAT_PERINGKAT['nama-kosong'];
        tulisKaki();
        return;
      }
    }
    if (!namaLayakPublik(nama)) {
      pesan = GALAT_PERINGKAT['nama-ditolak'];
      tulisKaki();
      return;
    }
    sibuk = true;
    tulisKaki();
    try {
      await o.layanan.ikut();
    } catch (e) {
      // Persetujuan tetap tercatat; skor dicoba kirim lagi otomatis (atau setelah nama diganti).
      pesan = GALAT_PERINGKAT[e instanceof GalatPeringkat ? e.kode : 'jaringan'];
    }
    sibuk = false;
    minggu = 'ini';
    tulisKaki();
    await muat(true);
  };

  const keluarPapan = async (): Promise<void> => {
    if (sibuk) return;
    sibuk = true;
    pesan = '';
    tulisKaki();
    try {
      await o.layanan.keluar();
      yakinKeluar = false;
    } catch {
      pesan = TEKS.peringkatKeluarGagal;
    }
    sibuk = false;
    tulisKaki();
    await muat(true);
  };

  const lepas = o.layanan.berlangganan(() => {
    tulisKaki();
    if (keadaan === 'ok') tulisDaftar();
  });
  const tutup = (): void => {
    if (sibuk) return;
    lepas();
    window.removeEventListener('keydown', saatTombol);
    latar.remove();
  };
  const saatTombol = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') tutup();
  };
  tabIni.addEventListener('click', () => {
    if (minggu === 'ini') return;
    minggu = 'ini';
    void muat();
  });
  tabLalu.addEventListener('click', () => {
    if (minggu === 'lalu') return;
    minggu = 'lalu';
    void muat();
  });
  cobaLagi.addEventListener('click', () => void muat(true));
  tutupB.addEventListener('click', tutup);
  latar.addEventListener('click', (e) => {
    if (e.target === latar) tutup();
  });
  window.addEventListener('keydown', saatTombol);

  tulisKaki();
  void muat();
  if (o.ambilModel().ikut) void o.layanan.segarkanSaya(true);
}

// ---------------------------------------------------------------------------
// Helper DOM

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

function tombol(kelas: string, teks: string): HTMLButtonElement {
  const b = el('button', kelas, teks);
  b.type = 'button';
  return b;
}

function setTeks(e: HTMLElement, teks: string): void {
  if (e.textContent !== teks) e.textContent = teks;
}

function setHidden(e: HTMLElement, hidden: boolean): void {
  if (e.hidden !== hidden) e.hidden = hidden;
}
