// Cloudflare Pages Function: halaman login Firebase lewat domain sendiri.
//   https://bustation.games/__/*  →  https://bustation-a4de9.firebaseapp.com/__/*
// Dengan authDomain = bustation.games (lihat src/platform/firebase.ts), popup
// login Google berada di domain yang sama dengan game, jadi tetap jalan di
// browser yang memblokir cookie pihak ketiga (Safari, PWA di iPhone).
// Rute lain tidak memanggil Function ini (Pages hanya merutekan /__/*).
const TUJUAN = 'bustation-a4de9.firebaseapp.com';

export function onRequest({ request }) {
  const url = new URL(request.url);
  url.protocol = 'https:';
  url.hostname = TUJUAN;
  url.port = '';
  return fetch(new Request(url, request));
}
