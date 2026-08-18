import type { EventSummary } from '../api/client';

const dayFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Kolkata',
});

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function eventDateLabel(event: EventSummary) {
  const start = event.timing.starts_at
    ? dayFormatter.format(new Date(event.timing.starts_at))
    : dayFormatter.format(new Date(`${event.timing.start_date}T00:00:00+05:30`));
  const end = event.timing.ends_at
    ? dayFormatter.format(new Date(event.timing.ends_at))
    : event.timing.end_date
      ? dayFormatter.format(new Date(`${event.timing.end_date}T00:00:00+05:30`))
      : null;

  return end && end !== start ? `${start}–${end}` : start;
}

export function eventTimeLabel(event: EventSummary) {
  if (!event.timing.starts_at) return 'All day';

  const start = timeFormatter.format(new Date(event.timing.starts_at));
  if (!event.timing.ends_at) return start;
  return `${start}–${timeFormatter.format(new Date(event.timing.ends_at))}`;
}

export function eventDateTimeLabel(event: EventSummary) {
  return `${eventDateLabel(event)} · ${eventTimeLabel(event)}`;
}

export function priceLabel(event: EventSummary) {
  if (event.pricing.is_free === true) return 'Free entry';
  if (event.pricing.is_free === null) return null;
  if (event.pricing.minimum_minor === null) return 'Paid entry';

  const amount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: event.pricing.currency ?? 'INR',
    maximumFractionDigits: 0,
  }).format(event.pricing.minimum_minor / 100);

  return event.pricing.maximum_minor === event.pricing.minimum_minor ? amount : `From ${amount}`;
}

export function freshnessLabel(timestamp: string) {
  const elapsedMinutes = Math.round((new Date(timestamp).getTime() - Date.now()) / 60_000);
  if (Math.abs(elapsedMinutes) < 60) return relativeFormatter.format(elapsedMinutes, 'minute');

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) return relativeFormatter.format(elapsedHours, 'hour');

  return relativeFormatter.format(Math.round(elapsedHours / 24), 'day');
}

export function registrationLabel(event: EventSummary) {
  switch (event.registration.state) {
    case 'sold_out':
      return 'Sold out';
    case 'closed':
      return 'Registration closed';
    case 'open':
      return 'Registration open';
    case 'not_required':
      return 'No registration needed';
    default:
      return null;
  }
}

export function primaryEventAction(event: EventSummary) {
  if (!event.registration.url) {
    return { href: event.source.url, label: 'Official page' };
  }
  if (event.registration.state === 'open') {
    return { href: event.registration.url, label: 'Open registration' };
  }
  return { href: event.registration.url, label: 'View booking page' };
}
