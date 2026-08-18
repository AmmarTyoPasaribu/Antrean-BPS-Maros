// ============================================================
// BUKU TAMU + SURVEI KEPUASAN — Google Apps Script Web App
//
// Cara pakai: buka Google Sheet yang SUDAH ADA (yang sudah dipakai Buku
// Tamu sekarang), buka Extensions > Apps Script, HAPUS semua kode lama,
// tempel SELURUH kode ini, lalu Deploy > Manage deployments > edit
// (ikon pensil) > Version: New version > Deploy. URL Web App-nya TETAP
// SAMA, tidak perlu ganti apapun di .env.local / Vercel.
// ============================================================

// Harus PERSIS SAMA dengan GUEST_BOOK_SHEET_WEBHOOK_SECRET di .env.local.
var SHARED_SECRET = 'GANTI_DENGAN_SECRET_YANG_SAMA_DENGAN_ENV_LOCAL';

var SURVEY_SHEET_NAME = 'Survei Kepuasan';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.secret !== SHARED_SECRET) {
      return respond({ ok: false, error: 'Invalid secret' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.type === 'survey') {
      writeSurveyRow(ss, data);
    } else {
      writeGuestBookRow(ss, data);
    }

    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

function writeGuestBookRow(ss, data) {
  // Sheet PERTAMA di file ini (posisi tab paling kiri) -- dipakai secara
  // stabil lewat posisi, BUKAN getActiveSheet() (yang gampang salah kalau
  // ada orang lagi buka/klik tab lain di Sheets saat script jalan).
  var sheet = ss.getSheets()[0];

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
}

function writeSurveyRow(ss, data) {
  var sheet = ss.getSheetByName(SURVEY_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SURVEY_SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Tanggal',
      'Rating Kepuasan (1-5)',
      'Hal yang Disukai',
      'Saran Perbaikan',
      'Waktu Submit (server)',
    ]);
  }

  sheet.appendRow([
    data.surveyDate || '',
    data.rating || '',
    data.liked || '',
    data.suggestion || '',
    new Date(),
  ]);
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
