import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { ApiProblem, calendarUrl } from '../api/client';
import { useEvent, useEventChanges } from '../api/queries';
import { ActionButton } from '../components/ActionButton';
import { ChangeNotice } from '../components/ChangeNotice';
import { DataError } from '../components/DataError';
import { EventArtwork } from '../components/EventArtwork';
import { EventStatus } from '../components/EventStatus';
import { RouteFallback } from '../components/RouteFallback';
import { SaveButton } from '../components/SaveButton';
import { SourceDisclosure } from '../components/SourceDisclosure';
import { ArrowLeftIcon, CalendarIcon, ExternalIcon } from '../components/icons';
import {
  eventDateTimeLabel,
  priceLabel,
  primaryEventAction,
  registrationLabel,
} from '../lib/eventFormat';
import { shareLink, type ShareResult } from '../lib/share';
import styles from './EventDetailRoute.module.css';

type LocationState = { from?: unknown };

function safeReturnPath(state: unknown) {
  if (!state || typeof state !== 'object') return '/';
  const from = (state as LocationState).from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
}

export default function EventDetailRoute() {
  const { occurrenceId } = useParams();
  const location = useLocation();
  const eventQuery = useEvent(occurrenceId);
  const changes = useEventChanges(eventQuery.data ? occurrenceId : undefined);
  const [shareState, setShareState] = useState<ShareResult | 'idle'>('idle');

  if (eventQuery.isPending) return <RouteFallback />;
  if (eventQuery.isError) {
    if (eventQuery.error instanceof ApiProblem && eventQuery.error.status === 404) {
      return (
        <section className={styles.notFound}>
          <span className={styles.notFoundMark} aria-hidden="true">
            〰
          </span>
          <div>
            <h1>This plan couldn’t be found</h1>
            <p>It may have ended, or the link may have changed.</p>
          </div>
          <Link className={styles.notFoundLink} to="/bengaluru">
            See Bengaluru plans
          </Link>
        </section>
      );
    }

    return (
      <DataError
        title="That plan is not available right now"
        onRetry={() => void eventQuery.refetch()}
      />
    );
  }

  const event = eventQuery.data;
  const price = priceLabel(event);
  const registration = registrationLabel(event);
  const primaryAction = primaryEventAction(event);
  const returnPath = safeReturnPath(location.state);

  async function shareEvent() {
    const result = await shareLink(event.title, window.location.href);
    setShareState(result === 'cancelled' ? 'idle' : result);
  }

  return (
    <article className={styles.page}>
      <Link className={styles.back} to={returnPath}>
        <ArrowLeftIcon /> Back to plans
      </Link>

      <div className={styles.layout}>
        <div className={styles.poster}>
          <EventArtwork event={event} priority />
        </div>

        <div className={styles.content}>
          <header className={styles.header}>
            <div className={styles.topline}>
              <p>
                {event.city.name} · {event.category}
              </p>
              <EventStatus event={event} />
            </div>
            <h1>{event.title}</h1>
            <p className={styles.when}>
              <time dateTime={event.timing.starts_at ?? event.timing.start_date}>
                {eventDateTimeLabel(event)}
              </time>
            </p>
            {event.venue ? (
              <p className={styles.where}>
                {event.venue.name}
                {event.venue.address ? <span> · {event.venue.address}</span> : null}
              </p>
            ) : null}
          </header>

          {changes.data?.items[0] ? <ChangeNotice change={changes.data.items[0]} /> : null}
          {changes.isError ? (
            <section className={styles.changeError} role="status">
              <div>
                <h2>We couldn’t load the change note.</h2>
                <p>
                  The event details below are current; its earlier change history is unavailable.
                </p>
              </div>
              <ActionButton tone="quiet" onClick={() => void changes.refetch()}>
                Try again
              </ActionButton>
            </section>
          ) : null}

          <dl className={styles.facts}>
            <div>
              <dt>Entry</dt>
              <dd>{price ?? 'Check official page'}</dd>
            </div>
            {registration ? (
              <div>
                <dt>Registration</dt>
                <dd>{registration}</dd>
              </div>
            ) : null}
            {event.language.length ? (
              <div>
                <dt>Language</dt>
                <dd>{event.language.join(', ')}</dd>
              </div>
            ) : null}
            {event.age_note ? (
              <div>
                <dt>Age</dt>
                <dd>{event.age_note}</dd>
              </div>
            ) : null}
            {event.accessibility_note ? (
              <div>
                <dt>Accessibility</dt>
                <dd>{event.accessibility_note}</dd>
              </div>
            ) : null}
          </dl>

          <div className={styles.actions}>
            <a
              className={styles.primaryAction}
              href={primaryAction.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {primaryAction.label} <ExternalIcon />
            </a>
            <SaveButton occurrenceId={event.id} showLabel />
            <a className={styles.secondaryAction} href={calendarUrl(event.id)} download>
              <CalendarIcon /> Add to calendar
            </a>
            <ActionButton tone="quiet" onClick={() => void shareEvent()}>
              {shareState === 'shared'
                ? 'Shared'
                : shareState === 'copied'
                  ? 'Link copied'
                  : shareState === 'failed'
                    ? 'Could not share'
                    : 'Share'}
            </ActionButton>
          </div>

          <SourceDisclosure event={event} />
        </div>
      </div>
    </article>
  );
}
