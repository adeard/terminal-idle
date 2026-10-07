/**
 * Isi tab pengelolaan terminal di panel bawah: Fasilitas, PO (mitra PO),
 * Terminal (level, perluasan, Renovasi), Modernisasi, dan Target (target
 * harian + penghargaan). Elemen dibuat sekali (kartu PO saat PO bergabung);
 * tiap pembaruan state hanya mengubah teks/kelas yang berubah.
 */
import type { Aksi } from '../sim/aksi';
import { LIVERY_PO, type Livery } from '../config/livery.config';
import { FASILITAS_IDS, KELAS_BUS_IDS, PENCAPAIAN_IDS, TEKNOLOGI_IDS, type FasilitasId, type KelasBusId, type PencapaianId, type PoId, type TeknologiId } from '../sim/fitur';
import { keHexCss, WARNA_TAHAP } from '../config/tema';
import { formatAngka, formatDurasi, formatUang } from './format';
import type { ModelFasilitas, ModelHargaPo, ModelMingguan, ModelMitra, ModelPoTerdaftar, ModelPoTersedia, ModelRenovasi, ModelTampilan, ModelTantangan } from './model';
import { namaKelas, NAMA_EVENT, NAMA_FASILITAS, NAMA_KELAS_BUS, NAMA_PENCAPAIAN, NAMA_PERLUASAN, NAMA_PO, NAMA_TEKNOLOGI, NAMA_TINGKAT_PO, sisaWaktuEvent, TEKS } from './teks';

export interface IsiTab {
  readonly elemen: HTMLElement;
  perbarui(m: ModelTampilan): void;
}

type Kirim = (aksi: Aksi) => void;

/** Iklan berhadiah untuk klaim 2× (lihat app/iklan.ts); `tonton` true = selesai ditonton. */
export interface IklanMenu {
  siap(): boolean;
  tonton(tempat: 'target2x' | 'penghargaan2x'): Promise<boolean>;
}

const IKON_PUTAR_KECIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M10 9l5 3-5 3z" fill="currentColor"/></svg>';

/** Tombol klaim 2× lewat iklan: ikon layar + "2×" + besar hadiah. */
function tombolGanda(): { tombol: HTMLButtonElement; besar: HTMLSpanElement } {
  const tombol = el('button', 'tombol tombol-iklan tombol-ganda');
  tombol.type = 'button';
  const kecil = el('span', 'tombol-kecil');
  kecil.innerHTML = `${IKON_PUTAR_KECIL}${TEKS.klaimGanda}`;
  const besar = el('span', 'tombol-besar');
  tombol.append(kecil, besar);
  return { tombol, besar };
}

/** Tombol beli dua baris: teks kecil (aksi) di atas harga. */
function tombolBeli(): { tombol: HTMLButtonElement; kecil: HTMLSpanElement; besar: HTMLSpanElement } {
  const tombol = el('button', 'tombol tombol-beli');
  tombol.type = 'button';
  const kecil = el('span', 'tombol-kecil');
  const besar = el('span', 'tombol-besar');
  tombol.append(kecil, besar);
  return { tombol, kecil, besar };
}

/** Ikon fasilitas (viewBox 24). */
const IKON_FASILITAS: Readonly<Record<FasilitasId, string>> = {
  kios: '<path d="M3 9l1.5-5h15L21 9a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" fill="currentColor"/><path d="M5 12v8h14v-8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10" y="15" width="4" height="5" fill="currentColor"/>',
  parkir: '<rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor"/><path d="M9.5 17V7h3.2a3 3 0 0 1 0 6H9.5" fill="none" stroke="#0b1117" stroke-width="2.2" stroke-linejoin="round"/>',
  toilet: '<circle cx="8" cy="5" r="2" fill="currentColor"/><circle cx="16" cy="5" r="2" fill="currentColor"/><path d="M6 9h4l.5 6H10v5H6v-5h-.5zM14 9h4l2 7h-2v4h-4v-4h-2z" fill="currentColor"/>',
  retribusi: '<rect x="2" y="6" width="20" height="12" rx="2" fill="currentColor"/><circle cx="12" cy="12" r="3" fill="none" stroke="#0b1117" stroke-width="2"/><path d="M5 9v6M19 9v6" stroke="#0b1117" stroke-width="1.6"/>',
};
/** Jalur bus: kanopi dengan dua lajur halte (viewBox 24). */
const IKON_JALUR =
  '<path d="M2 8.5 12 4l10 4.5V10H2z" fill="currentColor"/><path d="M4.5 10v10M12 10v10M19.5 10v10" stroke="currentColor" stroke-width="1.8"/><rect x="6" y="13" width="4.5" height="5.5" rx="1" fill="currentColor"/><rect x="13.5" y="13" width="4.5" height="5.5" rx="1" fill="currentColor" opacity="0.4"/>';
/** Tiket loket (viewBox 24), sama dengan ikon tahap Loket. */
const IKON_LOKET =
  '<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5z" fill="currentColor"/><path d="M14.5 6.5v11" stroke="#0b1117" stroke-width="1.4" stroke-dasharray="1.6 1.6" opacity="0.5"/>';
const IKON_PIALA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 13h4v4h3v3H7v-3h3z" fill="currentColor"/></svg>';
const IKON_PENSIL =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13.5 6.5l4 4" stroke="currentColor" stroke-width="2"/></svg>';

const persen = (x: number): number => Math.round(x * 100);
const rupiahKecil = (x: number): string => formatAngka(x, { desimalKecil: 2 });

// ---------------------------------------------------------------------------
// Fasilitas

/** Efek fasilitas sekarang: sewa kios per hari, parkir per penumpang, bonus belanja toilet, retribusi per bus. */
function efekFasilitas(f: ModelFasilitas): string {
  switch (f.id) {
    case 'kios':
      return TEKS.sewaKios(formatUang(f.sewaPerHari), formatUang(f.terkumpul));
    case 'parkir':
      return TEKS.perPenumpang(rupiahKecil(f.nilaiSekarang));
    case 'toilet':
      return TEKS.bonusBelanjaKios(persen(f.nilaiSekarang));
    case 'retribusi':
      return TEKS.perBus(rupiahKecil(f.nilaiSekarang));
  }
}

/** Tambahan efek per level berikutnya (label tombol upgrade). */
function tambahanFasilitas(f: ModelFasilitas): string {
  switch (f.id) {
    case 'kios':
      return TEKS.tambahBelanja(rupiahKecil(f.nilaiPerLevel));
    case 'parkir':
      return `+Rp ${rupiahKecil(f.nilaiPerLevel)}`;
    case 'toilet':
      return `+${persen(f.nilaiPerLevel)}%`;
    case 'retribusi':
      return TEKS.tambahPerBus(rupiahKecil(f.nilaiPerLevel));
  }
}

export function buatTabFasilitas(kirim: Kirim): IsiTab {
  const elemen = el('div', 'isi-tab daftar-item');
  // Jalur bus paling atas: pembangunan terminal yang langsung terlihat di adegan.
  const jalur = baris3(IKON_JALUR, TEKS.jalurNama, 'jalur');
  jalur.elemen.dataset['jalur'] = '1';
  jalur.tombol.addEventListener('click', () => kirim({ jenis: 'bukaJalur' }));
  elemen.append(jalur.elemen);
  const baris = FASILITAS_IDS.map((id) => {
    const r = baris3(IKON_FASILITAS[id], NAMA_FASILITAS[id].nama, 'fasilitas');
    r.elemen.dataset['fasilitas'] = id;
    r.tombol.addEventListener('click', () => kirim({ jenis: 'bangunFasilitas', fasilitas: id }));
    elemen.append(r.elemen);
    return { id, ...r };
  });
  return {
    elemen,
    perbarui(m) {
      const j = m.jalur;
      const kali = (x: number): string => formatAngka(x, { desimalKecil: 2 });
      setTeks(jalur.level, `${j.jumlah}/${j.maks}`);
      setTeks(jalur.keterangan, j.biaya ? TEKS.jalurKeterangan(kali(j.mult), kali(j.multBerikut)) : TEKS.jalurLengkap(kali(j.mult)));
      setHidden(jalur.tombol, j.biaya === null);
      if (j.biaya) {
        setTeks(jalur.tombolKecil, TEKS.bangunJalur(j.jumlah + 1));
        setTeks(jalur.tombolBesar, formatUang(j.biaya));
        setDisabled(jalur.tombol, !j.bisa);
      }
      for (const b of baris) {
        const f = m.fasilitas.find((x) => x.id === b.id)!;
        setTeks(b.level, f.level > 0 ? TEKS.level(f.level) : '');
        setHidden(b.level, f.level === 0);
        const efek = f.level > 0 ? `${efekFasilitas(f)} · ${NAMA_FASILITAS[b.id].deskripsi}` : NAMA_FASILITAS[b.id].deskripsi;
        setTeks(b.keterangan, efek);
        setTeks(b.tombolKecil, f.level > 0 ? `${TEKS.upgrade} ${tambahanFasilitas(f)}` : TEKS.bangun);
        setTeks(b.tombolBesar, formatUang(f.biaya));
        setDisabled(b.tombol, !f.bisa);
        b.elemen.classList.toggle('belum', f.level === 0);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Harga tiket per jurusan PO

interface PengaturHarga {
  readonly elemen: HTMLElement;
  /** Saran harga (ketuk = pakai); diletakkan pemanggil di kolom info. */
  readonly saran: HTMLElement;
  perbarui(h: ModelHargaPo): void;
}

/**
 * Tombol − / + dengan harga tiket Ekonomi (Rupiah) di tengahnya, dan tombol
 * saran. `kirimHarga` menerima nilai baru dalam persen harga normal (dirapikan sim).
 */
function pengaturHarga(nama: string, kirimHarga: (persen: number) => void): PengaturHarga {
  const elemen = el('div', 'pengatur-harga');
  const turun = el('button', 'harga-tombol', '−');
  const nilai = el('span', 'harga-nilai');
  const naik = el('button', 'harga-tombol', '+');
  turun.type = 'button';
  naik.type = 'button';
  turun.setAttribute('aria-label', TEKS.hargaTurun(nama));
  naik.setAttribute('aria-label', TEKS.hargaNaik(nama));
  elemen.append(turun, nilai, naik);
  const saran = el('button', 'harga-saran');
  saran.type = 'button';
  let sekarang: ModelHargaPo | null = null;
  turun.addEventListener('click', () => sekarang && kirimHarga(sekarang.persen - sekarang.langkah));
  naik.addEventListener('click', () => sekarang && kirimHarga(sekarang.persen + sekarang.langkah));
  saran.addEventListener('click', () => sekarang && kirimHarga(sekarang.saranPersen));
  return {
    elemen,
    saran,
    perbarui(h) {
      sekarang = h;
      setTeks(nilai, `Rp ${rupiahKecil(h.rupiah)}`);
      nilai.classList.toggle('murah', h.persen < 100);
      nilai.classList.toggle('mahal', h.persen > 100);
      setDisabled(turun, !h.bisaTurun);
      setDisabled(naik, !h.bisaNaik);
      const pas = h.persen === h.saranPersen;
      setTeks(saran, pas ? TEKS.hargaSesuaiSaran : TEKS.hargaSaran(`Rp ${rupiahKecil(h.saranRupiah)}`));
      setDisabled(saran, pas);
    },
  };
}

interface BarisHargaPo {
  readonly elemen: HTMLElement;
  perbarui(h: ModelHargaPo): void;
}

/** Satu jurusan PO: nama, harga normal (atau syarat bukanya), pengatur harga & saran. */
function buatBarisHargaPo(po: PoId, awal: ModelHargaPo, kirim: Kirim): BarisHargaPo {
  const elemen = el('div', 'po-jurusan');
  elemen.dataset['jurusan'] = String(awal.jurusan);
  elemen.classList.toggle('antarpulau', awal.feri !== null);
  const info = el('div', 'item-info');
  const ket = el('div', 'item-keterangan');
  const pengatur = pengaturHarga(awal.nama, (p) => kirim({ jenis: 'aturHargaPo', po, jurusan: awal.jurusan, persen: p }));
  info.append(el('span', 'item-nama', awal.nama), ket, pengatur.saran);
  elemen.append(info, pengatur.elemen);
  return {
    elemen,
    perbarui(h) {
      const feri = h.feri ? `${TEKS.lewatFeri(h.feri)} · ` : '';
      // Terkunci: kelas terminal (jangka panjang) lebih dulu, lalu level PO.
      const status = h.aktif
        ? TEKS.poHargaNormal(rupiahKecil(h.normalRupiah))
        : h.kurangKelas !== null
          ? TEKS.poSyaratTerminal(namaKelas(h.kurangKelas))
          : TEKS.poJurusanLevel(h.levelBuka);
      setTeks(ket, `${feri}${status}`);
      elemen.classList.toggle('terkunci', !h.aktif);
      setHidden(pengatur.elemen, !h.aktif);
      setHidden(pengatur.saran, !h.aktif);
      if (h.aktif) pengatur.perbarui(h);
    },
  };
}

// ---------------------------------------------------------------------------
// Mitra PO

/** Ikon kelas bus (viewBox 24): bentuk badan, jendela, dan atapnya. */
const IKON_KELAS_BUS: Readonly<Record<KelasBusId, string>> = {
  ekonomi:
    '<rect x="2" y="7" width="20" height="11" rx="2" fill="currentColor"/><rect x="6" y="5.6" width="3" height="1.4" fill="currentColor"/><rect x="14" y="5.6" width="3" height="1.4" fill="currentColor"/><path d="M4 9.5h4v3.5H4zM9.5 9.5h4v3.5h-4zM15 9.5h5v3.5h-5z" fill="#0b1117" opacity="0.85"/><circle cx="7" cy="18.5" r="2" fill="#0b1117"/><circle cx="17" cy="18.5" r="2" fill="#0b1117"/>',
  patas:
    '<rect x="2" y="7" width="20" height="11" rx="2" fill="currentColor"/><rect x="8" y="4.6" width="7" height="2.4" rx="0.8" fill="currentColor" opacity="0.8"/><path d="M4 9.5h16v3.5H4z" fill="#0b1117" opacity="0.85"/><circle cx="7" cy="18.5" r="2" fill="#0b1117"/><circle cx="17" cy="18.5" r="2" fill="#0b1117"/>',
  eksekutif:
    '<path d="M2 6.5h17.5a2.5 2.5 0 0 1 2.5 2.5v9H2z" fill="currentColor"/><path d="M3.5 8.4h13.8v4.4H3.5zM18.5 8.4h2.3v5.6h-2.3z" fill="#0b1117" opacity="0.9"/><path d="M3 14.6h14" stroke="#0b1117" stroke-width="0.8" opacity="0.5"/><circle cx="7" cy="18.5" r="2" fill="#0b1117"/><circle cx="17" cy="18.5" r="2" fill="#0b1117"/>',
  sleeper:
    '<path d="M2 5h17.5A2.5 2.5 0 0 1 22 7.5V18H2z" fill="currentColor"/><path d="M3.5 7h2.6v2.4H3.5zM7.4 7H10v2.4H7.4zM11.3 7h2.6v2.4h-2.6zM3.5 11h2.6v2.4H3.5zM7.4 11H10v2.4H7.4zM11.3 11h2.6v2.4h-2.6zM16 7h4.8v7H16z" fill="#0b1117" opacity="0.9"/><circle cx="7" cy="18.5" r="2" fill="#0b1117"/><circle cx="17" cy="18.5" r="2" fill="#0b1117"/>',
  tingkat:
    '<path d="M2 3.5h17.5A2.5 2.5 0 0 1 22 6v12H2z" fill="currentColor"/><path d="M3.5 5.3h17.2v3.9H3.5zM3.5 11.3h12v3.2h-12zM17 11.3h3.7v4.3H17z" fill="#0b1117" opacity="0.9"/><circle cx="7" cy="18.5" r="2" fill="#0b1117"/><circle cx="17" cy="18.5" r="2" fill="#0b1117"/>',
};

const hexWarna = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** Ikon bus kecil bercat livery PO (viewBox 24): badan, pola aksen, jendela, roda. */
function ikonLivery(l: Livery): string {
  const a = hexWarna(l.aksen);
  const pola =
    l.pola === 'garis'
      ? `<rect x="2" y="8.6" width="20" height="1.6" fill="${a}"/><rect x="2" y="15.4" width="20" height="0.9" fill="${a}"/>`
      : l.pola === 'dua'
        ? `<path d="M2 14.2h20v2.8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="${a}"/>`
        : l.pola === 'sapuan'
          ? `<path d="M2 16.5 12 13l10-6.2v2.6L12 15.6 2 19z" fill="${a}"/>`
          : '';
  return `<rect x="2" y="5" width="20" height="14" rx="2.5" fill="${hexWarna(l.warna)}"/>${pola}<rect x="4" y="10.6" width="16" height="3" rx="0.6" fill="#1e293b" opacity="0.9"/><circle cx="7" cy="19" r="2" fill="#0b1117"/><circle cx="17" cy="19" r="2" fill="#0b1117"/>`;
}

/** Baris kartu PO: judul + keterangan di kiri; tombolnya ditambahkan pemanggil di kanan. */
function barisPo(): { readonly elemen: HTMLElement; readonly judul: HTMLElement; readonly ket: HTMLElement } {
  const elemen = el('div', 'po-baris');
  const info = el('div', 'item-info');
  const judul = el('div', 'po-judul');
  const ket = el('div', 'po-ket');
  info.append(judul, ket);
  elemen.append(info);
  return { elemen, judul, ket };
}

/** Lama tombol Putus menunggu ketukan kedua. */
const MS_YAKIN_PUTUS = 3000;

interface KartuPo {
  readonly elemen: HTMLElement;
  perbarui(p: ModelPoTerdaftar, mi: ModelMitra): void;
}

/** Kartu mitra PO terdaftar: level & XP, loket, kelas bus, harga tiap jurusan, kontrak. */
function buatKartuPo(id: PoId, kirim: Kirim): KartuPo {
  const elemen = el('article', 'kartu-po');
  elemen.dataset['po'] = id;
  const kepala = el('div', 'po-kepala');
  const ikon = el('div', 'item-ikon');
  ikon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ikonLivery(LIVERY_PO[id])}</svg>`;
  const info = el('div', 'item-info');
  const atas = el('div', 'item-atas');
  const level = el('span', 'item-level');
  atas.append(el('span', 'item-nama', NAMA_PO[id].nama), level);
  const ket = el('div', 'item-keterangan');
  info.append(atas, ket);
  kepala.append(ikon, info);
  // XP menuju level berikutnya (satuan bus).
  const xp = el('div', 'po-xp');
  const bar = el('div', 'bar');
  const barIsi = el('div', 'bar-isi');
  bar.append(barIsi);
  const xpAngka = el('span', 'po-angka');
  xp.append(bar, xpAngka);
  const loket = barisPo();
  const tombolLoket = tombolBeli();
  tombolLoket.kecil.textContent = TEKS.tambahLoket;
  tombolLoket.tombol.addEventListener('click', () => kirim({ jenis: 'bangunLoket', po: id }));
  loket.elemen.append(tombolLoket.tombol);
  const kelas = el('div', 'po-teks');
  // Baris harga tiap jurusan dibuat saat pembaruan pertama (jurusan PO tetap).
  const daftarHarga = el('div', 'po-harga');
  const barisHarga: BarisHargaPo[] = [];
  const kontrak = barisPo();
  const tombolPerpanjang = tombolBeli();
  tombolPerpanjang.kecil.textContent = TEKS.perpanjang;
  tombolPerpanjang.tombol.addEventListener('click', () => kirim({ jenis: 'perpanjangPo', po: id }));
  // Putus kontrak lewat dua ketukan: ketukan pertama menampilkan akibatnya.
  const tombolPutus = el('button', 'tombol tombol-putus', TEKS.putus);
  tombolPutus.type = 'button';
  let yakinSampai = 0;
  let timerYakin = 0;
  const batalYakin = (): void => {
    yakinSampai = 0;
    tombolPutus.textContent = TEKS.putus;
    tombolPutus.classList.remove('yakin');
  };
  tombolPutus.addEventListener('click', () => {
    window.clearTimeout(timerYakin);
    if (performance.now() < yakinSampai) {
      batalYakin();
      kirim({ jenis: 'putusPo', po: id });
      return;
    }
    yakinSampai = performance.now() + MS_YAKIN_PUTUS;
    tombolPutus.textContent = TEKS.putusYakin;
    tombolPutus.classList.add('yakin');
    timerYakin = window.setTimeout(batalYakin, MS_YAKIN_PUTUS);
  });
  kontrak.elemen.append(tombolPerpanjang.tombol, tombolPutus);
  elemen.append(kepala, xp, loket.elemen, kelas, el('div', 'po-subjudul', TEKS.poHargaJudul), daftarHarga, kontrak.elemen);
  return {
    elemen,
    perbarui(p, mi) {
      setTeks(level, TEKS.level(p.level));
      setTeks(ket, `${TEKS.poTingkatAsal(NAMA_TINGKAT_PO[p.tingkat], NAMA_PO[id].asal)} · ${TEKS.poReputasi(Math.round(p.reputasi))}`);
      setStyle(barIsi, 'width', `${(p.rasioXp * 100).toFixed(1)}%`);
      setTeks(xpAngka, TEKS.poXp(formatAngka(Math.floor(Math.max(0, p.xpDalamLevel))), formatAngka(Math.ceil(p.xpLevel)), p.level + 1));
      const penuh = p.loket >= p.jatah;
      setTeks(loket.judul, TEKS.poLoket(p.loket, p.jatah));
      setTeks(loket.ket, penuh ? TEKS.poJatahPenuh : TEKS.poBagian(persen(p.bagian), persen(p.terisi)));
      setHidden(tombolLoket.tombol, penuh);
      setTeks(tombolLoket.besar, formatUang(p.biayaLoket));
      setDisabled(tombolLoket.tombol, !p.bisaTambahLoket);
      const b = p.kelasBerikut;
      const berikut = !b
        ? ''
        : p.level < b.level
          ? ` · ${TEKS.poKelasBerikut(NAMA_KELAS_BUS[b.kelas].nama, b.level)}`
          : b.kurangKelas !== null
            ? ` · ${TEKS.poKelasButuhTerminal(NAMA_KELAS_BUS[b.kelas].nama, namaKelas(b.kurangKelas))}`
            : '';
      setTeks(kelas, `${TEKS.poKelas(p.kelas.map((k) => NAMA_KELAS_BUS[k].nama).join(', '))}${berikut}`);
      p.jurusan.forEach((h, i) => {
        let r = barisHarga[i];
        if (!r) {
          r = buatBarisHargaPo(id, h, kirim);
          barisHarga[i] = r;
          daftarHarga.append(r.elemen);
        }
        r.perbarui(h);
      });
      setTeks(kontrak.judul, TEKS.poKontrak(formatAngka(Math.max(0, p.kontrakHari), { desimalKecil: 1 })));
      kontrak.elemen.classList.toggle('hampir', p.kontrakHari <= 1);
      const ketKontrak =
        performance.now() < yakinSampai
          ? TEKS.putusCatatan(mi.kontrak.penaltiPutus, mi.kontrak.jedaHari)
          : p.menolakPerpanjang && p.kepuasanMin !== null
            ? TEKS.poMenolak(persen(p.kepuasanMin))
            : p.kontrakPenuh
              ? TEKS.poKontrakPenuh(mi.kontrak.hariMaks)
              : '';
      setTeks(kontrak.ket, ketKontrak);
      setHidden(kontrak.ket, ketKontrak === '');
      setHidden(tombolPerpanjang.tombol, p.kontrakPenuh);
      setTeks(tombolPerpanjang.besar, formatUang(p.biayaPerpanjang));
      setDisabled(tombolPerpanjang.tombol, !p.bisaPerpanjang);
      setHidden(tombolPutus, !p.bisaPutus);
    },
  };
}

/** Status PO yang belum terdaftar: syarat yang kurang, atau catatan riwayat. */
function statusTersedia(p: ModelPoTersedia): string {
  const k = p.kurang;
  if (!k) return p.levelRiwayat !== null ? TEKS.poRiwayat(p.levelRiwayat) : '';
  switch (k.jenis) {
    case 'slot':
      return TEKS.poSlotPenuh;
    case 'jeda':
      return TEKS.poJeda(formatAngka(Math.max(0.1, p.jedaHari ?? 0), { desimalKecil: 1 }));
    case 'kepuasan':
      return TEKS.poSyaratKepuasan(persen(k.min));
    case 'kelas':
      return p.hadiah ? TEKS.poHadiahKelas(namaKelas(k.kelas)) : TEKS.poSyaratTerminal(namaKelas(k.kelas));
    case 'event':
      return p.event ? TEKS.poSyaratEvent(NAMA_EVENT[p.event].nama) : '';
    case 'terdaftar':
      return '';
  }
}

interface BarisTersedia {
  readonly elemen: HTMLElement;
  perbarui(p: ModelPoTersedia): void;
}

function buatBarisTersedia(id: PoId, kirim: Kirim): BarisTersedia {
  const r = baris3(ikonLivery(LIVERY_PO[id]), NAMA_PO[id].nama, 'po');
  r.elemen.dataset['po'] = id;
  const status = el('div', 'item-keterangan po-status');
  r.keterangan.after(status);
  r.tombolKecil.textContent = TEKS.daftar;
  r.tombol.addEventListener('click', () => kirim({ jenis: 'daftarPo', po: id }));
  return {
    elemen: r.elemen,
    perbarui(p) {
      setTeks(r.level, NAMA_TINGKAT_PO[p.tingkat]);
      setTeks(r.keterangan, `${NAMA_PO[id].asal} · ${TEKS.poJurusanDaftar(p.jurusan.join(', '))}`);
      const teks = statusTersedia(p);
      setTeks(status, teks);
      setHidden(status, teks === '');
      // Kelas terminal & event: masih jauh, jadi tanpa tombol.
      const terkunci = p.kurang?.jenis === 'kelas' || p.kurang?.jenis === 'event';
      setHidden(r.tombol, terkunci);
      setTeks(r.tombolBesar, p.biaya.lte(0) ? TEKS.gratis : formatUang(p.biaya));
      setDisabled(r.tombol, !p.bisa);
      r.elemen.classList.toggle('belum', !p.bisa);
      r.elemen.classList.toggle('terkunci', terkunci);
    },
  };
}

/** Susun ulang anak `wadah` hanya bila urutannya berubah (menghindari reflow tiap pembaruan). */
function susunUrut(wadah: HTMLElement, elemen: readonly HTMLElement[]): void {
  const sama = elemen.length === wadah.children.length && elemen.every((e, i) => wadah.children[i] === e);
  if (!sama) wadah.replaceChildren(...elemen);
}

export function buatTabPo(kirim: Kirim): IsiTab {
  const elemen = el('div', 'isi-tab daftar-item');
  const ringkasan = el('div', 'jurusan-ringkasan');
  const nilai = el('div', 'harga-catatan');
  // Loket kosong (milik terminal, belum disewa PO): diisi gratis ke PO yang paling menguntungkan.
  const kosong = baris3(IKON_LOKET, '', 'loket-kosong');
  kosong.tombolKecil.textContent = TEKS.isiLoket;
  kosong.tombolBesar.textContent = TEKS.gratis;
  setTeks(kosong.keterangan, TEKS.poLoketKosongKet);
  kosong.tombol.addEventListener('click', () => kirim({ jenis: 'isiLoketKosong' }));
  const daftarTerdaftar = el('div', 'po-daftar');
  const daftarTersedia = el('div', 'po-daftar');
  const catatan = el('div', 'harga-catatan', `${TEKS.poCatatan} ${TEKS.hargaCatatanPo}`);
  elemen.append(ringkasan, nilai, kosong.elemen, daftarTerdaftar, el('div', 'judul-bagian', TEKS.judulPoTersedia), daftarTersedia, catatan);
  const kartu = new Map<PoId, KartuPo>();
  const tersedia = new Map<PoId, BarisTersedia>();
  return {
    elemen,
    perbarui(m) {
      const mi = m.mitra;
      const slot = mi.slotBerikut ? ` · ${TEKS.poSlotBerikut(mi.slotBerikut.slot, mi.slotBerikut.level)}` : '';
      setTeks(ringkasan, `${TEKS.poRingkas(mi.terdaftar.length, mi.slot)}${slot}`);
      setTeks(nilai, TEKS.poNilaiTiket(rupiahKecil(mi.nilaiDibayar), rupiahKecil(mi.nilaiPerPenumpang), persen(mi.terisi)));
      setHidden(kosong.elemen, mi.loketKosong === 0);
      setTeks(kosong.nama, TEKS.poLoketKosong(mi.loketKosong));
      setDisabled(kosong.tombol, !mi.bisaIsiLoket);
      // Kartu dibuat saat PO bergabung dan dibuang saat PO keluar.
      for (const p of mi.terdaftar) {
        let k = kartu.get(p.id);
        if (!k) {
          k = buatKartuPo(p.id, kirim);
          kartu.set(p.id, k);
        }
        k.perbarui(p, mi);
      }
      for (const id of [...kartu.keys()]) if (!mi.terdaftar.some((p) => p.id === id)) kartu.delete(id);
      susunUrut(daftarTerdaftar, mi.terdaftar.map((p) => kartu.get(p.id)!.elemen));
      for (const p of mi.tersedia) {
        let b = tersedia.get(p.id);
        if (!b) {
          b = buatBarisTersedia(p.id, kirim);
          tersedia.set(p.id, b);
        }
        b.perbarui(p);
      }
      susunUrut(daftarTersedia, mi.tersedia.map((p) => tersedia.get(p.id)!.elemen));
    },
  };
}

// ---------------------------------------------------------------------------
// Terminal: level & kelas, perluasan, Renovasi, kelas bus

export interface OpsiTabTerminal {
  /** Membuka konfirmasi Renovasi (mengulang kapasitas terminal, jadi tidak langsung dikirim dari tombol). */
  readonly konfirmasiRenovasi?: (m: ModelRenovasi) => void;
  /** Membuka popup nama terminal (lihat popup-nama.ts). */
  readonly ubahNama?: () => void;
}

/** Kartu ber-bilah: judul, baris utama, keterangan, bilah & angka di kiri, tombol di kanan. */
function kartuBilah(kelas: string): {
  readonly elemen: HTMLElement;
  readonly kiri: HTMLElement;
  readonly judul: HTMLElement;
  readonly tugas: HTMLElement;
  readonly ket: HTMLElement;
  readonly bar: HTMLElement;
  readonly isi: HTMLElement;
  readonly angka: HTMLElement;
} {
  const elemen = el('div', `target-kartu ${kelas}`);
  const kiri = el('div', 'target-kiri');
  const judul = el('div', 'target-judul kelas-judul');
  const tugas = el('div', 'target-tugas');
  const ket = el('div', 'kelas-berikut');
  const bar = el('div', 'bar');
  const isi = el('div', 'bar-isi');
  bar.append(isi);
  const angka = el('div', 'target-angka');
  kiri.append(judul, tugas, ket, bar, angka);
  elemen.append(kiri);
  return { elemen, kiri, judul, tugas, ket, bar, isi, angka };
}

export function buatTabTerminal(kirim: Kirim, o: OpsiTabTerminal = {}): IsiTab {
  const elemen = el('div', 'isi-tab daftar-item');
  // Level & kelas terminal; nama terminal diubah lewat tombol ✎ di samping judul.
  const level = kartuBilah('kelas-kartu terminal-kartu');
  const tombolNama = el('button', 'tombol-nama');
  tombolNama.type = 'button';
  tombolNama.title = TEKS.namaTombol;
  tombolNama.setAttribute('aria-label', TEKS.namaTombol);
  tombolNama.innerHTML = IKON_PENSIL;
  tombolNama.addEventListener('click', () => o.ubahNama?.());
  setHidden(tombolNama, !o.ubahNama);
  const barisJudul = el('div', 'kelas-judul-baris');
  level.judul.replaceWith(barisJudul);
  barisJudul.append(level.judul, tombolNama);
  // Perluasan: tahap berikutnya & tombol bangun, atau proyek yang sedang berjalan.
  const perluasan = kartuBilah('perluasan-kartu');
  perluasan.judul.textContent = TEKS.perluasanJudul;
  const bonusPerluasan = el('div', 'kelas-berikut');
  perluasan.kiri.append(bonusPerluasan);
  const tombolPerluasan = tombolBeli();
  tombolPerluasan.kecil.textContent = TEKS.bangun;
  tombolPerluasan.tombol.addEventListener('click', () => kirim({ jenis: 'mulaiPerluasan' }));
  const kananPerluasan = el('div', 'target-tombol');
  kananPerluasan.append(tombolPerluasan.tombol);
  perluasan.elemen.append(kananPerluasan);
  // Renovasi (pengganti prestige): selalu lewat popup konfirmasi.
  const renov = kartuBilah('renovasi-kartu');
  renov.judul.textContent = TEKS.renovasiJudul;
  const tombolRenov = tombolBeli();
  tombolRenov.tombol.classList.add('tombol-kelas');
  tombolRenov.kecil.textContent = TEKS.renovasi;
  let modelRenov: ModelRenovasi | null = null;
  tombolRenov.tombol.addEventListener('click', () => {
    if (modelRenov?.bisa) o.konfirmasiRenovasi?.(modelRenov);
  });
  const kananRenov = el('div', 'target-tombol');
  kananRenov.append(tombolRenov.tombol);
  renov.elemen.append(kananRenov);
  // Kelas bus yang dioperasikan PO terdaftar.
  const barisKelas = KELAS_BUS_IDS.map((id) => {
    const r = baris3(IKON_KELAS_BUS[id], NAMA_KELAS_BUS[id].nama, 'kelas-bus');
    r.elemen.dataset['kelasBus'] = id;
    r.tombol.hidden = true;
    return { id, ...r };
  });
  elemen.append(
    level.elemen,
    perluasan.elemen,
    renov.elemen,
    el('div', 'judul-bagian', TEKS.judulKelasBus),
    ...barisKelas.map((b) => b.elemen),
    el('div', 'harga-catatan', `${TEKS.terminalCatatan} ${TEKS.kelasBusCatatan}`),
  );
  return {
    elemen,
    perbarui(m) {
      const t = m.terminal;
      setTeks(level.judul, TEKS.kelasJudul(namaKelas(t.kelas), t.nama));
      setTeks(level.tugas, TEKS.level(t.level));
      setTeks(level.ket, `${TEKS.terminalKelasBerikut(namaKelas(t.kelas + 1), t.levelKelasBerikut)} · ${TEKS.terminalBonus(persen(t.bonusLevel), t.slot)}`);
      setStyle(level.isi, 'width', `${(t.rasio * 100).toFixed(1)}%`);
      setTeks(level.angka, TEKS.terminalXp(formatAngka(Math.floor(t.xp)), formatAngka(Math.ceil(t.xpBerikut))));

      const p = t.perluasan;
      const tahap = p.proyek?.tahap ?? p.berikut?.tahap ?? null;
      const nama = tahap !== null ? NAMA_PERLUASAN[tahap - 1] : undefined;
      setTeks(perluasan.tugas, tahap !== null && nama ? TEKS.perluasanTahap(tahap, p.jumlah, nama.nama) : TEKS.perluasanSelesai);
      const efek = p.proyek
        ? TEKS.perluasanProyek(formatDurasi(p.proyek.sisaDetik))
        : p.berikut
          ? `${nama ? `${nama.deskripsi} · ` : ''}${TEKS.perluasanEfek(p.berikut.jatah)}${p.berikut.levelKurang ? ` · ${TEKS.perluasanSyarat(p.berikut.level)}` : ''}`
          : '';
      setTeks(perluasan.ket, efek);
      setHidden(perluasan.ket, efek === '');
      setHidden(perluasan.bar, p.proyek === null);
      setStyle(perluasan.isi, 'width', `${((p.proyek?.rasio ?? 0) * 100).toFixed(1)}%`);
      setHidden(perluasan.angka, true);
      setTeks(bonusPerluasan, p.bonusJatah > 0 ? TEKS.perluasanBonus(p.bonusJatah) : TEKS.perluasanCatatan);
      setHidden(kananPerluasan, p.berikut === null);
      if (p.berikut) {
        setTeks(tombolPerluasan.besar, formatUang(p.berikut.biaya));
        setDisabled(tombolPerluasan.tombol, !p.berikut.bisa);
      }
      perluasan.elemen.classList.toggle('siap', p.berikut?.bisa === true);

      const r = t.renovasi;
      modelRenov = r;
      setTeks(renov.tugas, TEKS.renovasiBonus(persen(r.bonus), r.jumlah));
      setTeks(renov.ket, r.bisa ? TEKS.renovasiBerikut(r.poinTersedia, persen(r.bonusSetelah)) : TEKS.renovasiSyarat(r.poinMin));
      setStyle(renov.isi, 'width', `${(r.rasio * 100).toFixed(1)}%`);
      setTeks(renov.angka, TEKS.kelasKemajuan(formatUang(r.pendapatanRun), formatUang(r.pendapatanPerlu)));
      setTeks(tombolRenov.besar, r.bisa ? TEKS.poin(r.poinTersedia) : TEKS.poinDari(r.poinTersedia, r.poinMin));
      setDisabled(tombolRenov.tombol, !r.bisa);
      renov.elemen.classList.toggle('siap', r.bisa);

      for (const b of barisKelas) {
        const k = t.kelasBus.find((x) => x.id === b.id)!;
        const syarat = k.beroperasi
          ? TEKS.kelasBusBeroperasi
          : `${TEKS.kelasBusSyarat(k.tingkatMin === 'lokal' ? null : NAMA_TINGKAT_PO[k.tingkatMin], k.levelPo)}${k.kelasTerminal > t.kelas ? ` · ${TEKS.poSyaratTerminal(namaKelas(k.kelasTerminal))}` : ''}`;
        setTeks(b.keterangan, `${NAMA_KELAS_BUS[b.id].deskripsi} · ${syarat}`);
        setTeks(b.level, '✓');
        setHidden(b.level, !k.beroperasi);
        b.elemen.classList.toggle('belum', !k.beroperasi);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Modernisasi

export function buatTabModern(kirim: Kirim): IsiTab {
  const elemen = el('div', 'isi-tab daftar-item');
  const baris = TEKNOLOGI_IDS.map((id: TeknologiId) => {
    const r = baris3('<path d="M12 2l2.4 6.3L21 9l-5 4.5L17.5 21 12 17.3 6.5 21 8 13.5 3 9l6.6-.7z" fill="currentColor"/>', NAMA_TEKNOLOGI[id], 'modern');
    r.tombol.addEventListener('click', () => kirim({ jenis: 'beliTeknologi', teknologi: id }));
    elemen.append(r.elemen);
    return { id, ...r };
  });
  return {
    elemen,
    perbarui(m) {
      for (const b of baris) {
        const t = m.teknologi.find((x) => x.id === b.id)!;
        b.elemen.style.setProperty('--warna', keHexCss(WARNA_TAHAP[t.tahap]));
        setTeks(b.keterangan, t.syaratKurang ? TEKS.butuh(NAMA_TEKNOLOGI[t.syaratKurang]) : TEKS.kapasitasPersen(persen(t.multKapasitas - 1), t.namaTahap));
        setHidden(b.level, !t.dimiliki);
        setTeks(b.level, '✓');
        setHidden(b.tombol, t.dimiliki);
        setTeks(b.tombolKecil, TEKS.pasang);
        setTeks(b.tombolBesar, formatUang(t.biaya));
        setDisabled(b.tombol, !t.bisa);
        b.elemen.classList.toggle('belum', !t.dimiliki);
        b.elemen.classList.toggle('terkunci', t.syaratKurang !== null);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Tantangan mingguan & rekor

/** Tugas satu tantangan mingguan. */
function teksTantangan(t: ModelTantangan, m: ModelMingguan): string {
  switch (t.jenis) {
    case 'penumpang':
      return TEKS.tantanganPenumpang(formatAngka(t.target));
    case 'pendapatan':
      return TEKS.tantanganPendapatan(formatUang(t.target));
    case 'upgrade':
      return TEKS.tantanganUpgrade(t.target);
    case 'kepuasan':
      return TEKS.tantanganKepuasan(persen(m.kepuasanMin), Math.round(t.target / 60));
    case 'fasilitas':
      return TEKS.tantanganFasilitas(t.target);
  }
}

/** Kemajuan "x / target" dalam satuan tantangannya. */
function angkaTantangan(t: ModelTantangan): string {
  const ada = Math.min(t.progres, t.target);
  switch (t.jenis) {
    case 'pendapatan':
      return `${formatUang(Math.floor(ada))} / ${formatUang(t.target)}`;
    case 'kepuasan':
      return TEKS.tantanganMenit(Math.floor(ada / 60), Math.round(t.target / 60));
    default:
      return `${formatAngka(Math.floor(ada))} / ${formatAngka(t.target)}`;
  }
}

/** Kartu tantangan mingguan: tiga baris berbilah dengan tombol klaim. */
function buatKartuTantangan(kirim: Kirim): { readonly elemen: HTMLElement; perbarui(m: ModelMingguan | null): void } {
  const elemen = el('div', 'target-kartu kartu-kolom tantangan-kartu');
  const judul = el('div', 'target-judul');
  const daftar = el('div', 'tantangan-daftar');
  const catatan = el('div', 'kelas-berikut', TEKS.tantanganCatatan);
  elemen.append(judul, daftar, catatan);
  const baris: { readonly elemen: HTMLElement; readonly label: HTMLElement; readonly isi: HTMLElement; readonly angka: HTMLElement; readonly tombol: HTMLButtonElement; readonly besar: HTMLElement }[] = [];
  return {
    elemen,
    perbarui(m) {
      setHidden(elemen, m === null);
      if (!m) return;
      const sisa = m.selesaiMs - Date.now();
      setTeks(judul, sisa > 0 ? TEKS.tantanganJudul(sisaWaktuEvent(sisa)) : TEKS.tantanganBerakhir);
      m.daftar.forEach((t, i) => {
        let b = baris[i];
        if (!b) {
          const e = el('div', 'tantangan-baris');
          const label = el('div', 'tantangan-label');
          const bar = el('div', 'bar');
          const isi = el('div', 'bar-isi');
          bar.append(isi);
          const angka = el('div', 'tantangan-angka');
          const tombol = el('button', 'tombol tombol-beli tombol-klaim');
          tombol.type = 'button';
          const kecil = el('span', 'tombol-kecil', TEKS.klaim);
          const besar = el('span', 'tombol-besar');
          tombol.append(kecil, besar);
          tombol.addEventListener('click', () => kirim({ jenis: 'klaimTantangan', indeks: i }));
          e.append(label, tombol, bar, angka);
          daftar.append(e);
          b = { elemen: e, label, isi, angka, tombol, besar };
          baris[i] = b;
        }
        setTeks(b.label, teksTantangan(t, m));
        setStyle(b.isi, 'width', `${(t.rasio * 100).toFixed(1)}%`);
        setTeks(b.angka, t.diklaim ? TEKS.diklaim : angkaTantangan(t));
        setTeks(b.besar, `+${formatUang(m.hadiah)}`);
        setHidden(b.tombol, t.diklaim);
        setDisabled(b.tombol, !t.selesai || t.diklaim);
        b.elemen.classList.toggle('selesai', t.selesai);
        b.elemen.classList.toggle('siap', t.selesai && !t.diklaim);
      });
    },
  };
}

/** Kartu rekor pribadi: hari ini, rekor harian, arus tertinggi. */
function buatKartuRekor(): { readonly elemen: HTMLElement; perbarui(m: ModelTampilan): void } {
  const elemen = el('div', 'target-kartu kartu-kolom rekor-kartu');
  const judul = el('div', 'target-judul', TEKS.rekorJudul);
  const hariIni = el('div', 'kelas-berikut');
  const daftar = el('div', 'rekor-daftar');
  const nilai = [TEKS.rekorPenumpang, TEKS.rekorPendapatan, TEKS.rekorArus].map((label) => {
    const v = el('span', 'rekor-nilai');
    daftar.append(el('span', 'rekor-label', label), v);
    return v;
  });
  elemen.append(judul, hariIni, daftar);
  return {
    elemen,
    perbarui(m) {
      const r = m.rekor;
      setTeks(hariIni, TEKS.rekorHariIni(formatAngka(Math.floor(r.penumpangHariIni)), formatUang(Math.floor(r.pendapatanHariIni))));
      const [p, rp, arus] = nilai as [HTMLElement, HTMLElement, HTMLElement];
      setTeks(p, r.penumpangHarian > 0 ? formatAngka(Math.floor(r.penumpangHarian)) : TEKS.rekorBelum);
      setTeks(rp, r.pendapatanHarian > 0 ? formatUang(Math.floor(r.pendapatanHarian)) : TEKS.rekorBelum);
      setTeks(arus, `${formatAngka(r.arusTertinggi)} ${TEKS.satuanArus}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Target harian & penghargaan

export interface OpsiTabTarget {
  /** Iklan berhadiah untuk klaim 2× (tanpa ini tombolnya tidak ada). */
  readonly iklan?: IklanMenu;
  /** Kartu papan peringkat (ui/peringkat.ts), di bawah tantangan mingguan. */
  readonly kartuPeringkat?: { readonly elemen: HTMLElement; perbarui(m: ModelTampilan): void };
}

export function buatTabTarget(kirim: Kirim, o: OpsiTabTarget = {}): IsiTab {
  const { iklan, kartuPeringkat } = o;
  let menonton = false;
  /** Tonton iklan lalu kirim aksi klaim ganda; satu iklan pada satu waktu. */
  const klaimGanda = (tempat: 'target2x' | 'penghargaan2x', aksi: Aksi): void => {
    if (!iklan || menonton) return;
    menonton = true;
    void iklan
      .tonton(tempat)
      .then((ok) => ok && kirim(aksi))
      .finally(() => (menonton = false));
  };
  const elemen = el('div', 'isi-tab daftar-item');
  // Event musiman: sisa waktu, pengali pendapatan, tahap target & klaim hadiahnya.
  const kartuEvent = el('div', 'target-kartu event-kartu');
  const eventJudul = el('div', 'target-judul event-judul');
  const eventTugas = el('div', 'target-tugas');
  const eventKet = el('div', 'kelas-berikut');
  const eventBar = el('div', 'bar');
  const eventBarIsi = el('div', 'bar-isi');
  eventBar.append(eventBarIsi);
  const eventAngka = el('div', 'target-angka');
  const tombolEvent = el('button', 'tombol tombol-beli tombol-klaim');
  tombolEvent.type = 'button';
  const eventKecil = el('span', 'tombol-kecil', TEKS.klaim);
  const eventBesar = el('span', 'tombol-besar');
  tombolEvent.append(eventKecil, eventBesar);
  tombolEvent.addEventListener('click', () => kirim({ jenis: 'klaimEvent' }));
  const eventKiri = el('div', 'target-kiri');
  eventKiri.append(eventJudul, eventTugas, eventKet, eventBar, eventAngka);
  const eventKanan = el('div', 'target-tombol');
  eventKanan.append(tombolEvent);
  kartuEvent.append(eventKiri, eventKanan);
  kartuEvent.hidden = true;
  const kartu = el('div', 'target-kartu');
  const judul = el('div', 'target-judul');
  const tugas = el('div', 'target-tugas');
  const bar = el('div', 'bar');
  const barIsi = el('div', 'bar-isi');
  bar.append(barIsi);
  const angka = el('div', 'target-angka');
  const tombolTarget = el('button', 'tombol tombol-beli tombol-klaim');
  tombolTarget.type = 'button';
  const targetKecil = el('span', 'tombol-kecil');
  const targetBesar = el('span', 'tombol-besar');
  tombolTarget.append(targetKecil, targetBesar);
  tombolTarget.addEventListener('click', () => kirim({ jenis: 'klaimTarget' }));
  const gandaTarget = tombolGanda();
  gandaTarget.tombol.addEventListener('click', () => klaimGanda('target2x', { jenis: 'klaimTarget', ganda: true }));
  const kiri = el('div', 'target-kiri');
  kiri.append(judul, tugas, bar, angka);
  const tombolKanan = el('div', 'target-tombol');
  tombolKanan.append(gandaTarget.tombol, tombolTarget);
  kartu.append(kiri, tombolKanan);
  const judulPenghargaan = el('div', 'judul-bagian', TEKS.penghargaan);
  const kartuTantangan = buatKartuTantangan(kirim);
  const kartuRekor = buatKartuRekor();
  elemen.append(kartuEvent, kartu, kartuTantangan.elemen, ...(kartuPeringkat ? [kartuPeringkat.elemen] : []), kartuRekor.elemen, judulPenghargaan);
  const baris = PENCAPAIAN_IDS.map((id: PencapaianId) => {
    const r = baris3(IKON_PIALA.replace(/^<svg[^>]*>|<\/svg>$/g, ''), NAMA_PENCAPAIAN[id].nama, 'penghargaan');
    setTeks(r.keterangan, NAMA_PENCAPAIAN[id].deskripsi);
    r.tombol.addEventListener('click', () => kirim({ jenis: 'klaimPencapaian', pencapaian: id }));
    const ganda = tombolGanda();
    ganda.tombol.addEventListener('click', () => klaimGanda('penghargaan2x', { jenis: 'klaimPencapaian', pencapaian: id, ganda: true }));
    r.tombol.before(ganda.tombol);
    elemen.append(r.elemen);
    return { id, ...r, ganda };
  });
  return {
    elemen,
    perbarui(m) {
      kartuTantangan.perbarui(m.mingguan);
      kartuPeringkat?.perbarui(m);
      kartuRekor.perbarui(m);
      const ev = m.event;
      setHidden(kartuEvent, ev === null);
      if (ev) {
        const nama = NAMA_EVENT[ev.id];
        const sisa = ev.selesaiMs !== null ? TEKS.eventSisa(sisaWaktuEvent(ev.selesaiMs - Date.now())) : TEKS.eventBerakhir;
        setTeks(eventJudul, `${nama.ikon} ${TEKS.eventJudul(nama.nama, ev.tahun)} · ${sisa}`);
        const tuntas = ev.tahap >= ev.jumlahTahap;
        setTeks(eventTugas, tuntas ? TEKS.eventTuntas : TEKS.eventTugas(formatAngka(ev.target), ev.tahap + 1, ev.jumlahTahap));
        setTeks(eventKet, TEKS.eventKeterangan(formatAngka(ev.pengali, { desimalKecil: 2 }), NAMA_PO[ev.po].nama, ev.poSudah));
        setStyle(eventBarIsi, 'width', `${((tuntas ? 1 : ev.rasio) * 100).toFixed(1)}%`);
        setTeks(eventAngka, tuntas ? '' : `${formatAngka(Math.floor(Math.min(ev.progres, ev.target)))} / ${formatAngka(ev.target)}`);
        setHidden(tombolEvent, tuntas);
        setTeks(eventBesar, `+${formatUang(ev.hadiah)}`);
        setDisabled(tombolEvent, !ev.bisaKlaim);
        kartuEvent.classList.toggle('siap', ev.bisaKlaim);
        kartuEvent.dataset['event'] = ev.id;
      }
      const t = m.target;
      setTeks(judul, TEKS.targetHari(t.hari));
      setTeks(tugas, t.jenis === 'upgrade' ? TEKS.targetUpgrade(formatAngka(t.target)) : TEKS.targetPenumpang(formatAngka(t.target)));
      setStyle(barIsi, 'width', `${(t.rasio * 100).toFixed(1)}%`);
      setTeks(angka, `${formatAngka(Math.floor(t.progres))} / ${formatAngka(t.target)}`);
      setTeks(targetKecil, t.diklaim ? '' : TEKS.klaim);
      setTeks(targetBesar, t.diklaim ? TEKS.diklaim : `+${formatUang(t.hadiah)}`);
      setDisabled(tombolTarget, !t.selesai || t.diklaim);
      const bisaIklan = iklan?.siap() ?? false;
      setHidden(gandaTarget.tombol, !bisaIklan || !t.selesai || t.diklaim);
      setTeks(gandaTarget.besar, `+${formatUang(t.hadiah.times(2))}`);
      kartu.classList.toggle('siap', t.selesai && !t.diklaim);
      for (const b of baris) {
        const p = m.pencapaian.find((x) => x.id === b.id)!;
        b.elemen.classList.toggle('belum', !p.tercapai);
        b.elemen.classList.toggle('siap', p.tercapai && !p.diklaim);
        // Belum tercapai: tanpa tombol. Tercapai: tombol klaim. Diklaim: tanda ✓.
        setHidden(b.tombol, !p.tercapai || p.diklaim);
        setHidden(b.level, !p.diklaim);
        setTeks(b.level, '✓');
        setTeks(b.tombolKecil, TEKS.klaim);
        setTeks(b.tombolBesar, `+${formatUang(m.hadiahPencapaian)}`);
        setHidden(b.ganda.tombol, !bisaIklan || !p.tercapai || p.diklaim);
        setTeks(b.ganda.besar, `+${formatUang(m.hadiahPencapaian.times(2))}`);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Baris item: ikon | nama + level + keterangan | tombol

interface Baris {
  readonly elemen: HTMLElement;
  readonly nama: HTMLElement;
  readonly level: HTMLElement;
  readonly keterangan: HTMLElement;
  readonly tombol: HTMLButtonElement;
  readonly tombolKecil: HTMLElement;
  readonly tombolBesar: HTMLElement;
}

function baris3(ikonSvg: string, nama: string, jenis: string): Baris {
  const elemen = el('div', `item item-${jenis}`);
  const ikon = el('div', 'item-ikon');
  ikon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ikonSvg}</svg>`;
  const info = el('div', 'item-info');
  const atas = el('div', 'item-atas');
  const namaEl = el('span', 'item-nama', nama);
  const level = el('span', 'item-level');
  atas.append(namaEl, level);
  const keterangan = el('div', 'item-keterangan');
  info.append(atas, keterangan);
  const tombol = el('button', 'tombol tombol-beli');
  tombol.type = 'button';
  const tombolKecil = el('span', 'tombol-kecil');
  const tombolBesar = el('span', 'tombol-besar');
  tombol.append(tombolKecil, tombolBesar);
  elemen.append(ikon, info, tombol);
  return { elemen, nama: namaEl, level, keterangan, tombol, tombolKecil, tombolBesar };
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
