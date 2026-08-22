import { useState, type ReactNode } from 'react';

import type { EventCategory, EventSummary } from '../api/client';
import { eventDateLabel } from '../lib/eventFormat';
import styles from './EventArtwork.module.css';

type Props = {
  event: EventSummary;
  priority?: boolean;
};

function categoryMotif(category: EventCategory): ReactNode {
  switch (category) {
    case 'arts':
      return (
        <>
          <path d="M89 233c-32-61 8-137 76-149 57-10 112 25 120 78 5 31-14 43-40 36-20-6-40 6-42 27-3 28-25 48-51 49-27 1-51-14-63-41Z" />
          <circle cx="139" cy="130" r="9" />
          <circle cx="179" cy="117" r="9" />
          <circle cx="218" cy="137" r="9" />
          <path d="m218 255 54-102M211 260l17-3-10-14" />
        </>
      );
    case 'talks':
      return (
        <>
          <path d="M61 94h174a26 26 0 0 1 26 26v68a26 26 0 0 1-26 26H137l-48 35 13-35H61a26 26 0 0 1-26-26v-68a26 26 0 0 1 26-26Z" />
          <path d="M90 139h116M90 169h82" />
          <path d="M171 235h64a24 24 0 0 1 24 24v21l27 20-52-20h-63a24 24 0 0 1-24-24" />
        </>
      );
    case 'workshops':
      return (
        <>
          <rect x="55" y="72" width="210" height="238" rx="26" />
          <path d="M101 72v-9a19 19 0 0 1 19-19h80a19 19 0 0 1 19 19v9M98 133h124M98 173h74" />
          <path d="m115 267 93-93 28 28-93 93-42 14 14-42Z" />
          <path d="m194 188 28 28" />
        </>
      );
    case 'theatre':
      return (
        <>
          <path d="M44 66h232M70 66c2 78 25 129 76 158-45 18-72 57-80 116M250 66c-2 78-25 129-76 158 45 18 72 57 80 116" />
          <path d="M112 152c0-31 21-52 48-52s48 21 48 52c0 46-23 82-48 82s-48-36-48-82Z" />
          <path d="M132 151c9-8 18-8 27 0M175 151c8-8 16-8 24 0M142 190c12 8 25 8 37 0" />
        </>
      );
    case 'music':
      return (
        <>
          <circle cx="139" cy="201" r="104" />
          <circle cx="139" cy="201" r="45" />
          <circle cx="139" cy="201" r="9" />
          <path d="M211 61v143c-10-7-24-8-37-2-18 8-28 26-21 41 7 16 29 21 47 13 15-7 24-21 23-34V95l54-14" />
        </>
      );
    case 'books':
      return (
        <>
          <path d="M42 101c48-13 89-1 118 31v184c-29-32-70-44-118-31V101ZM278 101c-48-13-89-1-118 31v184c29-32 70-44 118-31V101Z" />
          <path d="M75 145c29-4 54 4 75 23M75 183c29-4 54 4 75 23M245 145c-29-4-54 4-75 23M245 183c-29-4-54 4-75 23" />
        </>
      );
    case 'community':
      return (
        <>
          <circle cx="160" cy="111" r="43" />
          <circle cx="79" cy="156" r="31" />
          <circle cx="241" cy="156" r="31" />
          <path d="M88 306c2-72 29-112 72-112s70 40 72 112M30 299c3-57 21-88 55-88 16 0 30 7 40 21M290 299c-3-57-21-88-55-88-16 0-30 7-40 21" />
        </>
      );
    default:
      return (
        <>
          <path d="m160 64 19 63 61-27-40 52 57 34-66-4 7 66-38-55-38 55 7-66-66 4 57-34-40-52 61 27 19-63Z" />
          <circle cx="62" cy="85" r="12" />
          <circle cx="264" cy="267" r="16" />
          <path d="M75 274h55M102 246v55M224 69h40M244 49v40" />
        </>
      );
  }
}

export function EventArtwork({ event, priority = false }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (event.image_url && failedUrl !== event.image_url) {
    return (
      <div className={styles.frame}>
        <img
          alt=""
          width="800"
          height="1000"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          referrerPolicy="no-referrer"
          src={event.image_url}
          onError={() => setFailedUrl(event.image_url)}
        />
        <span className={styles.date}>{eventDateLabel(event)}</span>
      </div>
    );
  }

  return (
    <div
      className={`${styles.frame} ${styles.generated}`}
      data-category={event.category}
      aria-hidden="true"
    >
      <svg
        className={styles.illustration}
        data-motif={event.category}
        viewBox="0 0 320 400"
        aria-hidden="true"
      >
        {categoryMotif(event.category)}
      </svg>
      <span className={styles.date}>{eventDateLabel(event)}</span>
    </div>
  );
}
