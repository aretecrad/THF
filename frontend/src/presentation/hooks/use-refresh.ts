"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { watchRefresh } from "@/application/watch-refresh";
import type { RefreshStatus } from "@/domain/refresh";
import { useServices } from "../services";

const POLL_INTERVAL_MS = 1_500;

export function useRefresh(onFinished: () => void, enabled: boolean) {
  const { refresh } = useServices();
  const [status, setStatus] = useState<RefreshStatus>({ state: "idle" });
  const [error, setError] = useState<unknown>(null);
  const [watch, setWatch] = useState({ id: 0, justStarted: false });
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    watchRefresh(refresh, setStatus, { intervalMs: POLL_INTERVAL_MS, signal: controller.signal, justStarted: watch.justStarted }).then(
      (finished) => finished && onFinishedRef.current(),
      (reason: unknown) => !controller.signal.aborted && setError(reason),
    );
    return () => controller.abort();
  }, [refresh, watch, enabled]);

  const start = useCallback(
    async (days: number) => {
      setError(null);
      try {
        setStatus(await refresh.start(days));
        setWatch((current) => ({ id: current.id + 1, justStarted: true }));
      } catch (reason) {
        setError(reason);
      }
    },
    [refresh],
  );

  return { status, error, start };
}
