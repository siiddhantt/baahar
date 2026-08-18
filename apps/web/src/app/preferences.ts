import { useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type SupportedCity = 'bengaluru' | 'varanasi';

type Preferences = {
  city: SupportedCity | null;
  theme: ThemePreference;
};

const STORAGE_KEY = 'baahar.preferences.v1';
const fallbackPreferences: Preferences = { city: null, theme: 'system' };
const listeners = new Set<() => void>();

let current = readPreferences();

function isSupportedCity(value: unknown): value is SupportedCity {
  return value === 'bengaluru' || value === 'varanasi';
}

function isTheme(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function readPreferences(): Preferences {
  if (typeof window === 'undefined') return fallbackPreferences;

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return fallbackPreferences;

    const value = parsed as Record<string, unknown>;
    return {
      city: isSupportedCity(value.city) ? value.city : null,
      theme: isTheme(value.theme) ? value.theme : 'system',
    };
  } catch {
    return fallbackPreferences;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function updatePreferences(patch: Partial<Preferences>) {
  current = { ...current, ...patch };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // The in-memory preference remains useful when browser storage is unavailable.
  }

  emit();
}

export function usePreferences() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => fallbackPreferences,
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    current = readPreferences();
    emit();
  });
}
