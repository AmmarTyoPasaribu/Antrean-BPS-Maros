// ============================================================
// BUKU TAMU — Google Apps Script Web App
//
// Cara pakai: buat Google Sheet baru, buka Extensions > Apps Script,
// hapus isi default, tempel SELURUH kode ini, ganti SHARED_SECRET di
// bawah, lalu Deploy > New deployment > Web app (lihat panduan lengkap
// dari asisten untuk langkah persisnya).
// ============================================================

// Ganti dengan string acak yang sama dengan GUEST_BOOK_SHEET_WEBHOOK_SECRET
// di .env.local project Next.js. Ini mencegah orang lain selain aplikasi
// kita menulis ke sheet ini meskipun mereka tahu URL Web App-nya.
var SHARED_SECRET = 'GANTI_DENGAN_SECRET_YANG_SAMA_DENGAN_ENV_LOCAL';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.secret !== SHARED_SECRET) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'Invalid secret' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Tanggal Kunjungan',
        'Nama Pengunjung',
        'Jenis Kelamin',
        'Pekerjaan Utama',
        'Instansi',
        'Tujuan Berkunjung',
        'Email Pengunjung',
        'Nomor WhatsApp',
        'Waktu Submit (server)',
      ]);
    }

    sheet.appendRow([
      data.visitDate || '',
      data.visitorName || '',
      data.gender || '',
      data.occupation || '',
      data.institution || '',
      data.visitPurpose || '',
      data.email || '',
      data.whatsapp || '',
      new Date(),
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
