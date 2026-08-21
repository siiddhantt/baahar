import { type FormEvent, useMemo, useState } from 'react';

import type { CitySlug, EventCategory, TimeWindow } from '../api/client';
import { useAskBaahar } from '../api/queries';
import { categoryLabels, timeWindowLabels } from '../features/feed/filters';
import styles from './AskBaahar.module.css';

type AppliedFilters = {
  window: TimeWindow;
  categories: EventCategory[];
  explicitlyFree: boolean;
  venue: string;
};

type Props = {
  city: CitySlug;
  cityName: string;
  venues: string[];
  onApply: (filters: AppliedFilters) => void;
};

export function AskBaahar({ city, cityName, venues, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ask = useAskBaahar(city);
  const examples = useMemo(
    () => [
      'Free plans this weekend',
      'Music tonight',
      venues[0] ? `What’s on at ${venues[0]}?` : 'Something creative tomorrow',
    ],
    [venues],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const request = query.trim();
    if (!request || ask.isPending) return;
    ask.mutate(
      { query: request },
      {
        onSuccess: (result) => {
          onApply({
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
  const resultLabel = result
    ? `${result.result_count} ${result.result_count === 1 ? 'plan' : 'plans'}`
    : null;

  return (
    <section className={styles.root} data-open={open} aria-label="Ask Baahar">
      <button
        className={styles.mascotButton}
        type="button"
        aria-label="Ask Baahar"
        aria-expanded={open}
        aria-controls="ask-baahar-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.prompt}>{open ? 'I’m listening.' : 'Need a tiny nudge?'}</span>
        <CatMascot thinking={ask.isPending} />
        <span className={styles.buttonLabel}>Ask Baahar</span>
      </button>

      {open ? (
        <div className={styles.panel} id="ask-baahar-panel">
          <div className={styles.intro}>
            <p className={styles.eyebrow}>Guided discovery</p>
            <h2>Tell me the kind of plan.</h2>
            <p>I’ll translate it into real {cityName} filters—never made-up events.</p>
          </div>

          <form onSubmit={submit}>
            <label htmlFor="ask-baahar-query">What are you in the mood for?</label>
            <div className={styles.inputRow}>
              <input
                id="ask-baahar-query"
                value={query}
                maxLength={280}
                placeholder="Try “free music this weekend”"
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="submit" disabled={!query.trim() || ask.isPending}>
                {ask.isPending ? 'Looking…' : 'Find plans'}
              </button>
            </div>
          </form>

          <div className={styles.examples} aria-label="Example requests">
            {examples.map((example) => (
              <button key={example} type="button" onClick={() => setQuery(example)}>
                {example}
              </button>
            ))}
          </div>

          {ask.isError ? (
            <p className={styles.error} role="alert">
              I lost the thread. Try a date, category, free entry, or an exact venue.
            </p>
          ) : null}

          {result && resultLabel ? (
            <div className={styles.result} role="status" aria-live="polite">
              <p>
                {result.result_count
                  ? `Found ${resultLabel}. I’ve tuned the board for you.`
                  : 'No exact match this time. The filters are applied so you can adjust them.'}
              </p>
              <div>
                <span>{timeWindowLabels[result.interpretation.window]}</span>
                {result.interpretation.categories.map((category) => (
                  <span key={category}>{categoryLabels[category]}</span>
                ))}
                {result.interpretation.explicitly_free ? <span>Free entry</span> : null}
                {result.interpretation.venue ? <span>{result.interpretation.venue}</span> : null}
              </div>
              {!result.interpretation.assisted ? (
                <small>I used the exact words I recognized.</small>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CatMascot({ thinking }: { thinking: boolean }) {
  return (
    <svg
      className={styles.cat}
      data-thinking={thinking}
      viewBox="0 0 120 96"
      aria-hidden="true"
      focusable="false"
    >
      <path className={styles.tail} d="M89 68c22 5 26-9 17-17-6-6-14-1-10 5" />
      <path className={styles.body} d="M32 83c-1-19 7-31 27-32 20-1 31 10 32 32Z" />
      <path
        className={styles.head}
        d="M31 26 40 8l14 11c6-2 13-2 19 0L88 8l5 21c6 8 6 22-1 30-10 12-49 12-61-1-8-9-7-23 0-32Z"
      />
      <path className={styles.ear} d="m40 15 5 13-11 2Z" />
      <path className={styles.ear} d="m84 15-4 13 10 2Z" />
      <g className={styles.eyes}>
        <path d="M46 40c3-3 6-3 9 0" />
        <path d="M70 40c3-3 6-3 9 0" />
      </g>
      <path className={styles.nose} d="m62 46 4 2-4 3-4-3Z" />
      <path className={styles.mouth} d="M62 51c0 5-5 6-8 4M62 51c0 5 5 6 8 4" />
      <path className={styles.whisker} d="M53 49 29 45M52 54l-22 5M71 49l24-4M72 54l22 5" />
      <path className={styles.paw} d="M44 78c5-5 12-5 17 0M68 78c5-5 12-5 17 0" />
      {thinking ? <circle className={styles.thought} cx="107" cy="25" r="4" /> : null}
    </svg>
  );
}
