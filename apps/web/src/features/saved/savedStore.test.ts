import { act, renderHook } from '@testing-library/react';

import { toggleSaved, useSavedIds } from './savedStore';

describe('saved events', () => {
  beforeEach(() => {
    window.localStorage.clear();
    const { result } = renderHook(() => useSavedIds());
    for (const id of result.current) toggleSaved(id);
  });

  it('adds and removes a version-independent occurrence id', () => {
    const { result } = renderHook(() => useSavedIds());

    act(() => toggleSaved('0198-event'));
    expect(result.current).toEqual(['0198-event']);

    act(() => toggleSaved('0198-event'));
    expect(result.current).toEqual([]);
  });
});
