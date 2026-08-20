import { readFilters, writeFilters } from './filters';

describe('feed URL filters', () => {
  it('drops unsupported values and keeps explicit free semantics', () => {
    const filters = readFilters(
      new URLSearchParams('window=forever&category=music,unknown,music&free=false'),
    );

    expect(filters).toEqual({
      window: 'upcoming',
      categories: ['music'],
      explicitlyFree: false,
    });
  });

  it('writes shareable filters without stale pagination', () => {
    const params = writeFilters(new URLSearchParams('cursor=old'), {
      window: 'weekend',
      categories: ['arts', 'books'],
      explicitlyFree: true,
    });

    expect(params.toString()).toBe('window=weekend&category=arts%2Cbooks&free=true');
  });

  it('keeps workshops as a first-class category', () => {
    expect(readFilters(new URLSearchParams('category=workshops')).categories).toEqual([
      'workshops',
    ]);
  });
});
