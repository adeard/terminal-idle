import { describe, expect, it, vi } from 'vitest';
import { hadiahSetelahIklan, tontonBerhadiah, type HasilIklan, type TempatIklan } from '../src/app/iklan';
import { EKONOMI } from '../src/config/economy.config';
import { terapkanAksi, type Aksi } from '../src/sim/aksi';
import { terapkanOffline, type GameState } from '../src/sim/state';
import { denganNilaiKontrak, denganPetugas, jalankan, stateOtomatis, T0 } from './helpers';

/**
 * QA S-3 / AC-GP-23: aksi hadiah iklan (klaim 2× target & penghargaan, Bus Emas, offline 2×, boost,
 * percepat proyek) dikirim hanya setelah iklan selesai ditonton; dilewati, gagal, atau galat penyedia
 * tidak mengirim apa pun. UI DOM tidak punya harness tes, jadi alurnya lewat dua helper murni di
 * src/app/iklan.ts, dan tes sumber di bawah memastikan semua tombol iklan memakai helper itu.
 */

const HASIL: readonly (HasilIklan | 'galat')[] = ['ditonton', 'dilewati', 'gagal', 'galat'];

/** Penyedia iklan palsu dengan hasil tetap ('galat' = janji ditolak). */
function penyedia(hasil: HasilIklan | 'galat'): { readonly tempat: TempatIklan[]; tonton(t: TempatIklan): Promise<HasilIklan> } {
  const tempat: TempatIklan[] = [];
  return {
    tempat,
    tonton: (t) => {
      tempat.push(t);
      return hasil === 'galat' ? Promise.reject(new Error('galat penyedia')) : Promise.resolve(hasil);
    },
  };
}

const H = EKONOMI.hadiah;
const JAM_MS = 3_600_000;

/** Tiap tombol iklan: aksi hadiahnya, state tempat aksi itu berlaku, dan tanda bahwa hadiahnya diterima. */
const KASUS: readonly { readonly tempat: TempatIklan; readonly aksi: Aksi; readonly state: () => GameState; readonly diterima: (awal: GameState, akhir: GameState) => boolean }[] = [
  {
    tempat: 'target2x',
    aksi: { jenis: 'klaimTarget', ganda: true },
    state: () => ({ ...stateOtomatis(), harian: { ...stateOtomatis().harian, progres: 999, target: 10 } }),
    diterima: (a, b) => b.kas > a.kas && b.harian.diklaim,
  },
  {
    tempat: 'penghargaan2x',
    aksi: { jenis: 'klaimPencapaian', pencapaian: 'petugasPertama', ganda: true },
    state: () => ({ ...stateOtomatis(), pencapaian: { tercapai: ['petugasPertama'], diklaim: [] } }),
    diterima: (a, b) => b.kas > a.kas,
  },
  {
    tempat: 'busEmas',
    aksi: { jenis: 'klaimBusEmas' },
    state: () => terapkanAksi(jalankan(stateOtomatis(), H.busEmasSelangDetik[0] + 1), { jenis: 'tahanBusEmas' }),
    diterima: (a, b) => b.kas > a.kas,
  },
  {
    tempat: 'offline2x',
    aksi: { jenis: 'klaimBonusOffline' },
    state: () => terapkanOffline({ ...denganPetugas(denganNilaiKontrak(stateOtomatis(), 70_000_000), ['manajerOperasional']), waktuTerakhirMs: T0 }, T0 + JAM_MS).state,
    diterima: (a, b) => b.kas > a.kas,
  },
  {
    tempat: 'boost',
    aksi: { jenis: 'aktifkanBoost' },
    state: () => stateOtomatis(),
    diterima: (a, b) => b.hadiah.boostDetik > a.hadiah.boostDetik,
  },
  {
    tempat: 'percepatProyek',
    aksi: { jenis: 'percepatProyek' },
    state: () => ({ ...stateOtomatis(), perkembangan: { ...stateOtomatis().perkembangan, proyekDetik: 1440 } }),
    diterima: (a, b) => b.perkembangan.proyekDetik < a.perkembangan.proyekDetik,
  },
];

describe('iklan berhadiah: aksi hadiah hanya setelah iklan selesai ditonton (QA S-3, AC-GP-23)', () => {
  it('tontonBerhadiah: true hanya untuk "ditonton"; hasil dilaporkan sekali, galat penyedia = "gagal"', async () => {
    for (const h of HASIL) {
      const p = penyedia(h);
      const lapor: HasilIklan[] = [];
      expect(await tontonBerhadiah(p, 'target2x', (x) => lapor.push(x)), h).toBe(h === 'ditonton');
      expect(lapor).toEqual([h === 'galat' ? 'gagal' : h]);
      expect(p.tempat).toEqual(['target2x']);
    }
  });

  it('hadiahSetelahIklan: iklan diputar seketika (di dalam ketukan); hadiah tidak diberikan selama iklan berjalan, hanya setelah selesai', async () => {
    let selesai: (ok: boolean) => void = () => undefined;
    const tonton = vi.fn(() => new Promise<boolean>((r) => (selesai = r)));
    const beri = vi.fn();
    const janji = hadiahSetelahIklan(tonton, beri);
    expect(tonton).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(beri).not.toHaveBeenCalled();
    selesai(true);
    expect(await janji).toBe(true);
    expect(beri).toHaveBeenCalledTimes(1);
    // Dilewati di tengah jalan: tidak ada hadiah.
    const beriLagi = vi.fn();
    const lagi = hadiahSetelahIklan(() => new Promise<boolean>((r) => (selesai = r)), beriLagi);
    selesai(false);
    expect(await lagi).toBe(false);
    expect(beriLagi).not.toHaveBeenCalled();
  });

  for (const k of KASUS) {
    it(`${k.tempat}: aksi ${k.aksi.jenis} dikirim hanya bila iklan ditonton; dilewati/gagal/galat tidak mengubah state`, async () => {
      for (const h of HASIL) {
        const awal = k.state();
        let s = awal;
        const dikirim: Aksi[] = [];
        const p = penyedia(h);
        const ok = await hadiahSetelahIklan(
          () => tontonBerhadiah(p, k.tempat, () => undefined),
          () => {
            dikirim.push(k.aksi);
            s = terapkanAksi(s, k.aksi);
          },
        );
        expect(p.tempat, h).toEqual([k.tempat]);
        expect(ok, h).toBe(h === 'ditonton');
        if (h === 'ditonton') {
          expect(dikirim).toEqual([k.aksi]);
          expect(k.diterima(awal, s), h).toBe(true);
        } else {
          expect(dikirim, h).toEqual([]);
          expect(s, h).toBe(awal);
        }
      }
    });
  }
});

// Sumber UI (DOM, tanpa harness tes): tiap pemutaran iklan dan tiap aksi hadiah iklan lewat helper di atas.
const SUMBER = import.meta.glob<string>(['../src/main.ts', '../src/ui/**/*.ts'], { query: '?raw', import: 'default', eager: true });
/** Panggilan pemutar iklan dengan argumen (bukan deklarasi `tonton(tempat: …)` dan bukan callback popup `tonton()`). */
const PUTAR_IKLAN = /\b(?:tontonIklan|tonton)\((?!\s*\)|\s*\w+\s*:)/g;
/** Aksi yang hanya boleh dikirim sebagai hadiah iklan. */
const AKSI_HADIAH_IKLAN = /jenis: '(?:klaimBusEmas|klaimBonusOffline|aktifkanBoost|percepatProyek)'|ganda: true/g;
/** Pembungkus yang menunda aksi sampai iklan selesai: helper, dan klaimGanda tab Target (yang memakai helper). */
const PEMBUNGKUS = /\b(?:hadiahSetelahIklan|klaimGanda)\(/g;

/** Posisi `i` ada di dalam argumen panggilan pembungkus terakhir sebelum `i` (kurung belum ditutup). */
function diDalamPembungkus(isi: string, i: number): boolean {
  const awal = [...isi.slice(0, i).matchAll(PEMBUNGKUS)].pop();
  if (!awal) return false;
  const antara = isi.slice(awal.index, i);
  return (antara.match(/\(/g)?.length ?? 0) > (antara.match(/\)/g)?.length ?? 0);
}

describe('sumber UI: tombol iklan memakai hadiahSetelahIklan (AC-GP-23)', () => {
  it('tiap pemutaran iklan adalah argumen pertama hadiahSetelahIklan', () => {
    let jumlah = 0;
    for (const [file, isi] of Object.entries(SUMBER)) {
      for (const m of isi.matchAll(PUTAR_IKLAN)) {
        jumlah++;
        expect(isi.slice(Math.max(0, m.index - 80), m.index), `${file}: ${isi.slice(m.index, m.index + 40)}`).toMatch(/hadiahSetelahIklan\(\s*\(\)\s*=>\s*(?:[\w.]+\.)?$/);
      }
    }
    // percepat & klaimGanda (menu.ts), boost, Bus Emas & offline (main.ts).
    expect(jumlah).toBe(5);
  });

  it('aksi hadiah iklan hanya dikirim dari dalam hadiahSetelahIklan (atau klaimGanda)', () => {
    let jumlah = 0;
    for (const [file, isi] of Object.entries(SUMBER)) {
      for (const m of isi.matchAll(AKSI_HADIAH_IKLAN)) {
        jumlah++;
        expect(diDalamPembungkus(isi, m.index), `${file}: ${m[0]}`).toBe(true);
      }
    }
    // target 2×, penghargaan 2×, percepat (menu.ts); boost, Bus Emas, offline (main.ts).
    expect(jumlah).toBe(6);
  });
});
