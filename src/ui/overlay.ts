/**
 * DOM overlay: area adegan 3D (tempat tombol kamera & suara melayang) dan
 * bilah berisi HUD uang + panel per tahap. Portrait: HUD di atas, panel di
 * bawah; landscape: HUD & panel di bilah samping kanan (lihat gaya.css).
 * Dibangun sekali; setiap perubahan state hanya menyentuh node yang nilainya
 * berubah. Semua angka berasal dari view model (ui/model.ts).
 */
import type { PengendaliGame } from '../app/pengendali';
import { PILIHAN_KECEPATAN } from '../config/waktu.config';
import { keHexCss, WARNA_TAHAP } from '../config/tema';
import type { Aksi } from '../sim/aksi';
import type { PoId } from '../sim/fitur';
import { TAHAP_IDS, type TahapId } from '../sim/tahap';
import { formatAngka, formatUang } from './format';
import { buatTabFasilitas, buatTabModern, buatTabPo, buatTabTarget, buatTabTerminal, type IklanMenu, type IsiTab } from './menu';
import { buatModel, type ModelEvent, type ModelHud, type ModelTahap, type ModelTampilan } from './model';
import { notifikasiPerubahan } from './notifikasi';
import { tanyaNamaTerminal } from './popup-nama';
import { tampilkanPopupKepuasan, tingkatKepuasan, wajahKepuasan } from './popup-kepuasan';
import { tampilkanPopupRenovasi } from './popup-renovasi';
import { buatKartuPeringkat, type OpsiPeringkatUi } from './peringkat';
import { LABEL_KERAMAIAN, namaKelas, NAMA_EVENT, NAMA_PO, NAMA_TAHAP, TEKS } from './teks';

export interface Overlay {
  /** Area adegan 3D; tombol yang melayang di atas adegan ditambahkan ke `kontrol`. */
  readonly area: HTMLElement;
  readonly kontrol: HTMLElement;
  /** Tandai kecepatan yang aktif (mis. setelah diganti lewat keyboard). */
  aturKecepatan(kecepatan: number): void;
  /** Notifikasi singkat di atas adegan. */
  notif(teks: string): void;
  lepas(): void;
}

/** Ikon tiap tahap (viewBox 24): bus di peron, tiket di loket, kursi tunggu keberangkatan. */
const IKON_TAHAP: Readonly<Record<TahapId, string>> = {
  peron:
    '<rect x="4" y="3.5" width="16" height="14" rx="3" fill="currentColor"/><rect x="6.2" y="6" width="11.6" height="5" rx="1" fill="#0b1117" opacity="0.55"/><circle cx="8" cy="14.3" r="1.3" fill="#0b1117" opacity="0.55"/><circle cx="16" cy="14.3" r="1.3" fill="#0b1117" opacity="0.55"/><rect x="6" y="17.5" width="3" height="3" rx="1" fill="currentColor"/><rect x="15" y="17.5" width="3" height="3" rx="1" fill="currentColor"/>',
  loket:
    '<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5z" fill="currentColor"/><path d="M14.5 6.5v11" stroke="#0b1117" stroke-width="1.4" stroke-dasharray="1.6 1.6" opacity="0.5"/><rect x="6" y="9" width="6" height="1.8" rx="0.9" fill="#0b1117" opacity="0.5"/><rect x="6" y="12.6" width="4" height="1.8" rx="0.9" fill="#0b1117" opacity="0.5"/>',
  keberangkatan:
    '<path d="M6 4h7a2 2 0 0 1 2 2v7H8a2 2 0 0 1-2-2z" fill="currentColor"/><path d="M4 13h13a2 2 0 0 1 2 2v1H6a2 2 0 0 1-2-2z" fill="currentColor"/><path d="M7 16v4M16 16v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M17.5 4.5l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
};

export interface OpsiOverlay {
  /** Panel tahap mulai dalam keadaan ringkas (pilihan tersimpan). */
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

const ID_TAB = ['tahap', 'fasilitas', 'po', 'terminal', 'modern', 'target'] as const;
type IdTab = (typeof ID_TAB)[number];
const LABEL_TAB: Readonly<Record<IdTab, () => string>> = {
  tahap: () => TEKS.tabTahap,
  fasilitas: () => TEKS.tabFasilitas,
  po: () => TEKS.tabPo,
  terminal: () => TEKS.tabTerminal,
  modern: () => TEKS.tabModern,
  target: () => TEKS.tabTarget,
};

function petakanObjek<K extends string, A, B>(o: Readonly<Record<K, A>>, f: (a: A) => B): Record<K, B> {
  const hasil = {} as Record<K, B>;
  for (const k of Object.keys(o) as K[]) hasil[k] = f(o[k]);
  return hasil;
}

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
  const isiTahap = el('div', 'isi-tab isi-tahap');
  const panel = {} as Record<TahapId, PanelTahap>;
  for (const id of TAHAP_IDS) {
    panel[id] = buatPanelTahap(id, kirim);
    isiTahap.append(panel[id].elemen);
  }
  // Mode ringkas: rel ikon per tahap menggantikan kartu (lihat buatChipTahap).
  const rel = el('div', 'rel-ringkas');
  const chip = {} as Record<TahapId, ChipTahap>;
  for (const id of TAHAP_IDS) {
    chip[id] = buatChipTahap(id, () => ubahRingkas(false));
    rel.append(chip[id].elemen);
  }
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
  // Tab: tiga tahap, lalu pengelolaan terminal (fasilitas, mitra PO, terminal, modernisasi, target).
  const tabLain: Record<Exclude<IdTab, 'tahap'>, IsiTab> = {
    fasilitas: buatTabFasilitas(kirim),
    po: buatTabPo(kirim),
    terminal: buatTabTerminal(kirim, {
      konfirmasiRenovasi: (m) => void tampilkanPopupRenovasi(akar, m).then((ya) => ya && kirim({ jenis: 'renovasi' })),
      ubahNama: () => void mintaNama(),
    }),
    modern: buatTabModern(kirim),
    target: buatTabTarget(kirim, {
      ...(opsi.iklan ? { iklan: opsi.iklan } : {}),
      ...(opsi.peringkat
        ? { kartuPeringkat: buatKartuPeringkat(akar, { ...opsi.peringkat, ambilModel: () => buatModel(pengendali.state).peringkat, mintaNama }) }
        : {}),
    }),
  };
  const isi: Record<IdTab, HTMLElement> = { tahap: isiTahap, ...petakanObjek(tabLain, (t) => t.elemen) };
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
  let tabAktif: IdTab = 'tahap';
  const pilihTab = (id: IdTab): void => {
    tabAktif = id;
    for (const t of ID_TAB) {
      tombolTab[t].classList.toggle('aktif', t === id);
      tombolTab[t].setAttribute('aria-selected', String(t === id));
      isi[t].hidden = t !== id;
    }
  };
  daftar.append(barTab, ...ID_TAB.map((t) => isi[t]));
  pilihTab('tahap');
  // Ringkas/buka panel tahap supaya adegan lebih leluasa.
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
    // Mode ringkas hanya menampilkan rel ikon tahap.
    if (r && tabAktif !== 'tahap') pilihTab('tahap');
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
  };
  tombolRingkas.addEventListener('click', () => ubahRingkas(!ringkas));
  daftar.prepend(tombolRingkas);
  daftar.append(rel);
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
    for (const id of TAHAP_IDS) {
      panel[id].perbarui(model.tahap[id]);
      chip[id].perbarui(model.tahap[id]);
    }
    // Tab lain hanya diperbarui saat terlihat (dan sekali di awal) supaya hemat DOM.
    for (const t of Object.keys(tabLain) as (keyof typeof tabLain)[]) if (t === tabAktif || !modelLalu) tabLain[t].perbarui(model);
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
  for (const id of Object.keys(tabLain) as (keyof typeof tabLain)[]) {
    tombolTab[id].addEventListener('click', () => tabLain[id].perbarui(buatModel(pengendali.state)));
  }
  return { area, kontrol, aturKecepatan: hud.aturKecepatan, notif: tampilkanNotif, lepas };
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
  const uang = el('div', 'hud-uang');
  const baris = el('div', 'hud-baris');
  const pendapatan = el('span', 'hud-pendapatan');
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
  baris.append(pendapatan, arus, kelas, kepuasan, pilEvent);
  const pendapatanRingkas = el('div', 'hud-pendapatan-ringkas');
  const keuangan = el('div', 'hud-keuangan');
  keuangan.append(uang, baris, pendapatanRingkas);
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
      setTeks(uang, formatUang(m.uang));
      // Uang masuk per transaksi (tiket, parkir, sewa kios), jadi HUD menampilkan hasil hari ini, bukan laju per detik.
      const boost = m.boostAktif ? TEKS.boostHud : '';
      setTeks(pendapatan, `${TEKS.hudHariIni(formatUang(m.hariIni.pendapatan), formatAngka(m.hariIni.tiket))}${boost}`);
      pendapatan.classList.toggle('boost', boost !== '');
      setTeks(pendapatanRingkas, TEKS.hudHariIniRingkas(formatUang(m.hariIni.pendapatan)));
      setTeks(arus, `${TEKS.arus} ${formatAngka(m.arusAktif)} ${TEKS.satuanArus}`);
      setTeks(kelas, TEKS.hudKelas(namaKelas(m.kelas), m.level));
      if (kelas.dataset['kelas'] !== String(Math.min(m.kelas, 3))) kelas.dataset['kelas'] = String(Math.min(m.kelas, 3));
      const puas = m.kepuasan.nilai;
      setTeks(kepuasan, TEKS.kepuasanHud(wajahKepuasan(puas), Math.round(puas * 100)));
      const tingkat = tingkatKepuasan(puas);
      if (kepuasan.dataset['tingkat'] !== tingkat) kepuasan.dataset['tingkat'] = tingkat;
      setTeks(petunjuk, m.semuaOtomatis ? '' : TEKS.petunjukKepala);
      setHidden(petunjuk, m.semuaOtomatis);
    },
  };
}

// ---------------------------------------------------------------------------
// Panel tahap

interface PanelTahap {
  readonly elemen: HTMLElement;
  perbarui(m: ModelTahap): void;
}

function buatPanelTahap(id: TahapId, kirim: (aksi: Aksi) => void): PanelTahap {
  const elemen = el('article', 'panel');
  elemen.dataset['tahap'] = id;
  elemen.style.setProperty('--warna', keHexCss(WARNA_TAHAP[id]));

  // Ikon tahap berwarna, lalu info tiga baris ringkas.
  const ikon = el('div', 'panel-ikon');
  ikon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${IKON_TAHAP[id]}</svg>`;
  const info = el('div', 'panel-info');

  const atas = el('div', 'panel-atas');
  const level = el('span', 'panel-level');
  atas.append(el('span', 'panel-nama', NAMA_TAHAP[id]), level);
  // Loket: PO yang menerima loket berikutnya, loket kosong, atau jatah semua PO penuh.
  const tujuan = el('span', 'panel-tujuan');
  if (id === 'loket') atas.append(tujuan);

  const status = el('div', 'panel-status');
  const kap = el('span', 'panel-kapasitas');
  status.append(
    kap,
    el('span', 'lencana lencana-lambat', `⚠ ${TEKS.palingLambat}`),
    el('span', 'lencana lencana-otomatis', `✓ ${TEKS.adaKepala}`),
  );

  const milestone = el('div', 'milestone');
  const milestoneTeks = el('div', 'milestone-teks');
  const bar = el('div', 'bar');
  const barIsi = el('div', 'bar-isi');
  bar.append(barIsi);
  milestone.append(milestoneTeks, bar);

  info.append(atas, status, milestone);

  // Kanan: tombol
  const aksi = el('div', 'panel-aksi');

  const tombolUpgrade = el('button', 'tombol tombol-upgrade');
  const upgradeKecil = el('span', 'tombol-kecil');
  const upgradeBiaya = el('span', 'tombol-besar');
  tombolUpgrade.append(upgradeKecil, upgradeBiaya);
  tombolUpgrade.type = 'button';
  tombolUpgrade.addEventListener('click', () => kirim({ jenis: 'upgrade', tahap: id }));

  const tombolKepala = el('button', 'tombol tombol-kepala');
  const kepalaBiaya = el('span', 'tombol-besar');
  tombolKepala.append(el('span', 'tombol-kecil', TEKS.rekrutKepala), kepalaBiaya);
  tombolKepala.type = 'button';
  tombolKepala.addEventListener('click', () => kirim({ jenis: 'rekrutKepala', tahap: id }));

  aksi.append(tombolUpgrade, tombolKepala);
  const kepala = el('div', 'panel-kepala');
  kepala.append(ikon, info);
  elemen.append(kepala, aksi);

  return {
    elemen,
    perbarui(m) {
      elemen.classList.toggle('lambat', m.bottleneck);
      elemen.classList.toggle('otomatis', m.punyaKepala);

      setTeks(level, TEKS.level(m.level));
      setTeks(kap, `${formatAngka(m.kapasitas)} ${TEKS.satuanArus}`);
      if (m.loket) {
        const l = m.loket;
        setTeks(tujuan, l.kosong > 0 ? TEKS.panelLoketKosong(l.kosong) : l.tujuan ? TEKS.panelLoketUntuk(NAMA_PO[l.tujuan].nama) : TEKS.panelJatahPenuh);
        tujuan.classList.toggle('peringatan', l.kosong > 0 || l.tujuan === null);
      }

      const ms = m.milestone;
      setTeks(milestoneTeks, ms.ke === null ? TEKS.milestoneSelesai : TEKS.milestoneMenuju(ms.ke, m.multMilestone));
      setStyle(barIsi, 'width', `${(ms.rasio * 100).toFixed(1)}%`);

      setTeks(upgradeKecil, `${TEKS.upgrade} → ${formatAngka(m.kapasitasSetelahUpgrade)}`);
      setTeks(upgradeBiaya, formatUang(m.biayaUpgrade));
      setDisabled(tombolUpgrade, !m.bisaUpgrade);

      setHidden(tombolKepala, m.punyaKepala);
      setTeks(kepalaBiaya, formatUang(m.biayaKepala));
      setDisabled(tombolKepala, !m.bisaRekrutKepala);
    },
  };
}

// ---------------------------------------------------------------------------
// Chip tahap (mode ringkas)

interface ChipTahap {
  readonly elemen: HTMLElement;
  perbarui(m: ModelTahap): void;
}

/**
 * Lingkaran berikon tahap: cincin berwarna tahap (selalu berjalan), "Lv" di
 * bawah, "!" paling lambat, "↑" ada upgrade/Kepala terjangkau. Diketuk = buka panel.
 */
function buatChipTahap(id: TahapId, bukaPanel: () => void): ChipTahap {
  const elemen = el('button', 'chip-tahap');
  elemen.type = 'button';
  elemen.dataset['tahap'] = id;
  elemen.style.setProperty('--warna', keHexCss(WARNA_TAHAP[id]));
  elemen.innerHTML =
    '<svg class="chip-cincin" viewBox="0 0 64 64" aria-hidden="true"><circle class="chip-jalur" cx="32" cy="32" r="29"/><circle class="chip-isi" cx="32" cy="32" r="29"/></svg>' +
    `<svg class="chip-ikon" viewBox="0 0 24 24" aria-hidden="true">${IKON_TAHAP[id]}</svg>`;
  const level = el('span', 'chip-level');
  const lambat = el('span', 'chip-tanda chip-lambat', '!');
  const naik = el('span', 'chip-tanda chip-naik');
  naik.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 11.5 12 5.5l6 6" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  elemen.append(level, lambat, naik);
  elemen.addEventListener('click', bukaPanel);

  return {
    elemen,
    perbarui(m) {
      elemen.classList.toggle('lambat', m.bottleneck);
      elemen.classList.toggle('bisa-naik', m.bisaUpgrade || m.bisaRekrutKepala);
      setTeks(level, TEKS.level(m.level));
      const label = TEKS.chipTahap(NAMA_TAHAP[id], m.level, formatAngka(m.kapasitas), m.punyaKepala);
      if (elemen.title !== label) {
        elemen.title = label;
        elemen.setAttribute('aria-label', label);
      }
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

function setDisabled(e: HTMLButtonElement, disabled: boolean): void {
  if (e.disabled !== disabled) e.disabled = disabled;
}

function setStyle(e: HTMLElement, prop: 'width', nilai: string): void {
  if (e.style[prop] !== nilai) e.style[prop] = nilai;
}
