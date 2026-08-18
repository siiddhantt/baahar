import { useEffect, useLayoutEffect, useState, type PropsWithChildren } from 'react';

import { usePreferences } from './preferences';
import { ThemeContext, type ResolvedTheme } from './themeContext';

const darkMedia = '(prefers-color-scheme: dark)';
export function ThemeProvider({ children }: PropsWithChildren) {
  const preferences = usePreferences();
  const [systemDark, setSystemDark] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(darkMedia).matches,
  );

  const theme: ResolvedTheme =
    preferences.theme === 'system' ? (systemDark ? 'dark' : 'light') : preferences.theme;

  useLayoutEffect(() => {
    const media = window.matchMedia(darkMedia);
    const handleChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#10110f' : '#f5f0e7');
  }, [theme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
