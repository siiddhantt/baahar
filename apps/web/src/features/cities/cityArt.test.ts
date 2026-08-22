/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cityArtFor } from './cityArt';

describe('city art registry', () => {
  it.each([
    ['bengaluru', '/city-art/bengaluru.webp'],
    ['varanasi', '/city-art/varanasi.webp'],
    ['delhi', '/city-art/delhi.webp'],
    ['mumbai', '/city-art/mumbai.webp'],
  ])('returns responsive project artwork for %s', (slug, src) => {
    const art = cityArtFor(slug);

    expect(art?.src).toBe(src);
    expect(art?.position).toMatch(/^\d+% \d+%$/);
    expect(art?.mobilePosition).toMatch(/^\d+% \d+%$/);
    expect(['coast', 'dust', 'rain', 'river']).toContain(art?.atmosphere);
  });

  it('leaves an unknown API city to the generated fallback', () => {
    expect(cityArtFor('mysuru')).toBeNull();
  });

  it.each(['bengaluru', 'varanasi', 'delhi', 'mumbai'])(
    'ships a valid WebP asset for %s',
    (slug) => {
      const bytes = readFileSync(resolve(process.cwd(), `public/city-art/${slug}.webp`));

      expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
      expect(bytes.byteLength).toBeGreaterThan(1024);
    },
  );
});
