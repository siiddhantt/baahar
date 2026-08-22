export type CityArt = {
  src: string;
  position: string;
  mobilePosition: string;
  atmosphere: 'coast' | 'dust' | 'rain' | 'river';
};

const cityArt: Readonly<Record<string, CityArt>> = {
  bengaluru: {
    src: '/city-art/bengaluru.webp',
    position: '50% 48%',
    mobilePosition: '58% 50%',
    atmosphere: 'rain',
  },
  varanasi: {
    src: '/city-art/varanasi.webp',
    position: '50% 52%',
    mobilePosition: '54% 52%',
    atmosphere: 'river',
  },
  delhi: {
    src: '/city-art/delhi.webp',
    position: '50% 48%',
    mobilePosition: '52% 50%',
    atmosphere: 'dust',
  },
  mumbai: {
    src: '/city-art/mumbai.webp',
    position: '50% 50%',
    mobilePosition: '55% 50%',
    atmosphere: 'coast',
  },
};

export function cityArtFor(slug: string) {
  return cityArt[slug] ?? null;
}
