import { LoginRequiredError, NotConfiguredError, UpstreamError } from "./errors.js";
import type { Clock } from "./ports/clock.js";
import type { RefreshListings, RefreshOptions, RefreshProgress, RefreshSummary } from "./use-cases/refresh-listings.js";

export type RefreshStatus =
  | { readonly state: "idle" }
  | { readonly state: "running"; readonly startedAt: Date; readonly progress: RefreshProgress }
  | { readonly state: "done"; readonly startedAt: Date; readonly finishedAt: Date; readonly summary: RefreshSummary }
  | { readonly state: "error"; readonly startedAt: Date; readonly finishedAt: Date; readonly message: string };

const IDLE: RefreshStatus = { state: "idle" };
const UNEXPECTED_FAILURE = "The refresh failed because of a problem on our side. Please try again later.";

class RefreshCancelled extends Error {}

const isExplainable = (error: unknown): error is Error =>
  error instanceof UpstreamError || error instanceof LoginRequiredError || error instanceof NotConfiguredError;

export class RefreshJob {
  private readonly statuses = new Map<string, RefreshStatus>();
  private readonly runs = new Map<string, Promise<void>>();
  private readonly stopped = new Set<string>();

  constructor(
    private readonly refresh: RefreshListings,
    private readonly clock: Clock,
    private readonly onUnexpectedError: (error: unknown) => void = () => {},
  ) {}

  current(userId: string): RefreshStatus {
    return this.statuses.get(userId) ?? IDLE;
  }

  async start(userId: string, options: RefreshOptions): Promise<RefreshStatus> {
    const current = this.current(userId);
    if (current.state === "running") return current;
    if (this.stopped.has(userId)) throw new LoginRequiredError("Your data is being deleted. Log in again to use the app.");

    const startedAt = this.clock.now();
    const running: RefreshStatus = { state: "running", startedAt, progress: { phase: "searching", done: 0, total: 0 } };
    this.statuses.set(userId, running);
    const ready = this.refresh.assertCanRun(userId);
    this.runs.set(
      userId,
      ready.then(
        () => this.execute(userId, options, startedAt),
        () => void (this.statuses.get(userId) === running && this.statuses.set(userId, current)),
      ),
    );
    await ready;
    return running;
  }

  async whileStopped<T>(userId: string, work: () => Promise<T>): Promise<T> {
    this.stopped.add(userId);
    try {
      await this.settled(userId);
      return await work();
    } finally {
      this.stopped.delete(userId);
      this.forget(userId);
    }
  }

  settled(userId: string): Promise<void> {
    return this.runs.get(userId) ?? Promise.resolve();
  }

  private forget(userId: string): void {
    this.statuses.delete(userId);
    this.runs.delete(userId);
  }

  private async execute(userId: string, options: RefreshOptions, startedAt: Date): Promise<void> {
    try {
      const summary = await this.refresh.execute(userId, options, (progress) => {
        if (this.stopped.has(userId)) throw new RefreshCancelled();
        this.statuses.set(userId, { state: "running", startedAt, progress });
      });
      this.statuses.set(userId, { state: "done", startedAt, finishedAt: this.clock.now(), summary });
    } catch (error) {
      if (error instanceof RefreshCancelled) return;
      if (!isExplainable(error)) this.onUnexpectedError(error);
      const message = isExplainable(error) ? error.message : UNEXPECTED_FAILURE;
      this.statuses.set(userId, { state: "error", startedAt, finishedAt: this.clock.now(), message });
    }
  }
}
