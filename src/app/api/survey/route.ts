import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getWitaDateString } from '@/lib/wita';
import { postToSheetWebhook } from '@/lib/sheet-webhook';

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

// Survei kepuasan pelanggan — sengaja TIDAK terhubung ke buku tamu (tidak
// ada ID pengisi buku tamu yang dikirim/disimpan di sini). Independen
// sepenuhnya: dataset sendiri di Supabase, tab sheet sendiri di Google
// Sheets (lihat writeSurveyRow di apps-script-guest-book.gs).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const rating = Number(body?.rating);
  const likedText = isNonEmptyString(body?.likedText) ? body.likedText.trim() : '';
  const suggestionText = isNonEmptyString(body?.suggestionText) ? body.suggestionText.trim() : '';

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating harus antara 1 sampai 5' }, { status: 400 });
  }
  if (!likedText || !suggestionText) {
    return NextResponse.json({ error: 'Semua pertanyaan survei wajib diisi' }, { status: 400 });
  }

  const surveyDate = getWitaDateString();
  const surveyDateLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Makassar',
  });

  const { data: entry, error: insertError } = await supabaseAdmin
    .from('satisfaction_surveys')
    .insert({
      survey_date: surveyDate,
      rating,
      liked_text: likedText,
      suggestion_text: suggestionText,
    })
    .select()
    .single();

  if (insertError || !entry) {
    return NextResponse.json({ error: 'Gagal menyimpan survei' }, { status: 500 });
  }

  const succeeded = await postToSheetWebhook({
    type: 'survey',
    surveyDate: surveyDateLabel,
    rating,
    liked: likedText,
    suggestion: suggestionText,
  });
  if (succeeded) {
    await supabaseAdmin.from('satisfaction_surveys').update({ synced_to_sheet: true }).eq('id', entry.id);
  }

  return NextResponse.json({ ok: true });
}
