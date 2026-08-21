import { useEffect, useRef, useState } from 'react';

import type { EventSummary } from '../api/client';
import { calendarUrl } from '../api/client';
import { providerCalendarLinks } from '../lib/calendar';
import { CalendarIcon, ExternalIcon } from './icons';
import styles from './CalendarActions.module.css';

type Props = {
  event: EventSummary;
};

export function CalendarActions({ event }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const providerLinks = providerCalendarLinks(event);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={root}>
      <button
        className={styles.trigger}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <CalendarIcon /> Add to calendar
      </button>
      {open ? (
        <div className={styles.menu} role="menu" aria-label="Add event to calendar">
          {providerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span>{link.label}</span>
              <ExternalIcon />
            </a>
          ))}
          <a href={calendarUrl(event.id)} download role="menuitem" onClick={() => setOpen(false)}>
            <span>{providerLinks.length ? 'Calendar file' : 'Add with calendar file'}</span>
            <CalendarIcon />
          </a>
          {!providerLinks.length ? (
            <p>Its end time is unknown, so the calendar file keeps that fact honest.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
