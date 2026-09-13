// NPHIES timestamps use Saudi Arabia's offset, independent of the host timezone.
export function formatSaudiDateTime(value = new Date()) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date/time');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+03:00`;
}
