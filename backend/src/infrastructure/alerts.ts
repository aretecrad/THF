type Fetch = typeof fetch;

const TIMEOUT_MS = 5_000;
const REPEAT_AFTER_MS = 10 * 60 * 1000;
const MAX_DETAIL_LENGTH = 1_500;

export class Alerts {
  private readonly lastSent = new Map<string, number>();

  constructor(
    private readonly webhookUrl: string | undefined,
    private readonly http: Fetch = (input, init) => fetch(input, init),
    private readonly now: () => number = Date.now,
  ) {}

  notify(title: string, error?: unknown): Promise<void> {
    if (!this.webhookUrl || this.sentRecently(`${title}\n${error instanceof Error ? error.message : String(error)}`)) return Promise.resolve();

    const detail = error instanceof Error ? (error.stack ?? error.message) : error === undefined ? "" : String(error);
    const text = `[THF] ${title}${detail ? `\n${detail.slice(0, MAX_DETAIL_LENGTH)}` : ""}`;
    return this.http(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).then(
      (response) => {
        if (!response.ok) console.error(`Alert webhook answered HTTP ${response.status}`);
      },
      (failure: unknown) => console.error("Couldn't send alert:", failure),
    );
  }

  private sentRecently(key: string): boolean {
    const now = this.now();
    const last = this.lastSent.get(key);
    if (last !== undefined && now - last < REPEAT_AFTER_MS) return true;
    if (this.lastSent.size > 1_000) this.lastSent.clear();
    this.lastSent.set(key, now);
    return false;
  }
}
