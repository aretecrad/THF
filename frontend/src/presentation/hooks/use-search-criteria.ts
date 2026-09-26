"use client";

import { useCallback, useState } from "react";
import { DEFAULT_CRITERIA, type SearchCriteria } from "@/domain/search";

export function useSearchCriteria() {
  const [criteria, setCriteria] = useState<SearchCriteria>(DEFAULT_CRITERIA);
  const update = useCallback((changes: Partial<SearchCriteria>) => setCriteria((current) => ({ ...current, ...changes })), []);
  return { criteria, update };
}
