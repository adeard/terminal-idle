import { describe, expect, it } from 'vitest';
import { GEDUNG_LANTAI_IDS, type PoId } from '../src/sim/fitur';
import { aturTarif, bangun, daftarPo, DETIK_SEHARI, mulaiPerluasan, putusPo, type GameState } from '../src/sim/state';
import { kasSesudahAksi } from '../src/app/tujuan';
import { buatModel } from '../src/ui/model';
import { EKONOMI } from '../src/config/economy.config';
import { xpLevelPo } from '../src/sim/mitra';
import { antreNotif, MAKS_ANTREAN_NOTIF, notifArmada, notifBahaya, notifikasiPerubahan, perluasanBaruTerbuka, teksLantaiDibeli, teksPerluasanTerbuka, urutanPesan, type PesanNotif } from '../src/ui/notifikasi';
import { NAMA_GEDUNG_LANTAI, NAMA_KELAS_BUS, namaKelas, NAMA_PERLUASAN, NAMA_PO, TEKS, teksSlotTanpaJendela } from '../src/ui/teks';
import { denganLevelTerminal, denganPerluasan, denganPetugas, denganPo, kaya, stateOtomatis } from './helpers';

const notif = (lalu: GameState, sekarang: GameState, diputus?: ReadonlySet<PoId>): string | null => notifikasiPerubahan(buatModel(lalu), buatModel(sekarang), diputus);

describe('notifikasi perubahan', () => {
  it('tanpa perubahan: tidak ada notifikasi', () => {
    const s = stateOtomatis();
    expect(notif(s, s)).toBeNull();
  });

  it('PO bergabung; PO keluar karena kontrak habis diberi tahu, yang diputus pemain tidak', () => {
    const s = kaya(stateOtomatis());
    const t = daftarPo(s, 'peuyeumKilat');
    expect(notif(s, t)).toBe(TEKS.notifPo(NAMA_PO.peuyeumKilat.nama));
    const u = putusPo(t, 'peuyeumKilat');
    expect(notif(t, u)).toBe(TEKS.notifPoKeluar(NAMA_PO.peuyeumKilat.nama));
    expect(notif(t, u, new Set<PoId>(['peuyeumKilat']))).toBeNull();
  });

  it('level terminal, slot PO baru, dan kelas terminal (yang terpenting saja)', () => {
    const s = stateOtomatis();
    expect(notif(s, denganLevelTerminal(s, 2))).toBe(TEKS.notifLevelTerminal(2));
    expect(notif(s, denganLevelTerminal(s, 3))).toBe(TEKS.notifSlotBaru(3));
    expect(notif(s, denganLevelTerminal(s, 10))).toBe(TEKS.notifNaikKelas(namaKelas(1)));
  });

  it('naik level dengan izin (documents/15 bagian 3.5, AC-GP-06): izin jendela & jalur ditempel ke toast level; slot PO punya toast sendiri', () => {
    const p3 = denganPerluasan(stateOtomatis(), 3);
    expect(notif(denganLevelTerminal(p3, 15), denganLevelTerminal(p3, 16))).toBe('🏢 Terminal naik ke Lv 16: slot jendela loket +1 & slot jalur +1');
    expect(notif(denganLevelTerminal(p3, 11), denganLevelTerminal(p3, 12))).toBe('🏢 Terminal naik ke Lv 12: slot jendela loket +1');
    // Sebelum Perluasan 3: toast level biasa.
    expect(notif(denganLevelTerminal(stateOtomatis(), 11), denganLevelTerminal(stateOtomatis(), 12))).toBe(TEKS.notifLevelTerminal(12));
    // Slot PO ke-7 di Lv 17: toast slot PO (tetap).
    const p4 = denganPerluasan(kaya(stateOtomatis()), 4);
    expect(notif(denganLevelTerminal(p4, 16), denganLevelTerminal(p4, 17))).toMatch(/^🅿️ Slot PO ke-7 terbuka/);
  });

  it('lantai terbuka saat naik level (documents/18 bagian 4.4): satu toast gabungan; lantai 3 hanya sesudah lantai 2; sebelum Perluasan 3 tidak', () => {
    // Kas berlimpah: kas sesudah membeli aman, toast mengajak membangun.
    const p3 = kaya(denganPerluasan(stateOtomatis(), 3));
    const n = NAMA_GEDUNG_LANTAI;
    // Lv 21 juga membuka izin jendela: tetap satu toast, yang menyebut lantai.
    expect(notif(denganLevelTerminal(p3, 20), denganLevelTerminal(p3, 21))).toBe(`🏢 Lv 21: lantai 2 ${n.ruangTunggu.nama} bisa dibangun`);
    expect(notif(denganLevelTerminal(p3, 14), denganLevelTerminal(p3, 15))).toBe(`🏢 Lv 15: lantai 2 ${n.parkir.nama} bisa dibangun`);
    expect(notif(denganLevelTerminal(p3, 25), denganLevelTerminal(p3, 26))).toBe(`🏢 Lv 26: lantai 2 ${n.sayapBarat.nama} bisa dibangun`);
    expect(notif(denganLevelTerminal(p3, 32), denganLevelTerminal(p3, 33))).toBe(`🏢 Lv 33: lantai 2 ${n.aula.nama} bisa dibangun`);
    // Gedung parkir 3 di Lv 38: hanya bila lantai 2 sudah dibangun.
    expect(notif(denganLevelTerminal(p3, 37), denganLevelTerminal(p3, 38))).not.toContain('lantai');
    const parkir2 = { ...p3, terminal: { ...p3.terminal, lantai: { ...p3.terminal.lantai, parkir: 1 } } };
    expect(notif(denganLevelTerminal(parkir2, 37), denganLevelTerminal(parkir2, 38))).toBe(`🏢 Lv 38: lantai 3 ${n.parkir.nama} bisa dibangun`);
    // Sebelum Perluasan 3: toast level biasa.
    expect(notif(denganLevelTerminal(stateOtomatis(), 20), denganLevelTerminal(stateOtomatis(), 21))).toBe(TEKS.notifLevelTerminal(21));
  });

  it('toast lantai terbuka hanya mengajak membangun bila kas aman sesudahnya (temuan playtest T-1, aturan baris tujuan)', () => {
    const n = NAMA_GEDUNG_LANTAI;
    const tabung = `🏢 Lv 15: lantai 2 ${n.parkir.nama} terbuka · kumpulkan kas dulu`;
    // Kas kurang dari harga.
    const miskin = denganPerluasan(stateOtomatis(), 3);
    expect(notif(denganLevelTerminal(miskin, 14), denganLevelTerminal(miskin, 15))).toBe(tabung);
    // Kas cukup untuk harga, tetapi sisanya di bawah cadangan B (terminal merugi tanpa kontrak).
    const rugi = (kas: number): GameState => denganPetugas(denganPerluasan(stateOtomatis({}, kas), 3), ['kebersihan', 'kebersihan', 'kebersihan', 'satpam', 'satpam']);
    const ks = kasSesudahAksi(denganLevelTerminal(rugi(1e13), 15), { jenis: 'tambahLantai', gedung: 'parkir' })!;
    expect(ks.cadangan).toBeGreaterThan(0);
    const pas = rugi(300_000_000 + Math.floor(ks.cadangan) - 1);
    expect(notif(denganLevelTerminal(pas, 14), denganLevelTerminal(pas, 15))).toBe(tabung);
    const aman = rugi(300_000_000 + Math.ceil(ks.cadangan));
    expect(notif(denganLevelTerminal(aman, 14), denganLevelTerminal(aman, 15))).toBe(`🏢 Lv 15: lantai 2 ${n.parkir.nama} bisa dibangun`);
    for (const g of GEDUNG_LANTAI_IDS) expect(Array.from(TEKS.notifLantaiTerbukaTabung(38, 3, n[g].nama)).length).toBeLessThanOrEqual(60);
  });

  it('toast lantai dibeli (rancangan 4.5): nama, jumlah lantai kini, isi pendek; semua toast lantai ≤ 60 karakter', () => {
    expect(teksLantaiDibeli('ruangTunggu', 1)).toBe(`🏢 ${NAMA_GEDUNG_LANTAI.ruangTunggu.nama} kini 2 lantai: +4 blok kursi & 1 kios`);
    expect(teksLantaiDibeli('parkir', 2)).toBe(`🏢 ${NAMA_GEDUNG_LANTAI.parkir.nama} kini 3 lantai: +2 lahan parkir`);
    expect(teksLantaiDibeli('sayapBarat', 1)).toBe(`🏢 ${NAMA_GEDUNG_LANTAI.sayapBarat.nama} kini 2 lantai: selasar & +1 toilet`);
    expect(teksLantaiDibeli('sayapBarat', 1)).toBe('🏢 Gedung toilet kini 2 lantai: selasar & +1 toilet');
    for (const g of GEDUNG_LANTAI_IDS) {
      expect(Array.from(teksLantaiDibeli(g, 2)).length).toBeLessThanOrEqual(60);
      expect(Array.from(TEKS.notifLantaiTerbukaLevel(38, 3, NAMA_GEDUNG_LANTAI[g].nama)).length).toBeLessThanOrEqual(60);
    }
  });

  it('toast armada setelah klaim (documents/15 bagian 4.4): kemajuan level PO penerima, atau naik level dengan kelas bus/jurusan baru', () => {
    const s = denganPo(stateOtomatis(), 'ondelOndel', { level: 4 });
    const lalu = buatModel(s);
    const separuh = { ...s, mitra: { ...s.mitra, terdaftar: s.mitra.terdaftar.map((p) => ({ ...p, xp: p.xp + xpLevelPo(4) * 0.5 })) } };
    expect(notifArmada(lalu, buatModel(separuh))).toBe(`🚌 Armada baru ${NAMA_PO.ondelOndel.nama}: 0% → 50% menuju Lv 5`);
    expect(notifArmada(lalu, lalu)).toBeNull();
    // Lv 2 → 3 membuka Patas: teksnya sama dengan toast naik level PO (antrean membuang duplikat).
    const lv2 = denganPo(stateOtomatis(), 'ondelOndel', { level: 2 });
    const lv3 = denganPo(stateOtomatis(), 'ondelOndel', { level: 3 });
    expect(notifArmada(buatModel(lv2), buatModel(lv3))).toBe(`⬆️ ${NAMA_PO.ondelOndel.nama} naik ke Lv 3: kelas ${NAMA_KELAS_BUS.patas.nama}`);
  });

  it('perluasan diresmikan; jalur baru dibuka', () => {
    const s = stateOtomatis();
    const p = mulaiPerluasan(denganLevelTerminal(kaya(s), 3));
    const selesai = { ...p, perkembangan: { ...p.perkembangan, perluasan: 1, proyekDetik: 0 } };
    expect(notif(p, selesai)).toBe(TEKS.notifPerluasan(1, NAMA_PERLUASAN[0]!.nama));
    expect(notif(p, selesai)).toBe(`🏗️ Perluasan 1 selesai: ${NAMA_PERLUASAN[0]!.nama}!`);
    expect(notif(kaya(s), bangun(kaya(s), 'jalur'))).toBe(TEKS.notifJalur(2));
  });

  it('urutan antre: peresmian sebelum "Perluasan berikut terbuka"; di Lv 3 perluasan terbuka sebelum slot PO (AC-GP-18, playtest P-6)', () => {
    // Perluasan 1 selesai saat level sudah cukup untuk perluasan 2.
    const P2 = EKONOMI.mitra.perluasan[1]!;
    const p = mulaiPerluasan(denganLevelTerminal(kaya(stateOtomatis()), P2.level));
    const lalu = buatModel(p);
    const m = buatModel({ ...p, perkembangan: { ...p.perkembangan, perluasan: 1, proyekDetik: 0 } });
    const pesan = notifikasiPerubahan(lalu, m);
    expect(pesan).toBe(TEKS.notifPerluasan(1, NAMA_PERLUASAN[0]!.nama));
    expect(perluasanBaruTerbuka(lalu, m)).toBe(2);
    expect(urutanPesan(lalu, m, pesan, 2)).toEqual([pesan, teksPerluasanTerbuka(2)]);
    // Lv 3 tanpa peresmian: perluasan terbuka lebih dulu dari slot PO.
    const lv2 = buatModel(denganLevelTerminal(stateOtomatis(), 2));
    const lv3 = buatModel(denganLevelTerminal(stateOtomatis(), 3));
    const slot = notifikasiPerubahan(lv2, lv3);
    expect(urutanPesan(lv2, lv3, slot, 1)).toEqual([teksPerluasanTerbuka(1), slot]);
    // Awal sesi (belum ada model sebelumnya) & tanpa pesan.
    expect(urutanPesan(null, lv3, null, 1)).toEqual([teksPerluasanTerbuka(1)]);
    expect(urutanPesan(lalu, m, null, null)).toEqual([]);
  });

  it('perluasan dimulai: pesan bahwa proyek tetap berjalan saat game ditutup', () => {
    const s = denganLevelTerminal(kaya(stateOtomatis()), 3);
    expect(notif(s, mulaiPerluasan(s))).toBe(TEKS.notifPerluasanMulai(1));
    expect(TEKS.notifPerluasanMulai(1)).toBe('🏗️ Perluasan 1 dimulai! Selesai dalam sehari terminal, juga saat game ditutup');
  });

  it('slot PO baru tanpa jendela (semua PO terhalang slot jendela): tidak menyuruh mendaftarkan PO', () => {
    // Lv 3 dengan dua PO dan slot jendela penuh (sebelum perluasan 1): PO ketiga butuh jendela dari perluasan.
    const s = denganPo(denganPo(stateOtomatis(), 'ondelOndel', { loket: 2 }), 'peuyeumKilat', { loket: 2 });
    expect(s.terminal.bangunan.jendela).toBe(4);
    const naik = denganLevelTerminal(s, 3);
    expect(buatModel(naik).mitra.tersedia.some((p) => p.bisa)).toBe(false);
    expect(notif(s, naik)).toBe('🅿️ Slot PO ke-3 terbuka: jendela loket penuh sampai Perluasan 1');
  });

  it('slot PO baru tanpa jendela menyebut sasaran slot jendela berikutnya (playtest P-4, AC-GP-22): level izin atau perluasan', () => {
    // Perluasan 3, jendela 19/19 di Lv 17: slot PO ke-7, jendela berikutnya dari izin Lv 18.
    const p3 = denganPo(kaya(denganPerluasan(stateOtomatis(), 3)), 'ondelOndel', { loket: 19 });
    expect(notif(denganLevelTerminal(p3, 16), denganLevelTerminal(p3, 17))).toBe('🅿️ Slot PO ke-7 terbuka: jendela loket penuh sampai Lv 18');
    // Perluasan 2 (jendela 8/8) di Lv 14: slot PO ke-6, jendela berikutnya dari Perluasan 3.
    const p2 = denganPo(kaya(denganPerluasan(stateOtomatis(), 2)), 'ondelOndel', { loket: 8 });
    expect(notif(denganLevelTerminal(p2, 13), denganLevelTerminal(p2, 14))).toBe('🅿️ Slot PO ke-6 terbuka: jendela loket penuh sampai Perluasan 3');
    // Tidak ada slot jendela lagi: tanpa sasaran.
    expect(teksSlotTanpaJendela(20, null)).toBe('🅿️ Slot PO ke-20 terbuka: jendela loket penuh');
  });

  it('perluasan baru terbuka: sekali saat levelnya tercapai (atau di awal sesi), tidak saat proyek berjalan', () => {
    const lv2 = buatModel(denganLevelTerminal(stateOtomatis(), 2));
    const lv3s = denganLevelTerminal(kaya(stateOtomatis()), 3);
    const lv3 = buatModel(lv3s);
    expect(perluasanBaruTerbuka(lv2, lv3)).toBe(1);
    expect(perluasanBaruTerbuka(lv3, lv3)).toBeNull();
    expect(perluasanBaruTerbuka(null, lv3)).toBe(1);
    expect(perluasanBaruTerbuka(null, lv2)).toBeNull();
    expect(perluasanBaruTerbuka(lv3, buatModel(mulaiPerluasan(lv3s)))).toBeNull();
    expect(teksPerluasanTerbuka(1)).toBe('🏗️ Perluasan 1 terbuka: slot jendela loket +2. Bangun di tab Terminal');
  });

  it('antrean notifikasi: maks. 3 tertunda, tanpa duplikat, pesan bahaya melompati antrean', () => {
    const p = (teks: string): PesanNotif => ({ teks });
    let a = antreNotif([], p('a'));
    a = antreNotif(a, p('b'));
    a = antreNotif(a, p('a'));
    expect(a.map((x) => x.teks)).toEqual(['a', 'b']);
    expect(antreNotif(a, p('x'), 'x').map((x) => x.teks)).toEqual(['a', 'b']);
    a = antreNotif(antreNotif(a, p('c')), p('d'));
    expect(a.map((x) => x.teks)).toEqual(['a', 'b', 'c']);
    expect(MAKS_ANTREAN_NOTIF).toBe(3);
    expect(notifBahaya(TEKS.notifKasMenipis)).toBe(true);
    const bahaya = antreNotif(a, { teks: TEKS.notifKasMenipis, bahaya: true });
    expect(bahaya.map((x) => x.teks)).toEqual([TEKS.notifKasMenipis, 'a', 'b']);
    expect(antreNotif(bahaya, { teks: TEKS.notifPetugasBerhenti, bahaya: true }).map((x) => x.teks)).toEqual([TEKS.notifKasMenipis, TEKS.notifPetugasBerhenti, 'a']);
  });

  it('kas: peringatan kas menipis, lalu petugas yang berhenti karena gajinya tak terbayar', () => {
    const s = aturTarif(denganPetugas(stateOtomatis({ jalur: 2 }, 0), ['manajerOperasional', 'kebersihan', 'satpam']), 'sewaLoket', 0);
    const aman = { ...s, kas: 1e9 };
    expect(buatModel(s).hud.kasMenipis).toBe(true);
    expect(notif(aman, s)).toBe(TEKS.notifKasMenipis);
    const berhenti = { ...s, keuangan: { ...s.keuangan, petugasBerhenti: 1 } };
    expect(notif(s, berhenti)).toBe(TEKS.notifPetugasBerhenti);
  });

  it('rute antarpulau, kelas bus baru, kontrak tinggal sehari, dan PO naik level', () => {
    // Siger Sakti di Tipe B naik ke Lv 6: Palembang (rute keduanya) mulai dilayani.
    const b = denganPo(denganLevelTerminal(stateOtomatis(), 10), 'sigerSakti', { level: 5 });
    expect(notif(b, denganPo(b, 'sigerSakti', { level: 6 }))).toBe(TEKS.notifAntarpulau('PALEMBANG', NAMA_PO.sigerSakti.nama));
    const s = stateOtomatis();
    expect(notif(s, denganPo(s, 'ondelOndel', { level: 3 }))).toBe(TEKS.notifKelasBus(NAMA_KELAS_BUS.patas.nama));
    expect(notif(s, denganPo(s, 'ondelOndel', { level: 2 }))).toBe(TEKS.notifPoLevel(NAMA_PO.ondelOndel.nama, 2));
    const hampir = { ...s, mitra: { ...s.mitra, terdaftar: s.mitra.terdaftar.map((p) => ({ ...p, kontrakDetik: DETIK_SEHARI * 0.9 })) } };
    expect(notif(s, hampir)).toBe(TEKS.notifKontrakHampir(NAMA_PO.ondelOndel.nama));
  });
});
