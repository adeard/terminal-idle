/**
 * DOM overlay: area adegan 3D (tempat tombol kamera & suara melayang) dan
 * bilah berisi HUD (kas, laba hari ini, arus, kepuasan, jam) + panel tab
 * pengelolaan. Portrait: HUD di atas, panel di bawah; landscape: HUD & panel di
 * bilah samping kanan (lihat gaya.css). Dibangun sekali; setiap perubahan state
 * hanya menyentuh node yang nilainya berubah. Semua angka berasal dari view
 * model (ui/model.ts).
 */
import type { PengendaliGame } from '../app/pengendali';
import { PILIHAN_KECEPATAN } from '../config/waktu.config';
import type { Aksi } from '../sim/aksi';
import type { AreaId } from '../sim/operasi';
import type { PoId } from '../sim/fitur';
import { formatAngka, formatUang, formatUangBertanda } from './format';
import { buatTabBangun, buatTabPetugas, buatTabPo, buatTabTarget, buatTabTerminal, type IklanMenu, type IsiTab } from './menu';
import { buatModel, type ModelEvent, type ModelHud, type ModelTampilan } from './model';
import { notifikasiPerubahan } from './notifikasi';
import { tanyaNamaTerminal } from './popup-nama';
import { tampilkanPopupKepuasan, tingkatKepuasan, wajahKepuasan } from './popup-kepuasan';
import { buatKartuPeringkat, type OpsiPeringkatUi } from './peringkat';
import { LABEL_KERAMAIAN, namaKelas, NAMA_EVENT, TEKS } from './teks';

export interface Overlay {
  /** Area adegan 3D; tombol yang melayang di atas adegan ditambahkan ke `kontrol`. */
  readonly area: HTMLElement;
  readonly kontrol: HTMLElement;
  /** Tandai kecepatan yang aktif (mis. setelah diganti lewat keyboard). */
  aturKecepatan(kecepatan: number): void;
  /** Notifikasi singkat di atas adegan. */
  notif(teks: string): void;
  /** Buka tab Bangun di bagian area ini (label area di peta diketuk); panel ringkas dibuka dulu. */
  bukaArea(area: AreaId): void;
  lepas(): void;
}

export interface OpsiOverlay {
  /** Panel mulai dalam keadaan ringkas (pilihan tersimpan). */
  readonly ringkas?: boolean;
  /** Dipanggil saat pemain meringkas/membuka panel (untuk disimpan). */
  readonly saatUbahRingkas?: (ringkas: boolean) => void;
  /** Kecepatan waktu awal (lihat PILIHAN_KECEPATAN). */
  readonly kecepatan?: number;
  /** Dipanggil saat pemain memilih kecepatan waktu. */
  readonly saatUbahKecepatan?: (kecepatan: number) => void;
  /** Iklan berhadiah untuk tombol klaim 2× di tab Target (tanpa ini tombolnya tidak ada). */
  readonly iklan?: IklanMenu;
  /** Papan peringkat (hanya web; tanpa ini kartunya tidak ada). Model & popup nama disiapkan overlay. */
  readonly peringkat?: Omit<OpsiPeringkatUi, 'ambilModel' | 'mintaNama'>;
}

const ID_TAB = ['bangun', 'petugas', 'po', 'terminal', 'target'] as const;
type IdTab = (typeof ID_TAB)[number];
const LABEL_TAB: Readonly<Record<IdTab, () => string>> = {
  bangun: () => TEKS.tabBangun,
  petugas: () => TEKS.tabPetugas,
  po: () => TEKS.tabPo,
  terminal: () => TEKS.tabTerminal,
  target: () => TEKS.tabTarget,
};

/** Jalur panah tombol lipat panel: ke atas = buka panel, ke bawah = ringkas. */
const CHEVRON = { atas: 'M6 15l6-6 6 6', bawah: 'M6 9l6 6 6-6' } as const;

export function pasangOverlay(akar: HTMLElement, pengendali: PengendaliGame, opsi: OpsiOverlay = {}): Overlay {
  // PO yang diputus pemain sendiri: keluarnya tidak diberi notifikasi "kontrak habis".
  const diputus = new Set<PoId>();
  const kirim = (aksi: Aksi): void => {
    if (aksi.jenis === 'putusPo') diputus.add(aksi.po);
    pengendali.kirim(aksi);
  };

  const hud = buatHud(
    opsi.kecepatan ?? 1,
    (k) => opsi.saatUbahKecepatan?.(k),
    () => tampilkanPopupKepuasan(akar, buatModel(pengendali.state).hud.kepuasan),
  );
  const daftar = el('section', 'panel-daftar');
  /** Popup nama terminal; nama baru dikirim sebagai aksi. Hasil: nama sekarang (null = batal atau kosong). */
  const mintaNama = async (): Promise<string | null> => {
    const k = buatModel(pengendali.state).terminal;
    const nama = await tanyaNamaTerminal(akar, k.nama, namaKelas(k.kelas));
    if (nama === null) return null;
    if (nama !== k.nama) {
      kirim({ jenis: 'aturNamaTerminal', nama });
      if (nama) tampilkanNotif(TEKS.notifNama(nama));
    }
    return nama || null;
  };
  const tab: Record<IdTab, IsiTab> = {
    bangun: buatTabBangun(kirim),
    petugas: buatTabPetugas(kirim),
    po: buatTabPo(kirim),
    terminal: buatTabTerminal(kirim, { ubahNama: () => void mintaNama() }),
    target: buatTabTarget(kirim, {
      ...(opsi.iklan ? { iklan: opsi.iklan } : {}),
      ...(opsi.peringkat
        ? { kartuPeringkat: buatKartuPeringkat(akar, { ...opsi.peringkat, ambilModel: () => buatModel(pengendali.state).peringkat, mintaNama }) }
        : {}),
    }),
  };
  const barTab = el('nav', 'tab-bar');
  const tombolTab = {} as Record<IdTab, HTMLButtonElement>;
  const lencanaTarget = el('span', 'tab-lencana');
  for (const id of ID_TAB) {
    const b = el('button', 'tab', LABEL_TAB[id]());
    b.type = 'button';
    b.dataset['tab'] = id;
    b.addEventListener('click', () => pilihTab(id));
    if (id === 'target') b.append(lencanaTarget);
    tombolTab[id] = b;
    barTab.append(b);
  }
  let tabAktif: IdTab = 'bangun';
  const pilihTab = (id: IdTab): void => {
    tabAktif = id;
    for (const t of ID_TAB) {
      tombolTab[t].classList.toggle('aktif', t === id);
      tombolTab[t].setAttribute('aria-selected', String(t === id));
      tab[t].elemen.hidden = t !== id;
    }
  };
  daftar.append(barTab, ...ID_TAB.map((t) => tab[t].elemen));
  pilihTab('bangun');
  // Ringkas/buka panel supaya adegan lebih leluasa.
  // Isi tombol dibuat sekali lalu hanya diubah: kalau dibuat ulang saat diklik, elemen yang
  // diketuk (teks/panah) terlepas dari tombol di tengah event dan ketukan terbaca di luar tombol.
  const tombolRingkas = el('button', 'tombol-ringkas');
  tombolRingkas.type = 'button';
  tombolRingkas.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const panahRingkas = tombolRingkas.querySelector('path')!;
  const teksRingkas = el('span');
  tombolRingkas.append(teksRingkas);
  let ringkas = opsi.ringkas === true;
  const aturRingkas = (r: boolean): void => {
    ringkas = r;
    akar.classList.toggle('panel-ringkas', r);
    const teks = r ? TEKS.panelBuka : TEKS.panelRingkas;
    panahRingkas.setAttribute('d', r ? CHEVRON.atas : CHEVRON.bawah);
    teksRingkas.textContent = teks;
    tombolRingkas.setAttribute('aria-expanded', String(!r));
    tombolRingkas.setAttribute('aria-label', teks);
    tombolRingkas.title = teks;
  };
  const ubahRingkas = (r: boolean): void => {
    aturRingkas(r);
    opsi.saatUbahRingkas?.(r);
    // Panel yang dibuka lagi langsung menampilkan state terbaru.
    if (!r) tab[tabAktif].perbarui(buatModel(pengendali.state));
  };
  tombolRingkas.addEventListener('click', () => ubahRingkas(!ringkas));
  daftar.prepend(tombolRingkas);
  aturRingkas(ringkas);

  const area = el('div', 'area-adegan');
  const kontrol = el('div', 'kontrol-adegan');
  area.append(kontrol);
  const bilah = el('div', 'bilah');
  bilah.append(hud.elemen, daftar);
  akar.replaceChildren(area, bilah);

  // Notifikasi singkat (penghargaan baru, target harian selesai) di atas adegan.
  const notif = el('div', 'notif');
  notif.setAttribute('role', 'status');
  area.append(notif);
  let modelLalu: ModelTampilan | null = null;
  let timerNotif = 0;
  const tampilkanNotif = (teks: string): void => {
    notif.textContent = teks;
    notif.classList.add('tampil');
    window.clearTimeout(timerNotif);
    timerNotif = window.setTimeout(() => notif.classList.remove('tampil'), 3500);
  };

  const lepas = pengendali.berlangganan((state) => {
    const model = buatModel(state);
    hud.perbarui(model.hud, model.event);
    // Hanya tab yang terlihat yang diperbarui (dan semuanya sekali di awal) supaya hemat DOM.
    for (const t of ID_TAB) if (!modelLalu || (t === tabAktif && !ringkas)) tab[t].perbarui(model);
    setTeks(lencanaTarget, model.jumlahKlaim > 0 ? String(model.jumlahKlaim) : '');
    setHidden(lencanaTarget, model.jumlahKlaim === 0);
    tombolRingkas.classList.toggle('ada-klaim', model.jumlahKlaim > 0);
    if (modelLalu) {
      const lalu = modelLalu;
      const pesan = notifikasiPerubahan(lalu, model, diputus);
      // PO yang sudah keluar tidak perlu diingat lagi (bisa didaftarkan & diputus ulang nanti).
      for (const p of lalu.mitra.terdaftar) if (!model.mitra.terdaftar.some((x) => x.id === p.id)) diputus.delete(p.id);
      if (pesan) tampilkanNotif(pesan);
    }
    modelLalu = model;
  });
  // Saat berpindah tab, isi tab langsung diperbarui dengan state terbaru.
  for (const id of ID_TAB) tombolTab[id].addEventListener('click', () => tab[id].perbarui(buatModel(pengendali.state)));
  const bukaArea = (id: AreaId): void => {
    if (ringkas) ubahRingkas(false);
    pilihTab('bangun');
    tab.bangun.perbarui(buatModel(pengendali.state));
    tab.bangun.sorot?.(id);
  };
  return { area, kontrol, aturKecepatan: hud.aturKecepatan, notif: tampilkanNotif, bukaArea, lepas };
}

// ---------------------------------------------------------------------------
// HUD

interface Hud {
  readonly elemen: HTMLElement;
  perbarui(m: ModelHud, event: ModelEvent | null): void;
  aturKecepatan(kecepatan: number): void;
}

function buatHud(kecepatanAwal: number, saatPilih: (kecepatan: number) => void, bukaKepuasan: () => void): Hud {
  const elemen = el('header', 'hud');
  const kas = el('div', 'hud-uang');
  const baris = el('div', 'hud-baris');
  const laba = el('span', 'hud-pendapatan');
  const arus = el('span', 'hud-arus');
  const kelas = el('span', 'hud-kelas');
  // Kepuasan penumpang: diketuk membuka rinciannya.
  const kepuasan = el('button', 'hud-kepuasan');
  kepuasan.type = 'button';
  kepuasan.title = TEKS.kepuasanTombol;
  kepuasan.setAttribute('aria-label', TEKS.kepuasanTombol);
  kepuasan.addEventListener('click', bukaKepuasan);
  const pilEvent = el('span', 'hud-event');
  pilEvent.hidden = true;
  const petunjuk = el('div', 'hud-petunjuk');
  baris.append(laba, arus, kelas, kepuasan, pilEvent);
  const labaRingkas = el('div', 'hud-pendapatan-ringkas');
  const keuangan = el('div', 'hud-keuangan');
  keuangan.append(kas, baris, labaRingkas);
  // Jam terminal di kanan: ikon matahari/bulan + jam 24 jam, di bawahnya hari & keramaian.
  const waktu = el('div', 'hud-waktu');
  const ikon = el('span', 'ikon-langit');
  const hari = el('span', 'hud-hari');
  const jam = el('span', 'hud-jam');
  const keramaian = el('span', 'hud-keramaian');
  const barisJam = el('div', 'hud-baris-jam');
  barisJam.append(ikon, jam);
  const barisHari = el('div', 'hud-baris-hari');
  barisHari.append(hari, keramaian);
  // Kecepatan waktu 1× / 2× / 3× di bawah jam.
  const kecepatan = el('div', 'hud-kecepatan');
  kecepatan.setAttribute('role', 'group');
  const tombolKecepatan = PILIHAN_KECEPATAN.map((k) => {
    const b = el('button', 'tombol-kecepatan', `${k}×`);
    b.type = 'button';
    b.title = TEKS.kecepatan(k);
    b.setAttribute('aria-label', TEKS.kecepatan(k));
    b.addEventListener('click', () => {
      aturKecepatan(k);
      saatPilih(k);
    });
    kecepatan.append(b);
    return { k, b };
  });
  const aturKecepatan = (k: number): void => {
    for (const t of tombolKecepatan) {
      const aktif = t.k === k;
      t.b.classList.toggle('aktif', aktif);
      t.b.setAttribute('aria-pressed', String(aktif));
    }
  };
  aturKecepatan(kecepatanAwal);
  waktu.append(barisJam, barisHari, kecepatan);
  const utama = el('div', 'hud-utama');
  utama.append(keuangan, waktu);
  elemen.append(utama, petunjuk);

  return {
    elemen,
    aturKecepatan,
    perbarui(m, event) {
      const aktif = event?.aktif ? event : null;
      setHidden(pilEvent, aktif === null);
      if (aktif) {
        setTeks(pilEvent, TEKS.hudEvent(NAMA_EVENT[aktif.id].singkat, formatAngka(aktif.pengali, { desimalKecil: 2 })));
        if (pilEvent.dataset['event'] !== aktif.id) pilEvent.dataset['event'] = aktif.id;
      }
      setTeks(hari, m.waktu.hari);
      setTeks(jam, m.waktu.jam);
      hari.classList.toggle('minggu', m.waktu.hariMinggu);
      setTeks(keramaian, LABEL_KERAMAIAN[m.waktu.keramaian]);
      if (keramaian.dataset['tingkat'] !== m.waktu.keramaian) keramaian.dataset['tingkat'] = m.waktu.keramaian;
      ikon.classList.toggle('malam', !m.waktu.siang);
      ikon.classList.toggle('hujan', m.waktu.hujan);
      const judul = m.waktu.hujan ? TEKS.hujan : m.waktu.siang ? TEKS.siang : TEKS.malam;
      if (ikon.title !== judul) ikon.title = judul;
      setTeks(kas, formatUang(Math.floor(m.kas)));
      // Laba bersih hari ini (hari terminal): hijau untung, merah rugi.
      const boost = m.boostAktif ? TEKS.boostHud : '';
      const teksLaba = formatUangBertanda(m.labaHariIni);
      setTeks(laba, `${TEKS.hudHariIni(teksLaba, formatAngka(m.penumpangHariIni))}${boost}`);
      laba.classList.toggle('boost', boost !== '');
      laba.classList.toggle('rugi', m.labaHariIni < 0);
      setTeks(labaRingkas, TEKS.hudHariIniRingkas(teksLaba));
      labaRingkas.classList.toggle('rugi', m.labaHariIni < 0);
      setTeks(arus, `${TEKS.arus} ${formatAngka(Math.round(m.arus))} ${TEKS.satuanArus}`);
      setTeks(kelas, TEKS.hudKelas(namaKelas(m.kelas), m.level));
      if (kelas.dataset['kelas'] !== String(Math.min(m.kelas, 3))) kelas.dataset['kelas'] = String(Math.min(m.kelas, 3));
      const puas = m.kepuasan.nilai;
      setTeks(kepuasan, TEKS.kepuasanHud(wajahKepuasan(puas), Math.round(puas * 100)));
      const tingkat = tingkatKepuasan(puas);
      if (kepuasan.dataset['tingkat'] !== tingkat) kepuasan.dataset['tingkat'] = tingkat;
      // Peringatan kas lebih penting dari saran manajer.
      const teksPetunjuk = m.kasMenipis ? TEKS.petunjukKasMenipis : m.adaManajer ? '' : TEKS.petunjukManajer;
      setTeks(petunjuk, teksPetunjuk);
      setHidden(petunjuk, teksPetunjuk === '');
      petunjuk.classList.toggle('bahaya', m.kasMenipis);
    },
  };
}

// ---------------------------------------------------------------------------
// Helper DOM: tulis hanya kalau berubah

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

function setTeks(e: HTMLElement, teks: string): void {
  if (e.textContent !== teks) e.textContent = teks;
}

function setHidden(e: HTMLElement, hidden: boolean): void {
  if (e.hidden !== hidden) e.hidden = hidden;
}
