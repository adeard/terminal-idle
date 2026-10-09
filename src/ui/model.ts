/**
 * View model: semua angka yang ditampilkan UI, diturunkan dari GameState
 * lewat fungsi sim. UI tidak menghitung ekonomi sendiri. Murni, tanpa DOM.
 */
import { EKONOMI, type KonfigEkonomi, type TingkatPo } from '../config/economy.config';
import { menurutTahap, petakBus, pengaliBiayaKelas, perawatanHarian } from '../sim/bangunan';
import { cuacaTerminalState } from '../sim/cuaca';
import { BANGUNAN_IDS, EVENT_IDS, KELAS_BUS_IDS, PENCAPAIAN_IDS, PETUGAS_IDS, PO_IDS, TARIF_IDS, TEKNOLOGI_IDS, type BangunanId, type EventId, type JenisTarget, type KelasBusId, type PencapaianId, type PetugasId, type PoId, type TarifId, type TeknologiId } from '../sim/fitur';
import type { RincianBiaya, RincianPendapatan } from '../sim/keuangan';
import { kelasDariLevel, levelMinimalKelas, xpKumulatifTerminal } from '../sim/level-terminal';
import { biayaDaftarPo, jurusanAktif, kelasAktif, levelPoDariXp, nilaiJurusan, nilaiTiketPo, xpKumulatifPo, xpLevelPo } from '../sim/mitra';
import { AREA_IDS, dayaTarikTycoon, type AreaId } from '../sim/operasi';
import { maksPetugas } from '../sim/petugas';
import {
  acuanHarian,
  biayaBangunState,
  bisaBangun,
  bisaBeliTeknologi,
  bisaBerhentikanPetugas,
  bisaDaftarPo,
  bisaKlaimEvent,
  bisaKlaimTantangan,
  bisaKlaimTarget,
  bisaMulaiPerluasan,
  bisaPutusPo,
  bisaRekrutPetugas,
  DETIK_SEHARI,
  hadiahMenit,
  hadiahTahapEvent,
  hadiahTantangan,
  idEdisiEvent,
  jendelaKosong,
  jumlahPetugas,
  jumlahRincian,
  kelasBusBeroperasi,
  kelasTerminal,
  keuanganSekarang,
  kurangPerpanjangPo,
  labaBuku,
  levelPo,
  levelTerminal,
  operasiState,
  pengaliEvent,
  pengembalianBongkarState,
  slotPoState,
  syaratDaftarPoKurang,
  syaratTeknologi,
  targetHarianSelesai,
  type BukuHarian,
  type GameState,
  type KurangDaftarPo,
  type KurangPerpanjang,
} from '../sim/state';
import type { TahapId } from '../sim/tahap';
import type { JenisTantangan } from '../sim/tantangan';
import { keramaianTerminal, tingkatKeramaian, waktuTerminalState, type TingkatKeramaian } from '../sim/waktu';
import { NAMA_HARI } from './teks';

/** Urutan area di ringkasan kapasitas (alur penumpang & bus). */
export { AREA_IDS };

export interface ModelHud {
  readonly kas: number;
  /** Laba bersih & penumpang hari ini (hari terminal). */
  readonly labaHariIni: number;
  readonly penumpangHariIni: number;
  /** Laba per jam terminal sekarang (pendapatan × boost − biaya). */
  readonly labaPerJam: number;
  /** Boost pendapatan iklan sedang berjalan. */
  readonly boostAktif: boolean;
  /** Arus penumpang sekarang (pnp per jam terminal). */
  readonly arus: number;
  readonly waktu: ModelWaktu;
  /** Kelas terminal (lihat namaKelas di teks.ts). */
  readonly kelas: number;
  /** Level terminal. */
  readonly level: number;
  readonly kepuasan: ModelKepuasan;
  /** Ada Manajer Operasional: terminal tetap jalan saat game ditutup. */
  readonly adaManajer: boolean;
  /** Rata-rata sehari merugi dan kas tinggal kurang dari sehari kerugian. */
  readonly kasMenipis: boolean;
}

/** Kebutuhan sesuatu dibanding yang ada (saran di popup kepuasan). */
export interface AdaPerlu {
  readonly ada: number;
  readonly perlu: number;
}

/** Kepuasan penumpang (HUD & popup): komponen, kebutuhan untuk saran, dan area yang membatasi arus. */
export interface ModelKepuasan {
  readonly nilai: number;
  readonly kelancaran: number;
  readonly kenyamanan: number;
  readonly kebersihan: number;
  readonly keamanan: number;
  readonly fasilitas: number;
  readonly harga: number;
  /** Calon penumpang tambahan berkat kepuasan (0.4 = +40 % dibanding kepuasan 0). */
  readonly tambahanPenumpang: number;
  /** Area yang membatasi arus jam sibuk (null = semua penumpang terlayani). */
  readonly bottleneck: AreaId | null;
  /** Blok kursi, petugas kebersihan, & satpam: yang ada dan yang dibutuhkan arus jam sibuk. */
  readonly kursi: AdaPerlu;
  /** Papan jadwal digital terpasang (bagian dari kenyamanan). */
  readonly papanJadwal: boolean;
  readonly petugasKebersihan: AdaPerlu;
  readonly satpam: AdaPerlu;
  /** Fasilitas yang belum ada (toilet, kios & toko, lahan parkir). */
  readonly fasilitasKurang: readonly BangunanId[];
}

/** Jam terminal di HUD. */
export interface ModelWaktu {
  readonly hari: string;
  /** "HH:MM", 24 jam. */
  readonly jam: string;
  readonly siang: boolean;
  /** Minggu ditandai merah seperti kalender. */
  readonly hariMinggu: boolean;
  /** Keramaian penumpang menurut jam & hari (ritme harian). */
  readonly keramaian: TingkatKeramaian;
  /** Sedang hujan (ikon awan hujan menggantikan matahari/bulan). */
  readonly hujan: boolean;
}

const duaDigit = (n: number): string => String(n).padStart(2, '0');
/** Mulai sederas ini HUD menampilkan ikon hujan. */
const AMBANG_IKON_HUJAN = 0.08;

/** Kapasitas satu area (pnp per jam terminal). */
export interface ModelArea {
  readonly id: AreaId;
  readonly kapasitas: number;
  readonly bottleneck: boolean;
}

/** Satu jenis bangunan (tab Bangun). */
export interface ModelBangunan {
  readonly id: BangunanId;
  readonly jumlah: number;
  readonly slot: number;
  /** Tahap perluasan (1 = pertama) berikutnya yang menambah slot; null = tidak ada lagi. */
  readonly slotBerikut: number | null;
  /** Biaya unit berikutnya; null = slot penuh. */
  readonly biaya: number | null;
  readonly bisa: boolean;
  /** Perawatan satu unit per hari (sudah × pengali kelas terminal). */
  readonly perawatan: number;
  /** Uang kembali bila satu dibongkar; null = tidak bisa dibongkar. */
  readonly bongkar: number | null;
}

export interface ModelTeknologi {
  readonly id: TeknologiId;
  readonly tahap: TahapId;
  readonly multKapasitas: number;
  readonly biaya: number;
  /** Perawatan per hari (sudah × pengali kelas terminal). */
  readonly perawatan: number;
  readonly dimiliki: boolean;
  /** Teknologi pendahulu yang belum dipasang, null kalau syarat terpenuhi. */
  readonly syaratKurang: TeknologiId | null;
  readonly bisa: boolean;
}

/** Tab Bangun: kapasitas tiap area, bangunan di slot, modernisasi. */
export interface ModelBangun {
  readonly area: readonly ModelArea[];
  /** Permintaan & arus jam sibuk (pnp per jam). */
  readonly permintaanPuncak: number;
  readonly arusPuncak: number;
  readonly petakBus: number;
  readonly bangunan: Readonly<Record<BangunanId, ModelBangunan>>;
  readonly jendelaKosong: number;
  readonly teknologi: readonly ModelTeknologi[];
  /** Perawatan semua unit & modernisasi per hari (sudah × pengali kelas). */
  readonly perawatanHarian: number;
}

export interface ModelPetugas {
  readonly id: PetugasId;
  readonly jumlah: number;
  readonly maks: number;
  /** Gaji satu posisi per hari (sudah × pengali kelas terminal). */
  readonly gaji: number;
  readonly bisaRekrut: boolean;
  readonly bisaBerhentikan: boolean;
  /** Jumlah yang dibutuhkan arus sekarang (kebersihan, satpam); null = tanpa patokan. */
  readonly perlu: number | null;
}

/** Tab Petugas. */
export interface ModelTimPetugas {
  readonly daftar: readonly ModelPetugas[];
  readonly jumlah: number;
  /** Gaji semua petugas per hari. */
  readonly gajiHarian: number;
}

/** Harga tiket satu jurusan PO (ditetapkan PO; informasi). */
export interface ModelJurusanPo {
  /** Indeks jurusan (EKONOMI.jurusan). */
  readonly jurusan: number;
  readonly nama: string;
  /** Penyeberangan feri bila rute antarpulau. */
  readonly feri: string | null;
  /** Jurusan ini sedang dilayani (level PO & kelas terminal cukup). */
  readonly aktif: boolean;
  /** Level PO yang membukanya & kelas terminal minimal yang belum tercapai (null bila sudah). */
  readonly levelBuka: number;
  readonly kurangKelas: number | null;
  /** Harga tiket kelas Ekonomi (Rp). */
  readonly harga: number;
}

/** Mitra PO yang terdaftar (kartu di tab PO). */
export interface ModelPoTerdaftar {
  readonly id: PoId;
  readonly tingkat: TingkatPo;
  readonly level: number;
  /** XP di dalam level ini & yang dibutuhkan untuk naik (satuan bus), dan rasionya. */
  readonly xpDalamLevel: number;
  readonly xpLevel: number;
  readonly rasioXp: number;
  /** Jendela loket yang disewa, kapasitasnya, dan permintaan jam sibuk PO ini (pnp per jam). */
  readonly loket: number;
  readonly kapasitasLoket: number;
  readonly permintaanPuncak: number;
  /** Arus penumpang PO ini sekarang & bagiannya dari semua penumpang terminal (0–1). */
  readonly arus: number;
  readonly bagian: number;
  /** Ada jendela kosong yang bisa langsung disewakan ke PO ini (gratis). */
  readonly bisaIsiKosong: boolean;
  /** Biaya jendela loket baru (null = slot penuh). */
  readonly biayaJendela: number | null;
  readonly bisaTambahJendela: boolean;
  /** 0–100. */
  readonly reputasi: number;
  readonly kelas: readonly KelasBusId[];
  /** Kelas bus berikutnya yang terbuka seiring level (null = sudah semua yang boleh untuk tingkatnya). */
  readonly kelasBerikut: { readonly kelas: KelasBusId; readonly level: number; readonly kurangKelas: number | null } | null;
  readonly jurusan: readonly ModelJurusanPo[];
  /** Kepuasan mitra (0–1). */
  readonly kepuasanMitra: number;
  /** Sisa kontrak (hari terminal), dan kenapa belum bisa diperpanjang (null = bisa). */
  readonly kontrakHari: number;
  readonly kurangPerpanjang: KurangPerpanjang | null;
  /** PO premium: kepuasan penumpang minimal untuk memperpanjang (null = tanpa syarat). */
  readonly kepuasanMin: number | null;
  readonly bisaPutus: boolean;
}

/** PO yang belum terdaftar (daftar di bawah kartu PO). */
export interface ModelPoTersedia {
  readonly id: PoId;
  readonly tingkat: TingkatPo;
  /** Nama jurusan (urut terbuka: Lv 1, Lv 6, Lv 12). */
  readonly jurusan: readonly string[];
  readonly biaya: number;
  readonly bisa: boolean;
  /** Syarat yang belum terpenuhi (null = tinggal kasnya). */
  readonly kurang: KurangDaftarPo | null;
  /** Level yang dilanjutkan bila pernah terdaftar (riwayat), null bila belum pernah. */
  readonly levelRiwayat: number | null;
  /** Sisa masa jeda setelah diputus (hari terminal), null bila tidak sedang jeda. */
  readonly jedaHari: number | null;
  /** PO hadiah (kelas/event): gratis & kontrak pertama lebih panjang. */
  readonly hadiah: boolean;
  /** Event musiman yang menghadiahkan PO ini (null = bukan PO event). */
  readonly event: EventId | null;
}

export interface ModelMitra {
  readonly terdaftar: readonly ModelPoTerdaftar[];
  readonly tersedia: readonly ModelPoTersedia[];
  readonly slot: number;
  /** Slot berikutnya terbuka di level terminal ini (null = sudah paling banyak). */
  readonly slotBerikut: { readonly level: number; readonly slot: number } | null;
  readonly jendelaKosong: number;
  /** Aturan kontrak untuk keterangan: lama paling panjang, penalti reputasi & jeda bila diputus (hari terminal). */
  readonly kontrak: { readonly hariMaks: number; readonly penaltiPutus: number; readonly jedaHari: number };
  /** Kepuasan mitra minimal untuk memperpanjang kontrak & mau bergabung. */
  readonly minimalMitra: number;
}

/** Tahap perluasan terminal (tab Terminal). */
export interface ModelPerluasan {
  readonly selesai: number;
  readonly jumlah: number;
  /** Proyek yang sedang dibangun: tahap (1-based), sisa detik main, kemajuan 0–1. */
  readonly proyek: { readonly tahap: number; readonly sisaDetik: number; readonly rasio: number } | null;
  /** Tahap berikutnya (null = semua sudah dibangun). */
  readonly berikut: { readonly tahap: number; readonly level: number; readonly biaya: number; readonly operasional: number; readonly bisa: boolean; readonly levelKurang: boolean } | null;
}

/** Satu tarif terminal (tab Terminal). */
export interface ModelTarif {
  readonly id: TarifId;
  readonly nilai: number;
  readonly bawaan: number;
  readonly langkah: number;
  readonly bisaTurun: boolean;
  readonly bisaNaik: boolean;
  /**
   * Biaya layanan saja: rupiah yang dipungut terminal per penumpang dengan tarif
   * ini, dari rata-rata harga tiket (ditetapkan PO; beda tiap jurusan, kelas bus,
   * & level PO) penumpang yang berangkat sekarang. null untuk tarif lain.
   */
  readonly perPenumpang: { readonly rupiah: number; readonly hargaTiket: number } | null;
}

/** Buku keuangan satu hari terminal. */
export interface ModelBuku {
  readonly hari: string;
  readonly pendapatan: RincianPendapatan;
  readonly biaya: RincianBiaya;
  readonly totalPendapatan: number;
  readonly totalBiaya: number;
  readonly laba: number;
  readonly penumpang: number;
}

/** Laporan keuangan (tab Terminal). */
export interface ModelKeuangan {
  readonly kas: number;
  readonly hariIni: ModelBuku;
  readonly kemarin: ModelBuku | null;
  /** Rata-rata sehari biasa dengan tarif sekarang (Rp per hari terminal). */
  readonly rataRata: { readonly pendapatan: number; readonly biaya: number; readonly laba: number };
}

/** Level & kelas terminal, perluasan, tarif, keuangan (tab Terminal; kartu level di tab Target). */
export interface ModelTerminal {
  /** Nama terminal pilihan pemain (kosong = bawaan). */
  readonly nama: string;
  readonly level: number;
  readonly kelas: number;
  /** XP (penumpang): kumulatif sekarang, awal level ini, dan level berikutnya; kemajuannya 0–1. */
  readonly xp: number;
  readonly xpLevel: number;
  readonly xpBerikut: number;
  readonly rasio: number;
  /** Level saat kelas berikutnya tercapai. */
  readonly levelKelasBerikut: number;
  readonly slot: number;
  readonly perluasan: ModelPerluasan;
  readonly tarif: readonly ModelTarif[];
  readonly keuangan: ModelKeuangan;
  /** Kelas bus: dioperasikan PO terdaftar atau belum, dan syaratnya (level PO, tingkat PO paling rendah, kelas terminal). */
  readonly kelasBus: readonly ModelKelasBus[];
}

export interface ModelKelasBus {
  readonly id: KelasBusId;
  readonly beroperasi: boolean;
  readonly levelPo: number;
  readonly tingkatMin: TingkatPo;
  readonly kelasTerminal: number;
}

/** Event musiman: yang berlangsung, atau edisi terakhir yang masih punya hadiah untuk diklaim. */
export interface ModelEvent {
  readonly id: EventId;
  /** Tahun edisi (dari kunci edisi), mis. "2027"; kosong untuk edisi uji. */
  readonly tahun: string;
  readonly aktif: boolean;
  /** Selesai (ms epoch) bila sedang berlangsung. */
  readonly selesaiMs: number | null;
  /** Pengali pasar penumpang selama event. */
  readonly pengali: number;
  /** Tahap berikutnya (0-based) & banyaknya tahap; tahap = jumlahTahap berarti semua sudah diklaim. */
  readonly tahap: number;
  readonly jumlahTahap: number;
  readonly target: number;
  readonly progres: number;
  readonly rasio: number;
  readonly bisaKlaim: boolean;
  readonly hadiah: number;
  /** PO eksklusif hadiah tahap terakhir & apakah sudah didapat. */
  readonly po: PoId;
  readonly poSudah: boolean;
}

/** Satu tantangan mingguan (tab Target). */
export interface ModelTantangan {
  readonly jenis: JenisTantangan;
  readonly target: number;
  readonly progres: number;
  readonly rasio: number;
  readonly selesai: boolean;
  readonly diklaim: boolean;
}

/** Tantangan minggu ini; hadiah tiap tantangan sama (sekian menit laba). */
export interface ModelMingguan {
  readonly selesaiMs: number;
  readonly daftar: readonly ModelTantangan[];
  readonly hadiah: number;
  readonly kepuasanMin: number;
}

/** Rekor pribadi & hitungan hari terminal ini. */
export interface ModelRekor {
  readonly penumpangHariIni: number;
  readonly labaHariIni: number;
  readonly penumpangHarian: number;
  readonly labaHarian: number;
  readonly arusTertinggi: number;
}

/** Papan peringkat mingguan dari sisi state (peringkat & papannya dari server, lihat app/layanan-peringkat.ts). */
export interface ModelPeringkat {
  /** Minggu WIB berjalan; null = tantangan/minggu belum dimulai. */
  readonly minggu: string | null;
  readonly selesaiMs: number;
  /** Penumpang minggu ini (skor). */
  readonly penumpang: number;
  readonly ikut: boolean;
  readonly nama: string;
  readonly kelas: number;
}

export interface ModelTarget {
  readonly hari: string;
  readonly jenis: JenisTarget;
  readonly target: number;
  readonly progres: number;
  readonly rasio: number;
  readonly selesai: boolean;
  readonly diklaim: boolean;
  readonly hadiah: number;
}

export interface ModelPencapaian {
  readonly id: PencapaianId;
  readonly tercapai: boolean;
  readonly diklaim: boolean;
}

export interface ModelTampilan {
  readonly hud: ModelHud;
  readonly bangun: ModelBangun;
  readonly petugas: ModelTimPetugas;
  readonly mitra: ModelMitra;
  readonly terminal: ModelTerminal;
  readonly event: ModelEvent | null;
  readonly mingguan: ModelMingguan | null;
  readonly rekor: ModelRekor;
  readonly peringkat: ModelPeringkat;
  readonly target: ModelTarget;
  readonly pencapaian: readonly ModelPencapaian[];
  /** Hadiah pencapaian (sama untuk semua, sebanding laba sekarang). */
  readonly hadiahPencapaian: number;
  /** Banyaknya hadiah yang siap diklaim (target + pencapaian + tantangan + event), untuk lencana tab. */
  readonly jumlahKlaim: number;
  /** Petugas yang pernah berhenti karena kas habis (notifikasi saat bertambah). */
  readonly petugasBerhenti: number;
}

export function buatModel(state: GameState, cfg: KonfigEkonomi = EKONOMI): ModelTampilan {
  const op = operasiState(state, cfg);
  const keu = keuanganSekarang(state, cfg);
  const kelas = kelasTerminal(state, cfg);
  const w = waktuTerminalState(state);
  const hari = NAMA_HARI[w.indeksHari]!;
  const rata = acuanHarian(state, cfg, state.terminal.tarif);
  const b = state.terminal.bangunan;
  const n = jumlahPetugas(state);
  const k = op.kepuasan;
  const kp = cfg.tycoon.kepuasan;
  const hariIni = state.keuangan.hariIni;
  const kepuasan: ModelKepuasan = {
    nilai: k.nilai,
    kelancaran: k.kelancaran,
    kenyamanan: k.kenyamanan,
    kebersihan: k.kebersihan,
    keamanan: k.keamanan,
    fasilitas: k.fasilitas,
    harga: k.harga,
    tambahanPenumpang: dayaTarikTycoon(k.nilai, cfg) / dayaTarikTycoon(0, cfg) - 1,
    bottleneck: op.bottleneck,
    kursi: { ada: b.kursi, perlu: Math.ceil((op.arusPuncak * kp.jamTunggu) / kp.kursiPerBlok - 1e-9) },
    papanJadwal: state.terminal.teknologi.jadwalDigital,
    petugasKebersihan: { ada: n.kebersihan, perlu: Math.ceil(op.arusPuncak / kp.arusPerPetugasKebersihan - 1e-9) },
    satpam: { ada: n.satpam, perlu: b.jalur },
    fasilitasKurang: (['toilet', 'kios', 'lahanParkir'] as const).filter((id) => (id === 'kios' ? b.kios + b.toko : b[id]) === 0),
  };
  return {
    hud: {
      kas: state.kas,
      labaHariIni: labaBuku(hariIni),
      penumpangHariIni: Math.floor(hariIni.penumpang + 1e-9),
      labaPerJam: keu.laba,
      boostAktif: state.hadiah.boostDetik > 0,
      arus: op.arus,
      kelas,
      level: levelTerminal(state, cfg),
      kepuasan,
      adaManajer: n.manajerOperasional > 0,
      kasMenipis: rata.laba < 0 && state.kas < -rata.laba * 24,
      waktu: {
        hari,
        jam: `${duaDigit(w.jam)}:${duaDigit(w.menit)}`,
        siang: w.siang,
        hariMinggu: w.indeksHari === NAMA_HARI.length - 1,
        keramaian: tingkatKeramaian(keramaianTerminal(w)),
        hujan: cuacaTerminalState(state).hujan > AMBANG_IKON_HUJAN,
      },
    },
    bangun: modelBangun(state, cfg),
    petugas: modelPetugas(state, cfg),
    mitra: modelMitra(state, cfg),
    terminal: modelTerminal(state, rata, cfg),
    ...modelTarget(state, hari, cfg),
    petugasBerhenti: state.keuangan.petugasBerhenti,
  };
}

/** Tahap perluasan (1-based) berikutnya yang menambah slot tabel ini, null bila tidak ada lagi. */
function tahapTambahSlot(slot: readonly number[], perluasan: number): number | null {
  const sekarang = menurutTahap(slot, perluasan);
  for (let t = perluasan + 1; t < slot.length; t++) if (slot[t]! > sekarang) return t;
  return null;
}

function modelBangun(state: GameState, cfg: KonfigEkonomi): ModelBangun {
  const op = operasiState(state, cfg);
  const perluasan = state.perkembangan.perluasan;
  const pengali = pengaliBiayaKelas(kelasTerminal(state, cfg), cfg);
  const bangunan = {} as Record<BangunanId, ModelBangunan>;
  for (const id of BANGUNAN_IDS) {
    const c = cfg.tycoon.bangunan[id];
    const biaya = biayaBangunState(state, id, cfg);
    bangunan[id] = {
      id,
      jumlah: state.terminal.bangunan[id],
      slot: menurutTahap(c.slot, perluasan),
      slotBerikut: tahapTambahSlot(c.slot, perluasan),
      biaya,
      bisa: bisaBangun(state, id, null, cfg),
      perawatan: c.perawatan * pengali,
      bongkar: pengembalianBongkarState(state, id, cfg),
    };
  }
  return {
    area: AREA_IDS.map((id) => ({ id, kapasitas: op.kapasitas[id], bottleneck: op.bottleneck === id })),
    permintaanPuncak: op.permintaanPuncak,
    arusPuncak: op.arusPuncak,
    petakBus: petakBus(perluasan, cfg),
    bangunan,
    jendelaKosong: jendelaKosong(state),
    teknologi: TEKNOLOGI_IDS.map((id): ModelTeknologi => {
      const t = cfg.teknologi[id];
      return {
        id,
        tahap: t.tahap,
        multKapasitas: t.multKapasitas,
        biaya: t.biaya,
        perawatan: t.perawatan * pengali,
        dimiliki: state.terminal.teknologi[id],
        syaratKurang: syaratTeknologi(state, id, cfg) ? null : t.syarat,
        bisa: bisaBeliTeknologi(state, id, cfg),
      };
    }),
    perawatanHarian: perawatanHarian(state.terminal.bangunan, state.terminal.teknologi, cfg) * pengali,
  };
}

function modelPetugas(state: GameState, cfg: KonfigEkonomi): ModelTimPetugas {
  const op = operasiState(state, cfg);
  const n = jumlahPetugas(state);
  const b = state.terminal.bangunan;
  const pengali = pengaliBiayaKelas(kelasTerminal(state, cfg), cfg);
  const perlu = (id: PetugasId): number | null => {
    if (id === 'kebersihan') return Math.ceil(op.arusPuncak / cfg.tycoon.kepuasan.arusPerPetugasKebersihan - 1e-9);
    if (id === 'satpam') return b.jalur;
    return null;
  };
  const daftar = PETUGAS_IDS.map(
    (id): ModelPetugas => ({
      id,
      jumlah: n[id],
      maks: maksPetugas(id, b),
      gaji: cfg.tycoon.gaji[id] * pengali,
      bisaRekrut: bisaRekrutPetugas(state, id),
      bisaBerhentikan: bisaBerhentikanPetugas(state, id),
      perlu: perlu(id),
    }),
  );
  return { daftar, jumlah: state.terminal.petugas.length, gajiHarian: daftar.reduce((a, p) => a + p.gaji * p.jumlah, 0) };
}

/** Mitra PO: kartu PO terdaftar (level, jendela, kepuasan mitra, jurusan & harga, kontrak) dan PO yang bisa didaftarkan. */
function modelMitra(state: GameState, cfg: KonfigEkonomi): ModelMitra {
  const op = operasiState(state, cfg);
  const kelas = kelasTerminal(state, cfg);
  const level = levelTerminal(state, cfg);
  const kosong = jendelaKosong(state);
  const biayaJendela = biayaBangunState(state, 'jendela', cfg);
  const terdaftar = state.mitra.terdaftar.map((p, i): ModelPoTerdaftar => {
    const lv = levelPo(p, cfg);
    const aktif = new Set(jurusanAktif(p.id, lv, kelas, cfg));
    const h = op.po[i];
    const tingkat = cfg.mitra.tingkat[cfg.mitra.po[p.id].tingkat];
    const kelasPo = kelasAktif(p.id, lv, kelas, cfg);
    const kelasBerikutId = KELAS_BUS_IDS.find((kb, ki) => ki < tingkat.kelasMaks && !kelasPo.includes(kb));
    return {
      id: p.id,
      tingkat: cfg.mitra.po[p.id].tingkat,
      level: lv,
      xpDalamLevel: p.xp - xpKumulatifPo(lv, cfg),
      xpLevel: xpLevelPo(lv, cfg),
      rasioXp: Math.min(1, Math.max(0, (p.xp - xpKumulatifPo(lv, cfg)) / xpLevelPo(lv, cfg))),
      loket: p.loket,
      kapasitasLoket: h?.kapasitasLoket ?? 0,
      permintaanPuncak: h?.permintaanPuncak ?? 0,
      arus: h?.arus ?? 0,
      bagian: h && op.arus > 0 ? h.arus / op.arus : 0,
      bisaIsiKosong: kosong > 0,
      biayaJendela,
      bisaTambahJendela: bisaBangun(state, 'jendela', p.id, cfg),
      reputasi: p.reputasi,
      kelas: kelasPo,
      kelasBerikut: kelasBerikutId
        ? { kelas: kelasBerikutId, level: cfg.mitra.kelas[kelasBerikutId].levelPo, kurangKelas: cfg.kelasBus[kelasBerikutId].kelasTerminal > kelas ? cfg.kelasBus[kelasBerikutId].kelasTerminal : null }
        : null,
      jurusan: cfg.mitra.po[p.id].jurusan.map((nama, ji): ModelJurusanPo => {
        const j = cfg.jurusan.findIndex((x) => x.nama === nama);
        const kurang = cfg.jurusan[j]?.kelasTerminal ?? 0;
        return {
          jurusan: j,
          nama,
          feri: cfg.jurusan[j]?.feri ?? null,
          aktif: aktif.has(j),
          levelBuka: cfg.mitra.levelJurusan[ji] ?? 1,
          kurangKelas: kurang > kelas ? kurang : null,
          harga: cfg.tycoon.hargaTiketDasar * nilaiJurusan(j, cfg) * cfg.mitra.kelas.ekonomi.nilai * nilaiTiketPo(lv, cfg),
        };
      }),
      kepuasanMitra: h?.kepuasanMitra ?? 0,
      kontrakHari: p.kontrakDetik / DETIK_SEHARI,
      kurangPerpanjang: kurangPerpanjangPo(state, p.id, cfg),
      kepuasanMin: cfg.mitra.po[p.id].kepuasanMin ?? null,
      bisaPutus: bisaPutusPo(state, p.id),
    };
  });
  const terdaftarId = new Set(state.mitra.terdaftar.map((p) => p.id));
  const tersedia = PO_IDS.filter((id) => !terdaftarId.has(id))
    .map((id): ModelPoTersedia => {
      const po = cfg.mitra.po[id];
      const riwayat = state.mitra.riwayat[id];
      const kurang = syaratDaftarPoKurang(state, id, cfg);
      return {
        id,
        tingkat: po.tingkat,
        jurusan: po.jurusan,
        biaya: biayaDaftarPo(id, cfg),
        bisa: bisaDaftarPo(state, id, cfg),
        kurang,
        levelRiwayat: riwayat ? levelPoDariXp(riwayat.xp, cfg) : null,
        jedaHari: kurang?.jenis === 'jeda' ? (kurang.sampaiDetik - state.statistik.waktuMainDetik) / DETIK_SEHARI : null,
        hadiah: po.sumber === 'hadiahKelas' || po.sumber === 'hadiahEvent',
        event: EVENT_IDS.find((e) => cfg.event[e].po === id) ?? null,
      };
    })
    // Yang bisa didaftarkan (atau tinggal slot/kas) lebih dulu, lalu yang terkunci kelas/event/kepuasan;
    // di tiap golongan yang termurah dulu (PO kedua yang disarankan tutorial ada di paling atas).
    .sort((a, b) => urutanTersedia(a) - urutanTersedia(b) || a.biaya - b.biaya);
  const slot = slotPoState(state, cfg);
  const slotBerikut = cfg.mitra.terminal.slot.find(([lv, s]) => lv > level && s > slot);
  return {
    terdaftar,
    tersedia,
    slot,
    slotBerikut: slotBerikut ? { level: slotBerikut[0], slot: slotBerikut[1] } : null,
    jendelaKosong: kosong,
    kontrak: { hariMaks: cfg.mitra.kontrak.hariMaks, penaltiPutus: cfg.mitra.kontrak.penaltiReputasiPutus, jedaHari: cfg.mitra.kontrak.jedaPutusHari },
    minimalMitra: cfg.tycoon.mitra.minimal,
  };
}

function urutanTersedia(p: ModelPoTersedia): number {
  if (!p.kurang) return 0;
  switch (p.kurang.jenis) {
    case 'slot':
    case 'jeda':
    case 'jendela':
    case 'mitra':
      return 1;
    case 'kepuasan':
      return 2;
    case 'kelas':
      return 3 + p.kurang.kelas;
    case 'event':
      return 100;
    case 'terdaftar':
      return 200;
  }
}

function modelBuku(b: BukuHarian): ModelBuku {
  const totalPendapatan = jumlahRincian(b.pendapatan);
  const totalBiaya = jumlahRincian(b.biaya);
  return {
    hari: NAMA_HARI[((b.hariKe % NAMA_HARI.length) + NAMA_HARI.length) % NAMA_HARI.length]!,
    pendapatan: b.pendapatan,
    biaya: b.biaya,
    totalPendapatan,
    totalBiaya,
    laba: totalPendapatan - totalBiaya,
    penumpang: b.penumpang,
  };
}

/** Level & kelas terminal, perluasan, tarif, keuangan. */
/**
 * Rata-rata harga tiket penumpang yang berangkat sekarang (ditimbang arus tiap
 * PO × jurusan × kelas bus); saat sepi, rata-rata segmennya; tanpa PO, harga dasar.
 */
export function hargaTiketRata(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  const segmen = operasiState(state, cfg).segmen;
  if (segmen.length === 0) return cfg.tycoon.hargaTiketDasar;
  const arus = segmen.reduce((a, s) => a + s.arus, 0);
  if (arus > 0) return segmen.reduce((a, s) => a + s.arus * s.harga, 0) / arus;
  return segmen.reduce((a, s) => a + s.harga, 0) / segmen.length;
}

function modelTerminal(state: GameState, rata: { readonly pendapatan: number; readonly biaya: number; readonly laba: number }, cfg: KonfigEkonomi): ModelTerminal {
  const level = levelTerminal(state, cfg);
  const kelas = kelasDariLevel(level, cfg);
  const xp = state.perkembangan.xpTerminal;
  const xpLevel = xpKumulatifTerminal(level, cfg);
  const xpBerikut = xpKumulatifTerminal(level + 1, cfg);
  const p = state.perkembangan;
  const tahapBerikut = cfg.mitra.perluasan[p.perluasan];
  const perluasan: ModelPerluasan = {
    selesai: p.perluasan,
    jumlah: cfg.mitra.perluasan.length,
    proyek: p.proyekDetik > 0 ? { tahap: p.perluasan + 1, sisaDetik: p.proyekDetik, rasio: 1 - p.proyekDetik / cfg.mitra.detikProyek } : null,
    berikut:
      tahapBerikut && p.proyekDetik <= 0
        ? {
            tahap: p.perluasan + 1,
            level: tahapBerikut.level,
            biaya: tahapBerikut.biaya,
            operasional: tahapBerikut.operasional,
            bisa: bisaMulaiPerluasan(state, cfg),
            levelKurang: level < tahapBerikut.level,
          }
        : null,
  };
  const hargaTiket = hargaTiketRata(state, cfg);
  const tarif = TARIF_IDS.map((id): ModelTarif => {
    const t = cfg.tycoon.tarif[id];
    const nilai = state.terminal.tarif[id];
    const perPenumpang = id === 'layanan' ? { rupiah: (hargaTiket * nilai) / 100, hargaTiket } : null;
    return { id, nilai, bawaan: t.bawaan, langkah: t.langkah, bisaTurun: nilai > t.min, bisaNaik: nilai < t.maks, perPenumpang };
  });
  const k = state.keuangan;
  const beroperasi = new Set(kelasBusBeroperasi(state, cfg));
  const tingkat = Object.keys(cfg.mitra.tingkat) as TingkatPo[];
  return {
    nama: state.profil.namaTerminal,
    level,
    kelas,
    xp,
    xpLevel,
    xpBerikut,
    rasio: xpBerikut > xpLevel ? Math.min(1, Math.max(0, (xp - xpLevel) / (xpBerikut - xpLevel))) : 1,
    levelKelasBerikut: levelMinimalKelas(kelas + 1, cfg),
    slot: slotPoState(state, cfg),
    perluasan,
    tarif,
    keuangan: {
      kas: state.kas,
      hariIni: modelBuku(k.hariIni),
      kemarin: k.kemarin ? modelBuku(k.kemarin) : null,
      rataRata: { pendapatan: rata.pendapatan * 24, biaya: rata.biaya * 24, laba: rata.laba * 24 },
    },
    kelasBus: KELAS_BUS_IDS.map(
      (id, i): ModelKelasBus => ({
        id,
        beroperasi: beroperasi.has(id),
        levelPo: cfg.mitra.kelas[id].levelPo,
        // Tingkat PO paling rendah yang boleh mengoperasikan kelas ini (urut lokal → premium).
        tingkatMin: tingkat.find((t) => cfg.mitra.tingkat[t].kelasMaks > i) ?? tingkat[tingkat.length - 1]!,
        kelasTerminal: cfg.kelasBus[id].kelasTerminal,
      }),
    ),
  };
}

/** Event, tantangan, rekor, papan peringkat, target harian, dan pencapaian (tab Target). */
function modelTarget(
  state: GameState,
  hari: string,
  cfg: KonfigEkonomi,
): Pick<ModelTampilan, 'event' | 'mingguan' | 'rekor' | 'peringkat' | 'target' | 'pencapaian' | 'hadiahPencapaian' | 'jumlahKlaim'> {
  const e = state.event;
  const idEvent = idEdisiEvent(e.edisi);
  const bisaKlaimEv = bisaKlaimEvent(state);
  const targetEv = e.target[Math.min(e.diklaim, e.target.length - 1)] ?? 0;
  const event: ModelEvent | null =
    idEvent && (e.aktif !== null || bisaKlaimEv)
      ? {
          id: idEvent,
          tahun: e.edisi?.split('-')[1]?.replace('uji', '') ?? '',
          aktif: e.aktif !== null,
          selesaiMs: e.aktif?.selesaiMs ?? null,
          pengali: e.aktif ? pengaliEvent(state, cfg) : cfg.event[idEvent].pengaliPasar,
          tahap: e.diklaim,
          jumlahTahap: e.target.length,
          target: targetEv,
          progres: e.progres,
          rasio: Math.min(1, e.progres / Math.max(1, targetEv)),
          bisaKlaim: bisaKlaimEv,
          hadiah: hadiahTahapEvent(state, cfg),
          po: cfg.event[idEvent].po,
          poSudah: state.mitra.hadiahEvent.includes(cfg.event[idEvent].po),
        }
      : null;
  const h = state.harian;
  const target: ModelTarget = {
    hari,
    jenis: h.jenis,
    target: h.target,
    progres: h.progres,
    rasio: h.target > 0 ? Math.min(1, h.progres / h.target) : 1,
    selesai: targetHarianSelesai(state),
    diklaim: h.diklaim,
    hadiah: hadiahMenit(state, cfg.harian.hadiahMenit, cfg),
  };
  const pencapaian = PENCAPAIAN_IDS.map((id): ModelPencapaian => ({ id, tercapai: state.pencapaian.tercapai.includes(id), diklaim: state.pencapaian.diklaim.includes(id) }));
  const tg = state.tantangan;
  const mingguan: ModelMingguan | null =
    tg.minggu === null
      ? null
      : {
          selesaiMs: tg.selesaiMs,
          hadiah: hadiahTantangan(state, cfg),
          kepuasanMin: cfg.tantangan.kepuasanMin,
          daftar: tg.daftar.map((x) => ({
            jenis: x.jenis,
            target: x.target,
            progres: x.progres,
            rasio: x.target > 0 ? Math.min(1, x.progres / x.target) : 1,
            selesai: x.progres >= x.target,
            diklaim: x.diklaim,
          })),
        };
  const hariIni = state.keuangan.hariIni;
  const rekor: ModelRekor = {
    penumpangHariIni: hariIni.penumpang,
    labaHariIni: labaBuku(hariIni),
    penumpangHarian: state.rekor.penumpangHarian,
    labaHarian: state.rekor.labaHarian,
    arusTertinggi: state.rekor.arusTertinggi,
  };
  const peringkat: ModelPeringkat = {
    minggu: tg.minggu,
    selesaiMs: tg.selesaiMs,
    penumpang: tg.penumpang,
    ikut: state.profil.ikutPeringkat,
    nama: state.profil.namaTerminal,
    kelas: kelasTerminal(state, cfg),
  };
  const jumlahKlaim =
    (bisaKlaimTarget(state) ? 1 : 0) +
    (bisaKlaimEv ? 1 : 0) +
    pencapaian.filter((p) => p.tercapai && !p.diklaim).length +
    tg.daftar.filter((_, i) => bisaKlaimTantangan(state, i)).length;
  return { event, mingguan, rekor, peringkat, target, pencapaian, hadiahPencapaian: hadiahMenit(state, cfg.hadiahMenitPencapaian, cfg), jumlahKlaim };
}
