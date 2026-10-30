import { describe, expect, it } from 'vitest';
import type { PoId } from '../src/sim/fitur';
import { aturTarif, bangun, daftarPo, DETIK_SEHARI, mulaiPerluasan, putusPo, type GameState } from '../src/sim/state';
import { buatModel } from '../src/ui/model';
import { EKONOMI } from '../src/config/economy.config';
import { antreNotif, MAKS_ANTREAN_NOTIF, notifBahaya, notifikasiPerubahan, perluasanBaruTerbuka, teksPerluasanTerbuka, urutanPesan, type PesanNotif } from '../src/ui/notifikasi';
import { NAMA_KELAS_BUS, namaKelas, NAMA_PERLUASAN, NAMA_PO, TEKS } from '../src/ui/teks';
import { denganLevelTerminal, denganPetugas, denganPo, kaya, stateOtomatis } from './helpers';

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
    expect(notif(s, naik)).toBe(TEKS.notifSlotTanpaJendela(3));
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
