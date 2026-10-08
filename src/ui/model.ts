/**
 * View model: semua angka yang ditampilkan UI, diturunkan dari GameState
 * lewat fungsi sim. UI tidak menghitung ekonomi sendiri. Murni, tanpa DOM.
 */
import Decimal from 'break_infinity.js';
import { EKONOMI, type KonfigEkonomi, type TingkatPo } from '../config/economy.config';
import { WAKTU } from '../config/waktu.config';
import { biayaKepala, kapasitas, pendapatanUntukPoin, progresMilestone, type ProgresMilestone } from '../sim/economy';
import { EVENT_IDS, KELAS_BUS_IDS, PENCAPAIAN_IDS, PO_IDS, FASILITAS_IDS, TEKNOLOGI_IDS, type EventId, type FasilitasId, type JenisTarget, type KelasBusId, type PencapaianId, type PoId, type TeknologiId } from '../sim/fitur';
import { kelasDariLevel, levelMinimalKelas, xpKumulatifTerminal } from '../sim/level-terminal';
import { biayaDaftarPo, jatahLoket, jurusanAktif, kelasAktif, nilaiJurusan, nilaiTiketPo, xpKumulatifPo, xpLevelPo } from '../sim/mitra';
import { bonusJatahPerluasan } from '../sim/perluasan';
import {
  biayaFasilitas,
  biayaJalurBerikutnya,
  biayaLoketBaru,
  biayaPerpanjangPo,
  biayaUpgradeState,
  bisaBangunFasilitas,
  bisaBangunLoket,
  bisaBeliTeknologi,
  bisaBukaJalur,
  bisaDaftarPo,
  bisaKlaimEvent,
  bisaKlaimTantangan,
  bisaKlaimTarget,
  bisaMulaiPerluasan,
  bisaPerpanjangPo,
  bisaPutusPo,
  bisaRekrutKepala,
  bisaRenovasi,
  bisaUpgrade,
  bonusKepuasan,
  daftarBottleneckState,
  dayaTarikKepuasan,
  DETIK_SEHARI,
  hadiahMenit,
  hadiahTahapEvent,
  hadiahTantangan,
  idEdisiEvent,
  jumlahJalurMaks,
  kapasitasTahap,
  kelasBusBeroperasi,
  kelasTerminal,
  kepuasanTerminal,
  levelPo,
  levelTerminal,
  loketTerisi,
  multJalur,
  multTeknologi,
  nilaiFasilitas,
  nilaiPerPenumpangState,
  pengaliEvent,
  permintaanPenumpang,
  poinRenovasiTersedia,
  poTujuanLoket,
  rincianPendapatan,
  saranHargaPo,
  segmenState,
  slotPoState,
  syaratDaftarPoKurang,
  syaratTeknologi,
  tahapBottleneck,
  targetHarianSelesai,
  throughputState,
  type GameState,
  type KurangDaftarPo,
} from '../sim/state';
import { TAHAP_IDS, type TahapId } from '../sim/tahap';
import { cuacaTerminalState } from '../sim/cuaca';
import type { HasilSegmen } from '../sim/segmen';
import type { JenisTantangan } from '../sim/tantangan';
import { keramaianTerminal, tingkatKeramaian, waktuTerminalState, type TingkatKeramaian } from '../sim/waktu';
import { NAMA_HARI, NAMA_TAHAP } from './teks';

export interface ModelTahap {
  readonly id: TahapId;
  readonly level: number;
  readonly kapasitas: number;
  readonly kapasitasSetelahUpgrade: number;
  readonly biayaUpgrade: Decimal;
  readonly bisaUpgrade: boolean;
  readonly punyaKepala: boolean;
  readonly biayaKepala: Decimal;
  readonly bisaRekrutKepala: boolean;
  readonly bottleneck: boolean;
  readonly milestone: ProgresMilestone;
  readonly multMilestone: number;
  /**
   * Hanya tahap Loket: PO yang menerima loket baru (null = jatah semua PO penuh)
   * dan loket kosong (milik terminal, belum disewa PO).
   */
  readonly loket?: { readonly tujuan: PoId | null; readonly kosong: number };
}

export interface ModelHud {
  readonly uang: Decimal;
  /** Pendapatan operasi & tiket terjual hari ini (hari terminal); uang masuk per transaksi, bukan per detik. */
  readonly hariIni: { readonly pendapatan: number; readonly tiket: number };
  /** Boost pendapatan iklan sedang berjalan. */
  readonly boostAktif: boolean;
  /** Arus nyata (kapasitas × keterisian) dan kapasitas terminal. */
  readonly arusAktif: number;
  readonly arusPotensial: number;
  /** Ketiga tahap punya Kepala (terminal tetap jalan saat game ditutup). */
  readonly semuaOtomatis: boolean;
  readonly waktu: ModelWaktu;
  /** Kelas terminal (lihat namaKelas di teks.ts). */
  readonly kelas: number;
  /** Level terminal. */
  readonly level: number;
  readonly kepuasan: ModelKepuasan;
}

/** Kepuasan penumpang (HUD & popup): komponen, kebutuhan, bonus, dan tahap paling lambat untuk saran. */
export interface ModelKepuasan {
  readonly nilai: number;
  readonly kelancaran: number;
  readonly fasilitas: number;
  readonly jalur: number;
  readonly levelFasilitas: number;
  readonly fasilitasPerlu: number;
  readonly jumlahJalur: number;
  readonly jalurPerlu: number;
  /** Bonus pendapatan sekarang (0.17 = +17%), paling besar, dan kepuasan tempat bonus mulai. */
  readonly bonus: number;
  readonly bonusMaks: number;
  readonly bonusMulai: number;
  /** Calon penumpang tambahan berkat kepuasan (0.4 = +40 % dibanding kepuasan 0). */
  readonly tambahanPenumpang: number;
  /** Bagian kapasitas yang terisi penumpang sekarang (0–1; malam lebih sepi). */
  readonly keterisian: number;
  readonly tahapLambat: TahapId;
}

/** Jam terminal di HUD. */
export interface ModelWaktu {
  readonly hari: string;
  /** "HH:MM", 24 jam. */
  readonly jam: string;
  readonly siang: boolean;
  /** Minggu ditandai merah seperti kalender. */
  readonly hariMinggu: boolean;
  /** Keramaian penumpang menurut jam & hari (ritme harian, murni tampilan). */
  readonly keramaian: TingkatKeramaian;
  /** Sedang hujan (ikon awan hujan menggantikan matahari/bulan). */
  readonly hujan: boolean;
}

const duaDigit = (n: number): string => String(n).padStart(2, '0');
/** Mulai sederas ini HUD menampilkan ikon hujan. */
const AMBANG_IKON_HUJAN = 0.08;

export interface ModelFasilitas {
  readonly id: FasilitasId;
  readonly level: number;
  /** Efek sekarang & tambahan per level (arti per fasilitas: lihat KonfigFasilitas). */
  readonly nilaiSekarang: number;
  readonly nilaiPerLevel: number;
  /** Kios: perkiraan sewa per hari terminal (dengan arus sekarang) & yang sudah terkumpul hari ini. */
  readonly sewaPerHari: Decimal;
  readonly terkumpul: Decimal;
  readonly biaya: Decimal;
  readonly bisa: boolean;
}

/** Jalur bus (tab Fasilitas): berapa yang beroperasi, pengali Peron & Keberangkatan, dan jalur berikutnya. */
export interface ModelJalur {
  readonly jumlah: number;
  readonly maks: number;
  readonly mult: number;
  readonly multBerikut: number;
  /** null = semua jalur sudah beroperasi. */
  readonly biaya: Decimal | null;
  readonly bisa: boolean;
}

/** Harga tiket satu jurusan PO, dalam Rupiah (kelas Ekonomi; kelas lain ikut berlipat) & persen harga normal. */
export interface ModelHargaPo {
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
  /** Harga tiket kelas Ekonomi: normal (100 %), sekarang, perubahan tiap ketukan, dan saran (Rp). */
  readonly normalRupiah: number;
  readonly rupiah: number;
  readonly langkahRupiah: number;
  readonly saranRupiah: number;
  /** Nilai yang dikirim ke sim (persen harga normal): sekarang, langkah, saran. */
  readonly persen: number;
  readonly langkah: number;
  readonly saranPersen: number;
  readonly bisaTurun: boolean;
  readonly bisaNaik: boolean;
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
  readonly loket: number;
  readonly jatah: number;
  readonly biayaLoket: Decimal;
  readonly bisaTambahLoket: boolean;
  /** 0–100. */
  readonly reputasi: number;
  readonly kelas: readonly KelasBusId[];
  /** Kelas bus berikutnya yang terbuka seiring level (null = sudah semua yang boleh untuk tingkatnya). */
  readonly kelasBerikut: { readonly kelas: KelasBusId; readonly level: number; readonly kurangKelas: number | null } | null;
  readonly jurusan: readonly ModelHargaPo[];
  /** Bagian semua penumpang terminal yang naik bus PO ini (0–1), dan kursinya yang terisi (0–1). */
  readonly bagian: number;
  readonly terisi: number;
  /** Harga rata-rata PO ini (persen harga normal): dasar reputasinya. */
  readonly hargaRata: number;
  /** Sisa kontrak (hari terminal), biaya & bisa tidaknya perpanjang, dan bisa tidaknya diputus. */
  readonly kontrakHari: number;
  readonly kontrakPenuh: boolean;
  readonly biayaPerpanjang: Decimal;
  readonly bisaPerpanjang: boolean;
  /** PO premium menolak memperpanjang karena kepuasan di bawah syaratnya (kepuasanMin; null = tanpa syarat). */
  readonly menolakPerpanjang: boolean;
  readonly kepuasanMin: number | null;
  readonly bisaPutus: boolean;
}

/** PO yang belum terdaftar (daftar di bawah kartu PO). */
export interface ModelPoTersedia {
  readonly id: PoId;
  readonly tingkat: TingkatPo;
  /** Nama jurusan (urut terbuka: Lv 1, Lv 6, Lv 12). */
  readonly jurusan: readonly string[];
  readonly biaya: Decimal;
  readonly bisa: boolean;
  /** Syarat yang belum terpenuhi (null = tinggal uangnya). */
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
  readonly loketKosong: number;
  /** Ada PO yang jatahnya masih cukup untuk menyewa loket kosong. */
  readonly bisaIsiLoket: boolean;
  /** Harga tiket normal rata-rata per penumpang & yang benar-benar dibayar sekarang. */
  readonly nilaiPerPenumpang: number;
  readonly nilaiDibayar: number;
  /** Kursi terminal yang terisi sekarang (0–1). */
  readonly terisi: number;
  /** Aturan kontrak untuk keterangan: lama paling panjang, penalti reputasi & jeda bila diputus (hari terminal). */
  readonly kontrak: { readonly hariMaks: number; readonly penaltiPutus: number; readonly jedaHari: number };
}

/** Tahap perluasan terminal (tab Terminal). */
export interface ModelPerluasan {
  readonly selesai: number;
  readonly jumlah: number;
  /** Proyek yang sedang dibangun: tahap (1-based), sisa detik main, kemajuan 0–1. */
  readonly proyek: { readonly tahap: number; readonly sisaDetik: number; readonly rasio: number } | null;
  /** Tahap berikutnya (null = semua sudah dibangun). */
  readonly berikut: { readonly tahap: number; readonly level: number; readonly biaya: Decimal; readonly jatah: number; readonly bisa: boolean; readonly levelKurang: boolean } | null;
  /** Tambahan jatah loket semua PO dari tahap yang sudah selesai. */
  readonly bonusJatah: number;
}

/** Renovasi (pengganti prestige): poin & bonus sekarang, poin bila Renovasi sekarang, dan kemajuan menuju poin minimal. */
export interface ModelRenovasi {
  readonly jumlah: number;
  readonly poin: number;
  readonly bonus: number;
  readonly poinTersedia: number;
  readonly bonusSetelah: number;
  readonly poinMin: number;
  readonly bisa: boolean;
  readonly pendapatanRun: Decimal;
  readonly pendapatanPerlu: Decimal;
  readonly rasio: number;
}

/** Level & kelas terminal, perluasan, Renovasi (tab Terminal; kartu level di tab Target). */
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
  /** Bonus pendapatan dari level (0.36 = +36 %). */
  readonly bonusLevel: number;
  /** Level saat kelas berikutnya tercapai. */
  readonly levelKelasBerikut: number;
  readonly slot: number;
  readonly perluasan: ModelPerluasan;
  readonly renovasi: ModelRenovasi;
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
  /** Pengali pendapatan selama event. */
  readonly pengali: number;
  /** Tahap berikutnya (0-based) & banyaknya tahap; tahap = jumlahTahap berarti semua sudah diklaim. */
  readonly tahap: number;
  readonly jumlahTahap: number;
  readonly target: number;
  readonly progres: number;
  readonly rasio: number;
  readonly bisaKlaim: boolean;
  readonly hadiah: Decimal;
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

/** Tantangan minggu ini; hadiah tiap tantangan sama (sekian menit pendapatan sekarang). */
export interface ModelMingguan {
  readonly selesaiMs: number;
  readonly daftar: readonly ModelTantangan[];
  readonly hadiah: Decimal;
  readonly kepuasanMin: number;
}

/** Rekor pribadi & hitungan hari terminal ini. */
export interface ModelRekor {
  readonly penumpangHariIni: number;
  readonly pendapatanHariIni: number;
  readonly penumpangHarian: number;
  readonly pendapatanHarian: number;
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

export interface ModelTeknologi {
  readonly id: TeknologiId;
  readonly tahap: TahapId;
  readonly namaTahap: string;
  readonly multKapasitas: number;
  readonly biaya: Decimal;
  readonly dimiliki: boolean;
  /** Teknologi pendahulu yang belum dipasang, null kalau syarat terpenuhi. */
  readonly syaratKurang: TeknologiId | null;
  readonly bisa: boolean;
}

export interface ModelTarget {
  readonly hari: string;
  readonly jenis: JenisTarget;
  readonly target: number;
  readonly progres: number;
  readonly rasio: number;
  readonly selesai: boolean;
  readonly diklaim: boolean;
  readonly hadiah: Decimal;
}

export interface ModelPencapaian {
  readonly id: PencapaianId;
  readonly tercapai: boolean;
  readonly diklaim: boolean;
}

export interface ModelTampilan {
  readonly hud: ModelHud;
  readonly tahap: Readonly<Record<TahapId, ModelTahap>>;
  readonly fasilitas: readonly ModelFasilitas[];
  readonly jalur: ModelJalur;
  readonly mitra: ModelMitra;
  readonly terminal: ModelTerminal;
  readonly event: ModelEvent | null;
  readonly mingguan: ModelMingguan | null;
  readonly rekor: ModelRekor;
  readonly peringkat: ModelPeringkat;
  readonly teknologi: readonly ModelTeknologi[];
  readonly target: ModelTarget;
  readonly pencapaian: readonly ModelPencapaian[];
  /** Hadiah pencapaian (sama untuk semua, sebanding pendapatan sekarang). */
  readonly hadiahPencapaian: Decimal;
  /** Banyaknya hadiah yang siap diklaim (target + pencapaian), untuk lencana tab. */
  readonly jumlahKlaim: number;
  /** Sewa kios terakhir yang dibayar (notifikasi saat hari berganti). */
  readonly sewaKios: { readonly terakhir: Decimal; readonly hari: string | null; readonly hariKe: number };
}

export function buatModel(state: GameState, cfg: KonfigEkonomi = EKONOMI): ModelTampilan {
  const bottleneck = new Set(daftarBottleneckState(state, cfg));
  const tahap = {} as Record<TahapId, ModelTahap>;
  for (const id of TAHAP_IDS) {
    const t = state.terminal.tahap[id];
    const loket = id === 'loket';
    tahap[id] = {
      id,
      level: t.level,
      kapasitas: kapasitasTahap(state, id, cfg),
      // Loket: kapasitas dari loket yang disewa PO, ditambah satu.
      kapasitasSetelahUpgrade: loket
        ? kapasitas('loket', loketTerisi(state) + 1, cfg) * multTeknologi(state, id, cfg)
        : kapasitas(id, t.level + 1, cfg) * multTeknologi(state, id, cfg) * multJalur(state, id, cfg),
      biayaUpgrade: biayaUpgradeState(state, id, cfg),
      bisaUpgrade: bisaUpgrade(state, id, cfg),
      punyaKepala: t.kepala.direkrut,
      biayaKepala: biayaKepala(id, cfg),
      bisaRekrutKepala: bisaRekrutKepala(state, id, cfg),
      bottleneck: bottleneck.has(id),
      milestone: progresMilestone(loket ? Math.max(1, loketTerisi(state)) : t.level, cfg),
      multMilestone: cfg.multMilestone,
      ...(loket ? { loket: { tujuan: poTujuanLoket(state, cfg), kosong: state.terminal.loketKosong } } : {}),
    };
  }
  const kepuasan = kepuasanTerminal(state, cfg);
  // Kursi terisi per PO sekarang (kepuasan, jam, reputasi, harga tiket).
  const seg = segmenState(state, permintaanPenumpang(state, cfg), cfg);
  const w = waktuTerminalState(state);
  return {
    hud: {
      uang: state.uang,
      // Hasil operasi hari ini (tiket, parkir bus & kendaraan, belanja kios yang jadi sewa).
      hariIni: { pendapatan: state.rekor.pendapatanHariIni, tiket: Math.floor(state.rekor.penumpangHariIni + 1e-9) },
      boostAktif: state.hadiah.boostDetik > 0,
      arusAktif: throughputState(state, 'aktif', cfg),
      arusPotensial: throughputState(state, 'potensial', cfg),
      semuaOtomatis: TAHAP_IDS.every((id) => tahap[id].punyaKepala),
      kelas: kelasTerminal(state, cfg),
      level: levelTerminal(state, cfg),
      kepuasan: {
        nilai: kepuasan.nilai,
        kelancaran: kepuasan.kelancaran,
        fasilitas: kepuasan.fasilitas,
        jalur: kepuasan.jalur,
        levelFasilitas: state.terminal.fasilitas.kios + state.terminal.fasilitas.toilet,
        fasilitasPerlu: Math.ceil(kepuasan.fasilitasPerlu - 1e-9),
        jumlahJalur: state.terminal.jalur,
        jalurPerlu: kepuasan.jalurPerlu,
        bonus: bonusKepuasan(kepuasan.nilai, cfg),
        bonusMaks: cfg.kepuasan.bonusPendapatan,
        bonusMulai: cfg.kepuasan.bonusMulai,
        tambahanPenumpang: dayaTarikKepuasan(kepuasan.nilai, cfg) / dayaTarikKepuasan(0, cfg) - 1,
        keterisian: seg.terisi,
        tahapLambat: tahapBottleneck(state, cfg),
      },
      waktu: {
        hari: NAMA_HARI[w.indeksHari]!,
        jam: `${duaDigit(w.jam)}:${duaDigit(w.menit)}`,
        siang: w.siang,
        hariMinggu: w.indeksHari === NAMA_HARI.length - 1,
        keramaian: tingkatKeramaian(keramaianTerminal(w)),
        hujan: cuacaTerminalState(state).hujan > AMBANG_IKON_HUJAN,
      },
    },
    tahap,
    ...modelPengelolaan(state, NAMA_HARI[w.indeksHari]!, kepuasan.nilai, seg, cfg),
  };
}

/**
 * Saran harga per PO mahal dihitung (tiap jurusan × tiap harga × 24 jam), jadi
 * dihitung ulang hanya saat masukannya berubah cukup jauh: kepuasan, kelas
 * terminal, dan tiap PO (level, loket, reputasi dibulatkan per 5, harga).
 */
let saranTerakhir: { readonly kunci: string; readonly cfg: KonfigEkonomi; readonly hasil: ReadonlyMap<PoId, Readonly<Record<number, number>>> } | null = null;

function saranTersimpan(state: GameState, kepuasan: number, cfg: KonfigEkonomi): ReadonlyMap<PoId, Readonly<Record<number, number>>> {
  const po = state.mitra.terdaftar.map((p) => `${p.id}:${levelPo(p, cfg)}:${p.loket}:${Math.round(p.reputasi / 5)}:${JSON.stringify(p.harga)}`).join(',');
  const kunci = `${Math.round(kepuasan * 100)}|${kelasTerminal(state, cfg)}|${po}`;
  if (saranTerakhir && saranTerakhir.kunci === kunci && saranTerakhir.cfg === cfg) return saranTerakhir.hasil;
  const hasil = new Map<PoId, Readonly<Record<number, number>>>();
  for (const p of state.mitra.terdaftar) hasil.set(p.id, saranHargaPo(state, p.id, cfg));
  saranTerakhir = { kunci, cfg, hasil };
  return hasil;
}

/** Mitra PO: kartu PO terdaftar (level, loket, reputasi, jurusan & harga, kontrak) dan PO yang bisa didaftarkan. */
function modelMitra(state: GameState, kepuasan: number, seg: HasilSegmen, cfg: KonfigEkonomi): ModelMitra {
  const ch = cfg.harga;
  const kelas = kelasTerminal(state, cfg);
  const level = levelTerminal(state, cfg);
  const saran = saranTersimpan(state, kepuasan, cfg);
  const bonusPerluasan = bonusJatahPerluasan(state.perkembangan.perluasan, cfg);
  const biayaLoket = biayaLoketBaru(state, cfg);
  const terdaftar = state.mitra.terdaftar.map((p, i): ModelPoTerdaftar => {
    const lv = levelPo(p, cfg);
    const aktif = new Set(jurusanAktif(p.id, lv, kelas, cfg));
    const hasil = seg.po[i];
    const tingkat = cfg.mitra.tingkat[cfg.mitra.po[p.id].tingkat];
    const kelasBerikutId = KELAS_BUS_IDS.find((k, ki) => ki < tingkat.kelasMaks && !kelasAktif(p.id, lv, kelas, cfg).includes(k));
    const saranPo = saran.get(p.id) ?? {};
    const k = cfg.mitra.kontrak;
    const min = cfg.mitra.po[p.id].kepuasanMin;
    return {
      id: p.id,
      tingkat: cfg.mitra.po[p.id].tingkat,
      level: lv,
      xpDalamLevel: p.xp - xpKumulatifPo(lv, cfg),
      xpLevel: xpLevelPo(lv, cfg),
      rasioXp: Math.min(1, Math.max(0, (p.xp - xpKumulatifPo(lv, cfg)) / xpLevelPo(lv, cfg))),
      loket: p.loket,
      jatah: jatahLoket(lv, bonusPerluasan, cfg),
      biayaLoket,
      bisaTambahLoket: bisaBangunLoket(state, p.id, cfg),
      reputasi: p.reputasi,
      kelas: kelasAktif(p.id, lv, kelas, cfg),
      kelasBerikut: kelasBerikutId
        ? { kelas: kelasBerikutId, level: cfg.mitra.kelas[kelasBerikutId].levelPo, kurangKelas: cfg.kelasBus[kelasBerikutId].kelasTerminal > kelas ? cfg.kelasBus[kelasBerikutId].kelasTerminal : null }
        : null,
      jurusan: cfg.mitra.po[p.id].jurusan.map((nama, ji): ModelHargaPo => {
        const j = cfg.jurusan.findIndex((x) => x.nama === nama);
        const persen = p.harga[j] ?? 100;
        const normal = cfg.nilaiPerPenumpang * nilaiJurusan(j, cfg) * nilaiTiketPo(lv, cfg);
        const saranPersen = saranPo[j] ?? 100;
        const kurang = cfg.jurusan[j]?.kelasTerminal ?? 0;
        return {
          jurusan: j,
          nama,
          feri: cfg.jurusan[j]?.feri ?? null,
          aktif: aktif.has(j),
          levelBuka: cfg.mitra.levelJurusan[ji] ?? 1,
          kurangKelas: kurang > kelas ? kurang : null,
          normalRupiah: normal,
          rupiah: (normal * persen) / 100,
          langkahRupiah: (normal * ch.langkah) / 100,
          saranRupiah: (normal * saranPersen) / 100,
          persen,
          langkah: ch.langkah,
          saranPersen,
          bisaTurun: persen > ch.min,
          bisaNaik: persen < ch.maks,
        };
      }),
      bagian: hasil && seg.terisi > 0 ? hasil.terisi / seg.terisi : 0,
      terisi: hasil && hasil.kursi > 0 ? hasil.terisi / hasil.kursi : 0,
      hargaRata: hasil?.hargaRataPersen ?? 100,
      kontrakHari: p.kontrakDetik / DETIK_SEHARI,
      kontrakPenuh: p.kontrakDetik >= k.hariMaks * DETIK_SEHARI - 1e-6,
      biayaPerpanjang: biayaPerpanjangPo(state, p.id, cfg),
      bisaPerpanjang: bisaPerpanjangPo(state, p.id, cfg),
      menolakPerpanjang: min !== undefined && kepuasan < min,
      kepuasanMin: min ?? null,
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
        levelRiwayat: riwayat ? levelPoDariRiwayat(riwayat.xp, cfg) : null,
        jedaHari: kurang?.jenis === 'jeda' ? (kurang.sampaiDetik - state.statistik.waktuMainDetik) / DETIK_SEHARI : null,
        hadiah: po.sumber === 'hadiahKelas' || po.sumber === 'hadiahEvent',
        event: EVENT_IDS.find((e) => cfg.event[e].po === id) ?? null,
      };
    })
    // Yang bisa didaftarkan (atau tinggal slot/uang) lebih dulu, lalu yang terkunci kelas/event/kepuasan;
    // di tiap golongan yang termurah dulu (PO kedua yang disarankan tutorial ada di paling atas).
    .sort((a, b) => urutanTersedia(a) - urutanTersedia(b) || a.biaya.cmp(b.biaya));
  const slot = slotPoState(state, cfg);
  const slotBerikut = cfg.mitra.terminal.slot.find(([lv, n]) => lv > level && n > slot);
  const normal = nilaiPerPenumpangState(state, cfg);
  return {
    terdaftar,
    tersedia,
    slot,
    slotBerikut: slotBerikut ? { level: slotBerikut[0], slot: slotBerikut[1] } : null,
    loketKosong: state.terminal.loketKosong,
    bisaIsiLoket: state.terminal.loketKosong > 0 && poTujuanLoket(state, cfg) !== null,
    nilaiPerPenumpang: normal,
    nilaiDibayar: seg.terisi > 0 ? seg.tiket / seg.terisi : normal,
    terisi: seg.terisi,
    kontrak: { hariMaks: cfg.mitra.kontrak.hariMaks, penaltiPutus: cfg.mitra.kontrak.penaltiReputasiPutus, jedaHari: cfg.mitra.kontrak.jedaPutusHari },
  };
}

function levelPoDariRiwayat(xp: number, cfg: KonfigEkonomi): number {
  let lv = 1;
  while (xpKumulatifPo(lv + 1, cfg) <= xp) lv++;
  return lv;
}

function urutanTersedia(p: ModelPoTersedia): number {
  if (!p.kurang) return 0;
  switch (p.kurang.jenis) {
    case 'slot':
    case 'jeda':
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

/** Level & kelas terminal, perluasan, dan Renovasi. */
function modelTerminal(state: GameState, cfg: KonfigEkonomi): ModelTerminal {
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
        ? { tahap: p.perluasan + 1, level: tahapBerikut.level, biaya: new Decimal(tahapBerikut.biaya), jatah: tahapBerikut.jatah, bisa: bisaMulaiPerluasan(state, cfg), levelKurang: level < tahapBerikut.level }
        : null,
    bonusJatah: bonusJatahPerluasan(p.perluasan, cfg),
  };
  const poinTersedia = poinRenovasiTersedia(state, cfg).toNumber();
  const poinMin = cfg.mitra.poinMinRenovasi;
  const pendapatanPerlu = pendapatanUntukPoin(poinMin, cfg);
  const bonus = state.renovasi.poin.toNumber() * cfg.bonusPrestige;
  const renovasi: ModelRenovasi = {
    jumlah: state.renovasi.jumlah,
    poin: state.renovasi.poin.toNumber(),
    bonus,
    poinTersedia,
    bonusSetelah: bonus + poinTersedia * cfg.bonusPrestige,
    poinMin,
    bisa: bisaRenovasi(state, cfg),
    pendapatanRun: state.statistik.totalPendapatanRun,
    pendapatanPerlu,
    rasio: Math.min(1, state.statistik.totalPendapatanRun.div(pendapatanPerlu).toNumber()),
  };
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
    bonusLevel: cfg.mitra.terminal.bonusPerLevel * (level - 1),
    levelKelasBerikut: levelMinimalKelas(kelas + 1, cfg),
    slot: slotPoState(state, cfg),
    perluasan,
    renovasi,
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

/** Fasilitas, mitra PO, terminal, modernisasi, target harian, dan pencapaian. */
function modelPengelolaan(state: GameState, hari: string, kepuasan: number, seg: HasilSegmen, cfg: KonfigEkonomi): Omit<ModelTampilan, 'hud' | 'tahap'> {
  const sewaPerHari = rincianPendapatan(state, 'potensial', cfg).sewaKios.times(24 * WAKTU.detikPerJam).floor();
  const fasilitas = FASILITAS_IDS.map(
    (id): ModelFasilitas => ({
      sewaPerHari,
      terkumpul: state.sewaKios.terkumpul,
      id,
      level: state.terminal.fasilitas[id],
      nilaiSekarang: nilaiFasilitas(state, id, cfg),
      nilaiPerLevel: cfg.fasilitas[id].nilaiPerLevel,
      biaya: biayaFasilitas(state, id, cfg),
      bisa: bisaBangunFasilitas(state, id, cfg),
    }),
  );
  const jumlahJalur = state.terminal.jalur;
  const jalur: ModelJalur = {
    jumlah: jumlahJalur,
    maks: jumlahJalurMaks(cfg),
    mult: multJalur(state, 'peron', cfg),
    multBerikut: 1 + cfg.jalur.bonusKapasitas * jumlahJalur,
    biaya: biayaJalurBerikutnya(state, cfg),
    bisa: bisaBukaJalur(state, cfg),
  };
  const e = state.event;
  const idEvent = idEdisiEvent(e.edisi);
  const bisaKlaimEv = bisaKlaimEvent(state);
  const event: ModelEvent | null =
    idEvent && (e.aktif !== null || bisaKlaimEv)
      ? {
          id: idEvent,
          tahun: e.edisi?.split('-')[1]?.replace('uji', '') ?? '',
          aktif: e.aktif !== null,
          selesaiMs: e.aktif?.selesaiMs ?? null,
          pengali: pengaliEvent(state, cfg),
          tahap: e.diklaim,
          jumlahTahap: e.target.length,
          target: e.target[Math.min(e.diklaim, e.target.length - 1)] ?? 0,
          progres: e.progres,
          rasio: Math.min(1, e.progres / Math.max(1, e.target[Math.min(e.diklaim, e.target.length - 1)] ?? 1)),
          bisaKlaim: bisaKlaimEv,
          hadiah: hadiahTahapEvent(state, cfg),
          po: cfg.event[idEvent].po,
          poSudah: state.mitra.hadiahEvent.includes(cfg.event[idEvent].po),
        }
      : null;
  const teknologi = TEKNOLOGI_IDS.map((id): ModelTeknologi => {
    const t = cfg.teknologi[id];
    return {
      id,
      tahap: t.tahap,
      namaTahap: NAMA_TAHAP[t.tahap],
      multKapasitas: t.multKapasitas,
      biaya: new Decimal(t.biaya),
      dimiliki: state.terminal.teknologi[id],
      syaratKurang: syaratTeknologi(state, id, cfg) ? null : t.syarat,
      bisa: bisaBeliTeknologi(state, id, cfg),
    };
  });
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
  const pencapaian = PENCAPAIAN_IDS.map(
    (id): ModelPencapaian => ({ id, tercapai: state.pencapaian.tercapai.includes(id), diklaim: state.pencapaian.diklaim.includes(id) }),
  );
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
  const rekor: ModelRekor = { ...state.rekor };
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
    (bisaKlaimEvent(state) ? 1 : 0) +
    pencapaian.filter((p) => p.tercapai && !p.diklaim).length +
    tg.daftar.filter((_, i) => bisaKlaimTantangan(state, i)).length;
  const k = state.sewaKios;
  const sewaKios = { terakhir: k.terakhir, hariKe: k.hariTerakhir, hari: k.hariTerakhir >= 0 ? NAMA_HARI[k.hariTerakhir % NAMA_HARI.length]! : null };
  return {
    fasilitas,
    jalur,
    mitra: modelMitra(state, kepuasan, seg, cfg),
    terminal: modelTerminal(state, cfg),
    event,
    mingguan,
    rekor,
    peringkat,
    teknologi,
    target,
    pencapaian,
    hadiahPencapaian: hadiahMenit(state, cfg.hadiahMenitPencapaian, cfg),
    jumlahKlaim,
    sewaKios,
  };
}
