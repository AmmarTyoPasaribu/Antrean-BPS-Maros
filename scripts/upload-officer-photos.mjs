// One-off migration script: uploads the pre-existing local officer photos
// (src/assets/images/*) to the Supabase Storage bucket "officer-photos" and
// links each one to its officers row via photo_url. Run once after the
// schema/seed SQL has been applied. Officers who only had the shared
// generic placeholder in the old app are intentionally skipped — they keep
// photo_url = NULL and fall back to /images/default-avatar.jpeg, same as
// before.
//
// Usage: node scripts/upload-officer-photos.mjs
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!envUrl || !envServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  console.error('Run with: node --env-file=.env.local scripts/upload-officer-photos.mjs');
  process.exit(1);
}

const supabase = createClient(envUrl, envServiceKey, { auth: { persistSession: false } });

const IMAGES_DIR = path.resolve(import.meta.dirname, '..', 'src', 'assets', 'images');

// slug -> local filename (only officers with a real individual photo)
const PHOTO_MAP = {
  wahyu: '8-Wahyu Kiswatiningsih.jpg',
  firman: '15-Andi Firmansyah.jpg',
  sudirman: '1-Sudirman.jpg',
  arifin: '2-Arifin.jpg',
  sakka: '3-Sakka.jpg',
  arfah: '4-Arfah.jpg',
  siabe: '5-Siabe.jpg',
  hikma: '7-Hikmayani.jpg',
  kartini: '14-Kartini.jpg',
  dewi: '16-Andi Dewi.jpg',
  mustafa: '11-Mustafa.jpg',
  gusmawan: '13-Gusmawan.jpg',
  fauziah: '17-Fauziah Lestari.jpg',
  annur: '18-Annur Rachmih.jpg',
  herlina: '24-Herlina.jpg',
  shima: '26-Shima.jpg',
  dila: '19-Anindya Deshinta Dila.jpg',
  kristin: '9-Kristin.jpg',
  sija: '10-Syarifuddin.jpg',
  faishal: '20-Faishal.jpg',
  farida: '22-Farida.jpg',
  chory: '23-Chory.jpg',
  ambri: '21-Ambri.jpg',
  nasrullah: '12-Nasrullah.jpg',
  achil: '6-Andi Awaluddin.jpg',
};

async function main() {
  const { data: officers, error } = await supabase.from('officers').select('id, slug, name');
  if (error) throw error;

  const bySlug = new Map(officers.map((o) => [o.slug, o]));

  for (const [slug, filename] of Object.entries(PHOTO_MAP)) {
    const officer = bySlug.get(slug);
    if (!officer) {
      console.warn(`SKIP: no officer row for slug "${slug}"`);
      continue;
    }

    const filePath = path.join(IMAGES_DIR, filename);
    let buffer;
    try {
      buffer = await readFile(filePath);
    } catch {
      console.warn(`SKIP: file not found for ${slug}: ${filePath}`);
      continue;
    }

    const ext = path.extname(filename).slice(1).toLowerCase();
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const storagePath = `${officer.id}-seed.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('officer-photos')
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (uploadError) {
      console.error(`FAILED upload for ${officer.name}:`, uploadError.message);
      continue;
    }

    const { data: publicUrlData } = supabase.storage.from('officer-photos').getPublicUrl(storagePath);

    const { error: updateError } = await supabase
      .from('officers')
      .update({ photo_url: publicUrlData.publicUrl })
      .eq('id', officer.id);

    if (updateError) {
      console.error(`FAILED updating photo_url for ${officer.name}:`, updateError.message);
      continue;
    }

    console.log(`OK: ${officer.name} -> ${publicUrlData.publicUrl}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
