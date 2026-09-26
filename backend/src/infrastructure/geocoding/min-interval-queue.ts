type Sleep = (ms: number) => Promise<void>;
type Job = () => Promise<void>;

const sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class MinIntervalQueue {
  private readonly urgent: Job[] = [];
  private readonly background: Job[] = [];
  private draining = false;
  private lastStart = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly intervalMs: number,
    private readonly now: () => number = Date.now,
    private readonly wait: Sleep = sleep,
  ) {}

  run<T>(task: () => Promise<T>, { urgent = false } = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      (urgent ? this.urgent : this.background).push(() => Promise.resolve().then(task).then(resolve, reject));
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.urgent.length > 0 || this.background.length > 0) {
        const delay = this.lastStart + this.intervalMs - this.now();
        if (delay > 0) await this.wait(delay);
        const job = this.urgent.shift() ?? this.background.shift()!;
        this.lastStart = this.now();
        await job();
      }
    } finally {
      this.draining = false;
    }
  }
}
