/**
 * Notifikasi singkat dari perubahan view model di antara dua pembaruan state:
 * satu pesan terpenting per pembaruan (kas, event, kelas & level terminal,
 * mitra PO, penghargaan, rekor, …). Murni, tanpa DOM; ditampilkan oleh overlay.ts.
 */
import { kepuasanTurunBerlaku, type KepuasanTurun } from '../app/kepuasan-turun';
import { izinAntara } from '../sim/bangunan';
import type { PoId } from '../sim/fitur';
import { formatAngka } from './format';
import type { ModelPoTerdaftar, ModelTampilan } from './model';
import { wajahKepuasan } from './popup-kepuasan';
import { EFEK_PERLUASAN, namaKelas, NAMA_AREA, NAMA_EVENT, NAMA_KELAS_BUS, NAMA_PENCAPAIAN, NAMA_PERLUASAN, NAMA_PO, TEKS, teksIzin, teksSlotTanpaJendela } from './teks';

/**
 * @param diputus PO yang diputus pemain sendiri: keluarnya bukan karena kontrak habis.
 * @returns null bila tidak ada yang perlu diberitahukan.
 */
export function notifikasiPerubahan(lalu: ModelTampilan, m: ModelTampilan, diputus: ReadonlySet<PoId> = new Set()): string | null {
  // Kas lebih dulu: pemain perlu bertindak sebelum petugas berikutnya berhenti.
  if (m.petugasBerhenti > lalu.petugasBerhenti) return TEKS.notifPetugasBerhenti;
  if (m.hud.kasMenipis && !lalu.hud.kasMenipis) return TEKS.notifKasMenipis;
  const ev = m.event;
  if (ev?.aktif && !lalu.event?.aktif) return TEKS.notifEventMulai(NAMA_EVENT[ev.id].ikon, NAMA_EVENT[ev.id].nama, formatAngka(ev.pengali, { desimalKecil: 2 }));
  if (ev?.bisaKlaim && !lalu.event?.bisaKlaim) return TEKS.notifEventTahap;
  const t = m.terminal;
  const tl = lalu.terminal;
  if (t.kelas > tl.kelas) return TEKS.notifNaikKelas(namaKelas(t.kelas));
  const perluasan = t.perluasan.selesai > tl.perluasan.selesai ? NAMA_PERLUASAN[t.perluasan.selesai - 1] : undefined;
  if (perluasan) return TEKS.notifPerluasan(t.perluasan.selesai, perluasan.nama);
  // Proyek baru dimulai: pemain tahu proyeknya tetap berjalan saat game ditutup.
  if (t.perluasan.proyek && !tl.perluasan.proyek) return TEKS.notifPerluasanMulai(t.perluasan.proyek.tahap);
  const sekarang = new Map(m.mitra.terdaftar.map((p) => [p.id, p]));
  const sebelum = new Map(lalu.mitra.terdaftar.map((p) => [p.id, p]));
  const poBaru = m.mitra.terdaftar.find((p) => !sebelum.has(p.id));
  if (poBaru) return TEKS.notifPo(NAMA_PO[poBaru.id].nama);
  const keluar = lalu.mitra.terdaftar.find((p) => !sekarang.has(p.id) && !diputus.has(p.id));
  if (keluar) return TEKS.notifPoKeluar(NAMA_PO[keluar.id].nama);
  // Rute antarpulau yang baru dilayani PO mana pun (jurusan yang terbuka seiring level PO atau kelas terminal).
  const antarpulauLalu = new Set(lalu.mitra.terdaftar.flatMap((p) => p.jurusan.filter((j) => j.aktif && j.feri !== null).map((j) => j.jurusan)));
  for (const p of m.mitra.terdaftar) {
    const j = p.jurusan.find((x) => x.aktif && x.feri !== null && !antarpulauLalu.has(x.jurusan));
    if (j) return TEKS.notifAntarpulau(j.nama, NAMA_PO[p.id].nama);
  }
  // Slot PO baru yang belum bisa diisi (slot jendela penuh) tidak menyuruh mendaftarkan PO, tapi menyebut
  // kapan slot jendela berikutnya datang (level izin atau perluasan; playtest P-4).
  if (t.slot > tl.slot) return m.mitra.tersedia.some((p) => p.bisa) ? TEKS.notifSlotBaru(t.slot) : teksSlotTanpaJendela(t.slot, m.bangun.bangunan.jendela.slotBerikut);
  if (t.level > tl.level) {
    // Izin level jendela & jalur ditempel ke toast naik level (slot PO punya toast sendiri di atas).
    const iz = izinAntara(tl.level, t.level, t.perluasan.selesai);
    const izin = teksIzin({ ...iz, slotPo: 0 });
    return izin ? TEKS.notifLevelTerminalIzin(t.level, izin) : TEKS.notifLevelTerminal(t.level);
  }
  const kelasBusBaru = t.kelasBus.find((k, i) => k.beroperasi && !tl.kelasBus[i]?.beroperasi);
  if (kelasBusBaru) return TEKS.notifKelasBus(NAMA_KELAS_BUS[kelasBusBaru.id].nama);
  const hampirHabis = m.mitra.terdaftar.find((p) => {
    const l = sebelum.get(p.id);
    return l !== undefined && p.kontrakHari <= 1 && l.kontrakHari > 1;
  });
  if (hampirHabis) return TEKS.notifKontrakHampir(NAMA_PO[hampirHabis.id].nama);
  const jalur = m.bangun.bangunan.jalur.jumlah;
  if (jalur > lalu.bangun.bangunan.jalur.jumlah) return TEKS.notifJalur(jalur);
  const pencapaian = m.pencapaian.find((p, i) => p.tercapai && !lalu.pencapaian[i]?.tercapai);
  if (pencapaian) return TEKS.notifPencapaian(NAMA_PENCAPAIAN[pencapaian.id].nama);
  // Tantangan yang baru tercapai (minggu yang sama) & rekor harian yang baru dipecahkan.
  const mg = m.mingguan;
  const mgLalu = lalu.mingguan;
  if (mg !== null && mgLalu !== null && mg.selesaiMs === mgLalu.selesaiMs && mg.daftar.some((x, i) => x.selesai && !mgLalu.daftar[i]?.selesai)) return TEKS.notifTantangan;
  if (m.rekor.penumpangHarian > lalu.rekor.penumpangHarian && lalu.rekor.penumpangHarian > 0) return TEKS.notifRekor(formatAngka(Math.floor(m.rekor.penumpangHarian)));
  const poNaik = m.mitra.terdaftar.find((p) => {
    const l = sebelum.get(p.id);
    return l !== undefined && p.level > l.level;
  });
  if (poNaik) return TEKS.notifPoLevel(NAMA_PO[poNaik.id].nama, poNaik.level, barangBaruPo(sebelum.get(poNaik.id)!, poNaik));
  if (m.target.selesai && !lalu.target.selesai && !m.target.diklaim) return TEKS.notifTarget;
  return null;
}

/** Kelas bus & jurusan yang baru terbuka di PO ini di antara dua pembaruan (teks; kosong bila tidak ada). */
function barangBaruPo(l: ModelPoTerdaftar, p: ModelPoTerdaftar): string {
  const kelas = p.kelas.filter((k) => !l.kelas.includes(k)).map((k) => TEKS.poBaruKelas(NAMA_KELAS_BUS[k].nama));
  const jurusan = p.jurusan.filter((j, i) => j.aktif && !l.jurusan[i]?.aktif).map((j) => TEKS.poBaruJurusan(j.nama));
  return [...kelas, ...jurusan].join(' & ');
}

/**
 * Toast armada setelah klaim hadiah berarmada (documents/15 bagian 4.4): kemajuan level PO yang
 * menerimanya, atau, bila ia naik level, teks naik level PO yang sama dengan notifikasiPerubahan
 * (jadi tidak tampil dua kali) beserta kelas bus & jurusan barunya. Null bila tidak ada armada.
 */
export function notifArmada(lalu: ModelTampilan, m: ModelTampilan): string | null {
  const sebelum = new Map(lalu.mitra.terdaftar.map((p) => [p.id, p]));
  for (const p of m.mitra.terdaftar) {
    const l = sebelum.get(p.id);
    if (!l) continue;
    if (p.level > l.level) return TEKS.notifPoLevel(NAMA_PO[p.id].nama, p.level, barangBaruPo(l, p));
    if (p.xpDalamLevel > l.xpDalamLevel + 1e-9) return TEKS.notifArmada(NAMA_PO[p.id].nama, Math.round(l.rasioXp * 100), Math.round(p.rasioXp * 100), p.level + 1);
  }
  return null;
}

/**
 * Tahap perluasan yang baru terbuka (levelnya cukup, belum dibangun, tidak ada proyek)
 * dan sebelumnya belum terbuka; null bila tidak ada. `lalu` null = awal sesi (yang sudah
 * terbuka ikut diberitahukan). Overlay memberitahukannya sekali per tahap per sesi,
 * mendahului notifikasi slot PO & level di pembaruan yang sama.
 */
export function perluasanBaruTerbuka(lalu: ModelTampilan | null, m: ModelTampilan): number | null {
  const b = m.terminal.perluasan.berikut;
  if (!b || b.levelKurang) return null;
  const l = lalu?.terminal.perluasan.berikut;
  return l && l.tahap === b.tahap && !l.levelKurang ? null : b.tahap;
}

/** Teks notifikasi perluasan terbuka. */
export function teksPerluasanTerbuka(tahap: number): string {
  return TEKS.notifPerluasanTerbuka(tahap, EFEK_PERLUASAN[tahap - 1] ?? '');
}

/**
 * Urutan antre pesan satu pembaruan (murni): "Perluasan N terbuka" mendahului slot PO & level yang
 * terpicu bersamaan (Lv 3 & 6), kecuali saat perluasan baru selesai: peresmiannya lebih dulu, lalu
 * "Perluasan N+1 terbuka".
 * @param pesan hasil notifikasiPerubahan (null = tidak ada).
 * @param terbuka tahap yang baru terbuka & belum diumumkan sesi ini (null = tidak ada).
 */
export function urutanPesan(lalu: ModelTampilan | null, m: ModelTampilan, pesan: string | null, terbuka: number | null): string[] {
  const t = terbuka === null ? [] : [teksPerluasanTerbuka(terbuka)];
  const p = pesan === null ? [] : [pesan];
  const diresmikan = lalu !== null && m.terminal.perluasan.selesai > lalu.terminal.perluasan.selesai;
  return diresmikan ? [...p, ...t] : [...t, ...p];
}

/** Teks toast kepuasan turun: wajah & persen sekarang, dan sebabnya (documents/14 bagian 4.2). */
export function teksKepuasanTurun(t: KepuasanTurun): string {
  const s = t.sebab;
  const sebab =
    s.komponen === 'kelancaran'
      ? s.area
        ? TEKS.sebabAntreanDi(NAMA_AREA[s.area])
        : TEKS.sebabAntrean
      : s.komponen === 'kenyamanan'
        ? TEKS.sebabKenyamanan
        : s.komponen === 'kebersihan'
          ? TEKS.sebabKebersihan
          : s.komponen === 'keamanan'
            ? TEKS.sebabKeamanan
            : s.komponen === 'fasilitas'
              ? TEKS.sebabFasilitas
              : TEKS.sebabHarga;
  return TEKS.notifKepuasanTurun(wajahKepuasan(t.ke), Math.round(t.dari * 100), Math.round(t.ke * 100), sebab);
}

/** Satu pesan di antrean notifikasi overlay. */
export interface PesanNotif {
  readonly teks: string;
  /** Kas menipis & petugas berhenti: melompati antrean. */
  readonly bahaya?: boolean;
  /** Toast kepuasan turun (angkanya): satu-satunya yang bisa diketuk (membuka popup kepuasan). */
  readonly kepuasan?: KepuasanTurun;
}

/** Pesan yang tertunda paling banyak sekian (yang sedang tampil tidak dihitung). */
export const MAKS_ANTREAN_NOTIF = 3;

/** Pesan tingkat bahaya (melompati antrean). */
export function notifBahaya(teks: string): boolean {
  return teks === TEKS.notifKasMenipis || teks === TEKS.notifPetugasBerhenti;
}

/**
 * Masukkan pesan ke antrean (murni). Pesan yang sama (sedang tampil atau tertunda) tidak
 * masuk dua kali; pesan bahaya masuk di depan (setelah pesan bahaya lain); antrean
 * paling panjang MAKS_ANTREAN_NOTIF: pesan biasa yang tidak muat dibuang, pesan bahaya
 * menggeser pesan biasa terakhir.
 */
export function antreNotif(antrean: readonly PesanNotif[], baru: PesanNotif, tampil: string | null = null): PesanNotif[] {
  if (baru.teks === tampil || antrean.some((p) => p.teks === baru.teks)) return [...antrean];
  if (!baru.bahaya) return antrean.length >= MAKS_ANTREAN_NOTIF ? [...antrean] : [...antrean, baru];
  const i = antrean.findIndex((p) => !p.bahaya);
  const hasil = i < 0 ? [...antrean, baru] : [...antrean.slice(0, i), baru, ...antrean.slice(i)];
  return hasil.slice(0, MAKS_ANTREAN_NOTIF);
}

/**
 * Keluarkan pesan berikut dari antrean (murni). Toast kepuasan turun dinilai ulang saat akan
 * tampil, karena bisa menunggu beberapa detik di belakang pesan lain: dibuang bila kepuasan
 * sudah pulih (`kepuasanTurunBerlaku`), dan angka "sekarang"-nya memakai kepuasan saat itu
 * supaya sama dengan pil HUD.
 * @param kepuasanSekarang kepuasan penumpang saat ini (0–1, sama dengan pil HUD).
 * @returns pesan yang tampil (null = tidak ada) & sisa antrean.
 */
export function ambilNotif(antrean: readonly PesanNotif[], kepuasanSekarang: number): { readonly pesan: PesanNotif | null; readonly sisa: PesanNotif[] } {
  for (const [i, p] of antrean.entries()) {
    if (!p.kepuasan) return { pesan: p, sisa: antrean.slice(i + 1) };
    if (!kepuasanTurunBerlaku(p.kepuasan, kepuasanSekarang)) continue;
    const kini: KepuasanTurun = { ...p.kepuasan, ke: kepuasanSekarang };
    return { pesan: { ...p, teks: teksKepuasanTurun(kini), kepuasan: kini }, sisa: antrean.slice(i + 1) };
  }
  return { pesan: null, sisa: [] };
}
