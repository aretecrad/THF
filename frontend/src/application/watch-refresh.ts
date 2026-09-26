import type { RefreshStatus } from "@/domain/refresh";
import type { RefreshGateway } from "./ports";

type Wait = (ms: number, signal: AbortSignal) => Promise<void>;

interface WatchOptions {
  readonly intervalMs: number;
  readonly signal: AbortSignal;
  readonly justStarted?: boolean;
  readonly wait?: Wait;
}

export async function watchRefresh(
  gateway: RefreshGateway,
  onStatus: (status: RefreshStatus) => void,
  { intervalMs, signal, justStarted = false, wait = abortableDelay }: WatchOptions,
): Promise<boolean> {
  let sawRun = justStarted;
  let status = await gateway.current();
  if (signal.aborted) return false;
  onStatus(status);

  while (status.state === "running") {
    sawRun = true;
    await wait(intervalMs, signal);
    if (signal.aborted) return false;
    status = await gateway.current();
    if (signal.aborted) return false;
    onStatus(status);
  }
  return sawRun;
}

const abortableDelay: Wait = (ms, signal) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
