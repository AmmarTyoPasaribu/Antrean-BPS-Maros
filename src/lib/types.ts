export type ServiceSlug = 'statistik' | 'pengaduan' | 'ppid';

export interface Service {
  id: string;
  slug: ServiceSlug;
  name: string;
  code: 'A' | 'B' | 'C';
  loket_number: number;
}

export interface Officer {
  id: string;
  slug: string;
  name: string;
  photo_url: string | null;
  is_active: boolean;
}

export interface QueueItem {
  id: string;
  number: string;
  sequence_number: number;
  service_id: string;
  status: 'waiting' | 'calling' | 'completed' | 'skipped';
  loket_number: number;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
  queue_date: string;
}

export interface DailyAssignment {
  id: string;
  service_id: string;
  assignment_date: string;
  officer_id: string | null;
  officer_name_snapshot: string | null;
  is_manual_override: boolean;
}

// Composed shape used by the UI: a service merged with today's on-duty officer.
export interface ServiceDisplay extends Service {
  officerId: string | null;
  officerName: string;
  officerImage: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}
