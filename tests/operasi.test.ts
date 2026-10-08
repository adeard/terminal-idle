import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { bangunanAwal } from '../src/sim/bangunan';
import { TEKNOLOGI_IDS, type TeknologiId } from '../src/sim/fitur';
import { faktorReputasi } from '../src/sim/mitra';
import { dayaTarikTycoon, hitungOperasi, type KeadaanOperasi } from '../src/sim/operasi';
import { tarifBawaan } from '../src/sim/tarif';

const T = EKONOMI.tycoon;
const SIBUK = { ritme: 1, event: 1 } as const;
const tanpaTeknologi = Object.fromEntries(TEKNOLOGI_IDS.map((id) => [id, false])) as Record<TeknologiId, boolean>;

/** Terminal awal: satu jalur, satu jendela untuk PO Ondel-Ondel (Lv 1, hanya Jakarta, kelas Ekonomi). */
function terminal(ubah: Partial<KeadaanOperasi> = {}): KeadaanOperasi {
  return {
    bangunan: bangunanAwal(),
    petugas: [],
    tarif: tarifBawaan(),
    teknologi: tanpaTeknologi,
    po: [{ id: 'ondelOndel', level: 1, loket: 1, reputasi: 50 }],
    kelasTerminal: 0,
    perluasan: 0,
    ...ubah,
  };
}

/** Permintaan jam sibuk Jakarta (peminat 3) untuk satu PO sendirian. */
const PASAR_JAKARTA = T.pasar.perPeminat * 3;

describe('operasi tycoon: kapasitas & pasar', () => {
  it('terminal awal: kapasitas tiap area dari bangunan; satu jendela loket yang paling lambat', () => {
    const op = hitungOperasi(terminal(), SIBUK);
    expect(op.kapasitas.peron).toBeCloseTo(T.kapasitas.halte, 6);
    expect(op.kapasitas.loket).toBeCloseTo(T.kapasitas.jendela, 6);
    expect(op.kapasitas.keberangkatan).toBeCloseTo(T.kapasitas.gerbang, 6);
    expect(op.kapasitas.pangkalan).toBeCloseTo((10 * T.kapasitas.penumpangPerBus) / T.kapasitas.jamParkirBus, 6);
    expect(op.bottleneck).toBe('loket');
    expect(op.permintaanPuncak).toBeCloseTo(PASAR_JAKARTA, 6);
    expect(op.arusPuncak).toBeCloseTo(T.kapasitas.jendela, 6);
  });

  it('pasar mutlak: membangun melebihi permintaan tidak menambah arus', () => {
    const cukup = terminal({ bangunan: { ...bangunanAwal(), jalur: 2, jendela: 3 }, po: [{ id: 'ondelOndel', level: 1, loket: 3, reputasi: 50 }] });
    const op = hitungOperasi(cukup, SIBUK);
    expect(op.bottleneck).toBeNull();
    expect(op.arusPuncak).toBeCloseTo(op.permintaanPuncak, 6);
    const lebih = hitungOperasi(
      { ...cukup, perluasan: 1, bangunan: { ...cukup.bangunan, jalur: 4, jendela: 6 }, po: [{ id: 'ondelOndel', level: 1, loket: 6, reputasi: 50 }] },
      SIBUK,
    );
    expect(lebih.arusPuncak).toBeCloseTo(op.arusPuncak, 6);
  });

  it('petugas peron & gerbang menambah kapasitas halte/gerbangnya; modernisasi mengalikan', () => {
    const b = { ...bangunanAwal(), jalur: 2 };
    const op = hitungOperasi(terminal({ bangunan: b, petugas: ['peron', 'gerbang', 'gerbang', 'gerbang'] }), SIBUK);
    expect(op.kapasitas.peron).toBeCloseTo(T.kapasitas.halte * (2 + T.kapasitas.bonusPetugas), 6);
    // Gerbang: paling banyak satu petugas per gerbang.
    expect(op.kapasitas.keberangkatan).toBeCloseTo(T.kapasitas.gerbang * (2 + 2 * T.kapasitas.bonusPetugas), 6);
    const rambu = hitungOperasi(terminal({ bangunan: b, teknologi: { ...tanpaTeknologi, rambuHalte: true } }), SIBUK);
    expect(rambu.kapasitas.peron).toBeCloseTo(T.kapasitas.halte * 2 * EKONOMI.teknologi.rambuHalte.multKapasitas, 6);
  });

  it('PO di jurusan yang sama berbagi pasar menurut reputasi; pasarnya membesar tapi jenuh', () => {
    // Lumpia Kilat Lv 6: Semarang + Jakarta. Jakarta kini dilayani dua PO.
    const duaPo = (repOndel: number) =>
      hitungOperasi(
        terminal({
          perluasan: 1,
          bangunan: { ...bangunanAwal(), jendela: 6 },
          po: [
            { id: 'ondelOndel', level: 1, loket: 3, reputasi: repOndel },
            { id: 'lumpiaKilat', level: 6, loket: 3, reputasi: 50 },
          ],
        }),
        SIBUK,
      );
    const sama = duaPo(50);
    const kejenuhan = 1 / (1 + (EKONOMI.mitra.persaingan.kejenuhan / 3) * 1);
    expect(sama.po[0]!.permintaanPuncak).toBeCloseTo(PASAR_JAKARTA * kejenuhan, 6);
    expect(sama.permintaanPuncak).toBeCloseTo(2 * PASAR_JAKARTA * kejenuhan + T.pasar.perPeminat * 1.5, 6);
    // Reputasi lebih tinggi: bagian Jakarta Ondel-Ondel membesar sebanding daya tariknya.
    const unggul = duaPo(90);
    const a = faktorReputasi(90);
    const b = faktorReputasi(50);
    expect(unggul.po[0]!.permintaanPuncak).toBeCloseTo(PASAR_JAKARTA * kejenuhan * (a / ((a + b) / 2)), 6);
  });

  it('biaya layanan lebih mahal menurunkan permintaan, lebih murah menaikkannya', () => {
    const op = (layanan: number) => hitungOperasi(terminal({ tarif: { ...tarifBawaan(), layanan } }), SIBUK).permintaanPuncak;
    expect(op(20)).toBeLessThan(op(T.tarif.layanan.bawaan));
    expect(op(5)).toBeGreaterThan(op(T.tarif.layanan.bawaan));
  });

  it('permintaan sekarang = jam sibuk × daya tarik kepuasan × ritme × event; kapasitas tetap', () => {
    const k = terminal({ bangunan: { ...bangunanAwal(), jalur: 3, jendela: 4 }, po: [{ id: 'ondelOndel', level: 1, loket: 4, reputasi: 50 }] });
    const sibuk = hitungOperasi(k, SIBUK);
    const sepi = hitungOperasi(k, { ritme: 0.4, event: 1.5 });
    expect(sepi.permintaan).toBeCloseTo(sibuk.permintaanPuncak * dayaTarikTycoon(sibuk.kepuasan.nilai) * 0.4 * 1.5, 6);
    expect(sepi.kapasitas).toEqual(sibuk.kapasitas);
    expect(sepi.kepuasan).toEqual(sibuk.kepuasan);
    expect(sepi.arus).toBeLessThanOrEqual(sepi.permintaan + 1e-9);
  });
});

describe('operasi tycoon: kepuasan', () => {
  it('terminal awal kurang nyaman; petugas kebersihan, satpam, & fasilitas menaikkan komponennya', () => {
    const awal = hitungOperasi(terminal(), SIBUK).kepuasan;
    expect(awal.kebersihan).toBe(0);
    expect(awal.keamanan).toBe(0);
    expect(awal.fasilitas).toBe(0);
    expect(awal.kenyamanan).toBeCloseTo(0.9, 10);
    const rapi = hitungOperasi(terminal({ petugas: ['kebersihan', 'satpam'], bangunan: { ...bangunanAwal(), toilet: 1, kios: 1, lahanParkir: 1 } }), SIBUK).kepuasan;
    // Toilet tanpa petugasnya cepat kotor.
    expect(rapi.kebersihan).toBeCloseTo(0.85, 10);
    expect(rapi.keamanan).toBe(1);
    expect(rapi.fasilitas).toBeGreaterThan(0.9);
    expect(rapi.nilai).toBeGreaterThan(awal.nilai + 0.3);
  });

  it('kelancaran turun bila permintaan jauh di atas kapasitas; kursi kurang menurunkan kenyamanan', () => {
    const lancar = hitungOperasi(terminal({ bangunan: { ...bangunanAwal(), jalur: 2, jendela: 3 }, po: [{ id: 'ondelOndel', level: 1, loket: 3, reputasi: 50 }] }), SIBUK).kepuasan;
    const sesak = hitungOperasi(terminal(), SIBUK).kepuasan;
    expect(lancar.kelancaran).toBe(1);
    expect(sesak.kelancaran).toBeLessThan(0.1);
    const penuh = hitungOperasi(
      terminal({ bangunan: { ...bangunanAwal(), jalur: 3, jendela: 4, kursi: 0 }, po: [{ id: 'ondelOndel', level: 1, loket: 4, reputasi: 50 }] }),
      SIBUK,
    ).kepuasan;
    expect(penuh.kenyamanan).toBe(0);
  });

  it('kepuasan mitra: tarif sewa tinggi menurunkannya; paling puas saat jendela seimbang dengan permintaan', () => {
    const mitra = (loket: number, sewaLoket = tarifBawaan().sewaLoket) =>
      hitungOperasi(
        terminal({ perluasan: 1, tarif: { ...tarifBawaan(), sewaLoket }, bangunan: { ...bangunanAwal(), jalur: 3, jendela: loket }, po: [{ id: 'ondelOndel', level: 1, loket, reputasi: 50 }] }),
        SIBUK,
      ).po[0]!.kepuasanMitra;
    expect(mitra(3)).toBeGreaterThan(mitra(1));
    expect(mitra(3)).toBeGreaterThan(mitra(6));
    expect(mitra(3, 4 * tarifBawaan().sewaLoket)).toBeLessThan(EKONOMI.tycoon.mitra.minimal);
    expect(mitra(3)).toBeGreaterThan(EKONOMI.tycoon.mitra.minimal);
  });
});
