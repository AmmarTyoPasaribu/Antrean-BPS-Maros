import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getWitaDateString } from '@/lib/wita';
import { sendEmail } from '@/lib/mailer';
import { renderGuestBookThankYouEmail } from '@/lib/email-templates';

const GENDERS = ['Laki-laki', 'Perempuan'];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const visitorName = isNonEmptyString(body?.visitorName) ? body.visitorName.trim() : '';
  const gender = isNonEmptyString(body?.gender) ? body.gender.trim() : '';
  const occupation = isNonEmptyString(body?.occupation) ? body.occupation.trim() : '';
  const institution = isNonEmptyString(body?.institution) ? body.institution.trim() : '';
  const visitPurpose = isNonEmptyString(body?.visitPurpose) ? body.visitPurpose.trim() : '';
  const email = isNonEmptyString(body?.email) ? body.email.trim() : '';
  const whatsappNumber = isNonEmptyString(body?.whatsappNumber) ? body.whatsappNumber.trim() : '';

  if (!visitorName || !gender || !occupation || !institution || !visitPurpose || !email || !whatsappNumber) {
    return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 });
  }
  if (!GENDERS.includes(gender)) {
    return NextResponse.json({ error: 'Jenis kelamin tidak valid' }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 });
  }

  const visitDate = getWitaDateString();
  const visitDateLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Makassar',
  });

  const { data: entry, error: insertError } = await supabaseAdmin
    .from('guest_book_entries')
    .insert({
      visit_date: visitDate,
      visitor_name: visitorName,
      gender,
      occupation,
      institution,
      visit_purpose: visitPurpose,
      email,
      whatsapp_number: whatsappNumber,
    })
    .select()
    .single();

  if (insertError || !entry) {
    return NextResponse.json({ error: 'Gagal menyimpan data buku tamu' }, { status: 500 });
  }

  // Sync ke Google Sheets & kirim email SEKALIGUS (paralel, bukan berurutan)
  // supaya pengunjung tidak menunggu lama. Keduanya best-effort — kegagalan
  // di sini tidak menggagalkan submission karena data sudah aman di Supabase.
  // Dibatasi 8 detik per panggilan supaya form tidak menggantung kalau salah
  // satu layanan eksternal lambat/hang.
  const syncToSheet = async () => {
    const sheetWebhookUrl = process.env.GUEST_BOOK_SHEET_WEBHOOK_URL;
    if (!sheetWebhookUrl) return;
    try {
      // redirect: 'manual' is deliberate. Apps Script Web Apps always answer
      // a successful doPost() with a 302 to script.googleusercontent.com to
      // actually serve the response body. If we let fetch auto-follow that
      // redirect, the Fetch spec downgrades the follow-up request from POST
      // to GET (redirects to 301/302/303 must not preserve a non-GET/HEAD
      // method) — which 404s/405s against that one-time URL and looks like
      // failure even though doPost already ran successfully. So: don't
      // follow it, just treat the redirect itself as confirmation.
      const res = await fetch(sheetWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: process.env.GUEST_BOOK_SHEET_WEBHOOK_SECRET ?? '',
          visitDate: visitDateLabel,
          visitorName,
          gender,
          occupation,
          institution,
          visitPurpose,
          email,
          whatsapp: whatsappNumber,
        }),
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      const succeeded = res.ok || res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400);
      if (succeeded) {
        await supabaseAdmin.from('guest_book_entries').update({ synced_to_sheet: true }).eq('id', entry.id);
      } else {
        console.error('Guest book sheet webhook returned unexpected status:', res.status, res.type);
      }
    } catch (err) {
      console.error('Guest book sheet webhook failed:', err);
    }
  };

  const sendThankYouEmail = async () => {
    const sent = await sendEmail({
      to: email,
      subject: 'Terima Kasih Telah Mengisi Buku Tamu - BPS Kabupaten Maros',
      html: renderGuestBookThankYouEmail({ visitorName, visitDateLabel }),
    });
    if (sent) {
      await supabaseAdmin.from('guest_book_entries').update({ email_sent: true }).eq('id', entry.id);
    }
  };

  await Promise.all([syncToSheet(), sendThankYouEmail()]);

  return NextResponse.json({ ok: true });
}
