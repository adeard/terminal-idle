/**
 * Bagian bersama Pages Functions papan peringkat: satu verifikator token per
 * isolate Worker, supaya kunci publik Google diambil sekali lalu dipakai
 * banyak permintaan (sampai masa berlakunya habis).
 */
import { FIREBASE } from '../src/config/firebase.config';
import { buatVerifikator } from './token-firebase';

export const verifikasiToken = buatVerifikator({ projectId: FIREBASE.projectId });
