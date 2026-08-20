import { fireEvent, render } from '@testing-library/react';

import { CityArtwork } from './CityArtwork';

describe('CityArtwork', () => {
  it.each([
    ['bengaluru', '/city-art/bengaluru.webp', '50% 48%', '58% 50%'],
    ['varanasi', '/city-art/varanasi.webp', '50% 52%', '54% 52%'],
    ['delhi', '/city-art/delhi.webp', '50% 48%', '52% 50%'],
    ['mumbai', '/city-art/mumbai.webp', '50% 50%', '55% 50%'],
  ])(
    'loads %s artwork decoratively with desktop and mobile focal points',
    (citySlug, src, position, mobilePosition) => {
      const { container } = render(<CityArtwork citySlug={citySlug} />);
      const frame = container.firstElementChild;
      const image = container.querySelector('img');

      expect(frame).toHaveAttribute('aria-hidden', 'true');
      expect(frame).toHaveAttribute('data-image', 'ready');
      expect(frame).toHaveStyle({
        '--city-art-position': position,
        '--city-art-mobile-position': mobilePosition,
      });
      expect(image).toHaveAttribute('src', src);
      expect(image).toHaveAttribute('alt', '');
      expect(image).toHaveAttribute('width', '1280');
      expect(image).toHaveAttribute('height', '960');
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image).toHaveAttribute('decoding', 'async');
    },
  );

  it('falls back cleanly for missing and unknown artwork', () => {
    const known = render(<CityArtwork citySlug="varanasi" />);
    const image = known.container.querySelector('img');
    expect(image).not.toBeNull();
    if (!image) throw new Error('Expected registered city artwork');
    fireEvent.error(image);
    expect(known.container.firstElementChild).toHaveAttribute('data-image', 'fallback');
    expect(known.container.querySelector('img')).not.toBeInTheDocument();

    const unknown = render(<CityArtwork citySlug="mysuru" />);
    expect(unknown.container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(unknown.container.firstElementChild).toHaveAttribute('data-image', 'fallback');
    expect(unknown.container.querySelector('img')).not.toBeInTheDocument();
  });
});
