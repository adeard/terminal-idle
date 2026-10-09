/**
 * Notifikasi singkat dari perubahan view model di antara dua pembaruan state:
 * satu pesan terpenting per pembaruan (kas, event, kelas & level terminal,
 * mitra PO, penghargaan, rekor, …). Murni, tanpa DOM; ditampilkan oleh overlay.ts.
 */
import type { PoId } from '../sim/fitur';
import { formatAngka } from './format';
import type { ModelTampilan } from './model';
import { namaKelas, NAMA_EVENT, NAMA_KELAS_BUS, NAMA_PENCAPAIAN, NAMA_PERLUASAN, NAMA_PO, TEKS } from './teks';

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
  if (perluasan) return TEKS.notifPerluasan(perluasan.nama);
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
  if (t.slot > tl.slot) return TEKS.notifSlotBaru(t.slot);
  if (t.level > tl.level) return TEKS.notifLevelTerminal(t.level);
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
  if (poNaik) return TEKS.notifPoLevel(NAMA_PO[poNaik.id].nama, poNaik.level);
  if (m.target.selesai && !lalu.target.selesai && !m.target.diklaim) return TEKS.notifTarget;
  return null;
}
