import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getWitaDateString } from '@/lib/wita';
import { sendEmail } from '@/lib/mailer';
import { renderGuestBookThankYouEmail } from '@/lib/email-templates';
import { postToSheetWebhook } from '@/lib/sheet-webhook';

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
    const succeeded = await postToSheetWebhook({
      type: 'guest_book',
      visitDate: visitDateLabel,
      visitorName,
      gender,
      occupation,
      institution,
      visitPurpose,
      email,
      whatsapp: whatsappNumber,
    });
    if (succeeded) {
      await supabaseAdmin.from('guest_book_entries').update({ synced_to_sheet: true }).eq('id', entry.id);
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
