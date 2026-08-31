export type IdempotencyLookup =
  | Readonly<{ outcome: "MISS" }>
  | Readonly<{ outcome: "REPLAY"; resultIdentity: string }>
  | Readonly<{ outcome: "CONFLICT" }>;

interface IdempotencyEntry {
  readonly payloadHash: string;
  readonly resultIdentity: string;
  readonly expiresAt: number;
}

export class BoundedIdempotencyRegistry {
  readonly #capacity: number;
  readonly #ttlMs: number;
  readonly #entries = new Map<string, IdempotencyEntry>();

  public constructor(capacity: number, ttlMs: number) {
    if (
      !Number.isSafeInteger(capacity) ||
      capacity < 1 ||
      !Number.isSafeInteger(ttlMs) ||
      ttlMs < 1
    ) {
      throw new RangeError("Idempotency capacity and ttlMs must be positive safe integers");
    }
    this.#capacity = capacity;
    this.#ttlMs = ttlMs;
  }

  public get size(): number {
    this.#prune(Date.now());
    return this.#entries.size;
  }

  public lookup(key: string, payloadHash: string, now: number = Date.now()): IdempotencyLookup {
    this.#prune(now);
    const entry = this.#entries.get(key);
    if (entry === undefined) return Object.freeze({ outcome: "MISS" });
    if (entry.payloadHash !== payloadHash) return Object.freeze({ outcome: "CONFLICT" });
    return Object.freeze({ outcome: "REPLAY", resultIdentity: entry.resultIdentity });
  }

  public record(
    key: string,
    payloadHash: string,
    resultIdentity: string,
    now: number = Date.now(),
  ): void {
    this.#prune(now);
    const current = this.lookup(key, payloadHash, now);
    if (current.outcome === "CONFLICT") {
      throw new Error("IDEMPOTENCY_PAYLOAD_CONFLICT");
    }
    if (current.outcome === "REPLAY") return;
    while (this.#entries.size >= this.#capacity) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
    this.#entries.set(key, { payloadHash, resultIdentity, expiresAt: now + this.#ttlMs });
  }

  #prune(now: number): void {
    for (const [key, entry] of this.#entries) {
      if (entry.expiresAt <= now) this.#entries.delete(key);
    }
  }
}
