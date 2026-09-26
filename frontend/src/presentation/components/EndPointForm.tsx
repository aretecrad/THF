"use client";

import { useState, type FormEvent } from "react";
import type { EndPoint } from "@/domain/search";
import { describeError } from "../copy";
import { formatCoordinates } from "../format";
import { useEndPointPicker } from "../hooks/use-end-point-picker";
import { Button } from "./Button";
import styles from "./EndPointForm.module.css";

type Props = {
  endPoint: EndPoint | null;
  onPicked: (endPoint: EndPoint) => void;
};

export function EndPointForm({ endPoint, onPicked }: Props) {
  const [query, setQuery] = useState("");
  const picker = useEndPointPicker(onPicked);
  const busy = picker.pending !== null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await picker.fromQuery(query)) setQuery("");
  }

  return (
    <form onSubmit={submit}>
      <label className={styles.label} htmlFor="end-point">
        End point
      </label>
      <div className={styles.row}>
        <input
          id="end-point"
          className={styles.input}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Address or lat,lng"
          autoComplete="off"
        />
        <Button type="submit" disabled={busy || !query.trim()}>
          {picker.pending === "query" ? "Finding…" : "Set end point"}
        </Button>
      </div>
      <div className={styles.current}>
        {endPoint ? (
          <p className={styles.chosen}>
            Ranking from <strong>{endPoint.label}</strong>
            <span className={styles.coordinates}>{formatCoordinates(endPoint.point)}</span>
          </p>
        ) : (
          <p className={styles.hint}>Or click anywhere on the map.</p>
        )}
        <Button variant="link" onClick={() => void picker.fromDevice()} disabled={busy}>
          {picker.pending === "device" ? "Locating…" : "Use my location"}
        </Button>
      </div>
      {picker.error !== null && (
        <p className={styles.error} role="alert">
          {describeError(picker.error)}
        </p>
      )}
    </form>
  );
}
