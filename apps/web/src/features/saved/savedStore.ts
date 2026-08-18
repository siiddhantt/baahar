import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'baahar.saved.v1';
const listeners = new Set<() => void>();

let current = readSaved();

function readSaved(): readonly string[] {
  if (typeof window === 'undefined') return [];

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((value): value is string => typeof value === 'string'))];
  } catch {
    return [];
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function write(next: readonly string[]) {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Device saves still work for this session when storage is unavailable.
  }
  emit();
}

export function toggleSaved(occurrenceId: string) {
  write(
    current.includes(occurrenceId)
      ? current.filter((id) => id !== occurrenceId)
      : [occurrenceId, ...current],
  );
}

export function useSavedIds() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => [],
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    current = readSaved();
    emit();
  });
}
