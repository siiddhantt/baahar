type ActionKind = 'replay' | 'trigger';

export class IdempotencyKeys {
  private readonly keys = new Map<string, string>();

  claim(action: ActionKind, targetId: string) {
    const identity = `${action}:${targetId}`;
    const existing = this.keys.get(identity);
    if (existing) return existing;

    const key = `baahar-${action}-${crypto.randomUUID()}`;
    this.keys.set(identity, key);
    return key;
  }

  clear(action: ActionKind, targetId: string) {
    this.keys.delete(`${action}:${targetId}`);
  }
}
