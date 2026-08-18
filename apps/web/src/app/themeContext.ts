import { createContext, useContext } from 'react';

export type ResolvedTheme = 'light' | 'dark';

export const ThemeContext = createContext<ResolvedTheme>('light');

export function useResolvedTheme() {
  return useContext(ThemeContext);
}
