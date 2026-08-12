import AntreanApp from '@/components/AntreanApp';
import { getServicesWithOfficers } from '@/lib/queue-data';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminFromCookieStore } from '@/lib/session';
import { getWitaDateString } from '@/lib/wita';
import type { QueueItem, Officer } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const today = getWitaDateString();

  const [services, queuesResult, officersResult, adminId] = await Promise.all([
    getServicesWithOfficers(),
    supabaseAdmin.from('queues').select('*').eq('queue_date', today).order('sequence_number', { ascending: true }),
    supabaseAdmin.from('officers').select('*').order('name', { ascending: true }),
    getAdminFromCookieStore(),
  ]);

  return (
    <AntreanApp
      initialServices={services}
      initialQueues={(queuesResult.data ?? []) as QueueItem[]}
      initialOfficers={(officersResult.data ?? []) as Officer[]}
      initialIsAdmin={!!adminId}
    />
  );
}
