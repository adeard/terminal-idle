import { describe, expect, it } from 'vitest';
import type { PoId } from '../src/sim/fitur';
import { aturTarif, bangun, daftarPo, DETIK_SEHARI, mulaiPerluasan, putusPo, type GameState } from '../src/sim/state';
import { buatModel } from '../src/ui/model';
import { notifikasiPerubahan } from '../src/ui/notifikasi';
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
    expect(notif(p, selesai)).toBe(TEKS.notifPerluasan(NAMA_PERLUASAN[0]!.nama));
    expect(notif(kaya(s), bangun(kaya(s), 'jalur'))).toBe(TEKS.notifJalur(2));
  });

  it('kas: peringatan kas menipis, lalu petugas yang berhenti karena gajinya tak terbayar', () => {
    const s = aturTarif(denganPetugas(stateOtomatis({ jalur: 2 }, 0), ['manajerOperasional', 'kebersihan', 'satpam']), 'layanan', 0);
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
