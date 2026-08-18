import { shareLink } from './share';

describe('shareLink', () => {
  it('reports native share cancellation without claiming success', async () => {
    const navigatorApi = {
      share: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')),
      clipboard: { writeText: vi.fn() },
    } as unknown as Pick<Navigator, 'share' | 'clipboard'>;

    await expect(shareLink('Plan', 'https://baahar.test/event', navigatorApi)).resolves.toBe(
      'cancelled',
    );
  });

  it('copies when native sharing is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const navigatorApi = {
      share: undefined,
      clipboard: { writeText },
    } as unknown as Pick<Navigator, 'share' | 'clipboard'>;

    await expect(shareLink('Plan', 'https://baahar.test/event', navigatorApi)).resolves.toBe(
      'copied',
    );
    expect(writeText).toHaveBeenCalledWith('https://baahar.test/event');
  });
});
