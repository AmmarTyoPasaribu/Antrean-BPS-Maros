export function resolveOfficerImage(url: string | null): string {
  return url || '/images/default-avatar.jpeg';
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0 dtk';
  if (seconds < 60) return `${Math.round(seconds)} dtk`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins} mnt ${secs} dtk`;
}

export function formatClockTime(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
