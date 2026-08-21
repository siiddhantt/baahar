import { Link } from 'react-router-dom';

import styles from './SiteFooter.module.css';

const github = 'https://github.com/siiddhantt/baahar';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.route} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={styles.brand}>
        <Link to="/">Baahar</Link>
        <p>Less scrolling. More going.</p>
      </div>
      <nav aria-label="Footer">
        <Link to="/">Cities</Link>
        <Link to="/saved">Saved</Link>
        <a href={`${github}/issues/new?template=source-suggestion.yml`}>Suggest a source</a>
        <a href={github}>GitHub</a>
      </nav>
      <div className={styles.meta}>
        <p>
          <span aria-hidden="true" /> Fresh facts · official links
        </p>
        <p>
          © {new Date().getFullYear()} Baahar · <a href={`${github}/blob/main/LICENSE`}>MIT</a>
        </p>
      </div>
    </footer>
  );
}
