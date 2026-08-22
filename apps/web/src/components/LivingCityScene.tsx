import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

import { cityArtFor } from '../features/cities/cityArt';
import styles from './LivingCityScene.module.css';

type Props = {
  cityName: string;
  citySlug: string;
};

type SceneStyle = CSSProperties & {
  '--city-art-position'?: string;
  '--city-art-mobile-position'?: string;
  '--pointer-x'?: number;
  '--pointer-y'?: number;
};

export function LivingCityScene({ cityName, citySlug }: Props) {
  const art = cityArtFor(citySlug);
  const scene = useRef<HTMLElement>(null);
  const frame = useRef<number | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = art && failedSrc !== art.src;
  const style: SceneStyle | undefined = art
    ? {
        '--city-art-position': art.position,
        '--city-art-mobile-position': art.mobilePosition,
        '--pointer-x': 0,
        '--pointer-y': 0,
      }
    : undefined;

  useEffect(() => {
    const element = scene.current;
    if (!element || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(([entry]) => {
      element.dataset.active = entry?.isIntersecting ? 'true' : 'false';
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  function setPointer(event: PointerEvent<HTMLElement>) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const element = event.currentTarget;
    const bounds = element.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      element.style.setProperty('--pointer-x', x.toFixed(3));
      element.style.setProperty('--pointer-y', y.toFixed(3));
    });
  }

  function resetPointer(event: PointerEvent<HTMLElement>) {
    const element = event.currentTarget;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      element.style.setProperty('--pointer-x', '0');
      element.style.setProperty('--pointer-y', '0');
    });
  }

  return (
    <figure
      ref={scene}
      className={styles.scene}
      data-active="true"
      data-atmosphere={art?.atmosphere ?? 'dust'}
      data-image={showImage ? 'ready' : 'fallback'}
      style={style}
      aria-label={`A living illustration of ${cityName}`}
      onPointerMove={setPointer}
      onPointerLeave={resetPointer}
    >
      <span className={styles.scrollPlane}>
        <span className={styles.pointerPlane}>
          {showImage ? (
            <img
              className={styles.art}
              src={art.src}
              alt=""
              width="1280"
              height="960"
              loading="eager"
              decoding="async"
              onError={() => setFailedSrc(art.src)}
            />
          ) : null}
        </span>
      </span>

      <span className={styles.sky} />
      <span className={styles.weather}>
        <i />
        <i />
        <i />
        <i />
      </span>
      <svg className={styles.birds} viewBox="0 0 96 32" aria-hidden="true">
        <path d="M2 22c6-7 12-7 18 0 6-7 12-7 18 0M55 10c5-5 10-5 15 0 5-5 10-5 15 0" />
      </svg>
      <span className={styles.shimmer} />
      <span className={styles.edge} />
    </figure>
  );
}
