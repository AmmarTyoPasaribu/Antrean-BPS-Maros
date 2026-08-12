// WITA = UTC+8, no DST. This gives the correct calendar date in WITA
// regardless of what timezone the server process itself runs in.
export function getWitaDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' }); // "YYYY-MM-DD"
}
