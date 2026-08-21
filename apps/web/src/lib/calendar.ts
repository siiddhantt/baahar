import type { EventSummary } from '../api/client';

export type CalendarLink = {
  label: string;
  href: string;
};

function compactUtc(value: string) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function compactDate(value: string) {
  return value.replaceAll('-', '');
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function eventLocation(event: EventSummary) {
  if (!event.venue) return event.city.name;
  return [event.venue.name, event.venue.address].filter(Boolean).join(', ');
}

function commonDetails(event: EventSummary) {
  return {
    title: event.title,
    details: `Verified by Baahar. Official details: ${event.source.url}`,
    location: eventLocation(event),
  };
}

export function providerCalendarLinks(event: EventSummary): CalendarLink[] {
  const common = commonDetails(event);
  let googleDates: string;
  let outlookStart: string;
  let outlookEnd: string;
  let allDay: boolean;

  if (event.timing.precision === 'date') {
    const exclusiveEnd = nextDate(event.timing.end_date ?? event.timing.start_date);
    googleDates = `${compactDate(event.timing.start_date)}/${compactDate(exclusiveEnd)}`;
    outlookStart = event.timing.start_date;
    outlookEnd = exclusiveEnd;
    allDay = true;
  } else {
    if (!event.timing.starts_at || !event.timing.ends_at) return [];
    googleDates = `${compactUtc(event.timing.starts_at)}/${compactUtc(event.timing.ends_at)}`;
    outlookStart = event.timing.starts_at;
    outlookEnd = event.timing.ends_at;
    allDay = false;
  }

  const google = new URL('https://calendar.google.com/calendar/render');
  google.search = new URLSearchParams({
    action: 'TEMPLATE',
    text: common.title,
    dates: googleDates,
    details: common.details,
    location: common.location,
    ctz: event.timing.timezone,
  }).toString();

  const outlook = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  outlook.search = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: common.title,
    body: common.details,
    location: common.location,
    startdt: outlookStart,
    enddt: outlookEnd,
    allday: String(allDay),
  }).toString();

  return [
    { label: 'Google Calendar', href: google.toString() },
    { label: 'Outlook', href: outlook.toString() },
  ];
}
