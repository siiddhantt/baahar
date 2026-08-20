import { cityArtFor } from './cityArt';

describe('city art registry', () => {
  it('returns stable project asset paths for supported artwork', () => {
    expect(cityArtFor('bengaluru')?.src).toBe('/city-art/bengaluru.webp');
    expect(cityArtFor('varanasi')?.src).toBe('/city-art/varanasi.webp');
    expect(cityArtFor('delhi')?.src).toBe('/city-art/delhi.webp');
    expect(cityArtFor('mumbai')?.src).toBe('/city-art/mumbai.webp');
  });

  it('leaves an unknown API city to the generated fallback', () => {
    expect(cityArtFor('mysuru')).toBeNull();
  });
});
