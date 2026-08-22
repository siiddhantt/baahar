import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import type { CitySlug, EventCategory, TimeWindow } from '../api/client';
import { useMau } from '../api/queries';
import { categoryLabels, timeWindowLabels } from '../features/feed/filters';
import { eventDateTimeLabel } from '../lib/eventFormat';
import styles from './MauGuide.module.css';

type AppliedFilters = {
  city: CitySlug;
  window: TimeWindow;
  categories: EventCategory[];
  explicitlyFree: boolean;
  venue: string;
};

type Props = {
  city: CitySlug;
  onApply: (filters: AppliedFilters) => void;
};

export function MauGuide({ city, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const ask = useMau(city);
  const location = useLocation();
  const resetAsk = ask.reset;

  useEffect(() => {
    if (!open) return;
    input.current?.focus();

    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setOpen(false);
        resetAsk();
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      resetAsk();
      trigger.current?.focus();
    }

    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, resetAsk]);

  function close(restoreFocus = false) {
    setOpen(false);
    ask.reset();
    if (restoreFocus) trigger.current?.focus();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const request = query.trim();
    if (!request || ask.isPending) return;
    ask.mutate(
      { query: request },
      {
        onSuccess: (result) => {
          onApply({
            city: result.interpretation.city,
            window: result.interpretation.window,
            categories: result.interpretation.categories,
            explicitlyFree: result.interpretation.explicitly_free,
            venue: result.interpretation.venue ?? '',
          });
        },
      },
    );
  }

  const result = ask.data;
  const resultCity = result
    ? result.interpretation.city
        .split('-')
        .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
        .join(' ')
    : '';
  const state = ask.isPending
    ? 'thinking'
    : ask.isError
      ? 'resting'
      : result
        ? 'found'
        : 'listening';
  const prompt = !open
    ? 'Ask Mau'
    : ask.isPending
      ? 'Hmm…'
      : ask.isError
        ? 'A tiny nap…'
        : result
          ? 'Found a few!'
          : 'I’m listening.';

  return (
    <div className={styles.root} ref={root} data-open={open} data-state={state}>
      {open ? (
        <section className={styles.panel} id="mau-guide" role="dialog" aria-label="Ask Mau">
          <div className={styles.heading}>
            <div>
              <p className={styles.eyebrow}>Mau knows the board</p>
              <h2>What feels right?</h2>
            </div>
            <button
              className={styles.close}
              type="button"
              aria-label="Close Mau"
              onClick={() => close(true)}
            >
              ×
            </button>
          </div>

          <form onSubmit={submit}>
            <label className="visually-hidden" htmlFor="mau-query">
              Ask Mau what you would like to do
            </label>
            <div className={styles.inputRow}>
              <input
                ref={input}
                id="mau-query"
                value={query}
                maxLength={280}
                autoComplete="off"
                placeholder="Free music this weekend…"
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="submit" disabled={!query.trim() || ask.isPending}>
                {ask.isPending ? 'Looking…' : 'Ask'}
              </button>
            </div>
          </form>

          {ask.isPending ? (
            <p className={styles.message} role="status">
              Mau is checking the real event board…
            </p>
          ) : null}

          {ask.isError ? (
            <p className={styles.error} role="alert">
              Mau can’t look right now. The event board still works, so try again in a little while.
            </p>
          ) : null}

          {result ? (
            <div className={styles.result} role="status" aria-live="polite">
              <p>
                {result.result_count
                  ? `Mau found ${result.result_count} ${result.result_count === 1 ? 'plan' : 'plans'} in ${resultCity} and tuned the board.`
                  : `No exact match in ${resultCity} yet. Mau applied the verified filters so you can adjust them.`}
              </p>
              <div className={styles.filters}>
                <span>{resultCity}</span>
                <span>{timeWindowLabels[result.interpretation.window]}</span>
                {result.interpretation.categories.map((category) => (
                  <span key={category}>{categoryLabels[category]}</span>
                ))}
                {result.interpretation.explicitly_free ? <span>Free entry</span> : null}
                {result.interpretation.venue ? <span>{result.interpretation.venue}</span> : null}
              </div>
              {result.items.length ? (
                <ul className={styles.plans} aria-label="Plans Mau found">
                  {result.items.slice(0, 3).map((event) => (
                    <li key={event.id}>
                      <Link
                        to={`/events/${event.id}/${event.slug}`}
                        state={{ from: `${location.pathname}${location.search}` }}
                      >
                        <span>{event.title}</span>
                        <small>
                          {eventDateTimeLabel(event)}
                          {event.venue?.name ? ` · ${event.venue.name}` : ''}
                        </small>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <button
        ref={trigger}
        className={styles.mascot}
        type="button"
        aria-label={open ? 'Put Mau back to sleep' : 'Ask Mau for a plan'}
        aria-expanded={open}
        aria-controls="mau-guide"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className={styles.prompt} aria-hidden="true">
          {prompt}
        </span>
        {!open ? (
          <span className={styles.sleepMarks} aria-hidden="true">
            <span>z</span>
            <span>z</span>
            <span>Z</span>
          </span>
        ) : null}
        <img
          className={styles.sleeping}
          src="/mascot/mau-sleeping.webp"
          width="640"
          height="640"
          alt=""
          aria-hidden="true"
          draggable="false"
        />
        <img
          className={styles.awake}
          src="/mascot/mau-awake.webp"
          width="640"
          height="640"
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      </button>
    </div>
  );
}
