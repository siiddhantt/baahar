import { useState, type CSSProperties } from 'react';

import { cityArtFor } from '../features/cities/cityArt';
import styles from './CityArtwork.module.css';

type Props = {
  citySlug: string;
};

type ArtStyle = CSSProperties & {
  '--city-art-position'?: string;
  '--city-art-mobile-position'?: string;
};

export function CityArtwork({ citySlug }: Props) {
  const art = cityArtFor(citySlug);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = art && failedSrc !== art.src;
  const style: ArtStyle | undefined = art
    ? {
        '--city-art-position': art.position,
        '--city-art-mobile-position': art.mobilePosition,
      }
    : undefined;

  return (
    <span
      className={styles.art}
      data-image={showImage ? 'ready' : 'fallback'}
      style={style}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          className={styles.photo}
          src={art.src}
          alt=""
          width="1280"
          height="960"
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(art.src)}
        />
      ) : null}
      <span className={styles.orbit} />
      <span className={styles.orbit} />
      <span className={styles.orbit} />
    </span>
  );
}
