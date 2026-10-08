const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function dateTime(value: string | null | undefined, timeZone = browserZone()) {
  if (!value) return 'Not set';
  return `${new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value))} (${timeZone})`;
}

/** Wall-clock input for an explicit IANA zone, independent of browser timezone. */
export function dateInput(value: string | null | undefined, timeZone = browserZone()) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const field = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${field('year')}-${field('month')}-${field('day')}T${field('hour')}:${field('minute')}`;
}

export function dateInputToIso(value: string, timeZone = browserZone()) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error('Enter a valid date and time.');
  const wall = new Date(`${value}:00.000Z`);
  if (!Number.isFinite(+wall) || wall.toISOString().slice(0, 16) !== value)
    throw new Error('Enter a valid date and time.');
  // Sample offsets on both sides of possible DST changes, then round-trip each
  // candidate. Never silently normalize a nonexistent time or guess a repeated hour.
  const candidates = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = +wall + hours * 3_600_000;
    const offset = +new Date(`${dateInput(new Date(sample).toISOString(), timeZone)}:00Z`) - sample;
    const instant = +wall - offset;
    if (dateInput(new Date(instant).toISOString(), timeZone) === value) candidates.add(instant);
  }
  if (candidates.size !== 1)
    throw new Error(
      `This time is ${candidates.size ? 'ambiguous' : 'unavailable'} in ${timeZone} because of a clock change. Choose a time outside the repeated or skipped hour.`,
    );
  return new Date([...candidates][0]!).toISOString();
}
