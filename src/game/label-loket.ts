/**
 * Kemajuan transaksi tiket di tiap jendela loket (murni, tanpa DOM), dari
 * pembeli yang sedang membeli tiket di jendela itu. label-bus3d.ts
 * menggambarnya sebagai cincin loader di atas jendela.
 */
import type { OrangVisual } from './dunia-visual';

/** Kemajuan (0–1) per jendela loket; null kalau jendela itu sedang tidak melayani pembeli. */
export function kemajuanLoket(orang: readonly OrangVisual[], jumlahJendela: number): (number | null)[] {
  const hasil: (number | null)[] = Array.from({ length: jumlahJendela }, () => null);
  for (const o of orang) {
    if (o.fase !== 'beliTiket' || o.loket < 0 || o.loket >= jumlahJendela) continue;
    hasil[o.loket] = o.lamaTimer > 0 ? Math.min(1, Math.max(0, 1 - o.timer / o.lamaTimer)) : 1;
  }
  return hasil;
}
