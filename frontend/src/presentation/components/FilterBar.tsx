"use client";

import { KIND_FILTERS, LOOKBACK_DAYS, RADIUS_LIMITS_KM, type SearchCriteria } from "@/domain/search";
import { KIND_FILTER_LABEL } from "../copy";
import { formatLookback } from "../format";
import styles from "./FilterBar.module.css";

type Props = {
  criteria: SearchCriteria;
  onChange: (changes: Partial<SearchCriteria>) => void;
};

export function FilterBar({ criteria, onChange }: Props) {
  return (
    <div className={styles.filters}>
      <div>
        <label className={styles.distanceLabel} htmlFor="distance">
          <span>Distance</span>
          <output className={styles.distanceValue} htmlFor="distance">
            within {criteria.radiusKm} km
          </output>
        </label>
        <input
          id="distance"
          className={styles.range}
          type="range"
          min={RADIUS_LIMITS_KM.min}
          max={RADIUS_LIMITS_KM.max}
          step={1}
          value={criteria.radiusKm}
          onChange={(event) => onChange({ radiusKm: Number(event.target.value) })}
        />
      </div>
      <div className={styles.row}>
        <div>
          <span className={styles.label} id="kind-label">
            Listing
          </span>
          <div className={styles.segmented} role="group" aria-labelledby="kind-label">
            {KIND_FILTERS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={styles.segment}
                aria-pressed={criteria.kind === kind}
                onClick={() => onChange({ kind })}
              >
                {KIND_FILTER_LABEL[kind]}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.grow}>
          <label className={styles.label} htmlFor="lookback">
            Posted within
          </label>
          <select id="lookback" className={styles.select} value={criteria.days} onChange={(event) => onChange({ days: Number(event.target.value) })}>
            {LOOKBACK_DAYS.map((days) => (
              <option key={days} value={days}>
                {formatLookback(days)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
