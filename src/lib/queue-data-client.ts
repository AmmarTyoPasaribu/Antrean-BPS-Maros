import { supabaseBrowser } from './supabase-browser';
import { getWitaDateString } from './wita';
import type { Service, Officer, DailyAssignment, ServiceDisplay, QueueItem } from './types';

export async function fetchServicesWithOfficers(): Promise<ServiceDisplay[]> {
  const today = getWitaDateString();

  const [{ data: services }, { data: assignments }, { data: officers }] = await Promise.all([
    supabaseBrowser.from('services').select('*').order('loket_number', { ascending: true }),
    supabaseBrowser.from('daily_officer_assignment').select('*').eq('assignment_date', today),
    supabaseBrowser.from('officers').select('*'),
  ]);

  const officerMap = new Map<string, Officer>((officers ?? []).map((o: Officer) => [o.id, o]));
  const assignmentMap = new Map<string, DailyAssignment>(
    (assignments ?? []).map((a: DailyAssignment) => [a.service_id, a])
  );

  return ((services ?? []) as Service[]).map((s) => {
    const assignment = assignmentMap.get(s.id);
    const officer = assignment?.officer_id ? officerMap.get(assignment.officer_id) : undefined;
    return {
      ...s,
      officerId: officer?.id ?? null,
      officerName: officer?.name ?? assignment?.officer_name_snapshot ?? 'Belum ditentukan',
      officerImage: officer?.photo_url ?? null,
    } satisfies ServiceDisplay;
  });
}

export async function fetchQueues(): Promise<QueueItem[]> {
  const today = getWitaDateString();
  const { data } = await supabaseBrowser
    .from('queues')
    .select('*')
    .eq('queue_date', today)
    .order('sequence_number', { ascending: true });
  return (data ?? []) as QueueItem[];
}

export async function fetchOfficers(): Promise<Officer[]> {
  const { data } = await supabaseBrowser.from('officers').select('*').order('name', { ascending: true });
  return (data ?? []) as Officer[];
}
