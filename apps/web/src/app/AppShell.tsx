import { useEffect, useRef } from 'react';
import { NavigationType, Outlet, useLocation, useNavigationType } from 'react-router-dom';

import { SiteHeader } from '../components/SiteHeader';
import styles from './AppShell.module.css';

export function AppShell() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    if (navigationType === NavigationType.Pop) return;

    window.scrollTo({ top: 0, behavior: 'instant' });
    const frame = window.requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, navigationType]);

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main ref={main} id="main-content" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p>Fresh facts, always linked to the official page.</p>
        <p aria-hidden="true">Baahar chalo ↗</p>
      </footer>
    </div>
  );
}
