import 'server-only';

// Kirim data ke Apps Script Web App dan verifikasi hasilnya SUNGGUHAN
// (bukan cuma "ada redirect atau tidak").
//
// Apps Script Web Apps SELALU membalas doPost() dengan redirect 3xx ke URL
// sekali-pakai di script.googleusercontent.com yang isinya baru JSON asli
// dari fungsi kita -- redirect itu terjadi baik saat berhasil MAUPUN saat
// script kita sendiri return { ok: false, error: ... } (misal secret salah).
// Jadi cuma cek "dapat redirect" TIDAK CUKUP untuk tahu beneran berhasil;
// harus ikuti redirect-nya dan baca isi JSON-nya.
//
// fetch() bawaan tidak bisa dipakai untuk follow redirect ini langsung
// (redirect: 'follow' menurunkan method POST->GET di hop yang salah dan
// bikin 404/405), jadi kita ambil header Location manual lalu GET sendiri.
export async function postToSheetWebhook(payload: Record<string, unknown>): Promise<boolean> {
  const url = process.env.GUEST_BOOK_SHEET_WEBHOOK_URL;
  if (!url) return false;

  try {
    const initial = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.GUEST_BOOK_SHEET_WEBHOOK_SECRET ?? '', ...payload }),
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    });

    const location = initial.headers.get('location');
    if (!location) {
      console.error('Sheet webhook: tidak ada redirect location di respons awal, status:', initial.status);
      return false;
    }

    const followed = await fetch(location, { signal: AbortSignal.timeout(8000) });
    const text = await followed.text();

    let parsed: { ok?: boolean; error?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('Sheet webhook: respons bukan JSON:', text.slice(0, 300));
      return false;
    }

    if (!parsed.ok) {
      console.error('Sheet webhook melaporkan gagal:', parsed.error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Sheet webhook request gagal:', err);
    return false;
  }
}
