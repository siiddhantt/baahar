import { fireEvent, render } from '@testing-library/react';

import { LivingCityScene } from './LivingCityScene';

describe('LivingCityScene', () => {
  it.each([
    ['bengaluru', 'Bengaluru', '/city-art/bengaluru.webp', 'rain'],
    ['varanasi', 'Varanasi', '/city-art/varanasi.webp', 'river'],
    ['delhi', 'Delhi', '/city-art/delhi.webp', 'dust'],
    ['mumbai', 'Mumbai', '/city-art/mumbai.webp', 'coast'],
  ])('uses the registered art and atmosphere for %s', (citySlug, cityName, src, atmosphere) => {
    const { container } = render(<LivingCityScene cityName={cityName} citySlug={citySlug} />);
    const scene = container.querySelector('figure');
    const image = container.querySelector('img');

    expect(scene).toHaveAccessibleName(`A living illustration of ${cityName}`);
    expect(scene).toHaveAttribute('data-atmosphere', atmosphere);
    expect(scene).toHaveAttribute('data-image', 'ready');
    expect(image).toHaveAttribute('src', src);
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('decoding', 'async');
  });

  it('keeps a styled fallback when an image cannot load', () => {
    const { container } = render(<LivingCityScene cityName="Varanasi" citySlug="varanasi" />);
    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    if (!image) throw new Error('Expected registered city artwork');

    fireEvent.error(image);

    expect(container.querySelector('figure')).toHaveAttribute('data-image', 'fallback');
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });
});
