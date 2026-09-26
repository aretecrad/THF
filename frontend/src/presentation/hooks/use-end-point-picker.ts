"use client";

import { useCallback, useState } from "react";
import { resolveEndPoint } from "@/application/resolve-end-point";
import type { EndPoint } from "@/domain/search";
import { useServices } from "../services";

type Source = "query" | "device";

export function useEndPointPicker(onPicked: (endPoint: EndPoint) => void) {
  const { places, location } = useServices();
  const [pending, setPending] = useState<Source | null>(null);
  const [error, setError] = useState<unknown>(null);

  const pick = useCallback(
    async (source: Source, resolve: () => Promise<EndPoint>): Promise<boolean> => {
      setPending(source);
      setError(null);
      try {
        onPicked(await resolve());
        return true;
      } catch (reason) {
        setError(reason);
        return false;
      } finally {
        setPending(null);
      }
    },
    [onPicked],
  );

  const fromQuery = useCallback((query: string) => pick("query", () => resolveEndPoint(query, places)), [pick, places]);

  const fromDevice = useCallback(
    () => pick("device", async () => ({ point: await location.current(), label: "Your location" })),
    [pick, location],
  );

  return { pending, error, fromQuery, fromDevice };
}
