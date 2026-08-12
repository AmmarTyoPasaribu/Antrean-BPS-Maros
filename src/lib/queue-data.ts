import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getWitaDateString } from './wita';
import type { Service, Officer, DailyAssignment, ServiceDisplay } from './types';

// Ensures today's (WITA) rotation/random assignment exists, then returns the
// 3 services merged with whoever is on duty today. Server-only (needs
// service_role to run ensure_daily_assignment). Safe to call on every page
// load — the RPC is idempotent per day.
export async function getServicesWithOfficers(): Promise<ServiceDisplay[]> {
  await supabaseAdmin.rpc('ensure_daily_assignment');

  const today = getWitaDateString();

  const [{ data: services }, { data: assignments }, { data: officers }] = await Promise.all([
    supabaseAdmin.from('services').select('*').order('loket_number', { ascending: true }),
    supabaseAdmin.from('daily_officer_assignment').select('*').eq('assignment_date', today),
    supabaseAdmin.from('officers').select('*'),
  ]);

  const officerMap = new Map<string, Officer>((officers ?? []).map((o: Officer) => [o.id, o]));
  const assignmentMap = new Map<string, DailyAssignment>(
    (assignments ?? []).map((a: DailyAssignment) => [a.service_id, a])
  );

  return ((services ?? []) as Service[]).map((s) => {
    const assignment = assignmentMap.get(s.id);
    const officer = assignment?.officer_id ? officerMap.get(assignment.officer_id) : undefined;
    // Fall back to the name snapshot when the officer row itself has been
    // deleted since (officer_id goes NULL via ON DELETE SET NULL) — the
    // historical record still shows who was on duty, just without a live
    // photo/link.
    return {
      ...s,
      officerId: officer?.id ?? null,
      officerName: officer?.name ?? assignment?.officer_name_snapshot ?? 'Belum ditentukan',
      officerImage: officer?.photo_url ?? null,
    } satisfies ServiceDisplay;
  });
}
