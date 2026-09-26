"use client";

import { useEffect, useState } from "react";
import type { ListingsPage } from "@/domain/listing";
import type { SearchCriteria } from "@/domain/search";
import { useServices } from "../services";

const DEBOUNCE_MS = 200;

export function useListings(criteria: SearchCriteria, version: number, enabled: boolean) {
  const { listings } = useServices();
  const [page, setPage] = useState<ListingsPage | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const timer = setTimeout(() => {
      listings.search(criteria).then(
        (result) => {
          if (!current) return;
          setPage(result);
          setError(null);
        },
        (reason: unknown) => current && setError(reason),
      );
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [listings, criteria, version, enabled]);

  return { page, error };
}
