/**
 * DOM overlay: area adegan 3D (tempat tombol kamera & suara melayang) dan
 * bilah berisi HUD (kas, laba rata-rata per hari, penumpang di terminal, kepuasan,
 * jam, baris tujuan berikutnya) + panel tab pengelolaan. Portrait: HUD di atas,
 * panel di bawah; landscape: HUD & panel di bilah samping kanan (lihat gaya.css).
 * Dibangun sekali; setiap perubahan state hanya menyentuh node yang nilainya
 * berubah. Semua angka berasal dari view model (ui/model.ts) dan helper murni
 * (app/tujuan.ts, app/kepuasan-turun.ts). Ingatan sesi (tujuan yang tampil, butir
 * lencana yang sudah dilihat, antrean notifikasi, riwayat kepuasan) tidak disimpan.
 */
import type { Analitik } from '../app/analitik';
import { peristiwaTujuanKetuk } from '../app/analitik';
import { KEPUASAN_TURUN, kepuasanTurunBerlaku, periksaKepuasanTurun, type KepuasanTurun, type SampelKepuasan } from '../app/kepuasan-turun';
import type { PengendaliGame } from '../app/pengendali';
import { butirLencana, daftarTujuan, jumlahLencana, pilihTujuan, type ButirLencana, type TujuanDinilai } from '../app/tujuan';
import { PILIHAN_KECEPATAN } from '../config/waktu.config';
import type { Aksi } from '../sim/aksi';
import type { AreaId } from '../sim/operasi';
import type { PoId } from '../sim/fitur';
import { gayaTujuan, sasaranTujuan, teksTujuan, type GayaTujuan, type SasaranTujuan } from './baris-tujuan';
import { formatAngka, formatUang, formatUangBertanda } from './format';
import { buatTabBangun, buatTabPetugas, buatTabPo, buatTabTarget, buatTabTerminal, type IklanMenu, type IsiTab } from './menu';
import { buatModel, type ModelEvent, type ModelHud, type ModelTampilan } from './model';
import { ambilNotif, antreNotif, notifBahaya, notifikasiPerubahan, perluasanBaruTerbuka, teksKepuasanTurun, urutanPesan, type PesanNotif } from './notifikasi';
import { tanyaNamaTerminal } from './popup-nama';
import { tampilkanPopupKepuasan, tingkatPilKepuasan, wajahKepuasan } from './popup-kepuasan';
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
  /** Panel sedang layar penuh (menutupi adegan): adegan 3D tidak perlu digambar. */
  panelPenuh(): boolean;
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
  /** Analitik untuk ketukan baris tujuan (`tujuan_ketuk`). */
  readonly analitik?: Analitik;
}

/** Baris tujuan & lencana dihitung ulang paling sering sekali per detik nyata (dan langsung setelah aksi pemain). */
const MS_HITUNG_TUJUAN = 1000;
/** Lama sasaran ketukan baris tujuan / pil laba disorot. */
const MS_SOROT_TUJUAN = 3000;
/** Lama satu notifikasi tampil, dan jeda sebelum notifikasi berikutnya dari antrean. */
const MS_NOTIF = 3500;
const MS_JEDA_NOTIF = 300;
/** Toast kepuasan tidak muncul di detik-detik pertama sesi (sambutan tutorial). */
const MS_AWAL_TANPA_TOAST_KEPUASAN = 8000;
const KELAS_SOROT = 'sorot-tutorial';

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
/** Ikon tombol layar penuh: sudut keluar = perbesar, sudut masuk = kecilkan. */
const IKON_PENUH = { besar: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5', kecil: 'M9 4v5H4M15 4v5h5M15 20v-5h5M9 20v-5H4' } as const;

export function pasangOverlay(akar: HTMLElement, pengendali: PengendaliGame, opsi: OpsiOverlay = {}): Overlay {
  // PO yang diputus pemain sendiri: keluarnya tidak diberi notifikasi "kontrak habis".
  const diputus = new Set<PoId>();
  // Setelah aksi pemain, baris tujuan langsung dihitung ulang (tujuan yang baru dikerjakan diganti).
  let perluHitungTujuan = true;
  const kirim = (aksi: Aksi): void => {
    if (aksi.jenis === 'putusPo') diputus.add(aksi.po);
    perluHitungTujuan = true;
    pengendali.kirim(aksi);
  };

  const hud = buatHud(opsi.kecepatan ?? 1, {
    pilihKecepatan: (k) => opsi.saatUbahKecepatan?.(k),
    bukaKepuasan: () => tampilkanPopupKepuasan(akar, buatModel(pengendali.state).hud.kepuasan),
    bukaKeuangan: () => bukaSasaran({ tab: 'terminal', selektor: '[data-kartu="keuangan"]' }),
    ketukTujuan: () => {
      if (!tujuan) return;
      const p = peristiwaTujuanKetuk(tujuan.jenis);
      opsi.analitik?.catat(p.nama, p.data);
      bukaSasaran(sasaranTujuan(tujuan));
    },
  });
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
      bukaKepuasan: () => tampilkanPopupKepuasan(akar, buatModel(pengendali.state).hud.kepuasan),
      ...(opsi.iklan ? { iklan: opsi.iklan } : {}),
      ...(opsi.peringkat
        ? { kartuPeringkat: buatKartuPeringkat(akar, { ...opsi.peringkat, ambilModel: () => buatModel(pengendali.state).peringkat, mintaNama }) }
        : {}),
    }),
  };
  const barTab = el('nav', 'tab-bar');
  const tombolTab = {} as Record<IdTab, HTMLButtonElement>;
  const lencanaTarget = el('span', 'tab-lencana');
  // Lencana Terminal (perluasan terbuka) & PO (tawaran, PO yang bisa didaftarkan, jendela kosong): app/tujuan.ts.
  const lencanaTerminal = el('span', 'tab-lencana');
  const lencanaPo = el('span', 'tab-lencana');
  lencanaTerminal.hidden = true;
  lencanaPo.hidden = true;
  for (const id of ID_TAB) {
    const b = el('button', 'tab', LABEL_TAB[id]());
    b.type = 'button';
    b.dataset['tab'] = id;
    b.addEventListener('click', () => pilihTab(id));
    if (id === 'target') b.append(lencanaTarget);
    if (id === 'terminal') b.append(lencanaTerminal);
    if (id === 'po') b.append(lencanaPo);
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
  /** Butir lencana terakhir & kunci yang sudah dilihat (memori sesi saja: memuat ulang = dihitung ulang). */
  let butir: ButirLencana = { terminal: [], po: [] };
  const dilihat = new Set<string>();
  let jumlahKlaim = 0;
  const perbaruiLencana = (): void => {
    // Tab yang terbuka (panel tidak ringkas): semua butirnya terlihat.
    if (!ringkas) for (const k of tabAktif === 'terminal' ? butir.terminal : tabAktif === 'po' ? butir.po : []) dilihat.add(k);
    // Ditahan selama tutorial aktif (juga titik merah tombol panel yang berasal dari lencana).
    const { terminal, po, target } = jumlahLencana(butir, dilihat, akar.classList.contains('tutorial-aktif'), jumlahKlaim);
    setTeks(lencanaTerminal, terminal > 0 ? String(terminal) : '');
    setHidden(lencanaTerminal, terminal === 0);
    setTeks(lencanaPo, po > 0 ? String(po) : '');
    setHidden(lencanaPo, po === 0);
    setTeks(lencanaTarget, target > 0 ? String(target) : '');
    setHidden(lencanaTarget, target === 0);
    tombolTab.terminal.classList.toggle('ada-lencana', terminal > 0);
    tombolTab.po.classList.toggle('ada-lencana', po > 0);
    tombolTab.target.classList.toggle('ada-lencana', target > 0);
    // Titik merah tombol panel: ada hadiah, atau (saat panel ringkas, tab tersembunyi) lencana tab.
    tombolRingkas.classList.toggle('ada-klaim', target > 0 || (ringkas && terminal + po > 0));
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
    if (r && penuh) aturPenuh(false);
    aturRingkas(r);
    opsi.saatUbahRingkas?.(r);
    // Panel yang dibuka lagi langsung menampilkan state terbaru.
    if (!r) tab[tabAktif].perbarui(buatModel(pengendali.state));
  };
  tombolRingkas.addEventListener('click', () => ubahRingkas(!ringkas));
  daftar.prepend(tombolRingkas);
  aturRingkas(ringkas);

  // Layar penuh: panel menutupi adegan supaya pengaturan yang banyak lebih leluasa. Selama itu
  // adegan tidak digambar (main.ts) dan kanvasnya dibiarkan di tempat (bingkai.ts), jadi sudut
  // kamera tetap saat panel dikecilkan lagi. Tidak disimpan: game selalu mulai dengan adegan.
  const tombolPenuh = el('button', 'tab-penuh');
  tombolPenuh.type = 'button';
  tombolPenuh.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ikonPenuh = tombolPenuh.querySelector('path')!;
  barTab.append(tombolPenuh);
  let penuh = false;
  const tandaiPenuh = (): void => {
    const teks = penuh ? TEKS.panelKecilkan : TEKS.panelPenuh;
    ikonPenuh.setAttribute('d', penuh ? IKON_PENUH.kecil : IKON_PENUH.besar);
    tombolPenuh.setAttribute('aria-pressed', String(penuh));
    tombolPenuh.setAttribute('aria-label', teks);
    tombolPenuh.title = teks;
  };
  const aturPenuh = (p: boolean): void => {
    penuh = p;
    akar.classList.toggle('panel-penuh', p);
    tandaiPenuh();
    // Tata letak berubah: bingkai menghitung ulang (dan menempatkan kanvas lagi saat keluar).
    window.dispatchEvent(new Event('resize'));
    if (p) tab[tabAktif].perbarui(buatModel(pengendali.state));
  };
  tombolPenuh.addEventListener('click', () => aturPenuh(!penuh));
  tandaiPenuh();
  const saatTombol = (e: KeyboardEvent): void => {
    // Esc menutup popup lebih dulu (popup memasang penanganannya sendiri).
    if (e.key === 'Escape' && penuh && !akar.querySelector('.popup-latar')) aturPenuh(false);
  };
  window.addEventListener('keydown', saatTombol);

  const area = el('div', 'area-adegan');
  const kontrol = el('div', 'kontrol-adegan');
  area.append(kontrol);
  const bilah = el('div', 'bilah');
  bilah.append(hud.elemen, daftar);
  akar.replaceChildren(area, bilah);

  // Notifikasi singkat di atas adegan, bergantian lewat antrean (paling banyak 3 tertunda, 3,5 dtk
  // masing-masing; pesan bahaya melompati antrean). Menunggu selama popup terbuka.
  const notif = el('div', 'notif');
  notif.setAttribute('role', 'status');
  area.append(notif);
  let modelLalu: ModelTampilan | null = null;
  let antrean: PesanNotif[] = [];
  let notifTampil: PesanNotif | null = null;
  let timerNotif = 0;
  /** Kepuasan penumpang terakhir (pil HUD): toast kepuasan dinilai ulang dengannya saat keluar dari antrean. */
  let kepuasanKini = 0;
  const antre = (teks: string, kepuasan?: KepuasanTurun): void => {
    antrean = antreNotif(antrean, { teks, bahaya: notifBahaya(teks), ...(kepuasan ? { kepuasan } : {}) }, notifTampil?.teks ?? null);
  };
  const sembunyikanNotif = (): void => {
    window.clearTimeout(timerNotif);
    notif.classList.remove('tampil', 'bisa-ketuk');
    hud.denyutKepuasan(false);
    // Jeda singkat supaya pesan berikutnya muncul sebagai toast baru, bukan teks yang berganti.
    timerNotif = window.setTimeout(() => {
      notifTampil = null;
      tampilkanBerikut();
    }, MS_JEDA_NOTIF);
  };
  const tampilkanBerikut = (): void => {
    if (notifTampil || antrean.length === 0 || akar.querySelector('.popup-latar')) return;
    // Toast kepuasan yang sudah pulih dibuang; yang masih berlaku memakai angka sekarang (sama dengan pil).
    const { pesan: p, sisa } = ambilNotif(antrean, kepuasanKini);
    antrean = sisa;
    if (!p) return;
    notifTampil = p;
    notif.textContent = p.teks;
    notif.classList.add('tampil');
    // Hanya toast kepuasan yang bisa diketuk; selama tampil pil kepuasan berdenyut.
    notif.classList.toggle('bisa-ketuk', p.kepuasan !== undefined);
    hud.denyutKepuasan(p.kepuasan !== undefined);
    window.clearTimeout(timerNotif);
    timerNotif = window.setTimeout(sembunyikanNotif, MS_NOTIF);
  };
  const tampilkanNotif = (teks: string): void => {
    antre(teks);
    tampilkanBerikut();
  };
  notif.addEventListener('click', () => {
    if (!notifTampil?.kepuasan) return;
    sembunyikanNotif();
    tampilkanPopupKepuasan(akar, buatModel(pengendali.state).hud.kepuasan);
  });

  // Toast kepuasan turun: satu sampel per detik nyata (documents/14 bagian 4.2).
  const mulaiMs = performance.now();
  let riwayatKepuasan: SampelKepuasan[] = [];
  let toastKepuasanMs: number | null = null;
  let sampelKepuasanMs = Number.NEGATIVE_INFINITY;
  const amatiKepuasan = (m: ModelTampilan, sekarang: number): void => {
    if (sekarang - sampelKepuasanMs < 1000) return;
    sampelKepuasanMs = sekarang;
    const sampel: SampelKepuasan = { ms: sekarang, kepuasan: m.hud.kepuasan, bottleneck: m.hud.kepuasan.bottleneck };
    // Toast kepuasan yang sedang tampil hilang begitu kepuasan pulih (tidak bertentangan dengan pil).
    if (notifTampil?.kepuasan && !kepuasanTurunBerlaku(notifTampil.kepuasan, sampel.kepuasan.nilai)) sembunyikanNotif();
    const boleh = !akar.classList.contains('tutorial-sambutan') && sekarang - mulaiMs >= MS_AWAL_TANPA_TOAST_KEPUASAN;
    const turun = boleh ? periksaKepuasanTurun(riwayatKepuasan, sampel, toastKepuasanMs) : null;
    if (turun) {
      antre(teksKepuasanTurun(turun), turun);
      toastKepuasanMs = sekarang;
      riwayatKepuasan = [sampel];
      return;
    }
    riwayatKepuasan = riwayatKepuasan.filter((x) => x.ms >= sekarang - KEPUASAN_TURUN.jendelaMs);
    riwayatKepuasan.push(sampel);
  };

  // Baris tujuan berikutnya: yang tampil dipertahankan (histeresis app/tujuan.ts); tidak disimpan.
  let tujuan: TujuanDinilai | null = null;
  let tujuanTampil: { kunci: string; sejakMs: number } | null = null;
  let hitungTujuanMs = Number.NEGATIVE_INFINITY;
  const perbaruiTujuan = (sekarang: number): void => {
    const s = pengendali.state;
    const p = pilihTujuan(daftarTujuan(s, tujuanTampil?.kunci ?? null), tujuanTampil, sekarang);
    if (!tujuanTampil || tujuanTampil.kunci !== p.kunci) tujuanTampil = { kunci: p.kunci, sejakMs: sekarang };
    tujuan = p;
    hud.tampilkanTujuan(teksTujuan(p), gayaTujuan(p));
    butir = butirLencana(s);
    perbaruiLencana();
  };
  // Perluasan yang baru terbuka diberitahukan sekali per tahap per sesi.
  const perluasanDiumumkan = new Set<number>();

  const lepasLangganan = pengendali.berlangganan((state) => {
    const model = buatModel(state);
    const sekarang = performance.now();
    kepuasanKini = model.hud.kepuasan.nilai;
    hud.perbarui(model.hud, model.event, akar.classList.contains('tutorial-aktif'));
    // Hanya tab yang terlihat yang diperbarui (dan semuanya sekali di awal) supaya hemat DOM.
    for (const t of ID_TAB) if (!modelLalu || (t === tabAktif && !ringkas)) tab[t].perbarui(model);
    jumlahKlaim = model.jumlahKlaim;
    // Level naik atau perluasan berganti tahap: baris tujuan & lencana langsung ikut (bersamaan dengan notifikasinya).
    const lp = modelLalu?.terminal;
    if (lp && (lp.level !== model.terminal.level || lp.perluasan.selesai !== model.terminal.perluasan.selesai)) perluHitungTujuan = true;
    if (perluHitungTujuan || sekarang - hitungTujuanMs >= MS_HITUNG_TUJUAN) {
      perluHitungTujuan = false;
      hitungTujuanMs = sekarang;
      perbaruiTujuan(sekarang);
    } else perbaruiLencana();
    // Perluasan terbuka lebih dulu dari slot PO & level (Lv 3 & 6 memicu ketiganya sekaligus), tapi sesudah
    // peresmian perluasan sebelumnya (urutanPesan). Di awal sesi pesannya menunggu di antrean sampai popup
    // (offline, pembaruan) ditutup.
    const baru = perluasanBaruTerbuka(modelLalu, model);
    const tahap = baru !== null && !perluasanDiumumkan.has(baru) ? baru : null;
    if (tahap !== null) perluasanDiumumkan.add(tahap);
    const pesan = modelLalu ? notifikasiPerubahan(modelLalu, model, diputus) : null;
    for (const teks of urutanPesan(modelLalu, model, pesan, tahap)) antre(teks);
    if (modelLalu) {
      const lalu = modelLalu;
      // PO yang sudah keluar tidak perlu diingat lagi (bisa didaftarkan & diputus ulang nanti).
      for (const p of lalu.mitra.terdaftar) if (!model.mitra.terdaftar.some((x) => x.id === p.id)) diputus.delete(p.id);
      amatiKepuasan(model, sekarang);
      // Pembaruan pertama berjalan sebelum popup offline dipasang: antrean baru diputar sesudahnya.
      tampilkanBerikut();
    }
    modelLalu = model;
  });
  // Saat berpindah tab, isi tab langsung diperbarui dengan state terbaru, dan butirnya ditandai sudah dilihat.
  for (const id of ID_TAB)
    tombolTab[id].addEventListener('click', () => {
      tab[id].perbarui(buatModel(pengendali.state));
      perbaruiLencana();
    });
  // Tutorial dipasang (ui/tutorial.ts) setelah pembaruan pertama di atas, atau selesai: lencana langsung
  // ikut kelas `tutorial-aktif`, tanpa menunggu pembaruan state berikutnya (sambutan tanpa kilasan lencana).
  const pengamatTutorial = new MutationObserver(() => perbaruiLencana());
  pengamatTutorial.observe(akar, { attributes: true, attributeFilter: ['class'] });

  // Ketukan baris tujuan / pil laba: buka panel & tab, gulir ke sasaran, sorot 3 dtk. Tidak pernah menjalankan aksi.
  let disorot: HTMLElement[] = [];
  let timerSorot = 0;
  const lepasSorot = (): void => {
    window.clearTimeout(timerSorot);
    for (const e of disorot) {
      e.classList.remove(KELAS_SOROT);
      e.removeEventListener('click', lepasSorot);
    }
    disorot = [];
  };
  const bukaSasaran = (s: SasaranTujuan): void => {
    if (ringkas) ubahRingkas(false);
    if (penuh) aturPenuh(false);
    pilihTab(s.tab);
    tab[s.tab].perbarui(buatModel(pengendali.state));
    perbaruiLencana();
    const cari = (sel: string): HTMLElement[] => [...daftar.querySelectorAll<HTMLElement>(sel)].filter((e) => e.getClientRects().length > 0);
    let ketemu = cari(s.selektor);
    if (ketemu.length === 0 && s.cadangan) ketemu = cari(s.cadangan);
    lepasSorot();
    disorot = ketemu.length > 0 ? ketemu : [tombolTab[s.tab]];
    const halus = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const e of disorot) {
      e.classList.add(KELAS_SOROT);
      // Sasaran diketuk: sorotan berhenti lebih awal.
      e.addEventListener('click', lepasSorot);
    }
    const pertama = disorot[0]!;
    if (pertama.closest('.isi-tab')) pertama.scrollIntoView({ block: 'nearest', behavior: halus ? 'smooth' : 'auto' });
    timerSorot = window.setTimeout(lepasSorot, MS_SOROT_TUJUAN);
  };
  const bukaArea = (id: AreaId): void => {
    if (ringkas) ubahRingkas(false);
    pilihTab('bangun');
    tab.bangun.perbarui(buatModel(pengendali.state));
    tab.bangun.sorot?.(id);
  };
  const lepas = (): void => {
    lepasLangganan();
    pengamatTutorial.disconnect();
    window.removeEventListener('keydown', saatTombol);
    window.clearTimeout(timerNotif);
    lepasSorot();
  };
  return { area, kontrol, aturKecepatan: hud.aturKecepatan, notif: tampilkanNotif, bukaArea, panelPenuh: () => penuh, lepas };
}

// ---------------------------------------------------------------------------
// HUD

interface Hud {
  readonly elemen: HTMLElement;
  /** @param tutorial tutorial sedang aktif: pil laba & kepuasan netral (belum hijau/merah). */
  perbarui(m: ModelHud, event: ModelEvent | null, tutorial: boolean): void;
  aturKecepatan(kecepatan: number): void;
  /** Isi & warna baris tujuan berikutnya. */
  tampilkanTujuan(teks: string, gaya: GayaTujuan): void;
  /** Pil kepuasan berdenyut selama toast kepuasan turun tampil. */
  denyutKepuasan(aktif: boolean): void;
}

interface AksiHud {
  readonly pilihKecepatan: (kecepatan: number) => void;
  readonly bukaKepuasan: () => void;
  /** Pil laba diketuk: laporan keuangan di tab Terminal. */
  readonly bukaKeuangan: () => void;
  readonly ketukTujuan: () => void;
}

function buatHud(kecepatanAwal: number, aksi: AksiHud): Hud {
  const saatPilih = aksi.pilihKecepatan;
  const elemen = el('header', 'hud');
  const kas = el('div', 'hud-uang');
  const baris = el('div', 'hud-baris');
  // Laba rata-rata per hari: diketuk membuka laporan keuangan.
  const laba = el('button', 'hud-pendapatan');
  laba.type = 'button';
  laba.title = TEKS.hudLabaJudul;
  laba.addEventListener('click', aksi.bukaKeuangan);
  const diTerminal = el('span', 'hud-arus');
  const kelas = el('span', 'hud-kelas');
  // Kepuasan penumpang: diketuk membuka rinciannya.
  const kepuasan = el('button', 'hud-kepuasan');
  kepuasan.type = 'button';
  kepuasan.title = TEKS.kepuasanTombol;
  kepuasan.setAttribute('aria-label', TEKS.kepuasanTombol);
  kepuasan.addEventListener('click', aksi.bukaKepuasan);
  const pilEvent = el('span', 'hud-event');
  pilEvent.hidden = true;
  // Baris tujuan berikutnya (menggantikan petunjuk lama, posisi & ukuran sama): diketuk menuju sasarannya.
  const petunjuk = el('button', 'hud-petunjuk hud-tujuan');
  petunjuk.type = 'button';
  const teksTujuanEl = el('span', 'tujuan-teks');
  petunjuk.append(teksTujuanEl, el('span', 'tujuan-panah', '›'));
  petunjuk.hidden = true;
  petunjuk.addEventListener('click', aksi.ketukTujuan);
  baris.append(laba, diTerminal, kelas, kepuasan, pilEvent);
  const labaRingkas = el('button', 'hud-pendapatan-ringkas');
  labaRingkas.type = 'button';
  labaRingkas.title = TEKS.hudLabaJudul;
  labaRingkas.addEventListener('click', aksi.bukaKeuangan);
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
    tampilkanTujuan(teks, gaya) {
      setTeks(teksTujuanEl, teks);
      if (petunjuk.getAttribute('aria-label') !== teks) petunjuk.setAttribute('aria-label', teks);
      setHidden(petunjuk, teks === '');
      petunjuk.classList.toggle('bahaya', gaya === 'bahaya');
      petunjuk.classList.toggle('netral', gaya === 'netral');
    },
    denyutKepuasan(aktif) {
      kepuasan.classList.toggle('berdenyut', aktif);
    },
    perbarui(m, event, tutorial) {
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
      // Laba rata-rata per hari (dengan kontrak PO): hijau untung, merah rugi; netral selama
      // tutorial & jam terminal pertama supaya HUD tidak merah di detik pertama.
      const boost = m.boostAktif ? TEKS.boostHud : '';
      const teksLaba = TEKS.hudLaba(formatUangBertanda(m.labaHarian));
      const netral = tutorial || m.awal;
      setTeks(laba, `${teksLaba}${boost}`);
      laba.classList.toggle('boost', boost !== '');
      laba.classList.toggle('rugi', !netral && m.labaHarian < 0);
      laba.classList.toggle('netral', netral);
      setTeks(labaRingkas, teksLaba);
      labaRingkas.classList.toggle('rugi', !netral && m.labaHarian < 0);
      labaRingkas.classList.toggle('netral', netral);
      setTeks(diTerminal, TEKS.hudDiTerminal(formatAngka(m.penumpangDiTerminal)));
      setTeks(kelas, TEKS.hudKelas(namaKelas(m.kelas), m.level));
      if (kelas.dataset['kelas'] !== String(Math.min(m.kelas, 3))) kelas.dataset['kelas'] = String(Math.min(m.kelas, 3));
      const puas = m.kepuasan.nilai;
      setTeks(kepuasan, TEKS.kepuasanHud(wajahKepuasan(puas), Math.round(puas * 100)));
      // Pil kepuasan ikut netral seperti pil laba (angka & wajah tetap).
      const tingkat = tingkatPilKepuasan(puas, netral);
      if (kepuasan.dataset['tingkat'] !== tingkat) kepuasan.dataset['tingkat'] = tingkat;
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
