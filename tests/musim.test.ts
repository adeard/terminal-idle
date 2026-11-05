import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { peristiwaAksi, peristiwaMusim, PencatatAnalitik, ringkasanSesi, type DataAnalitik } from '../src/app/analitik';
import { daftarTujuan } from '../src/app/tujuan';
import { EKONOMI } from '../src/config/economy.config';
import { KELOMPOK_TUGAS, MUSIM, TEMA_MUSIM, TEMPLAT_TUGAS, type TemplatTugas } from '../src/config/musim.config';
import { WAKTU } from '../src/config/waktu.config';
import { terapkanAksi, type Aksi } from '../src/sim/aksi';
import { levelPoDariXp, xpLevelPo } from '../src/sim/mitra';
import {
  adaBangunAman,
  bangunanAman,
  bisaBukaMusim,
  bukaMusim,
  buatMusimAwal,
  buatTugas,
  buatTugasHari,
  geserHari,
  hadiahTingkat,
  hiasanAktif,
  kotaSorotan,
  kunciHariWib,
  majukanTugas,
  musimDariId,
  musimPada,
  nilaiRapor,
  perbaikanTerlemah,
  perbaruiMusim,
  semuaHiasan,
  tambahPoin,
  tingkatRapor,
  tuasTugas,
  type AksiTuas,
  type MusimState,
  type TugasAktif,
} from '../src/sim/musim';
import { deserialisasi, keSaveV3, serialisasi, VERSI_SKEMA } from '../src/sim/save';
import { acuanHarian, bulatkanTarget, cadanganKas, keuanganSekarang, kelasTerminal, labaDenganKontrak, levelTerminal, operasiState, perbaruiJamNyata, terapkanOffline, tick, type GameState } from '../src/sim/state';
import { sasaranTujuan, sasaranTugas, teksTujuan } from '../src/ui/baris-tujuan';
import { bingkaiFoto } from '../src/ui/foto';
import { buatModel, modelMusim, urutanKartuTarget, type ModelTampilan, type ModelTugas } from '../src/ui/model';
import { notifikasiMusim } from '../src/ui/notifikasi';
import { isiRapor, judulRapor, teksSuratPo } from '../src/ui/popup-musim';
import { angkaTugas, hurufJudul, TEKS, teksTugas, teksTugasPendek } from '../src/ui/teks';
import { denganLevelTerminal, denganPo, jalankan, stateOtomatis } from './helpers';

const JAM = 3_600_000;
const HARI = 86_400_000;
/** Senin 30 November 2026 00.00 WIB: awal Musim 1. */
const SENIN = Date.UTC(2026, 10, 29, 17);
/** Jam 10.00 WIB hari ke-`n` musim (0 = Senin 30 Nov). */
const pada = (n: number, jam = 10): number => SENIN + n * HARI + jam * JAM;

/** Terminal Lv 10 dengan dua PO, kios, toilet, parkir, dan kas berlimpah (semua templat yang mungkin layak). */
function terminal(level = 10, kas = 5e9): GameState {
  let s = stateOtomatis({ jendela: 3, kursi: 2, kios: 1, toilet: 1, lahanParkir: 1 }, kas, ['peron', 'kebersihan']);
  s = denganPo(s, 'bakpiaRasa', { level: 3 });
  return denganLevelTerminal(s, level);
}

/** Musim terbuka di hari ke-`n` musim. */
function terbuka(n = 0, s: GameState = terminal()): GameState {
  return bukaMusim(s, pada(n));
}

const denganMusim = (s: GameState, ubah: Partial<MusimState>): GameState => ({ ...s, musim: { ...s.musim, ...ubah } });

describe('kalender musim (AC-GP-01)', () => {
  it('kunci hari WIB berganti tepat 00.00 WIB', () => {
    expect(kunciHariWib(SENIN + HARI - 1)).toBe('2026-11-30');
    expect(kunciHariWib(SENIN + HARI)).toBe('2026-12-01');
    expect(kunciHariWib(SENIN - 1)).toBe('2026-11-29');
    expect(geserHari('2026-12-01', -1)).toBe('2026-11-30');
    expect(geserHari('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('Musim 1 mulai Senin 30 November 2026 00.00 WIB; sebelumnya belum ada musim', () => {
    expect(musimPada(SENIN - 1)).toBeNull();
    const m = musimPada(SENIN)!;
    expect(m).toMatchObject({ id: '2026-11-30', ke: 0, tema: 'hujan', tahun: 2026, mulaiMs: SENIN, selesaiMs: SENIN + 42 * HARI });
  });

  it('musim ke-0..12 berganti di batas Senin 00.00 WIB (detik sebelum & sesudah); tema berulang sesudah daftar habis', () => {
    for (let n = 0; n <= 12; n++) {
      const mulai = SENIN + n * 42 * HARI;
      const m = musimPada(mulai)!;
      expect(m.ke).toBe(n);
      expect(m.id).toBe(kunciHariWib(mulai));
      expect(new Date(mulai + 7 * JAM).getUTCDay()).toBe(1);
      expect(m.tema).toBe(TEMA_MUSIM[n % TEMA_MUSIM.length]);
      expect(musimPada(mulai + 42 * HARI - 1000)!.ke).toBe(n);
      if (n > 0) expect(musimPada(mulai - 1000)!.ke).toBe(n - 1);
      expect(musimDariId(m.id)).toEqual(m);
    }
    expect(musimPada(SENIN + 3 * 42 * HARI)!).toMatchObject({ tema: 'hujan', tahun: 2027 });
  });

  it('kunci musim yang bukan awal musim tidak sah', () => {
    expect(musimDariId('2026-12-01')).toBeNull();
    expect(musimDariId('2026-11-23')).toBeNull();
    expect(musimDariId('bukan')).toBeNull();
  });
});

describe('buka musim (AC-GP-09)', () => {
  it('terbuka di Lv 6 sesudah Musim 1 dimulai; Lv 5 atau sebelum 30 November belum', () => {
    expect(bisaBukaMusim(terminal(5), pada(0))).toBe(false);
    expect(bisaBukaMusim(terminal(6), pada(-1))).toBe(false);
    expect(bisaBukaMusim(terminal(6), pada(0))).toBe(true);
    expect(bukaMusim(terminal(5), pada(0)).musim.id).toBeNull();
  });

  it('membuka musim berjalan, membuat tugas hari ini, dan sambutan sekali', () => {
    const s = terbuka(3);
    expect(s.musim.id).toBe('2026-11-30');
    expect(s.musim.hariTugas).toBe('2026-12-03');
    expect(s.musim.tugas).toHaveLength(3);
    expect(s.musim.sambutan).toBe(false);
    expect(s.musim.statistik).toMatchObject({ lvAwal: 10, tugas: 0, tantangan: 0 });
    const t = terapkanAksi(s, { jenis: 'tutupSambutanMusim' });
    expect(t.musim.sambutan).toBe(true);
    expect(terapkanAksi(t, { jenis: 'tutupSambutanMusim' })).toBe(t);
    // Sudah terbuka: bukaMusim tidak membuka ulang.
    expect(bukaMusim(t, pada(3, 11))).toBe(t);
  });

  it('save 0.4.x tanpa blok musim dengan Lv ≥ 6: dimuat belum terbuka, lalu bisa dibuka', () => {
    const lama = { ...keSaveV3(terminal(12)) } as Record<string, unknown>;
    delete lama['musim'];
    const s = deserialisasi(JSON.stringify(lama), pada(0));
    expect(s.musim).toEqual(buatMusimAwal());
    expect(bukaMusim(s, pada(0)).musim.id).toBe('2026-11-30');
  });

  it('perbaruiJamNyata tidak membuka musim sendiri (pembukaan menunggu tutorial, lihat main.ts)', () => {
    expect(perbaruiJamNyata(terminal(12), pada(0)).musim.id).toBeNull();
  });
});

describe('undian tugas (AC-GP-02)', () => {
  it('state & kunci hari yang sama → tugas yang sama', () => {
    const s = terminal();
    expect(buatTugasHari(s, '2026-12-02', new Set())).toEqual(buatTugasHari(s, '2026-12-02', new Set()));
    expect(terbuka(1).musim.tugas).toEqual(terbuka(1).musim.tugas);
  });

  it('tiga tugas dari tiga kelompok bila layak, sepanjang 6 minggu', () => {
    const s = terminal();
    for (let n = 0; n < 42; n++) {
      const tugas = buatTugasHari(s, geserHari('2026-11-30', n), new Set());
      expect(tugas).toHaveLength(3);
      expect(new Set(tugas.map((t) => KELOMPOK_TUGAS[t.templat]))).toEqual(new Set(['main', 'sorotan', 'kelola']));
    }
  });

  it('templat yang tidak layak tidak pernah muncul; kelola tanpa templat layak → sorotan kedua', () => {
    // Tanpa kios, parkir, antarpulau, PO kedua, dan kas: hanya penumpang, laba, kota, kelasTinggi?, kepuasan.
    const s = denganLevelTerminal(stateOtomatis({}, 0), 6);
    const terlarang: TemplatTugas[] = ['antarpulau', 'poTerendah', 'kios', 'parkir', 'bangun'];
    for (let n = 0; n < 42; n++) {
      const tugas = buatTugasHari(s, geserHari('2026-11-30', n), new Set());
      expect(tugas).toHaveLength(3);
      for (const t of tugas) expect(terlarang).not.toContain(t.templat);
      const kelompok = tugas.map((t) => KELOMPOK_TUGAS[t.templat]);
      if (!kelompok.includes('kelola')) expect(kelompok.filter((k) => k === 'sorotan')).toHaveLength(2);
    }
    expect(adaBangunAman(s)).toBe(false);
  });

  it('target sesuai bagian 3.2: main × 8 jam, sorotan × 8 × 1,25, kepuasan 8 menit main di atas ambang', () => {
    const s = terminal();
    const semua = TEMPLAT_TUGAS.flatMap((_, i) => buatTugasHari(s, geserHari('2026-11-30', i), new Set()));
    const laba = semua.find((t) => t.templat === 'laba');
    if (laba) expect(laba.target).toBe(bulatkanTarget(Math.max(labaDenganKontrak(acuanHarian(s)), EKONOMI.hadiah.minPerMenit) * 8));
    const kepuasan = semua.find((t) => t.templat === 'kepuasan');
    if (kepuasan) {
      expect(kepuasan.target).toBe(8 * WAKTU.detikPerJam);
      const k = operasiState(s).kepuasan.nilai;
      expect(kepuasan.param).toBeCloseTo(Math.min(0.8, Math.max(0.5, Math.floor(k * 20 + 1e-9) / 20)), 9);
    }
    const penumpang = semua.find((t) => t.templat === 'penumpang')!;
    const kota = semua.find((t) => t.templat === 'kota');
    expect(penumpang).toBeDefined();
    // Kota sorotan selalu salah satu kota yang dilayani; targetnya × 1,25 dari laju kota itu (lebih kecil dari semua penumpang × 1,25).
    if (kota) expect(kota.target).toBeLessThanOrEqual(penumpang.target * 1.25 * 1.06);
  });

  it('kota sorotan diundi dari kunci minggu: sama sepanjang minggu, dari kota yang dilayani', () => {
    const s = terminal();
    const j = kotaSorotan(s, '2026-11-30');
    expect(j).not.toBeNull();
    for (let n = 1; n < 7; n++) expect(kotaSorotan(s, geserHari('2026-11-30', n))).toBe(j);
    expect(operasiState(s).segmen.some((g) => g.jurusan === j)).toBe(true);
  });
});

describe('tugas hanya maju saat main aktif (AC-GP-03)', () => {
  it('terapkanOffline (dengan Manajer) tidak mengubah tugas', () => {
    let s = terbuka(0);
    s = { ...s, terminal: { ...s.terminal, petugas: [...s.terminal.petugas, 'manajerOperasional'] }, waktuTerakhirMs: pada(0) };
    const o = terapkanOffline(s, pada(0) + 8 * JAM).state;
    expect(o.musim).toBe(s.musim);
  });

  it('kemajuan per detik main sama di 1× dan 3× (tick 0,1 dtk vs 0,3 dtk)', () => {
    const s = terbuka(0);
    let a = s;
    let b = s;
    for (let i = 0; i < 300; i++) a = tick(a, 0.1);
    for (let i = 0; i < 100; i++) b = tick(b, 0.3);
    let maju = 0;
    a.musim.tugas.forEach((t, i) => {
      const u = b.musim.tugas[i]!;
      // Selisih hanya dari sampel ritme jam yang lebih jarang di tick 0,3 dtk (< 0,5 %).
      expect(Math.abs(u.progres - t.progres)).toBeLessThanOrEqual(Math.abs(t.progres) * 0.005 + 1e-9);
      if (t.progres > 0) maju++;
    });
    expect(maju).toBeGreaterThan(0);
  });

  it('tugas maju dari tick; tugas selesai → +10 poin', () => {
    const s0 = terbuka(0);
    // Laba bisa turun saat rugi (terminal uji tanpa nilai kontrak), jadi pakai tugas sorotan/main yang hanya naik.
    const i = s0.musim.tugas.findIndex((t) => t.templat !== 'laba' && KELOMPOK_TUGAS[t.templat] !== 'kelola');
    expect(i).toBeGreaterThanOrEqual(0);
    const t = s0.musim.tugas[i]!;
    const hampir = denganMusim(s0, { tugas: s0.musim.tugas.map((x, j) => (j === i ? { ...x, progres: t.target - 1e-6 } : x)) });
    const s = jalankan(hampir, 5);
    expect(s.musim.tugas[i]!.selesai).toBe(true);
    expect(s.musim.poin).toBe(10);
    expect(s.musim.statistik.tugas).toBe(1);
    expect(s.kas).toBeGreaterThan(0);
  });
});

describe('tugas berlaku 2 hari (AC-GP-04)', () => {
  it('hari baru: tugas kemarin yang belum selesai tetap, set baru dibuat; maks 6', () => {
    const s1 = terbuka(0);
    const s2 = perbaruiMusim(s1, pada(1));
    expect(s2.musim.hariTugas).toBe('2026-12-01');
    expect(s2.musim.tugas.filter((t) => t.hari === '2026-11-30')).toEqual(s1.musim.tugas);
    expect(s2.musim.tugas.filter((t) => t.hari === '2026-12-01')).toHaveLength(3);
    expect(s2.musim.tugas.length).toBeLessThanOrEqual(MUSIM.tugas.maksTerbuka);
    // Templat hari ini berbeda dari tugas kemarin yang masih terbuka bila masih cukup templat.
    const kemarin = new Set(s1.musim.tugas.map((t) => t.templat));
    const baru = s2.musim.tugas.filter((t) => t.hari === '2026-12-01');
    expect(baru.filter((t) => kemarin.has(t.templat)).length).toBeLessThanOrEqual(1);
  });

  it('tugas kemarin yang sudah selesai tidak dibawa; lusa tugas kemarin berakhir', () => {
    const s1 = terbuka(0);
    const selesai = denganMusim(s1, { tugas: s1.musim.tugas.map((t, i) => (i === 0 ? { ...t, selesai: true } : t)) });
    const s2 = perbaruiMusim(selesai, pada(1));
    expect(s2.musim.tugas.filter((t) => t.hari === '2026-11-30')).toHaveLength(2);
    const s3 = perbaruiMusim(s2, pada(2));
    expect(s3.musim.tugas.some((t) => t.hari === '2026-11-30')).toBe(false);
  });

  it('absen kemarin → set kemarin dibuat saat kembali; absen ≥ 2 hari → hanya kemarin + hari ini', () => {
    const s = terbuka(0);
    const dua = perbaruiMusim(s, pada(2));
    expect(dua.musim.tugas.map((t) => t.hari)).toEqual(['2026-12-01', '2026-12-01', '2026-12-01', '2026-12-02', '2026-12-02', '2026-12-02']);
    const lima = perbaruiMusim(s, pada(5));
    expect(new Set(lima.musim.tugas.map((t) => t.hari))).toEqual(new Set(['2026-12-04', '2026-12-05']));
    expect(lima.musim.tugas).toHaveLength(6);
  });

  it('pertama kali terbuka: tanpa susulan kemarin', () => {
    expect(terbuka(4).musim.tugas.every((t) => t.hari === '2026-12-04')).toBe(true);
  });

  it('kunci hari hanya maju: jam dimundurkan tidak membuat ulang tugas', () => {
    const s = perbaruiMusim(terbuka(0), pada(2));
    expect(perbaruiMusim(s, pada(1))).toBe(s);
    expect(perbaruiMusim(s, pada(2, 23))).toBe(s);
    expect(perbaruiMusim(s, pada(-3))).toBe(s);
  });
});

describe('poin & tingkat (AC-GP-05)', () => {
  it('tingkat = min(30, ⌊poin ÷ 45⌋); nilai rapor', () => {
    expect([0, 44, 45, 89, 90, 1349, 1350, 5000].map((p) => tingkatRapor(p))).toEqual([0, 0, 1, 1, 2, 29, 30, 30]);
    expect([0, 9, 10, 19, 20, 29, 30].map((t) => nilaiRapor(t))).toEqual(['cukup', 'cukup', 'baik', 'baik', 'sangatBaik', 'sangatBaik', 'istimewa']);
  });

  it('tantangan mingguan +40: diklaim dan dikirim otomatis saat minggu berganti, masuk musim minggu itu', () => {
    let s = perbaruiJamNyata(terbuka(0), pada(0));
    const t = s.tantangan.daftar[0]!;
    s = { ...s, tantangan: { ...s.tantangan, daftar: s.tantangan.daftar.map((x, i) => (i === 0 ? { ...x, progres: t.target } : x)) } };
    const klaim = terapkanAksi(s, { jenis: 'klaimTantangan', indeks: 0 });
    expect(klaim.musim.poin).toBe(40);
    expect(klaim.musim.statistik.tantangan).toBe(1);
    // Lupa diklaim: dikirim otomatis Senin berikutnya, poinnya tetap ke musim (minggu 1 musim yang sama).
    const otomatis = perbaruiJamNyata(s, pada(7));
    expect(otomatis.musim.poin).toBe(40);
  });

  it('musim belum terbuka: tidak ada poin', () => {
    let s = perbaruiJamNyata(terminal(), pada(0));
    s = { ...s, tantangan: { ...s.tantangan, daftar: s.tantangan.daftar.map((x, i) => (i === 0 ? { ...x, progres: x.target } : x)) } };
    expect(terapkanAksi(s, { jenis: 'klaimTantangan', indeks: 0 }).musim.poin).toBe(0);
    expect(tambahPoin(buatMusimAwal(), 100).poin).toBe(0);
  });

  it('tidak ada aksi musim yang mengubah kas', () => {
    let s = denganMusim(terbuka(0), { tiketGanti: 2, suratArmada: 1, koleksi: ['spanduk-hujan'], rapor: null });
    const aksi: Aksi[] = [
      { jenis: 'gantiTugas', indeks: 0, cara: 'gratis' },
      { jenis: 'gantiTugas', indeks: 1, cara: 'tiket' },
      { jenis: 'pakaiHiasan', slot: 'spanduk', item: 'spanduk-hujan' },
      { jenis: 'pakaiHiasan', slot: 'spanduk', item: null },
      { jenis: 'pakaiSuratArmada', po: 'bakpiaRasa' },
      { jenis: 'tutupRapor' },
      { jenis: 'tutupSambutanMusim' },
    ];
    for (const a of aksi) {
      const b = terapkanAksi(s, a);
      expect(b.kas).toBe(s.kas);
      s = b;
    }
    // Hadiah tingkat (sampai 30) juga tidak memberi uang.
    expect(tambahPoin(s.musim, 1350).poin).toBe(1350);
  });
});

describe('hadiah rapor (AC-GP-06)', () => {
  it('per tingkat sesuai bagian 4.1: hiasan langsung dipakai, tiket & surat bertambah', () => {
    const m0 = terbuka(0).musim;
    const m = tambahPoin(m0, 45 * 15);
    expect(m.koleksi).toEqual(['bingkai-hujan', 'spanduk-hujan', 'seragam-hujan', 'papan-hujan']);
    expect(m.pakai).toEqual({ spanduk: 'spanduk-hujan', seragam: 'seragam-hujan', papan: 'papan-hujan', bingkai: 'bingkai-hujan' });
    expect(m.tiketGanti).toBe(2);
    expect(m.suratArmada).toBe(1);
    const penuh = tambahPoin(m, 45 * 15);
    expect(penuh.tiketGanti).toBe(8);
    expect(penuh.suratArmada).toBe(2);
    expect(penuh.pakai.bingkai).toBe('bingkai-emas');
    expect(hadiahTingkat(30, 'hujan').map((h) => h.jenis)).toEqual(['lencana', 'hiasan']);
    expect(hadiahTingkat(9, 'hujan')).toEqual([]);
  });

  it('hiasan yang sudah dimiliki (tema kembali) jadi tiket ganti, tanpa dipasang ulang', () => {
    const m0 = { ...terbuka(0).musim, koleksi: ['spanduk-hujan'], pakai: { spanduk: null, seragam: null, papan: null, bingkai: null } };
    const m = tambahPoin(m0, 45 * 5);
    expect(m.koleksi.filter((x) => x === 'spanduk-hujan')).toHaveLength(1);
    expect(m.pakai.spanduk).toBeNull();
    expect(m.tiketGanti).toBe(MUSIM.tiketDuplikat);
  });

  it('Surat Armada: PO terdaftar pilihan +½ × kebutuhan level berikutnya; PO tak terdaftar ditolak', () => {
    const s = denganMusim(terbuka(0), { suratArmada: 1 });
    const p = s.mitra.terdaftar.find((x) => x.id === 'bakpiaRasa')!;
    const b = terapkanAksi(s, { jenis: 'pakaiSuratArmada', po: 'bakpiaRasa' });
    expect(b.mitra.terdaftar.find((x) => x.id === 'bakpiaRasa')!.xp).toBeCloseTo(p.xp + 0.5 * xpLevelPo(levelPoDariXp(p.xp)), 9);
    expect(b.musim.suratArmada).toBe(0);
    expect(terapkanAksi(b, { jenis: 'pakaiSuratArmada', po: 'bakpiaRasa' })).toBe(b);
    expect(terapkanAksi(s, { jenis: 'pakaiSuratArmada', po: 'kopiGayo' })).toBe(s);
  });

  it('pakai & lepas hiasan: hanya yang dimiliki, di slotnya; dibaca adegan lewat hiasanAktif', () => {
    const s = denganMusim(terbuka(0), { koleksi: ['spanduk-hujan', 'papan-hujan'] });
    const a = terapkanAksi(s, { jenis: 'pakaiHiasan', slot: 'spanduk', item: 'spanduk-hujan' });
    expect(hiasanAktif(a)).toEqual({ spanduk: 'spanduk-hujan', seragam: null, papan: null, bingkai: null });
    expect(terapkanAksi(a, { jenis: 'pakaiHiasan', slot: 'seragam', item: 'papan-hujan' })).toBe(a);
    expect(terapkanAksi(a, { jenis: 'pakaiHiasan', slot: 'seragam', item: 'seragam-hujan' })).toBe(a);
    expect(hiasanAktif(terapkanAksi(a, { jenis: 'pakaiHiasan', slot: 'spanduk', item: null })).spanduk).toBeNull();
  });
});

describe('ganti tugas (AC-GP-07)', () => {
  it('sekali gratis per hari, lalu tiket; pengganti dari kelompok yang sama & bukan templat yang ada', () => {
    const s = terbuka(0);
    const lama = s.musim.tugas[0]!;
    const a = terapkanAksi(s, { jenis: 'gantiTugas', indeks: 0, cara: 'gratis' });
    const baru = a.musim.tugas[0]!;
    expect(baru.templat).not.toBe(lama.templat);
    expect(s.musim.tugas.map((t) => t.templat)).not.toContain(baru.templat);
    expect(baru).toMatchObject({ hari: lama.hari, progres: 0, selesai: false });
    if (KELOMPOK_TUGAS[lama.templat] !== 'kelola') expect(KELOMPOK_TUGAS[baru.templat]).toBe(KELOMPOK_TUGAS[lama.templat]);
    expect(a.musim.gantiHari).toBe('2026-11-30');
    // Gratis kedua di hari yang sama ditolak; tanpa tiket juga.
    expect(terapkanAksi(a, { jenis: 'gantiTugas', indeks: 1, cara: 'gratis' })).toBe(a);
    expect(terapkanAksi(a, { jenis: 'gantiTugas', indeks: 1, cara: 'tiket' })).toBe(a);
    const t = terapkanAksi(denganMusim(a, { tiketGanti: 1 }), { jenis: 'gantiTugas', indeks: 1, cara: 'tiket' });
    expect(t.musim.tiketGanti).toBe(0);
    expect(t.musim.tugas[1]!.templat).not.toBe(a.musim.tugas[1]!.templat);
    // Besok gratis lagi.
    const besok = perbaruiMusim(t, pada(1));
    const i = besok.musim.tugas.findIndex((x) => x.hari === '2026-12-01');
    expect(terapkanAksi(besok, { jenis: 'gantiTugas', indeks: i, cara: 'gratis' })).not.toBe(besok);
  });

  it('tugas yang sudah selesai tidak bisa diganti', () => {
    const s0 = terbuka(0);
    const s = denganMusim(s0, { tugas: s0.musim.tugas.map((t, i) => (i === 0 ? { ...t, selesai: true } : t)) });
    expect(terapkanAksi(s, { jenis: 'gantiTugas', indeks: 0, cara: 'gratis' })).toBe(s);
  });
});

describe('pergantian musim & rapor (AC-GP-08)', () => {
  it('di sesi aktif: rapor sekali, poin 0, koleksi/pakai/tiket/surat tetap, riwayat bertambah', () => {
    let s = perbaruiMusim(terbuka(0), pada(41));
    s = { ...s, musim: { ...tambahPoin(s.musim, 45 * 11), tiketGanti: 3 } };
    const akhir = perbaruiJamNyata(s, pada(42, 0.01));
    const m = akhir.musim;
    expect(m.id).toBe('2027-01-11');
    expect(m.poin).toBe(0);
    expect(m.rapor).toMatchObject({ id: '2026-11-30', tingkat: 11, poin: 495, lvAwal: 10, lvAkhir: 10, hiasan: ['bingkai-hujan', 'spanduk-hujan', 'seragam-hujan'] });
    expect(m.riwayat).toEqual([{ id: '2026-11-30', tingkat: 11 }]);
    expect(m.koleksi).toEqual(s.musim.koleksi);
    expect(m.pakai).toEqual(s.musim.pakai);
    expect([m.tiketGanti, m.suratArmada]).toEqual([s.musim.tiketGanti, s.musim.suratArmada]);
    expect(m.tugas.every((t) => t.hari === '2027-01-11')).toBe(true);
    // Rapor tersimpan sekali: pembaruan berikutnya tidak membuatnya ulang; ditutup lewat aksi.
    expect(perbaruiJamNyata(akhir, pada(42, 1)).musim.rapor).toBe(m.rapor);
    expect(terapkanAksi(akhir, { jenis: 'tutupRapor' }).musim.rapor).toBeNull();
  });

  it('tantangan minggu terakhir yang lupa diklaim masuk musim lama sebelum rapornya ditutup', () => {
    let s = perbaruiJamNyata(perbaruiMusim(terbuka(0), pada(40)), pada(40));
    s = { ...s, tantangan: { ...s.tantangan, daftar: s.tantangan.daftar.map((x, i) => (i === 0 ? { ...x, progres: x.target } : x)) } };
    const akhir = perbaruiJamNyata(s, pada(42));
    expect(akhir.musim.rapor).toMatchObject({ id: '2026-11-30', poin: 40, tantangan: 1 });
    expect(akhir.musim.poin).toBe(0);
  });

  it('dibuka sesudah offline melewati batas musim: offline dulu, lalu rapor', () => {
    let s = denganMusim(terbuka(40), { poin: 100 });
    s = { ...s, waktuTerakhirMs: pada(40) };
    const o = terapkanOffline(s, pada(43));
    expect(o.state.musim.rapor).toBeNull();
    const t = perbaruiJamNyata(o.state, pada(43));
    expect(t.musim.rapor).toMatchObject({ id: '2026-11-30', poin: 100 });
    expect(t.musim.tugas.some((x) => x.hari === '2027-01-12')).toBe(true);
    // Hari pertama musim baru (absen) dibuat sebagai susulan; hari terakhir musim lama tidak.
    expect(t.musim.tugas.some((x) => x.hari === '2027-01-11')).toBe(true);
    expect(t.musim.tugas.some((x) => x.hari < '2027-01-11')).toBe(false);
  });

  it('musim terlewat tanpa poin tidak membuat rapor; absen beberapa musim hanya rapor musim terakhir yang diikuti', () => {
    const kosong = perbaruiMusim(terbuka(0), pada(100));
    expect(kosong.musim.id).toBe(musimPada(pada(100))!.id);
    expect(kosong.musim.rapor).toBeNull();
    expect(kosong.musim.riwayat).toEqual([]);
    const ikut = perbaruiMusim(denganMusim(terbuka(0), { poin: 90 }), pada(100));
    expect(ikut.musim.rapor).toMatchObject({ id: '2026-11-30', tingkat: 2 });
    expect(ikut.musim.riwayat).toHaveLength(1);
  });
});

describe('save blok musim (AC-GP-10)', () => {
  it('round-trip utuh, skema tetap 3', () => {
    let s = perbaruiMusim(terbuka(0), pada(1));
    s = denganMusim(s, { ...tambahPoin(s.musim, 300), rapor: { id: '2026-11-30', tingkat: 3, poin: 150, tugas: 12, tantangan: 1, lvAwal: 6, lvAkhir: 9, penumpang: 12345, hiasan: ['bingkai-hujan'] }, riwayat: [{ id: '2026-11-30', tingkat: 3 }], sambutan: true, gantiHari: '2026-12-01' });
    const d = deserialisasi(serialisasi(s), pada(1));
    expect(d.musim).toEqual(s.musim);
    expect(JSON.parse(serialisasi(s)).schemaVersion).toBe(VERSI_SKEMA);
    expect(VERSI_SKEMA).toBe(3);
  });

  it('bentuk blok di save sama dengan dokumen 17 bagian 9.1 (bentuk yang dipakai tes cloud save tests/akun.test.ts)', () => {
    let s = perbaruiMusim(terbuka(0), pada(1));
    s = denganMusim(s, { ...tambahPoin(s.musim, 300), rapor: { id: '2026-11-30', tingkat: 3, poin: 150, tugas: 12, tantangan: 1, lvAwal: 6, lvAkhir: 9, penumpang: 12345, hiasan: ['bingkai-hujan'] }, riwayat: [{ id: '2026-11-30', tingkat: 3 }] });
    const b = keSaveV3(s).musim!;
    const kunci = (o: object): string[] => Object.keys(o).sort();
    expect(kunci(b)).toEqual(['gantiHari', 'hariTugas', 'id', 'koleksi', 'pakai', 'poin', 'rapor', 'riwayat', 'sambutan', 'statistik', 'suratArmada', 'tiketGanti', 'tugas']);
    expect(b.tugas.length).toBeGreaterThan(0);
    for (const t of b.tugas) expect(kunci(t)).toEqual(['hari', 'param', 'progres', 'selesai', 'target', 'templat']);
    expect(kunci(b.pakai)).toEqual(['bingkai', 'papan', 'seragam', 'spanduk']);
    expect(kunci(b.statistik)).toEqual(['lvAwal', 'penumpangAwal', 'tantangan', 'tugas']);
    for (const r of b.riwayat) expect(kunci(r)).toEqual(['id', 'tingkat']);
    expect(kunci(b.rapor!)).toEqual(['hiasan', 'id', 'lvAkhir', 'lvAwal', 'penumpang', 'poin', 'tantangan', 'tingkat', 'tugas']);
  });

  it('blok berbentuk tes cloud save (dengan nilai sah) pulang-pergi baca → simpan → baca tanpa berubah', () => {
    // Bentuk & angka konstanta MUSIM di tests/akun.test.ts; param, koleksi & bingkai diganti nilai yang lolos penyaring.
    const blok = {
      id: '2026-11-30',
      poin: 137,
      tugas: [
        { hari: '2026-12-01', templat: 'penumpang', target: 120, progres: 40, param: null, selesai: false },
        { hari: '2026-12-01', templat: 'poTerendah', target: 900, progres: 900, param: 'bakpiaRasa', selesai: true },
        { hari: '2026-12-01', templat: 'kepuasan', target: 480, progres: 180, param: 0.65, selesai: false },
      ],
      hariTugas: '2026-12-01',
      gantiHari: '2026-12-01',
      tiketGanti: 2,
      suratArmada: 1,
      koleksi: ['bingkai-hujan', 'spanduk-hujan', 'seragam-hujan'],
      pakai: { spanduk: 'spanduk-hujan', seragam: null, papan: null, bingkai: 'bingkai-hujan' },
      statistik: { tugas: 7, tantangan: 1, lvAwal: 6, penumpangAwal: 1200 },
      riwayat: [{ id: '2026-11-30', tingkat: 3 }],
      rapor: null,
      sambutan: true,
    };
    const s = deserialisasi(JSON.stringify({ ...keSaveV3(terminal()), musim: blok }), pada(1));
    expect(s.musim).toEqual(blok);
    const teks = serialisasi(s);
    expect(JSON.parse(teks).musim).toEqual(blok);
    expect(deserialisasi(teks, pada(1)).musim).toEqual(blok);
  });

  it('nilai tidak sah disaring tanpa menolak save', () => {
    const dasar = keSaveV3(terbuka(0)) as unknown as Record<string, unknown>;
    const muat = (musim: unknown): MusimState => deserialisasi(JSON.stringify({ ...dasar, musim }), pada(0)).musim;
    for (const rusak of [5, 'x', [], null, true]) expect(muat(rusak)).toEqual(buatMusimAwal());
    const m = muat({
      id: '2026-12-01',
      poin: 999,
      tugas: [{ hari: '2026-11-30', templat: 'penumpang', target: 10, progres: 0, param: null, selesai: false }],
      tiketGanti: -2,
      suratArmada: 1.5,
      koleksi: ['spanduk-hujan', 'bukan', 'spanduk-hujan', 7],
      pakai: { spanduk: 'spanduk-hujan', seragam: 'papan-hujan', papan: 'papan-hujan', bingkai: 3 },
      riwayat: [{ id: '2026-11-30', tingkat: 5 }, { id: 'x', tingkat: 1 }, { id: '2026-11-30', tingkat: 99 }],
      rapor: { id: 'x' },
      sambutan: 'ya',
    });
    expect(m.id).toBeNull();
    expect(m.poin).toBe(0);
    expect(m.tugas).toEqual([]);
    expect([m.tiketGanti, m.suratArmada]).toEqual([0, 0]);
    expect(m.koleksi).toEqual(['spanduk-hujan']);
    expect(m.pakai).toEqual({ spanduk: 'spanduk-hujan', seragam: null, papan: null, bingkai: null });
    expect(m.riwayat).toEqual([{ id: '2026-11-30', tingkat: 5 }]);
    expect(m.rapor).toBeNull();
    expect(m.sambutan).toBe(false);
    // Musim sah: poin dijepit ke batas hari musim; tugas dengan templat/target/param tidak sah dibuang.
    const t: unknown[] = [
      { hari: '2026-11-30', templat: 'penumpang', target: 100, progres: 5, param: null, selesai: false },
      { hari: '2026-11-30', templat: 'terbang', target: 100, progres: 0, param: null, selesai: false },
      { hari: '2026-11-30', templat: 'laba', target: -1, progres: 0, param: null, selesai: false },
      { hari: '2026-11-30', templat: 'kota', target: 100, progres: 0, param: 99, selesai: false },
      { hari: '2026-11-30', templat: 'kepuasan', target: 480, progres: 0, param: 0.95, selesai: false },
      { hari: 'kemarin', templat: 'laba', target: 100, progres: 0, param: null, selesai: false },
      { hari: '2026-11-30', templat: 'poTerendah', target: 100, progres: 0, param: 'bakpiaRasa', selesai: true },
    ];
    const sah = muat({ id: '2026-11-30', poin: 1e9, tugas: t });
    expect(sah.id).toBe('2026-11-30');
    expect(sah.poin).toBe(1 * 6 * 10 + 7 * 40);
    expect(sah.tugas.map((x) => x.templat)).toEqual(['penumpang', 'poTerendah']);
  });

  it('ukuran blok musim sesudah setahun ≤ 2.500 karakter', () => {
    const tugas: TugasAktif[] = TEMPLAT_TUGAS.slice(0, 6).map((templat, i) => ({ hari: '2027-11-30', templat, target: 1234567, progres: 123456.789012, param: i === 2 ? 15 : null, selesai: false }));
    const m: MusimState = {
      ...buatMusimAwal(),
      id: '2027-11-01',
      poin: 1234,
      tugas,
      hariTugas: '2027-11-30',
      gantiHari: '2027-11-29',
      tiketGanti: 12,
      suratArmada: 2,
      koleksi: semuaHiasan(),
      pakai: { spanduk: 'spanduk-mudik', seragam: 'seragam-imlek', papan: 'papan-hujan', bingkai: 'bingkai-emas' },
      statistik: { tugas: 120, tantangan: 14, lvAwal: 140, penumpangAwal: 123456789.123 },
      riwayat: Array.from({ length: 9 }, (_, i) => ({ id: musimPada(SENIN + i * 42 * HARI)!.id, tingkat: 30 })),
      rapor: { id: '2027-09-20', tingkat: 30, poin: 1500, tugas: 126, tantangan: 18, lvAwal: 120, lvAkhir: 140, penumpang: 2345678, hiasan: ['bingkai-mudik', 'spanduk-mudik', 'seragam-mudik', 'papan-mudik', 'bingkai-emas'] },
      sambutan: true,
    };
    const panjang = JSON.stringify(keSaveV3({ ...terminal(), musim: m }).musim).length;
    expect(panjang).toBeLessThanOrEqual(2500);
  });
});

describe('baris tujuan: tugas musim (AC-GP-12)', () => {
  it('jenis tugas di tingkat 5 sebelum naik level, hanya bila musim terbuka dan ada tugas belum selesai', () => {
    const s = terbuka(0);
    const d = daftarTujuan(s, null);
    const i = d.findIndex((t) => t.jenis === 'tugas');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(d[i]!.tingkat).toBe(5);
    expect(d[i]!.aksi).toBeNull();
    expect(d.findIndex((t) => t.jenis === 'naikLevel' || t.jenis === 'kelasBerikut')).toBeGreaterThan(i);
    expect(daftarTujuan(terminal(), null).some((t) => t.jenis === 'tugas')).toBe(false);
    const semua = denganMusim(s, { tugas: s.musim.tugas.map((t) => ({ ...t, selesai: true })) });
    expect(daftarTujuan(semua, null).some((t) => t.jenis === 'tugas')).toBe(false);
  });
});

describe('UI musim: model, teks, tuas, toast, popup, foto (AC-GP-11, AC-GP-15)', () => {
  const tugasUji = (templat: TemplatTugas, o: Partial<ModelTugas> = {}): ModelTugas => ({
    indeks: 0,
    hari: '2026-12-01',
    templat,
    target: templat === 'kepuasan' ? 480 : templat === 'perbaikan' ? 0.8 : templat === 'bangun' || templat === 'daftarPo' ? 1 : 12_000,
    progres: templat === 'perbaikan' ? 0.62 : 0,
    rasio: 0,
    selesai: false,
    param: templat === 'kota' ? 15 : templat === 'poTerendah' ? 'wayangLestari' : templat === 'kepuasan' ? 0.65 : templat === 'perbaikan' ? 'kenyamanan' : null,
    kota: templat === 'kota' ? 'Banda Aceh' : null,
    po: templat === 'poTerendah' ? 'wayangLestari' : null,
    ganti: null,
    tuas: null,
    ...o,
  });

  it('model: null sebelum terbuka; tugas hari ini & kemarin, bilah poin, hadiah berikutnya, ganti, hiasan, surat', () => {
    expect(modelMusim(terminal())).toBeNull();
    let s = perbaruiMusim(terbuka(0), pada(1));
    s = denganMusim(s, { ...tambahPoin(s.musim, 45 * 5 + 10), suratArmada: 1 });
    const m = modelMusim(s)!;
    expect(m).toMatchObject({ id: '2026-11-30', tema: 'hujan', tahun: 2026, tingkat: 5, batasBerikut: 270, tiketGanti: 0, suratArmada: 1 });
    expect(m.rasio).toBeCloseTo(10 / 45, 9);
    expect(m.berikut).toEqual({ tingkat: 8, hadiah: [{ jenis: 'tiket', jumlah: 2 }] });
    expect(m.hariIni.map((t) => t.hari)).toEqual(['2026-12-01', '2026-12-01', '2026-12-01']);
    expect(m.kemarin.every((t) => t.hari === '2026-11-30')).toBe(true);
    expect(m.hariIni.every((t) => t.ganti === 'gratis')).toBe(true);
    expect(m.hiasan).toEqual([
      { slot: 'spanduk', item: 'spanduk-hujan', dipakai: true },
      { slot: 'bingkai', item: 'bingkai-hujan', dipakai: true },
    ]);
    expect(m.suratPo.map((p) => p.po)).toEqual(s.mitra.terdaftar.map((p) => p.id));
    // Surat Armada yang belum dipakai memberi titik di tab Target.
    expect(buatModel(s).jumlahKlaim - buatModel(denganMusim(s, { suratArmada: 0 })).jumlahKlaim).toBe(1);
  });

  it('teks kartu ≤ 40 karakter (angka sebesar contoh dokumen), baris tujuan ≤ 60', () => {
    for (const templat of TEMPLAT_TUGAS) {
      const t = tugasUji(templat, { target: templat === 'kepuasan' ? 480 : templat === 'perbaikan' ? 0.8 : templat === 'bangun' || templat === 'daftarPo' ? 1 : 4800 });
      expect([...teksTugas(t)].length, teksTugas(t)).toBeLessThanOrEqual(40);
      const uang = templat === 'laba' || templat === 'kios' || templat === 'parkir';
      const jumlah = KELOMPOK_TUGAS[templat] === 'sorotan' && templat !== 'kepuasan' ? true : templat === 'penumpang';
      const besar = tugasUji(templat, uang ? { target: 1.23e9, progres: 9.8e8 } : jumlah ? { target: 123_456, progres: 98_765 } : {});
      const baris = TEKS.tujuanTugas(teksTugasPendek(besar), angkaTugas(besar));
      expect([...baris].length, baris).toBeLessThanOrEqual(60);
    }
    expect(teksTugas(tugasUji('kota', { target: 1200, kota: 'Semarang' }))).toBe('Antar 1.200 penumpang ke Semarang');
    expect(teksTugas(tugasUji('perbaikan', { param: 'kebersihan' }))).toBe('Naikkan kebersihan ke 80% (kini 62%)');
    expect(teksTugas(tugasUji('kepuasan'))).toBe('Jaga kepuasan ≥ 65% selama 8 menit main');
    expect(angkaTugas(tugasUji('penumpang', { target: 400, progres: 210.7 }))).toBe('210/400');
    expect(hurufJudul('BANDA ACEH')).toBe('Banda Aceh');
    // Dari state sungguhan: baris tujuan tugas musim.
    const s = terbuka(0);
    const tujuan = daftarTujuan(s, null).find((t) => t.jenis === 'tugas')!;
    expect([...teksTujuan(tujuan)].length).toBeLessThanOrEqual(60);
    expect(teksTujuan(tujuan).startsWith('📋 Tugas: ')).toBe(true);
    expect(sasaranTujuan(tujuan)).toEqual({ tab: 'target', selektor: `.musim-tugas[data-indeks="${(tujuan as { indeks: number }).indeks}"]`, cadangan: '.musim-kartu' });
  });

  it('tuas "›" menuju tombol aksi tuasnya (tab & selektor), laporan keuangan, popup kepuasan, atau tidak ada', () => {
    const aksi = (a: AksiTuas): Partial<ModelTugas> => ({ tuas: { jenis: 'aksi', aksi: a } });
    expect(sasaranTugas(tugasUji('penumpang'))).toBeNull();
    expect(sasaranTugas(tugasUji('kota'))).toBeNull();
    expect(sasaranTugas(tugasUji('laba', { tuas: { jenis: 'keuangan' } }))).toEqual({ tab: 'terminal', selektor: '[data-kartu="keuangan"]' });
    expect(sasaranTugas(tugasUji('kepuasan', { tuas: { jenis: 'kepuasan' } }))).toEqual({ popup: 'kepuasan' });
    expect(sasaranTugas(tugasUji('kota', aksi({ jenis: 'bangun', bangunan: 'jalur' })))).toEqual({ tab: 'bangun', selektor: '.item-bangun[data-bangunan="jalur"] .tombol-beli', cadangan: '.item-bangun[data-bangunan="jalur"]' });
    expect(sasaranTugas(tugasUji('bangun', aksi({ jenis: 'beliTeknologi', teknologi: 'jadwalDigital' })))).toEqual({
      tab: 'bangun',
      selektor: '.item-modern[data-teknologi="jadwalDigital"] .tombol-beli',
      cadangan: '.item-modern[data-teknologi="jadwalDigital"]',
    });
    expect(sasaranTugas(tugasUji('perbaikan', aksi({ jenis: 'rekrut', petugas: 'petugasToilet' })))).toEqual({
      tab: 'petugas',
      selektor: '.item-petugas[data-petugas="petugasToilet"] .tombol-tambah',
      cadangan: '.item-petugas[data-petugas="petugasToilet"]',
    });
    expect(sasaranTugas(tugasUji('kios', aksi({ jenis: 'saranTarif', tarif: 'sewaKios' })))).toEqual({
      tab: 'terminal',
      selektor: '.item-tarif[data-tarif="sewaKios"] .harga-saran',
      cadangan: '.item-tarif[data-tarif="sewaKios"]',
    });
    expect(sasaranTugas(tugasUji('daftarPo', aksi({ jenis: 'daftarPo', po: 'kopiGayo' })))).toEqual({ tab: 'po', selektor: '.item-po[data-po="kopiGayo"] .tombol-beli', cadangan: '.item-po[data-po="kopiGayo"]' });
  });

  it('toast: tugas selesai, Rapor naik (dengan hadiah), musim selesai; terbuka tanpa toast', () => {
    const m0 = terbuka(0).musim;
    expect(notifikasiMusim(buatMusimAwal(), m0)).toEqual([]);
    const selesai = { ...tambahPoin(m0, 10 + 40), statistik: { ...m0.statistik, tugas: 1 } };
    expect(notifikasiMusim({ ...m0, poin: 40 }, { ...selesai, poin: 50 })).toEqual([TEKS.notifTugasSelesai, '🎓 Rapor naik ke tingkat 1: Lencana Peserta Musim Hujan 2026']);
    const lima = tambahPoin(m0, 45 * 5);
    expect(notifikasiMusim(tambahPoin(m0, 45 * 4), lima)).toEqual(['🎓 Rapor naik ke tingkat 5: Spanduk gapura Musim Hujan terpasang']);
    expect(notifikasiMusim(tambahPoin(m0, 45 * 8), tambahPoin(m0, 45 * 9))).toEqual(['🎓 Rapor naik ke tingkat 9']);
    expect(notifikasiMusim(m0, { ...m0, id: '2027-01-11', poin: 0 })).toEqual(['🌧️ Musim Hujan selesai']);
  });

  it('popup rapor & Surat Armada: teks bagian 8', () => {
    const r = { id: '2026-11-30', tingkat: 24, poin: 1100, tugas: 96, tantangan: 9, lvAwal: 41, lvAkhir: 120, penumpang: 2_300_000, hiasan: ['spanduk-hujan', 'seragam-hujan', 'papan-hujan'] };
    expect(judulRapor(r)).toBe('🎓 Rapor Musim Hujan 2026');
    // Nilai dan tingkat dua baris; terminal dan penumpang saat bermain dua baris (P-12, AC-GP-21).
    expect(isiRapor(r, musimPada(pada(42)))).toEqual({
      nilai: 'Sangat Baik',
      tingkat: 'tingkat 24 dari 30',
      baris: ['Tugas selesai 96 · tantangan 9', 'Terminal: Lv 41 → Lv 120', 'Penumpang saat kamu bermain: 2,3 jt', 'Hiasan baru: spanduk, seragam, papan gapura', '🧧 Musim Imlek dimulai hari ini.'],
    });
    // Penumpang 0 (mis. pemain yang hanya main offline): barisnya tidak ada.
    expect(isiRapor({ ...r, penumpang: 0, hiasan: [] }, null).baris).toEqual(['Tugas selesai 96 · tantangan 9', 'Terminal: Lv 41 → Lv 120']);
    // Surat Armada tanpa awalan "PO" supaya satu baris (GP-1).
    expect(teksSuratPo({ po: 'peuyeumKilat', level: 6, levelSesudah: 6, rasioSesudah: 0.5 })).toBe('Peuyeum Kilat · Lv 6 → 50% ke Lv 7');
    expect(teksSuratPo({ po: 'peuyeumKilat', level: 6, levelSesudah: 7, rasioSesudah: 0.1 })).toBe('Peuyeum Kilat · Lv 6 → Lv 7');
    expect(teksSuratPo({ po: 'wayangLestari', level: 19, levelSesudah: 19, rasioSesudah: 0.9 })).toBe('Wayang Lestari · Lv 19 → 90% ke Lv 20');
  });

  it('foto: bingkai musim yang dipakai & baris "MUSIM HUJAN 2026 · Lencana Lulus"; tanpa bingkai = bawaan', () => {
    const s = terbuka(0);
    expect(bingkaiFoto(s)).toBeNull();
    const b = denganMusim(s, { ...tambahPoin(s.musim, 45 * 20) });
    expect(bingkaiFoto(b)).toEqual({ warna: '#38bdf8', baris: 'MUSIM HUJAN 2026 · Lencana Lulus' });
    // Musim baru tanpa lencana: musim terakhir di riwayat.
    const lanjut = perbaruiMusim(b, pada(42));
    expect(bingkaiFoto(lanjut)!.baris).toBe('MUSIM HUJAN 2026 · Lencana Lulus');
  });
});

describe('analitik musim (bagian 9.2)', () => {
  const nilaiSah = (d: DataAnalitik | undefined): void => {
    for (const v of Object.values(d ?? {})) expect(['number', 'boolean', 'string']).toContain(typeof v);
  };

  it('musim_buka, tugas_selesai, rapor_naik dari perubahan state; hanya id & angka', () => {
    const lama = terminal();
    const buka = bukaMusim(lama, pada(0));
    expect(peristiwaMusim(lama, buka)).toEqual([{ nama: 'musim_buka', data: { musim: '2026-11-30' } }]);
    const i = buka.musim.tugas.findIndex((t) => t.templat !== 'laba' && KELOMPOK_TUGAS[t.templat] !== 'kelola');
    const hampir = denganMusim(buka, { poin: 40, tugas: buka.musim.tugas.map((t, j) => (j === i ? { ...t, progres: t.target } : t)) });
    const selesai = jalankan(hampir, 0.1);
    const p = peristiwaMusim(hampir, selesai);
    expect(p.map((x) => x.nama)).toEqual(['tugas_selesai', 'rapor_naik']);
    expect(p[0]!.data).toEqual({ templat: buka.musim.tugas[i]!.templat, musim: '2026-11-30', kelas: kelasTerminal(selesai) });
    expect(p[1]!.data).toEqual({ musim: '2026-11-30', tingkat: 1 });
    for (const x of p) nilaiSah(x.data);
    expect(peristiwaMusim(selesai, selesai)).toEqual([]);
  });

  it('tugas_ganti, hiasan_pakai, rapor_musim dari aksi; templat & item dari config, tanpa teks bebas', () => {
    const s = denganMusim(terbuka(0), { koleksi: ['spanduk-hujan'], rapor: { id: '2026-11-30', tingkat: 24, poin: 1100, tugas: 96, tantangan: 9, lvAwal: 41, lvAkhir: 120, penumpang: 2300000, hiasan: [] } });
    const ganti = terapkanAksi(s, { jenis: 'gantiTugas', indeks: 0, cara: 'gratis' });
    expect(peristiwaAksi({ jenis: 'gantiTugas', indeks: 0, cara: 'gratis' }, s, ganti)).toEqual([{ nama: 'tugas_ganti', data: { templat: s.musim.tugas[0]!.templat, cara: 'gratis' } }]);
    const pakai = terapkanAksi(s, { jenis: 'pakaiHiasan', slot: 'spanduk', item: 'spanduk-hujan' });
    expect(peristiwaAksi({ jenis: 'pakaiHiasan', slot: 'spanduk', item: 'spanduk-hujan' }, s, pakai)).toEqual([{ nama: 'hiasan_pakai', data: { slot: 'spanduk', item: 'spanduk-hujan', pakai: true } }]);
    const lepas = terapkanAksi(pakai, { jenis: 'pakaiHiasan', slot: 'spanduk', item: null });
    expect(peristiwaAksi({ jenis: 'pakaiHiasan', slot: 'spanduk', item: null }, pakai, lepas)).toEqual([{ nama: 'hiasan_pakai', data: { slot: 'spanduk', item: 'spanduk-hujan', pakai: false } }]);
    const tutup = terapkanAksi(s, { jenis: 'tutupRapor' });
    expect(peristiwaAksi({ jenis: 'tutupRapor' }, s, tutup)).toEqual([{ nama: 'rapor_musim', data: { musim: '2026-11-30', tingkat: 24, tugas: 96, tantangan: 9 } }]);
    const surat = denganMusim(s, { suratArmada: 1 });
    expect(peristiwaAksi({ jenis: 'pakaiSuratArmada', po: 'bakpiaRasa' }, surat, terapkanAksi(surat, { jenis: 'pakaiSuratArmada', po: 'bakpiaRasa' }))).toEqual([]);
  });

  it('di antara 6 peristiwa Musim hanya hiasan_pakai yang sekali per sesi per data', () => {
    const terkirim: string[] = [];
    const p = new PencatatAnalitik({ catat: (nama) => terkirim.push(nama) });
    const musim: [string, DataAnalitik][] = [
      ['musim_buka', { musim: '2026-11-30' }],
      ['tugas_selesai', { templat: 'kota', musim: '2026-11-30', kelas: 1 }],
      ['tugas_ganti', { templat: 'kota', cara: 'gratis' }],
      ['rapor_naik', { musim: '2026-11-30', tingkat: 3 }],
      ['rapor_musim', { musim: '2026-11-30', tingkat: 24, tugas: 96, tantangan: 9 }],
      ['hiasan_pakai', { slot: 'spanduk', item: 'spanduk-hujan', pakai: true }],
    ];
    for (let i = 0; i < 2; i++) for (const [nama, data] of musim) p.catat(nama, data);
    for (const [nama] of musim) expect(terkirim.filter((x) => x === nama), nama).toHaveLength(nama === 'hiasan_pakai' ? 1 : 2);
    // "Per data": melepas hiasan yang sama adalah data lain, jadi tetap tercatat (sekali).
    p.catat('hiasan_pakai', { slot: 'spanduk', item: 'spanduk-hujan', pakai: false });
    p.catat('hiasan_pakai', { slot: 'spanduk', item: 'spanduk-hujan', pakai: false });
    expect(terkirim.filter((x) => x === 'hiasan_pakai')).toHaveLength(2);
  });

  it('ringkasan_sesi.musim_tingkat: −1 sebelum terbuka, lalu tingkat rapor', () => {
    const s = terminal();
    expect(ringkasanSesi(s, s, 0, 60)['musim_tingkat']).toBe(-1);
    const m = denganMusim(terbuka(0), { poin: 100 });
    expect(ringkasanSesi(m, m, 0, 60)['musim_tingkat']).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Ronde perbaikan 1 (playtest Citra P-1..P-9, QA Nisa GP-1..3): AC-GP-16..22

/** Save pengikut tujuan asli dari playtest Citra (docs/design/20261104-musim-terminal/playtest/save/), tanpa nama terminal. */
const FIXTURE = { lv15: 'dump-J4-lv7', lv19: 'dump-J4-lv18', lv27: 'dump-J4-lv24', lv39: 'dump-J3-h2', lv46: 'dump-K2-h1', lv75: 'dump-K2-h12' } as const;

function muat(nama: keyof typeof FIXTURE): { readonly s: GameState; readonly hari: string } {
  const d = JSON.parse(readFileSync(new URL(`./fixtures/musim/${FIXTURE[nama]}.json`, import.meta.url), 'utf8')) as { ms: number; save: string };
  return { s: deserialisasi(d.save, d.ms), hari: kunciHariWib(d.ms) };
}

/** Kemajuan tugas ini selama satu hari terminal main aktif (144 tick × 10 dtk). */
function majuSehari(s: GameState, t: TugasAktif): number {
  let x: GameState = { ...s, musim: { ...s.musim, tugas: [{ ...t, target: 1e15 }] } };
  for (let i = 0; i < 144; i++) x = tick(x, 10);
  return x.musim.tugas[0]!.progres;
}

const aksiTuas = (s: GameState, t: TugasAktif | null): AksiTuas | null => {
  const tuas = t ? tuasTugas(s, t) : null;
  return tuas?.jenis === 'aksi' ? tuas.aksi : null;
};

describe('tugas kepuasan dan laba (AC-GP-16, AC-GP-20)', () => {
  it('kepuasan maju bila persen bulatnya (seperti HUD) ≥ ambang: 59,74 % memenuhi 60 %, 59,4 % tidak', () => {
    const s = terbuka(0);
    const t: TugasAktif = { hari: '2026-11-30', templat: 'kepuasan', target: 480, progres: 0, param: 0.6, selesai: false };
    const op = operasiState(s);
    const maju = (nilai: number): number =>
      majukanTugas({ ...s.musim, tugas: [t] }, { dt: 10, op: { ...op, kepuasan: { ...op.kepuasan, nilai } }, keu: keuanganSekarang(s), labaKemajuan: 0 }).tugas[0]!.progres;
    expect(maju(0.5974)).toBe(10);
    expect(maju(0.6)).toBe(10);
    expect(maju(0.594)).toBe(0);
  });

  it('templat kepuasan hanya dibuat bila kepuasan ≥ 50 %: Lv 27 (49,3 %) tidak, Lv 46 (53,8 %) ya dengan ambang 50 %', () => {
    const lv27 = muat('lv27');
    expect(Math.round(operasiState(lv27.s).kepuasan.nilai * 100)).toBe(49);
    expect(buatTugas(lv27.s, 'kepuasan', lv27.hari)).toBeNull();
    for (let n = 0; n < 14; n++) expect(buatTugasHari(lv27.s, geserHari(lv27.hari, n), new Set()).some((x) => x.templat === 'kepuasan')).toBe(false);
    const lv46 = muat('lv46');
    expect(buatTugas(lv46.s, 'kepuasan', lv46.hari)).toMatchObject({ param: 0.5 });
  });

  it('templat laba hanya dibuat bila laba dengan kontrak (tarif pemain) > 0', () => {
    const rugi = denganLevelTerminal(stateOtomatis({ jendela: 1 }, 1e9, ['peron', 'gerbang', 'kebersihan', 'satpam', 'satpam', 'kebersihan']), 8);
    expect(labaDenganKontrak(acuanHarian(rugi, EKONOMI, rugi.terminal.tarif))).toBeLessThanOrEqual(0);
    expect(buatTugas(rugi, 'laba', '2026-12-01')).toBeNull();
    const untung = muat('lv19');
    expect(labaDenganKontrak(acuanHarian(untung.s, EKONOMI, untung.s.terminal.tarif))).toBeGreaterThan(0);
    expect(buatTugas(untung.s, 'laba', untung.hari)).not.toBeNull();
  });
});

describe('tuas "›" menunjuk aksi yang memajukan tugas (AC-GP-17)', () => {
  it.each(Object.keys(FIXTURE) as (keyof typeof FIXTURE)[])('%s: aksi tuas memajukan tugasnya dan lolos aturan aman', (nama) => {
    const { s, hari } = muat(nama);
    for (const templat of TEMPLAT_TUGAS) {
      const t = buatTugas(s, templat, hari);
      if (!t) continue;
      const tuas = tuasTugas(s, t);
      if (templat === 'penumpang') expect(tuas).toBeNull();
      else if (templat === 'laba') expect(tuas).toEqual({ jenis: 'keuangan' });
      else if (templat === 'kepuasan') expect(tuas).toEqual({ jenis: 'kepuasan' });
      if (tuas?.jenis !== 'aksi') continue;
      const s2 = terapkanAksi(s, tuas.aksi);
      expect(s2, templat).not.toBe(s);
      // Aman menurut baris tujuan: kas sesudahnya ≥ cadangan B (saran tarif tidak mengeluarkan uang); rekrut: laba tetap > 0.
      if (tuas.aksi.jenis !== 'saranTarif') expect(s2.kas, templat).toBeGreaterThanOrEqual(cadanganKas(s2, EKONOMI, 1));
      if (tuas.aksi.jenis === 'rekrut') expect(labaDenganKontrak(acuanHarian(s2, EKONOMI, s2.terminal.tarif)), templat).toBeGreaterThan(0);
      if (templat === 'bangun' || templat === 'daftarPo') {
        expect(terapkanAksi({ ...s, musim: { ...s.musim, tugas: [t] } }, tuas.aksi).musim.tugas[0]!.selesai, templat).toBe(true);
      } else if (templat === 'perbaikan') {
        const c = t.param as 'kebersihan';
        expect(operasiState(s2).kepuasan[c], templat).toBeGreaterThanOrEqual(t.target - 1e-9);
        expect(operasiState(s2).kepuasan[c], templat).toBeGreaterThan(operasiState(s).kepuasan[c]);
      } else {
        // Sorotan: lebih dari perbaikanNaikMin (2 %) lebih cepat sepanjang satu hari terminal main.
        expect(majuSehari(s2, t), templat).toBeGreaterThan(majuSehari(s, t) * (1 + MUSIM.tugas.perbaikanNaikMin));
      }
    }
  });

  it('kasus playtest: perbaikan (P-2), bangun aman (P-3), tugas PO (P-5), kios (P-6)', () => {
    // P-2 Lv 15: kebersihan hanya naik ke 100 % lewat petugas toilet (toilet tanpa petugasnya menahan kebersihan).
    const lv15 = muat('lv15');
    expect(perbaikanTerlemah(lv15.s)).toMatchObject({ komponen: 'kebersihan', target: 1, aksi: { jenis: 'rekrut', petugas: 'petugasToilet' } });
    expect(aksiTuas(lv15.s, buatTugas(lv15.s, 'perbaikan', lv15.hari))).toEqual({ jenis: 'rekrut', petugas: 'petugasToilet' });
    // P-2 Lv 19: fasilitas tidak lewat toilet (tidak bisa dibangun).
    const lv19 = muat('lv19');
    const perbaikan19 = buatTugas(lv19.s, 'perbaikan', lv19.hari)!;
    expect(perbaikan19.param).toBe('fasilitas');
    expect(aksiTuas(lv19.s, perbaikan19)).toEqual({ jenis: 'bangun', bangunan: 'kios' });
    // P-3 Lv 15: kursi, kios, toko melanggar cadangan B; hanya pos retribusi yang aman. Lv 39: jendela Rp 423 jt
    // melanggar cadangan, tugas bangun lewat modernisasi.
    expect(bangunanAman(lv15.s)).toEqual({ jenis: 'bangun', bangunan: 'posRetribusi' });
    expect(aksiTuas(lv15.s, buatTugas(lv15.s, 'bangun', lv15.hari))).toEqual({ jenis: 'bangun', bangunan: 'posRetribusi' });
    const lv39 = muat('lv39');
    expect(aksiTuas(lv39.s, buatTugas(lv39.s, 'bangun', lv39.hari))?.jenis).toBe('beliTeknologi');
    // P-5: selama slot jalur ada, tugas arus menunjuk jalur; peron leher botol tanpa jalur (Lv 46, 75): tanpa tuas.
    for (const nama of ['lv19', 'lv27'] as const) {
      const f = muat(nama);
      for (const templat of ['kota', 'kelasTinggi', 'poTerendah'] as const) expect(aksiTuas(f.s, buatTugas(f.s, templat, f.hari)), `${nama} ${templat}`).toEqual({ jenis: 'bangun', bangunan: 'jalur' });
    }
    for (const nama of ['lv46', 'lv75'] as const) {
      const f = muat(nama);
      for (const templat of ['kota', 'antarpulau', 'kelasTinggi', 'poTerendah'] as const) {
        const t = buatTugas(f.s, templat, f.hari);
        if (t) expect(tuasTugas(f.s, t), `${nama} ${templat}`).toBeNull();
      }
    }
    // P-6: tugas kios menunjuk saran tarif sewa kios (gratis, ×3–6,7), juga saat slot kios penuh.
    for (const nama of ['lv27', 'lv39', 'lv46', 'lv75'] as const) {
      const f = muat(nama);
      expect(aksiTuas(f.s, buatTugas(f.s, 'kios', f.hari)), nama).toEqual({ jenis: 'saranTarif', tarif: 'sewaKios' });
    }
  });

  it('tuas bangun mengikuti kas: tanpa aksi yang aman, tanpa tuas; tugas selesai tanpa tuas', () => {
    const lv15 = muat('lv15');
    const t = buatTugas(lv15.s, 'bangun', lv15.hari)!;
    expect(tuasTugas({ ...lv15.s, kas: 0 }, t)).toBeNull();
    expect(tuasTugas(lv15.s, { ...t, selesai: true })).toBeNull();
  });

  it('model: tuas dibaca dari tugas (disimpan per susunan terminal) sama dengan tuasTugas', () => {
    const { s } = muat('lv27');
    expect(levelTerminal(s)).toBe(27);
    const m = modelMusim(s)!;
    for (const t of [...m.hariIni, ...m.kemarin]) expect(t.tuas, t.templat).toEqual(tuasTugas(s, s.musim.tugas[t.indeks]!));
  });
});

describe('urutan kartu tab Target (AC-GP-18)', () => {
  it('kartu yang bisa diklaim di atas kartu Musim; tanpa klaim, Musim teratas', () => {
    const s = perbaruiJamNyata(terbuka(0), pada(0));
    expect(urutanKartuTarget(buatModel(s))).toEqual(['musim', 'event', 'target', 'tantangan']);
    const klaim = { ...s, harian: { ...s.harian, target: 10, progres: 10, diklaim: false } };
    expect(urutanKartuTarget(buatModel(klaim))).toEqual(['target', 'musim', 'event', 'tantangan']);
    const diklaim = { ...klaim, harian: { ...klaim.harian, diklaim: true } };
    expect(urutanKartuTarget(buatModel(diklaim))[0]).toBe('musim');
    const m = buatModel(klaim);
    const tantangan: ModelTampilan = { ...m, mingguan: { ...m.mingguan!, daftar: m.mingguan!.daftar.map((x, i) => (i === 1 ? { ...x, selesai: true, diklaim: false } : x)) } };
    expect(urutanKartuTarget(tantangan)).toEqual(['target', 'tantangan', 'musim', 'event']);
  });
});

describe('save: tiket, surat, dan poin saat jam mundur (AC-GP-22)', () => {
  const dasar = keSaveV3(terbuka(0)) as unknown as Record<string, unknown>;
  const muatMusim = (musim: Record<string, unknown>, ms: number): MusimState => deserialisasi(JSON.stringify({ ...dasar, musim }), ms).musim;

  it('tiket ganti dan Surat Armada dijepit ke yang bisa diberikan tabel hadiah sejak Musim 1 (GP-2)', () => {
    // Per musim paling banyak 4 × 2 tiket + 5 hiasan duplikat × 1 = 13 tiket, dan 2 Surat Armada.
    expect(muatMusim({ id: '2026-11-30', tiketGanti: 1e9, suratArmada: 1e9 }, pada(1))).toMatchObject({ tiketGanti: 13, suratArmada: 2 });
    expect(muatMusim({ id: '2027-01-11', tiketGanti: 1e9, suratArmada: 1e9 }, pada(43))).toMatchObject({ tiketGanti: 26, suratArmada: 4 });
    expect(muatMusim({ id: '2026-11-30', tiketGanti: 7, suratArmada: 1 }, pada(1))).toMatchObject({ tiketGanti: 7, suratArmada: 1 });
    expect(muatMusim({ id: null, tiketGanti: 5, suratArmada: 1 }, pada(1))).toMatchObject({ tiketGanti: 0, suratArmada: 0 });
  });

  it('jam perangkat mundur tidak memotong poin yang sah; poin mustahil tetap dijepit (GP-3)', () => {
    const blok = { id: '2026-11-30', poin: 800, hariTugas: '2026-12-19' };
    expect(muatMusim(blok, pada(19)).poin).toBe(800);
    expect(muatMusim(blok, pada(2)).poin).toBe(800);
    expect(muatMusim(blok, pada(-3)).poin).toBe(800);
    // Poin mustahil tetap dijepit (hari ke-20: 20 × 60 + 3 minggu × 280).
    expect(muatMusim({ ...blok, poin: 1e12 }, pada(2)).poin).toBe(20 * 60 + 3 * 280);
    // Tanpa hari tugas tersimpan, jam yang menentukan (seperti sebelumnya).
    expect(muatMusim({ id: '2026-11-30', poin: 800 }, pada(2)).poin).toBe(3 * 60 + 280);
  });
});
