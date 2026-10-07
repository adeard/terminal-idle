/**
 * View model: semua angka yang ditampilkan UI, diturunkan dari GameState
 * lewat fungsi sim. UI tidak menghitung ekonomi sendiri. Murni, tanpa DOM.
 */
import Decimal from 'break_infinity.js';
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { WAKTU } from '../config/waktu.config';
import { biayaKepala, kapasitas, pendapatanUntukPoin, progresMilestone, type ProgresMilestone } from '../sim/economy';
import {
  biayaFasilitas,
  bisaKlaimEvent,
  hadiahTahapEvent,
  idEdisiEvent,
  pengaliEvent,
  bisaNaikKelas,
  kelasTerminal,
  poinMinimalNaikKelas,
  poinPrestigeTersedia,
  biayaKontrakPo,
  biayaUpgradeState,
  bisaKontrakPo,
  bisaKlaimTantangan,
  hadiahTantangan,
  kepuasanMinPo,
  kepuasanTerminal,
  bonusKepuasan,
  tahapBottleneck,
  bisaBeliKelasBus,
  kelasBusBeroperasi,
  multKelasBus,
  syaratKelasBusKurang,
  multPo,
  poBergabung,
  bisaBangunFasilitas,
  bisaBeliTeknologi,
  bisaBukaJurusan,
  biayaJalurBerikutnya,
  bisaBukaJalur,
  jumlahJalurMaks,
  multJalur,
  kelasKurangJurusan,
  bisaKlaimTarget,
  bisaRekrutKepala,
  bisaUpgrade,
  hadiahMenit,
  multJurusan,
  multTeknologi,
  nilaiFasilitas,
  rincianPendapatan,
  nilaiPerPenumpangState,
  syaratTeknologi,
  targetHarianSelesai,
  arusHarga,
  kelebihanHarga,
  saranHarga,
  type SaranHarga,
  daftarBottleneckState,
  dayaTarikKepuasan,
  faktorPeminat,
  kapasitasTahap,
  permintaanPenumpang,
  throughputState,
  type ArusHarga,
  type GameState,
} from '../sim/state';
import { FASILITAS_IDS, KELAS_BUS_IDS, PENCAPAIAN_IDS, PO_IDS, TEKNOLOGI_IDS, type EventId, type FasilitasId, type JenisTarget, type KelasBusId, type PencapaianId, type PoId, type TeknologiId } from '../sim/fitur';
import { TAHAP_IDS, type TahapId } from '../sim/tahap';
import { cuacaTerminalState } from '../sim/cuaca';
import type { Kepuasan } from '../sim/kepuasan';
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
  /** Bagian kepuasan yang hilang karena tiket terlalu mahal (0 = harga wajar). */
  readonly penaltiHarga: number;
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

/**
 * Harga tiket yang diatur pemain, dalam Rupiah: harga jurusan, atau tambahan
 * harga kelas bus (tiket = harga jurusan + tambahan kelas; lihat EKONOMI.harga).
 */
export interface ModelHarga {
  /** Harga sekarang, perubahan tiap ketukan −/+, dan saran (Rp). */
  readonly rupiah: number;
  readonly langkahRupiah: number;
  readonly saranRupiah: number;
  /** Nilai yang dikirim ke sim (persen harga normal): sekarang, langkah, saran. */
  readonly persen: number;
  readonly langkah: number;
  readonly saranPersen: number;
  readonly bisaTurun: boolean;
  readonly bisaNaik: boolean;
  /** Calon penumpang karena harga dibanding harga normal (−0.2 = −20 %). */
  readonly peminat: number;
  /** Kursinya yang terisi sekarang (0–1), dan calon penumpang dibanding kursinya (> 1 = penuh, ada yang tidak terangkut). */
  readonly terisi: number;
  readonly minat: number;
  /**
   * Harga ini ikut membuat tiket melewati harga yang diterima penumpang (kepuasan turun):
   * jurusan di atas harga normal, atau kelas dengan tambahan, yang segmennya kemahalan.
   */
  readonly terlaluMahal: boolean;
}

export interface ModelJurusan {
  /** `feri`: penyeberangan rute antarpulau, null untuk jurusan Jawa–Bali; `harga` null bila belum dibuka. */
  readonly daftar: readonly { readonly nama: string; readonly buka: boolean; readonly bonusTiket: number; readonly feri: string | null; readonly harga: ModelHarga | null }[];
  /** Jurusan berikutnya yang bisa dibuka, null kalau semua sudah dibuka. */
  readonly berikutnya: {
    readonly nama: string;
    readonly biaya: Decimal;
    readonly bonusTiket: number;
    readonly bisa: boolean;
    /** Mitra PO yang ikut bergabung saat jurusan ini dibuka. */
    readonly po: PoId | null;
    /** Penyeberangan feri bila rute antarpulau. */
    readonly feri: string | null;
    /** Kelas terminal minimal yang belum tercapai untuk membukanya, null kalau sudah. */
    readonly kurangKelas: number | null;
  } | null;
  readonly multTiket: number;
  /** Harga tiket normal per penumpang, dan rata-rata yang benar-benar dibayar (ikut harga yang diatur). */
  readonly nilaiPerPenumpang: number;
  readonly nilaiDibayar: number;
  /** Kursi terminal yang terisi sekarang (0–1). */
  readonly terisi: number;
  /** Harga tiket tertinggi yang masih diterima penumpang (Rp), dan kepuasan yang hilang karena tiket terlalu mahal. */
  readonly batasWajar: number;
  readonly penaltiHarga: number;
}

export interface ModelPo {
  readonly id: PoId;
  readonly bergabung: boolean;
  /** Cara bergabung: bersama jurusan (nama kota), atau kontrak (biaya).  */
  readonly syarat:
    | { readonly jenis: 'jurusan'; readonly kota: string }
    /** `kepuasanMin`: syarat kepuasan (0–1) atau null; `kepuasanKurang`: syarat itu belum terpenuhi. */
    | { readonly jenis: 'kontrak'; readonly biaya: Decimal; readonly bisa: boolean; readonly kepuasanMin: number | null; readonly kepuasanKurang: boolean }
    | { readonly jenis: 'kelas'; readonly kelas: number }
    | { readonly jenis: 'event'; readonly event: EventId };
}

export interface ModelKelasBus {
  readonly id: KelasBusId;
  readonly beroperasi: boolean;
  /** Tambahan harga tiket kelas ini (0.1 = +10%). */
  readonly bonusTiket: number;
  readonly biaya: Decimal;
  readonly bisa: boolean;
  /** Syarat yang belum terpenuhi: kelas bus sebelumnya, atau kelas terminal minimal. */
  readonly kurang: { readonly jenis: 'sebelumnya'; readonly kelas: KelasBusId } | { readonly jenis: 'terminal'; readonly kelas: number } | null;
  /** Harga tiket kelas ini; null bila belum beroperasi. */
  readonly harga: ModelHarga | null;
}

export interface ModelArmada {
  /** Kelas bus (urut ekonomi → double decker), banyaknya yang beroperasi, dan bonus tiketnya (0.3 = +30%). */
  readonly kelasBus: readonly ModelKelasBus[];
  readonly jumlahKelasBus: number;
  readonly bonusKelasBus: number;
  readonly daftar: readonly ModelPo[];
  /** Banyaknya mitra PO yang sudah bergabung. */
  readonly jumlah: number;
  /** Tambahan harga tiket dari semua mitra PO (0.09 = +9%) dan per PO. */
  readonly bonusTiket: number;
  readonly bonusPerPo: number;
}

/** Kelas terminal & naik kelas (prestige). */
export interface ModelKelas {
  readonly kelas: number;
  /** Bonus pendapatan permanen sekarang & setelah naik kelas (0.3 = +30%). */
  readonly bonus: number;
  readonly bonusSetelah: number;
  /** Poin yang didapat bila naik kelas sekarang, dan minimal yang dibutuhkan. */
  readonly poinTersedia: number;
  readonly poinMinimal: number;
  readonly bisa: boolean;
  /** Pendapatan run ini & yang dibutuhkan untuk poin minimal (kemajuan). */
  readonly pendapatanRun: Decimal;
  readonly pendapatanPerlu: Decimal;
  readonly rasio: number;
  /** Mitra PO yang bergabung sebagai hadiah kelas berikutnya. */
  readonly poHadiah: PoId | null;
  /** Kelas bus yang baru bisa didatangkan di kelas terminal berikutnya. */
  readonly kelasBusTerbuka: readonly KelasBusId[];
  /** Nama terminal pilihan pemain (kosong = bawaan). */
  readonly nama: string;
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
  /** PO eksklusif hadiah tahap terakhir & apakah sudah bergabung. */
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
  readonly jurusan: ModelJurusan;
  readonly armada: ModelArmada;
  readonly kelas: ModelKelas;
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
    tahap[id] = {
      id,
      level: t.level,
      kapasitas: kapasitasTahap(state, id, cfg),
      kapasitasSetelahUpgrade: kapasitas(id, t.level + 1, cfg) * multTeknologi(state, id, cfg) * multJalur(state, id, cfg),
      biayaUpgrade: biayaUpgradeState(state, id, cfg),
      bisaUpgrade: bisaUpgrade(state, id, cfg),
      punyaKepala: t.kepala.direkrut,
      biayaKepala: biayaKepala(id, cfg),
      bisaRekrutKepala: bisaRekrutKepala(state, id, cfg),
      bottleneck: bottleneck.has(id),
      milestone: progresMilestone(t.level, cfg),
      multMilestone: cfg.multMilestone,
    };
  }
  const kepuasan = kepuasanTerminal(state, cfg);
  // Kursi terisi per jurusan & kelas bus sekarang (kepuasan, jam, harga tiket).
  const ah = arusHarga(state, permintaanPenumpang(state, cfg), cfg);
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
      kelas: kelasTerminal(state),
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
        keterisian: ah.terisi,
        penaltiHarga: kepuasan.penaltiHarga,
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
    ...modelPengelolaan(state, NAMA_HARI[w.indeksHari]!, kepuasan, ah, cfg),
  };
}

/** Saran harga mahal dihitung (puluhan ribu langkah), jadi dihitung ulang hanya saat masukannya berubah. */
let saranTerakhir: { readonly kunci: string; readonly cfg: KonfigEkonomi; readonly hasil: SaranHarga } | null = null;

function saranTersimpan(state: GameState, kepuasan: number, cfg: KonfigEkonomi): SaranHarga {
  const kelas = KELAS_BUS_IDS.map((k) => (state.terminal.kelasBus[k] ? state.harga.tambahanKelas[k] : '-')).join(',');
  const kunci = `${Math.round(kepuasan * 1000)}|${state.terminal.jurusanBuka}|${kelas}|${state.harga.jurusan.join(',')}`;
  if (saranTerakhir && saranTerakhir.kunci === kunci && saranTerakhir.cfg === cfg) return saranTerakhir.hasil;
  const hasil = saranHarga(state, cfg);
  saranTerakhir = { kunci, cfg, hasil };
  return hasil;
}

/** Fasilitas, jurusan (& harga tiketnya), armada, modernisasi, target harian, dan pencapaian. */
function modelPengelolaan(state: GameState, hari: string, kepuasan: Kepuasan, ah: ArusHarga, cfg: KonfigEkonomi): Omit<ModelTampilan, 'hud' | 'tahap'> {
  // Harga tiket dalam Rupiah: persen tersimpan × harga normal sekarang.
  const ch = cfg.harga;
  const normal = nilaiPerPenumpangState(state, cfg);
  const saran = saranTersimpan(state, kepuasan.nilai, cfg);
  const lebih = kelebihanHarga(state, cfg);
  const harga = (persen: number, min: number, maks: number, saranPersen: number, peminat: number, terisi: number, minat: number, mahal: boolean): ModelHarga => ({
    rupiah: (normal * persen) / 100,
    langkahRupiah: (normal * ch.langkah) / 100,
    saranRupiah: (normal * saranPersen) / 100,
    persen,
    langkah: ch.langkah,
    saranPersen,
    bisaTurun: persen > min,
    bisaNaik: persen < maks,
    peminat,
    terisi,
    minat,
    terlaluMahal: mahal,
  });
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
  const buka = state.terminal.jurusanBuka;
  const berikutnyaCfg = cfg.jurusan[buka];
  const jurusan: ModelJurusan = {
    daftar: cfg.jurusan.map((j, i) => ({
      nama: j.nama,
      buka: i < buka,
      bonusTiket: j.bonusTiket,
      feri: j.feri ?? null,
      harga:
        i < buka
          ? harga(
              state.harga.jurusan[i] ?? 100,
              ch.min,
              ch.maks,
              saran.jurusan[i] ?? 100,
              faktorPeminat(state.harga.jurusan[i] ?? 100, 0, j.elastisitas, 0) - 1,
              ah.terisiJurusan[i] ?? 0,
              ah.minatJurusan[i] ?? 0,
              // Hanya penyumbang kemahalan yang ditandai: jurusan di atas harga normal (bukan yang mahal karena tambahan kelas).
              (lebih.jurusan[i] ?? 0) > 0 && (state.harga.jurusan[i] ?? 100) > 100,
            )
          : null,
    })),
    berikutnya: berikutnyaCfg
      ? {
          nama: berikutnyaCfg.nama,
          biaya: new Decimal(berikutnyaCfg.biaya),
          bonusTiket: berikutnyaCfg.bonusTiket,
          bisa: bisaBukaJurusan(state, cfg),
          po: PO_IDS.find((id) => { const sy = cfg.po.syarat[id]; return sy.jenis === 'jurusan' && sy.ke === buka; }) ?? null,
          feri: berikutnyaCfg.feri ?? null,
          kurangKelas: kelasKurangJurusan(state, cfg),
        }
      : null,
    multTiket: multJurusan(state, cfg),
    nilaiPerPenumpang: nilaiPerPenumpangState(state, cfg),
    nilaiDibayar: normal * ah.harga,
    terisi: ah.terisi,
    batasWajar: (normal * ch.ambangMahal) / 100,
    penaltiHarga: kepuasan.penaltiHarga,
  };
  const armada: ModelArmada = {
    kelasBus: KELAS_BUS_IDS.map(
      (id): ModelKelasBus => ({
        id,
        beroperasi: state.terminal.kelasBus[id],
        bonusTiket: cfg.kelasBus[id].bonusTiket,
        biaya: new Decimal(cfg.kelasBus[id].biaya),
        bisa: bisaBeliKelasBus(state, id, cfg),
        kurang: syaratKelasBusKurang(state, id, cfg),
        harga: state.terminal.kelasBus[id]
          ? harga(
              state.harga.tambahanKelas[id],
              0,
              ch.tambahanMaks,
              saran.tambahanKelas[id] ?? 0,
              faktorPeminat(100, state.harga.tambahanKelas[id], 0, cfg.kelasBus[id].elastisitas) - 1,
              ah.terisiKelas[id],
              ah.minatKelas[id],
              // Kelas tanpa tambahan tidak ditandai walau jurusannya kemahalan.
              lebih.kelas[id] > 0 && state.harga.tambahanKelas[id] > 0,
            )
          : null,
      }),
    ),
    jumlahKelasBus: kelasBusBeroperasi(state).length,
    bonusKelasBus: multKelasBus(state, cfg) - 1,
    daftar: PO_IDS.map((id): ModelPo => {
      const sy = cfg.po.syarat[id];
      return {
        id,
        bergabung: poBergabung(state, id),
        syarat:
          sy.jenis === 'jurusan'
            ? { jenis: 'jurusan', kota: cfg.jurusan[sy.ke]?.nama ?? '' }
            : sy.jenis === 'kelas'
              ? { jenis: 'kelas', kelas: sy.kelas }
              : sy.jenis === 'event'
                ? { jenis: 'event', event: sy.event }
                : {
                    jenis: 'kontrak',
                    biaya: biayaKontrakPo(id, cfg)!,
                    bisa: bisaKontrakPo(state, id, cfg),
                    kepuasanMin: kepuasanMinPo(id, cfg),
                    kepuasanKurang: (kepuasanMinPo(id, cfg) ?? 0) > kepuasan.nilai,
                  },
      };
    }),
    jumlah: state.armada.po.length,
    bonusTiket: multPo(state, cfg) - 1,
    bonusPerPo: cfg.po.bonusTiket,
  };
  const kls = kelasTerminal(state);
  const poinTersedia = poinPrestigeTersedia(state, cfg).toNumber();
  const poinMinimal = poinMinimalNaikKelas(kls, cfg);
  const pendapatanPerlu = pendapatanUntukPoin(poinMinimal, cfg);
  const bonus = state.prestige.poin.toNumber() * cfg.bonusPrestige;
  const kelas: ModelKelas = {
    kelas: kls,
    bonus,
    bonusSetelah: bonus + Math.max(poinTersedia, poinMinimal) * cfg.bonusPrestige,
    poinTersedia,
    poinMinimal,
    bisa: bisaNaikKelas(state, cfg),
    pendapatanRun: state.statistik.totalPendapatanRun,
    pendapatanPerlu,
    rasio: Math.min(1, state.statistik.totalPendapatanRun.div(pendapatanPerlu).toNumber()),
    poHadiah: PO_IDS.find((id) => { const sy = cfg.po.syarat[id]; return sy.jenis === 'kelas' && sy.kelas === kls + 1; }) ?? null,
    kelasBusTerbuka: KELAS_BUS_IDS.filter((id) => cfg.kelasBus[id].kelasTerminal === kls + 1),
    nama: state.profil.namaTerminal,
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
          poSudah: poBergabung(state, cfg.event[idEvent].po),
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
    kelas: state.prestige.jumlahReset,
  };
  const jumlahKlaim =
    (bisaKlaimTarget(state) ? 1 : 0) +
    (bisaKlaimEvent(state) ? 1 : 0) +
    pencapaian.filter((p) => p.tercapai && !p.diklaim).length +
    tg.daftar.filter((_, i) => bisaKlaimTantangan(state, i)).length;
  const k = state.sewaKios;
  const sewaKios = { terakhir: k.terakhir, hariKe: k.hariTerakhir, hari: k.hariTerakhir >= 0 ? NAMA_HARI[k.hariTerakhir % NAMA_HARI.length]! : null };
  return { fasilitas, jalur, jurusan, armada, kelas, event, mingguan, rekor, peringkat, teknologi, target, pencapaian, hadiahPencapaian: hadiahMenit(state, cfg.hadiahMenitPencapaian, cfg), jumlahKlaim, sewaKios };
}
