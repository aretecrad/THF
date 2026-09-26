"use client";

import { useEffect, useState } from "react";
import type { SystemStatus } from "@/domain/system";
import { useServices } from "../services";

export function useSystemStatus(version: number, enabled: boolean) {
  const { system } = useServices();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    system.status().then(
      (result) => {
        if (!current) return;
        setStatus(result);
        setError(null);
      },
      (reason: unknown) => current && setError(reason),
    );
    return () => {
      current = false;
    };
  }, [system, version, enabled]);

  return { status, error };
}
