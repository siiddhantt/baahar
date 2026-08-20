import { fireEvent, render } from '@testing-library/react';

import { CityArtwork } from './CityArtwork';

describe('CityArtwork', () => {
  it('loads known artwork decoratively without shifting its frame', () => {
    const { container } = render(<CityArtwork citySlug="bengaluru" />);
    const frame = container.firstElementChild;
    const image = container.querySelector('img');

    expect(frame).toHaveAttribute('aria-hidden', 'true');
    expect(frame).toHaveAttribute('data-image', 'ready');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('width', '1280');
    expect(image).toHaveAttribute('height', '960');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
  });

  it('falls back cleanly for missing and unknown artwork', () => {
    const known = render(<CityArtwork citySlug="varanasi" />);
    const image = known.container.querySelector('img');
    expect(image).not.toBeNull();
    if (!image) throw new Error('Expected registered city artwork');
    fireEvent.error(image);
    expect(known.container.firstElementChild).toHaveAttribute('data-image', 'fallback');
    expect(known.container.querySelector('img')).not.toBeInTheDocument();

    const unknown = render(<CityArtwork citySlug="mysuru" />);
    expect(unknown.container.firstElementChild).toHaveAttribute('data-image', 'fallback');
    expect(unknown.container.querySelector('img')).not.toBeInTheDocument();
  });
});
