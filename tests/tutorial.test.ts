import { describe, expect, it } from 'vitest';
import { cocokUntukTutorial, langkahBerikut, sasaranLangkah } from '../src/app/tutorial';
import { EKONOMI } from '../src/config/economy.config';
import { terapkanAksi, type Aksi } from '../src/sim/aksi';
import { buatStateBaru, poTujuanJendela, tawaranKontrakPo, type GameState } from '../src/sim/state';
import { denganPerluasan, jalankan, kaya, stateOtomatis, T0 } from './helpers';

const baru = (): GameState => buatStateBaru(T0);
const lakukan = (s: GameState, ...aksi: Aksi[]): GameState => aksi.reduce((st, a) => terapkanAksi(st, a), s);

describe('tutorial terpandu', () => {
  it('dimulai hanya untuk game yang benar-benar baru, bukan save pemain lama', () => {
    expect(cocokUntukTutorial(baru())).toBe(true);
    // Terminal berjalan sendiri sejak awal: sudah ada penumpang tapi belum membeli apa pun = tetap baru.
    expect(cocokUntukTutorial(jalankan(baru(), 5))).toBe(true);
    expect(cocokUntukTutorial(stateOtomatis({ jalur: 3 }))).toBe(false);
    expect(cocokUntukTutorial(denganPerluasan(baru(), 1))).toBe(false);
  });

  it('modal awal cukup untuk semua langkah tutorial', () => {
    const s = baru();
    const total = (['jendela', 'po', 'petugas', 'jalur'] as const).reduce((a, id) => a + sasaranLangkah(id, s).biaya, 0);
    expect(total).toBeLessThanOrEqual(EKONOMI.tycoon.modalAwal);
  });

  it('langkah maju sendiri saat syaratnya terpenuhi: jendela loket → PO kedua → petugas peron → Jalur 2 → tamat', () => {
    let s = baru();
    expect(langkahBerikut(s)).toBe('jendela');
    // Laba masuk tanpa diketuk; langkahnya menunggu pemain membangun.
    s = jalankan(s, 5);
    expect(s.statistik.totalPenumpang).toBeGreaterThan(0);
    expect(langkahBerikut(s)).toBe('jendela');
    s = lakukan(s, { jenis: 'bangun', bangunan: 'jendela' });
    expect(langkahBerikut(s)).toBe('po');
    s = lakukan(s, { jenis: 'daftarPo', po: 'peuyeumKilat' });
    expect(s.mitra.terdaftar).toHaveLength(2);
    expect(langkahBerikut(s)).toBe('petugas');
    s = lakukan(s, { jenis: 'rekrut', petugas: 'peron' });
    expect(langkahBerikut(s)).toBe('jalur');
    s = lakukan(s, { jenis: 'bangun', bangunan: 'jalur' });
    expect(s.terminal.bangunan.jalur).toBe(2);
    expect(langkahBerikut(s)).toBeNull();
  });

  it('urutan bebas: langkah yang terpenuhi lebih dulu tetap dihitung, yang ditampilkan langkah pertama yang belum', () => {
    // PO kedua langsung membangun jendela bawaannya: langkah pertama ikut terpenuhi.
    expect(langkahBerikut(lakukan(kaya(baru()), { jenis: 'daftarPo', po: 'peuyeumKilat' }))).toBe('petugas');
    let s = lakukan(kaya(baru()), { jenis: 'rekrut', petugas: 'peron' }, { jenis: 'bangun', bangunan: 'jalur' });
    expect(langkahBerikut(s)).toBe('jendela');
    s = lakukan(s, { jenis: 'bangun', bangunan: 'jendela' });
    expect(langkahBerikut(s)).toBe('po');
    s = lakukan(s, { jenis: 'daftarPo', po: 'lumpiaKilat' });
    expect(langkahBerikut(s)).toBeNull();
  });

  it('sasaran: jendela untuk PO yang antreannya paling panjang, PO pertama yang bisa didaftarkan (gratis, membayar kontraknya), petugas peron (gratis), Jalur 2', () => {
    const s = baru();
    expect(sasaranLangkah('jendela', s)).toEqual({ jenis: 'jendela', po: poTujuanJendela(s), biaya: EKONOMI.tycoon.bangunan.jendela.biaya[0] });
    const po = sasaranLangkah('po', s);
    expect(po).toEqual({ jenis: 'po', po: 'peuyeumKilat', biaya: 0, nilai: tawaranKontrakPo(s, 'peuyeumKilat').nilai });
    // PO yang sedang jeda (baru diputus) dilewati: berikutnya menurut urutan daftar PO.
    const jeda: GameState = { ...s, mitra: { ...s.mitra, jedaSampai: { peuyeumKilat: s.statistik.waktuMainDetik + 1000 } } };
    expect(sasaranLangkah('po', jeda)).toMatchObject({ jenis: 'po', po: 'lumpiaKilat' });
    expect(sasaranLangkah('petugas', s)).toEqual({ jenis: 'petugas', biaya: 0 });
    expect(sasaranLangkah('jalur', s)).toEqual({ jenis: 'jalur', biaya: EKONOMI.tycoon.bangunan.jalur.biaya[0] });
  });
});
