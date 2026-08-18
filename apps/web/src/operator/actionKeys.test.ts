import { IdempotencyKeys } from './actionKeys';

describe('IdempotencyKeys', () => {
  it('reuses a trigger key until that action succeeds', () => {
    const keys = new IdempotencyKeys();

    const firstAttempt = keys.claim('trigger', 'source-1');
    expect(keys.claim('trigger', 'source-1')).toBe(firstAttempt);

    keys.clear('trigger', 'source-1');
    expect(keys.claim('trigger', 'source-1')).not.toBe(firstAttempt);
  });
});
