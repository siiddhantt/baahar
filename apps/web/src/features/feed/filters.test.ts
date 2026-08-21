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
      venue: '',
    });
  });

  it('writes shareable filters without stale pagination', () => {
    const params = writeFilters(new URLSearchParams('cursor=old'), {
      window: 'weekend',
      categories: ['arts', 'books'],
      explicitlyFree: true,
      venue: '',
    });

    expect(params.toString()).toBe('window=weekend&category=arts%2Cbooks&free=true');
  });

  it('keeps workshops as a first-class category', () => {
    expect(readFilters(new URLSearchParams('category=workshops')).categories).toEqual([
      'workshops',
    ]);
  });

  it('round-trips an exact venue and clears stale pagination', () => {
    const filters = readFilters(new URLSearchParams('venue=Town+Hall&cursor=old'));
    expect(filters.venue).toBe('Town Hall');
    expect(writeFilters(new URLSearchParams('cursor=old'), filters).toString()).toContain(
      'venue=Town+Hall',
    );
  });
});
