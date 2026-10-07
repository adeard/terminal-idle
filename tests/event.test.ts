import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { KUNCI_SAVE, SesiGame, slotLokal, type Penyimpanan } from '../src/app/sesi';
import { EKONOMI } from '../src/config/economy.config';
import { terapkanAksi } from '../src/sim/aksi';
import { eventBerikutnya, eventPada, idulFitri, tengahMalamWib } from '../src/sim/event';
import { deserialisasi, serialisasi } from '../src/sim/save';
import {
  bisaKlaimEvent,
  hadiahTahapEvent,
  klaimEvent,
  pendapatanPerDetikState,
  pengaliEvent,
  perbaruiEvent,
  rincianPendapatan,
  tandaiWaktu,
  tick,
  type GameState,
} from '../src/sim/state';
import { stateOtomatis } from './helpers';

const wib = (tahun: number, bulan: number, tanggal: number, jam = 12): number => tengahMalamWib(tahun, bulan, tanggal) + jam * 3_600_000;
const edisiPada = (ms: number): string | null => eventPada(ms)?.edisi ?? null;

describe('kalender event musiman (WIB)', () => {
  it('Nataru 20 Desember – 5 Januari, termasuk pergantian tahun; batasnya tengah malam WIB', () => {
    expect(edisiPada(wib(2026, 12, 25))).toBe('nataru-2026');
    expect(edisiPada(wib(2027, 1, 3))).toBe('nataru-2026');
    expect(edisiPada(wib(2027, 1, 5, 23.9))).toBe('nataru-2026');
    expect(edisiPada(wib(2027, 1, 6, 0.1))).toBeNull();
    expect(edisiPada(tengahMalamWib(2026, 12, 20))).toBe('nataru-2026');
    expect(edisiPada(tengahMalamWib(2026, 12, 20) - 1)).toBeNull();
  });

  it('HUT RI 10–20 Agustus', () => {
    expect(edisiPada(wib(2027, 8, 17))).toBe('hutRi-2027');
    expect(edisiPada(wib(2027, 8, 9))).toBeNull();
    expect(edisiPada(wib(2027, 8, 21))).toBeNull();
  });

  it('Mudik Lebaran H−10 sampai H+7 Idul Fitri; tahun di luar tabel diperkirakan', () => {
    expect(idulFitri(2027)).toBe(tengahMalamWib(2027, 3, 10));
    expect(edisiPada(wib(2027, 2, 28))).toBe('mudikLebaran-2027');
    expect(edisiPada(wib(2027, 3, 17))).toBe('mudikLebaran-2027');
    expect(edisiPada(wib(2027, 2, 27))).toBeNull();
    expect(edisiPada(wib(2027, 3, 18))).toBeNull();
    // Perkiraan: tiap tahun hijriah maju ±11 hari lebih awal, tetap jatuh di tahun yang diminta.
    const lebaran2031 = new Date(idulFitri(2031) + 7 * 3_600_000);
    expect(lebaran2031.getUTCFullYear()).toBe(2031);
    expect(idulFitri(2031)).toBeLessThan(tengahMalamWib(2031, 2, 5));
    expect(idulFitri(2031)).toBeGreaterThan(tengahMalamWib(2031, 1, 15));
  });

  it('event berikutnya setelah akhir September 2026 = Nataru 2026', () => {
    expect(eventBerikutnya(wib(2026, 9, 29)).edisi).toBe('nataru-2026');
    expect(eventBerikutnya(wib(2027, 1, 10)).edisi).toBe('mudikLebaran-2027');
  });
});

describe('event musiman di game', () => {
  const SIANG_BIASA = wib(2026, 10, 1);
  const MUDIK = wib(2027, 3, 5);
  const siap = (): GameState => stateOtomatis({ peron: 20, loket: 20, keberangkatan: 20 });

  it('dimulai dari jam nyata: pendapatan naik, target tahap ditetapkan dari arus saat itu', () => {
    const s = siap();
    expect(perbaruiEvent(s, SIANG_BIASA)).toBe(s);
    const e = perbaruiEvent(s, MUDIK);
    expect(e.event.aktif?.id).toBe('mudikLebaran');
    expect(e.event.edisi).toBe('mudikLebaran-2027');
    expect(e.event.target).toHaveLength(EKONOMI.event.mudikLebaran.targetDetik.length);
    expect([...e.event.target]).toEqual([...e.event.target].sort((a, b) => a - b));
    expect(pengaliEvent(e)).toBe(EKONOMI.event.mudikLebaran.pengaliPendapatan);
    expect(rincianPendapatan(e).tiket.toNumber()).toBeCloseTo(rincianPendapatan(s).tiket.toNumber() * EKONOMI.event.mudikLebaran.pengaliPendapatan, 9);
    expect(pendapatanPerDetikState(e).toNumber()).toBeCloseTo(pendapatanPerDetikState(s).toNumber() * 1.5, 9);
    // Jam yang sama lagi: tidak berubah.
    expect(perbaruiEvent(e, MUDIK + 60_000)).toBe(e);
  });

  it('progres hanya bertambah selama event; setelah selesai edisi & progres tetap, lalu dilanjutkan bila dibuka lagi', () => {
    let s = perbaruiEvent(siap(), MUDIK);
    for (let i = 0; i < 100; i++) s = tick(s, 0.1);
    const progres = s.event.progres;
    expect(progres).toBeGreaterThan(0);
    const selesai = perbaruiEvent(s, wib(2027, 4, 1));
    expect(selesai.event.aktif).toBeNull();
    expect(selesai.event.edisi).toBe('mudikLebaran-2027');
    expect(tick(selesai, 1).event.progres).toBe(progres);
    expect(pengaliEvent(selesai)).toBe(1);
    // Dibuka lagi masih di masa mudik: progres dilanjutkan, bukan diulang.
    expect(perbaruiEvent(selesai, MUDIK).event.progres).toBe(progres);
    // Edisi berikutnya (HUT RI) mulai dari nol.
    const hut = perbaruiEvent(selesai, wib(2027, 8, 17));
    expect(hut.event.edisi).toBe('hutRi-2027');
    expect(hut.event.progres).toBe(0);
    expect(hut.event.diklaim).toBe(0);
  });

  it('klaim tiap tahap: hadiah uang, tahap terakhir membawa PO eksklusif; boleh diklaim setelah event selesai', () => {
    let s = perbaruiEvent({ ...siap(), uang: new Decimal(0) }, MUDIK);
    expect(bisaKlaimEvent(s)).toBe(false);
    expect(klaimEvent(s)).toBe(s);
    const target = s.event.target;
    s = { ...s, event: { ...s.event, progres: target[target.length - 1]! } };
    for (let i = 0; i < target.length; i++) {
      const terakhir = i === target.length - 1;
      // Tahap terakhir diklaim setelah event selesai.
      if (terakhir) s = perbaruiEvent(s, wib(2027, 4, 1));
      expect(bisaKlaimEvent(s)).toBe(true);
      const hadiah = hadiahTahapEvent(s).toNumber();
      expect(hadiah).toBeGreaterThan(0);
      const sebelum = s.uang.toNumber();
      s = klaimEvent(s);
      expect(s.uang.toNumber()).toBeCloseTo(sebelum + hadiah, 6);
      // PO eksklusif jadi bisa didaftarkan (gratis), belum langsung terdaftar.
      expect(s.mitra.hadiahEvent.includes('mudikCeria')).toBe(terakhir);
    }
    expect(bisaKlaimEvent(s)).toBe(false);
    expect(klaimEvent(s)).toBe(s);
  });

  it('tersimpan: edisi, progres, tahap diklaim, target', () => {
    let s = perbaruiEvent(siap(), MUDIK);
    s = { ...s, event: { ...s.event, progres: 1234.5, diklaim: 1 } };
    const d = deserialisasi(serialisasi(s), MUDIK);
    expect(d.event).toEqual(s.event);
    const mentah = JSON.parse(serialisasi(s)) as { event: { aktif: { id: string } } };
    mentah.event.aktif.id = 'eventMasaDepan';
    expect(deserialisasi(JSON.stringify(mentah), MUDIK).event.aktif).toBeNull();
  });

  it('aksi & analitik', () => {
    const s0 = perbaruiEvent(siap(), MUDIK);
    const s = { ...s0, event: { ...s0.event, progres: s0.event.target[0]! } };
    const baru = terapkanAksi(s, { jenis: 'klaimEvent' });
    expect(baru.event.diklaim).toBe(1);
    expect(peristiwaAksi({ jenis: 'klaimEvent' }, s, baru)).toEqual([{ nama: 'klaim_event', data: { edisi: 'mudikLebaran-2027', tahap: 1 } }]);
  });

  it('sesi mencocokkan event dengan jam dinding saat mulai; event uji (server dev) bisa dipaksa', async () => {
    const penyimpanan: Penyimpanan & { isi: Map<string, string> } = {
      isi: new Map(),
      async baca(k) {
        return this.isi.get(k) ?? null;
      },
      async tulis(k, v) {
        this.isi.set(k, v);
      },
      async hapus(k) {
        this.isi.delete(k);
      },
    };
    penyimpanan.isi.set(KUNCI_SAVE, serialisasi(tandaiWaktu(siap(), wib(2026, 12, 24))));
    const { sesi } = await SesiGame.mulai({ slot: slotLokal(penyimpanan), jam: () => wib(2026, 12, 25) });
    expect(sesi.pengendali.state.event.aktif?.id).toBe('nataru');
    const uji = await SesiGame.mulai({ slot: slotLokal(penyimpanan), jam: () => wib(2026, 10, 1), eventUji: 'hutRi' });
    expect(uji.sesi.pengendali.state.event.aktif?.id).toBe('hutRi');
  });
});
