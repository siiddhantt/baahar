export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

type ShareNavigator = Pick<Navigator, 'share' | 'clipboard'>;

function isCancellation(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export async function shareLink(
  title: string,
  url: string,
  navigatorApi: ShareNavigator = navigator,
): Promise<ShareResult> {
  if (navigatorApi.share) {
    try {
      await navigatorApi.share({ title, url });
      return 'shared';
    } catch (error) {
      if (isCancellation(error)) return 'cancelled';
    }
  }

  try {
    await navigatorApi.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
