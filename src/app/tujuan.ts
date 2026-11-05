/**
 * "Tujuan berikutnya" (murni; documents/14 bagian 3): satu baris di HUD yang selalu
 * menunjukkan langkah berikutnya yang aman dikerjakan, dan lencana tab Terminal/PO.
 * Tidak ada field save baru: ingatan tujuan yang sedang tampil & butir lencana yang
 * sudah dilihat hanya ada di memori sesi UI (ui/overlay.ts). Baris ini tidak pernah
 * menjalankan aksi; teks & sasaran ketukannya di ui/baris-tujuan.ts.
 *
 * Urutan prioritas (tingkat): 1 mendesak · 2 siap (gratis atau uang masuk, dan
 * perluasan) · 3 perbaikan · 4 menunggu · 5 tugas musim yang terbuka, lalu naik level
 * (selalu ada, jadi daftar tidak pernah kosong). Saran berbiaya menyisakan cadangan kas untuk rugi operasi
 * sampai uang kontrak PO berikutnya bisa masuk (bagian 3.2), supaya mengikuti saran
 * tidak pernah memunculkan "kas menipis".
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { terapkanAksi, type Aksi } from '../sim/aksi';
import { izinBerikut, type Izin } from '../sim/bangunan';
import { PO_IDS, TEKNOLOGI_IDS, type BangunanId, type PetugasId, type PoId, type TeknologiId } from '../sim/fitur';
import { levelMinimalKelas } from '../sim/level-terminal';
import { urutanPo } from '../sim/mitra';
import type { TugasAktif } from '../sim/musim';
import { penumpangMenunggu, type AreaId } from '../sim/operasi';
import {
  acuanHarian,
  adaPetugas,
  biayaBangunState,
  bisaDaftarPo,
  bisaRekrutPetugas,
  cadanganKas,
  DETIK_SEHARI,
  hitungOffline,
  jendelaKosong,
  jumlahPetugas,
  kelasTerminal,
  kurangPerpanjangPo,
  levelTerminal,
  operasiState,
  slotBangunanState,
  slotPoState,
  syaratTeknologi,
  tawaranKontrakPo,
  type GameState,
} from '../sim/state';
import { KOMPONEN_KEPUASAN, type KomponenKepuasan } from './kepuasan-turun';

/** Tujuan bertingkat lebih tinggi baru menggantikan yang sedang tampil setelah sekian ms nyata (tingkat 1 langsung). */
export const TAHAN_TUJUAN_MS = 8000;
/** Di bawah kepuasan ini baris tujuan menyarankan perbaikan komponen kepuasan (sama dengan batas "baik" pil kepuasan). */
const AMBANG_KEPUASAN = 0.75;

export type TingkatTujuan = 1 | 2 | 3 | 4 | 5;

interface DasarTujuan {
  readonly tingkat: TingkatTujuan;
  /** Identitas untuk histeresis: jenis + sasaran. */
  readonly kunci: string;
  /** Bisa dikerjakan sekarang tanpa membuat kas menipis (status menunggu: false). */
  readonly siap: boolean;
  /** Aksi yang memenuhi tujuan ini (untuk simulasi & tes; UI tidak pernah mengirimnya sendiri). Null = status. */
  readonly aksi: Aksi | null;
}

/** Obat kas menipis, urut: perpanjang kontrak, sewakan jendela kosong, daftarkan PO, kurangi petugas (yang terakhir direkrut; null = tidak ada). */
export type ObatKasMenipis =
  | { readonly jenis: 'perpanjang'; readonly po: PoId }
  | { readonly jenis: 'sewakan' }
  | { readonly jenis: 'daftar'; readonly po: PoId; readonly nilai: number }
  | { readonly jenis: 'petugas'; readonly petugas: PetugasId | null };

/** Perbaikan area paling lambat, urut: petugas areanya, jendela loket, modernisasi, jalur. */
export type PerbaikanArea =
  | { readonly jenis: 'rekrut'; readonly petugas: 'peron' | 'gerbang' }
  | { readonly jenis: 'jendela'; readonly biaya: number }
  | { readonly jenis: 'teknologi'; readonly teknologi: TeknologiId; readonly biaya: number }
  | { readonly jenis: 'jalur'; readonly nomor: number; readonly biaya: number };

export type PerbaikanKepuasan =
  | { readonly jenis: 'rekrut'; readonly petugas: 'kebersihan' | 'petugasToilet' | 'satpam' }
  | { readonly jenis: 'bangun'; readonly bangunan: BangunanId; readonly biaya: number };

export type TujuanDinilai = DasarTujuan &
  (
    | { readonly jenis: 'kasMenipis'; readonly obat: ObatKasMenipis }
    | { readonly jenis: 'kontrakHampir'; readonly po: PoId }
    | { readonly jenis: 'poMenolak'; readonly po: PoId; readonly sebab: 'mitra' | 'kepuasan'; readonly kepuasanMin: number | null }
    | { readonly jenis: 'perpanjang'; readonly po: PoId; readonly nilai: number }
    | { readonly jenis: 'sewakan'; readonly jumlah: number }
    | { readonly jenis: 'daftarPo'; readonly po: PoId; readonly nilai: number }
    | { readonly jenis: 'perluasan'; readonly tahap: number; readonly biaya: number }
    | { readonly jenis: 'area'; readonly area: AreaId; readonly perbaikan: PerbaikanArea }
    | { readonly jenis: 'kepuasan'; readonly komponen: KomponenKepuasan; readonly nilai: number; readonly perbaikan: PerbaikanKepuasan }
    | { readonly jenis: 'manajer' }
    | { readonly jenis: 'proyek'; readonly tahap: number; readonly sisaDetik: number }
    /** hanyaCadangan: kas sudah ≥ biaya perluasan, kekurangannya hanya untuk cadangan kas. */
    | { readonly jenis: 'menabung'; readonly tahap: number; readonly kekurangan: number; readonly hanyaCadangan: boolean }
    /** izin: izin level terdekat bila lebih dulu dari perluasan berikut (`level` = level izin itu), selain itu null. */
    | { readonly jenis: 'naikLevel'; readonly tahap: number; readonly level: number; readonly levelSekarang: number; readonly izin: Izin | null }
    | { readonly jenis: 'kelasBerikut'; readonly kelas: number; readonly level: number; readonly levelSekarang: number }
    /** Tugas musim yang belum selesai (documents/17 bagian 5): `indeks` di state.musim.tugas. */
    | { readonly jenis: 'tugas'; readonly tugas: TugasAktif; readonly indeks: number }
  );

/** Jenis tujuan (juga parameter peristiwa analitik `tujuan_ketuk`). */
export type JenisTujuan = TujuanDinilai['jenis'];

/** Rata-rata sehari (tarif pemain, tanpa kontrak) merugi dan kas tinggal kurang dari sehari kerugian. */
export function kasMenipis(state: GameState, cfg: KonfigEkonomi = EKONOMI): boolean {
  const rata = acuanHarian(state, cfg, state.terminal.tarif);
  return rata.laba < 0 && state.kas < -rata.laba * 24;
}

/** Cadangan kas (documents/14 bagian 3.2) kini di sim/state.ts supaya tugas kelola musim memakai aturan yang sama. */
export { cadanganKas };

/** Kas khayalan untuk menerapkan aksi tanpa memeriksa kas. */
const KAS_KAYA = 1e15;

/** Keadaan sesudah aksi, tanpa memeriksa kas (null = aksi tidak berlaku). Kas sesudahnya = state.kas + (hasil.kas − KAS_KAYA). */
function sesudah(state: GameState, aksi: Aksi, cfg: KonfigEkonomi): GameState | null {
  const kaya = { ...state, kas: KAS_KAYA };
  const b = terapkanAksi(kaya, aksi, cfg);
  return b === kaya ? null : b;
}

interface PerluasanBerikut {
  readonly tahap: number;
  readonly level: number;
  readonly biaya: number;
  readonly levelCukup: boolean;
}

/** Tahap perluasan berikutnya yang bisa dimulai (null = proyek sedang berjalan atau semua sudah dibangun). */
function perluasanBerikut(state: GameState, cfg: KonfigEkonomi): PerluasanBerikut | null {
  const p = state.perkembangan;
  const t = cfg.mitra.perluasan[p.perluasan];
  if (p.proyekDetik > 0 || !t) return null;
  return { tahap: p.perluasan + 1, level: t.level, biaya: t.biaya, levelCukup: levelTerminal(state, cfg) >= t.level };
}

/**
 * Cadangan kas sesudah perluasan dimulai (Infinity bila tidak bisa dimulai sama sekali): tahap 1
 * cadangan A, tahap ≥ 2 cadangan B (+1 hari penyangga, playtest P-1; tahap 1 tetap A supaya
 * perluasan 1 dimulai cepat setelah Lv 3).
 */
function cadanganPerluasan(state: GameState, tahap: number, cfg: KonfigEkonomi): number {
  const b = sesudah(state, { jenis: 'mulaiPerluasan' }, cfg);
  return b ? cadanganKas(b, cfg, tahap >= 2 ? 1 : 0) : Number.POSITIVE_INFINITY;
}

/**
 * Merekrut Manajer Operasional menguntungkan (documents/14 bagian 3.1, AC-GP-13): sesudahnya laba
 * rata-rata sehari (dengan kontrak) ≥ 0 dan laba offline sehari terminal ≥ 0 (rumus terapkanOffline:
 * pendapatan & kontrak × efisiensi offline, biaya penuh). Tanpa syarat kedua pemain bisa pulang ke
 * laba offline minus. False bila Manajer sudah ada atau tidak bisa direkrut. Juga dipakai popup
 * offline tanpa Manajer (saran merekrutnya hanya bila sudah untung).
 */
export function manajerUntung(state: GameState, cfg: KonfigEkonomi = EKONOMI): boolean {
  if (adaPetugas(state, 'manajerOperasional')) return false;
  const b = sesudah(state, { jenis: 'rekrut', petugas: 'manajerOperasional' }, cfg);
  if (!b) return false;
  const a = acuanHarian(b, cfg, b.terminal.tarif);
  if (a.laba + a.kontrak < 0) return false;
  const pergi = { ...b, kas: state.kas + (b.kas - KAS_KAYA), waktuTerakhirMs: 0 };
  return hitungOffline(pergi, DETIK_SEHARI * 1000, cfg).laba >= 0;
}

/**
 * Unit yang disarankan, bagian kunci tujuan "area" (perbaikan U-2, documents/15 bagian 3.4): nomor jalur,
 * biaya jendela, id modernisasi, peran petugas. Unit berikutnya jadi tujuan baru yang dinilai lagi dengan
 * cadangan B, bukan lewat histeresis "sudah tampil".
 */
function unitPerbaikan(p: PerbaikanArea): string | number {
  switch (p.jenis) {
    case 'jalur':
      return p.nomor;
    case 'jendela':
      return p.biaya;
    case 'teknologi':
      return p.teknologi;
    case 'rekrut':
      return p.petugas;
  }
}

/** PO yang disarankan untuk didaftarkan: yang pertama (urutan tab PO) di antara yang bisa. */
function poBisaDidaftarkan(state: GameState, cfg: KonfigEkonomi): PoId | null {
  return [...PO_IDS].sort((a, b) => urutanPo(a, cfg) - urutanPo(b, cfg)).find((id) => bisaDaftarPo(state, id, cfg)) ?? null;
}

/**
 * Semua tujuan yang berlaku sekarang, urut prioritas (tingkat, lalu urutan calon), tidak pernah kosong.
 * Calon tingkat 2–3 yang belum aman tidak dimasukkan; perluasan yang levelnya cukup tapi belum aman
 * menjadi "menabung" (tingkat 4).
 * @param kunciTampil tujuan yang sedang tampil: tujuan berbiaya tetap berlaku selama kas ≥ biayanya
 *   (tanpa cadangan), supaya tidak hilang-muncul saat kas naik-turun di sekitar ambang. Kunci tujuan
 *   berbiaya memuat unitnya (jalur ke-n, biaya jendela/bangunan), jadi histeresis hanya berlaku untuk unit itu.
 */
export function daftarTujuan(state: GameState, kunciTampil: string | null, cfg: KonfigEkonomi = EKONOMI): TujuanDinilai[] {
  const hasil: TujuanDinilai[] = [];
  const kemitraan = adaPetugas(state, 'manajerKemitraan');
  const urutKontrak = [...state.mitra.terdaftar].sort((a, b) => a.kontrakDetik - b.kontrakDetik);
  const tawar = urutKontrak.filter((p) => kurangPerpanjangPo(state, p.id, cfg) === null);
  const kosong = jendelaKosong(state);
  const poBaru = poBisaDidaftarkan(state, cfg);
  const berikut = perluasanBerikut(state, cfg);

  // 1 Mendesak
  if (kasMenipis(state, cfg)) {
    const akhir = state.terminal.petugas[state.terminal.petugas.length - 1];
    const [obat, aksi]: [ObatKasMenipis, Aksi | null] = tawar[0]
      ? [{ jenis: 'perpanjang', po: tawar[0].id }, { jenis: 'perpanjangPo', po: tawar[0].id }]
      : kosong > 0
        ? [{ jenis: 'sewakan' }, { jenis: 'isiJendelaKosong' }]
        : poBaru
          ? [{ jenis: 'daftar', po: poBaru, nilai: tawaranKontrakPo(state, poBaru, cfg).nilai }, { jenis: 'daftarPo', po: poBaru }]
          : [{ jenis: 'petugas', petugas: akhir ?? null }, akhir ? { jenis: 'berhentikan', petugas: akhir } : null];
    hasil.push({ jenis: 'kasMenipis', tingkat: 1, kunci: `kasMenipis:${obat.jenis}`, siap: aksi !== null, aksi, obat });
  }
  for (const p of urutKontrak) {
    if (p.kontrakDetik > DETIK_SEHARI + 1e-6) continue;
    const kurang = kurangPerpanjangPo(state, p.id, cfg);
    // Manajer Kemitraan memperpanjang sendiri kontrak yang tinggal sehari bila PO-nya mau.
    if (kurang === null && !kemitraan) hasil.push({ jenis: 'kontrakHampir', tingkat: 1, kunci: `perpanjang:${p.id}`, siap: true, aksi: { jenis: 'perpanjangPo', po: p.id }, po: p.id });
    // PO terakhir selalu memperpanjang sendiri saat kontraknya habis, jadi penolakannya tidak mendesak.
    else if ((kurang === 'mitra' || kurang === 'kepuasan') && state.mitra.terdaftar.length > 1)
      hasil.push({ jenis: 'poMenolak', tingkat: 1, kunci: `menolak:${p.id}`, siap: false, aksi: null, po: p.id, sebab: kurang, kepuasanMin: cfg.mitra.po[p.id].kepuasanMin ?? null });
  }

  // 2 Siap: gratis atau uang masuk
  if (!kemitraan) {
    for (const p of tawar)
      if (p.kontrakDetik > DETIK_SEHARI + 1e-6)
        hasil.push({ jenis: 'perpanjang', tingkat: 2, kunci: `perpanjang:${p.id}`, siap: true, aksi: { jenis: 'perpanjangPo', po: p.id }, po: p.id, nilai: tawaranKontrakPo(state, p.id, cfg).nilai });
    if (kosong > 0) hasil.push({ jenis: 'sewakan', tingkat: 2, kunci: 'sewakan', siap: true, aksi: { jenis: 'isiJendelaKosong' }, jumlah: kosong });
  }
  if (poBaru) hasil.push({ jenis: 'daftarPo', tingkat: 2, kunci: `daftarPo:${poBaru}`, siap: true, aksi: { jenis: 'daftarPo', po: poBaru }, po: poBaru, nilai: tawaranKontrakPo(state, poBaru, cfg).nilai });
  if (berikut?.levelCukup) {
    const kunci = `perluasan:${berikut.tahap}`;
    const cadangan = cadanganPerluasan(state, berikut.tahap, cfg);
    const siap = kunci === kunciTampil ? state.kas >= berikut.biaya : state.kas - berikut.biaya >= cadangan;
    if (siap) hasil.push({ jenis: 'perluasan', tingkat: 2, kunci, siap: true, aksi: { jenis: 'mulaiPerluasan' }, tahap: berikut.tahap, biaya: berikut.biaya });
    else {
      // "Kumpulkan Rp X lagi": kekurangan terhadap biaya + cadangan (A atau B; tetap selama menunggu kontrak, lihat bagian 3.4).
      const kekurangan = Math.max(1, Math.ceil(berikut.biaya + cadangan - state.kas));
      hasil.push({ jenis: 'menabung', tingkat: 4, kunci: `menabung:${berikut.tahap}`, siap: false, aksi: null, tahap: berikut.tahap, kekurangan, hanyaCadangan: state.kas >= berikut.biaya });
    }
  }

  // 3 Perbaikan: hanya yang aman (kas sesudah ≥ cadangan B; gaji tidak membuat laba rata-rata rugi;
  // selama perluasan berikut terbuka, kasnya juga cukup untuk perluasan itu).
  const dahulukan = berikut?.levelCukup ? berikut.biaya : 0;
  const aman = (kunci: string, aksi: Aksi, gaji: boolean): boolean => {
    const b = sesudah(state, aksi, cfg);
    if (!b) return false;
    if (gaji) {
      const a = acuanHarian(b, cfg, b.terminal.tarif);
      if (a.laba + a.kontrak < 0) return false;
    }
    const kasSesudah = state.kas + (b.kas - KAS_KAYA);
    if (kunci === kunciTampil) return kasSesudah >= 0;
    return kasSesudah - dahulukan >= cadanganKas(b, cfg, 1);
  };
  const area = operasiState(state, cfg).bottleneck;
  if (area) {
    const calon: { perbaikan: PerbaikanArea; aksi: Aksi; gaji: boolean }[] = [];
    const petugas = area === 'peron' ? 'peron' : area === 'keberangkatan' ? 'gerbang' : null;
    if (petugas && bisaRekrutPetugas(state, petugas)) calon.push({ perbaikan: { jenis: 'rekrut', petugas }, aksi: { jenis: 'rekrut', petugas }, gaji: true });
    const biayaJendela = biayaBangunState(state, 'jendela', cfg);
    if (area === 'loket' && biayaJendela !== null) calon.push({ perbaikan: { jenis: 'jendela', biaya: biayaJendela }, aksi: { jenis: 'bangun', bangunan: 'jendela' }, gaji: false });
    const tek = TEKNOLOGI_IDS.find((id) => cfg.teknologi[id].tahap === area && !state.terminal.teknologi[id] && syaratTeknologi(state, id, cfg));
    if (tek) calon.push({ perbaikan: { jenis: 'teknologi', teknologi: tek, biaya: cfg.teknologi[tek].biaya }, aksi: { jenis: 'beliTeknologi', teknologi: tek }, gaji: false });
    const biayaJalur = biayaBangunState(state, 'jalur', cfg);
    if ((area === 'peron' || area === 'keberangkatan') && biayaJalur !== null)
      calon.push({ perbaikan: { jenis: 'jalur', nomor: state.terminal.bangunan.jalur + 1, biaya: biayaJalur }, aksi: { jenis: 'bangun', bangunan: 'jalur' }, gaji: false });
    for (const c of calon) {
      const kunci = `area:${area}:${c.perbaikan.jenis}:${unitPerbaikan(c.perbaikan)}`;
      if (aman(kunci, c.aksi, c.gaji)) hasil.push({ jenis: 'area', tingkat: 3, kunci, siap: true, aksi: c.aksi, area, perbaikan: c.perbaikan });
    }
  }
  const kp = perbaikanKepuasan(state, cfg);
  if (kp) {
    const kunci = `kepuasan:${kp.komponen}:${kp.perbaikan.jenis === 'rekrut' ? kp.perbaikan.petugas : `${kp.perbaikan.bangunan}:${kp.perbaikan.biaya}`}`;
    if (aman(kunci, kp.aksi, kp.perbaikan.jenis === 'rekrut'))
      hasil.push({ jenis: 'kepuasan', tingkat: 3, kunci, siap: true, aksi: kp.aksi, komponen: kp.komponen, nilai: kp.nilai, perbaikan: kp.perbaikan });
  }
  // Manajer Operasional terakhir di tingkat 3, dan hanya bila untung (juga saat pemain pergi) dan kasnya aman.
  if (manajerUntung(state, cfg)) {
    const aksi: Aksi = { jenis: 'rekrut', petugas: 'manajerOperasional' };
    if (aman('manajer', aksi, false)) hasil.push({ jenis: 'manajer', tingkat: 3, kunci: 'manajer', siap: true, aksi });
  }

  // 4 Menunggu
  const p = state.perkembangan;
  if (p.proyekDetik > 0) hasil.push({ jenis: 'proyek', tingkat: 4, kunci: `proyek:${p.perluasan + 1}`, siap: false, aksi: null, tahap: p.perluasan + 1, sisaDetik: p.proyekDetik });

  // 5 Tugas musim yang terbuka (status tanpa aksi, jadi pengikut tujuan tidak berubah perilaku), sebelum naik level.
  const tugasMusim = state.musim.id === null ? -1 : state.musim.tugas.findIndex((t) => !t.selesai);
  if (tugasMusim >= 0) {
    const t = state.musim.tugas[tugasMusim]!;
    hasil.push({ jenis: 'tugas', tingkat: 5, kunci: `tugas:${t.hari}:${t.templat}`, siap: false, aksi: null, tugas: t, indeks: tugasMusim });
  }
  // 5 Naik level (selalu ada)
  const level = levelTerminal(state, cfg);
  if (berikut && !berikut.levelCukup) {
    // Izin level terdekat (slot jendela, jalur, slot PO) bila lebih dulu dari perluasan berikut (documents/15 bagian 3.5).
    const iz = izinBerikut(level, p.perluasan, cfg);
    if (iz && iz.level < berikut.level)
      hasil.push({ jenis: 'naikLevel', tingkat: 5, kunci: `izin:${iz.level}`, siap: false, aksi: null, tahap: berikut.tahap, level: iz.level, levelSekarang: level, izin: iz.izin });
    else hasil.push({ jenis: 'naikLevel', tingkat: 5, kunci: `level:${berikut.tahap}`, siap: false, aksi: null, tahap: berikut.tahap, level: berikut.level, levelSekarang: level, izin: null });
  } else {
    const kelas = kelasTerminal(state, cfg) + 1;
    hasil.push({ jenis: 'kelasBerikut', tingkat: 5, kunci: `kelas:${kelas}`, siap: false, aksi: null, kelas, level: levelMinimalKelas(kelas, cfg), levelSekarang: level });
  }
  // sort stabil: di tingkat yang sama urutan calon di atas dipertahankan.
  return hasil.sort((a, b) => a.tingkat - b.tingkat);
}

/**
 * Perbaikan kepuasan (kepuasan < 75%): komponen dengan kekurangan berbobot terbesar,
 * bobot × (1 − nilai), yang punya perbaikan (kelancaran & harga tidak punya; kelancaran
 * ditangani lewat area paling lambat). Null = tidak ada.
 */
function perbaikanKepuasan(state: GameState, cfg: KonfigEkonomi): { komponen: KomponenKepuasan; nilai: number; perbaikan: PerbaikanKepuasan; aksi: Aksi } | null {
  const op = operasiState(state, cfg);
  const k = op.kepuasan;
  if (k.nilai >= AMBANG_KEPUASAN) return null;
  const kp = cfg.tycoon.kepuasan;
  const b = state.terminal.bangunan;
  const n = jumlahPetugas(state);
  // Kebutuhan sama dengan saran popup kepuasan (ModelKepuasan di ui/model.ts).
  const perluKebersihan = Math.ceil(op.arusPuncak / kp.arusPerPetugasKebersihan - 1e-9);
  const perluKursi = Math.ceil(penumpangMenunggu(op.arusPuncak, cfg) / kp.kursiPerBlok - 1e-9);
  const bangun = (bangunan: BangunanId): { perbaikan: PerbaikanKepuasan; aksi: Aksi } | null => {
    const biaya = biayaBangunState(state, bangunan, cfg);
    return biaya === null ? null : { perbaikan: { jenis: 'bangun', bangunan, biaya }, aksi: { jenis: 'bangun', bangunan } };
  };
  const rekrut = (petugas: 'kebersihan' | 'petugasToilet' | 'satpam'): { perbaikan: PerbaikanKepuasan; aksi: Aksi } | null =>
    bisaRekrutPetugas(state, petugas) ? { perbaikan: { jenis: 'rekrut', petugas }, aksi: { jenis: 'rekrut', petugas } } : null;
  const perbaikan = (c: KomponenKepuasan): { perbaikan: PerbaikanKepuasan; aksi: Aksi } | null => {
    switch (c) {
      case 'kebersihan':
        return (n.kebersihan < perluKebersihan ? rekrut('kebersihan') : null) ?? (b.toilet > 0 ? rekrut('petugasToilet') : null);
      case 'keamanan':
        return n.satpam < b.jalur ? rekrut('satpam') : null;
      case 'kenyamanan':
        return b.kursi < perluKursi ? bangun('kursi') : null;
      case 'fasilitas': {
        const belum = (['toilet', 'kios', 'lahanParkir'] as const).filter((id) => (id === 'kios' ? b.kios + b.toko : b[id]) === 0);
        for (const id of belum) {
          const x = bangun(id);
          if (x) return x;
        }
        return null;
      }
      case 'kelancaran':
      case 'harga':
        return null;
    }
  };
  const urut = KOMPONEN_KEPUASAN.map((c) => ({ c, defisit: kp.bobot[c] * (1 - k[c]) })).sort((x, y) => y.defisit - x.defisit);
  for (const { c, defisit } of urut) {
    if (defisit < 0.01) break;
    const x = perbaikan(c);
    if (x) return { komponen: c, nilai: k.nilai, ...x };
  }
  return null;
}

/**
 * Tujuan yang ditampilkan (histeresis, documents/14 bagian 3.3): yang sedang tampil
 * dipertahankan selama masih berlaku; tujuan bertingkat lebih tinggi menggantikannya
 * setelah tampil ≥ TAHAN_TUJUAN_MS (tingkat 1 langsung); setingkat tidak saling
 * menggantikan. Tanpa yang sedang tampil: tingkat terkecil, yang siap lebih dulu.
 * @param daftar hasil daftarTujuan (tidak pernah kosong)
 * @param tampil tujuan yang sedang tampil & sejak kapan (ms nyata), null bila belum ada
 */
export function pilihTujuan(daftar: readonly TujuanDinilai[], tampil: { readonly kunci: string; readonly sejakMs: number } | null, sekarangMs: number): TujuanDinilai {
  const min = Math.min(...daftar.map((t) => t.tingkat));
  const setingkat = daftar.filter((t) => t.tingkat === min);
  const terbaik = setingkat.find((t) => t.siap) ?? setingkat[0]!;
  const kini = tampil ? daftar.find((t) => t.kunci === tampil.kunci) : undefined;
  if (!kini || !tampil) return terbaik;
  if (terbaik.tingkat === 1 && kini.tingkat !== 1) return terbaik;
  if (terbaik.tingkat < kini.tingkat && sekarangMs - tampil.sejakMs >= TAHAN_TUJUAN_MS) return terbaik;
  return kini;
}

/** Butir lencana tab (kunci "sudah dilihat" disimpan overlay di memori sesi; documents/14 bagian 3.6). */
export interface ButirLencana {
  /** Perluasan berikut terbuka levelnya & belum dibangun: `perluasan:{tahap}:{siap}` (siap = lolos cadangannya: A tahap 1, B tahap ≥ 2). */
  readonly terminal: readonly string[];
  /** Tawaran perpanjangan yang bisa diterima, ada PO yang bisa didaftarkan, jendela kosong (dua yang pertama & terakhir tanpa Manajer Kemitraan). */
  readonly po: readonly string[];
}

/**
 * Angka lencana tab: Terminal 1 bila ada butirnya yang belum dilihat, PO = banyaknya butir yang
 * belum dilihat, Target = hadiah yang siap diklaim (`klaim`). Selama tutorial aktif (sambutan &
 * langkah) ketiganya ditahan (0) supaya tidak mendahului langkah tutorial; setelah tutorial
 * selesai atau dilewati muncul seperti biasa.
 */
export function jumlahLencana(
  butir: ButirLencana,
  dilihat: ReadonlySet<string>,
  tutorialAktif: boolean,
  klaim = 0,
): { readonly terminal: number; readonly po: number; readonly target: number } {
  if (tutorialAktif) return { terminal: 0, po: 0, target: 0 };
  return { terminal: butir.terminal.some((k) => !dilihat.has(k)) ? 1 : 0, po: butir.po.filter((k) => !dilihat.has(k)).length, target: klaim };
}

export function butirLencana(state: GameState, cfg: KonfigEkonomi = EKONOMI): ButirLencana {
  const terminal: string[] = [];
  const berikut = perluasanBerikut(state, cfg);
  if (berikut?.levelCukup) terminal.push(`perluasan:${berikut.tahap}:${state.kas - berikut.biaya >= cadanganPerluasan(state, berikut.tahap, cfg)}`);
  const po: string[] = [];
  const kemitraan = adaPetugas(state, 'manajerKemitraan');
  if (!kemitraan) for (const p of state.mitra.terdaftar) if (kurangPerpanjangPo(state, p.id, cfg) === null) po.push(`perpanjang:${p.id}:${p.kontrakKe}`);
  if (poBisaDidaftarkan(state, cfg)) po.push(`daftar:${slotPoState(state, cfg)}:${slotBangunanState(state, 'jendela', cfg)}`);
  const kosong = jendelaKosong(state);
  if (!kemitraan && kosong > 0) po.push(`kosong:${kosong}`);
  return { terminal, po };
}
