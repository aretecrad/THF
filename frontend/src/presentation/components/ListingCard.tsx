"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { Listing, ListingKind } from "@/domain/listing";
import { cx } from "../class-names";
import { detailNotes, NOT_AVAILABLE, placeLabel, priceLabel } from "../copy";
import { formatKm, timeAgo } from "../format";
import { KindTag } from "./KindTag";
import styles from "./ListingCard.module.css";

const TONE: Readonly<Record<ListingKind, string | undefined>> = { sale: styles.sale, rent: styles.rent, "sale/rent": undefined };

type Props = {
  listing: Listing;
  distanceKm: number | null;
  radiusKm: number;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function ListingCard({ listing, distanceKm, radiusKm, selected, onSelect }: Props) {
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!selected) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, [selected]);

  return (
    <li ref={ref} className={cx(styles.card, TONE[listing.kind], selected && styles.selected)} aria-current={selected || undefined}>
      <button type="button" className={styles.main} onClick={() => onSelect(listing.id)}>
        <span className={styles.distance}>
          {distanceKm === null ? (
            <span className={cx(styles.km, styles.missing)} aria-label="Distance not available">
              {NOT_AVAILABLE}
            </span>
          ) : (
            <>
              <span className={styles.km}>
                {formatKm(distanceKm)}
                <small>km</small>
              </span>
              <span className={styles.ruler} style={{ "--position": Math.min(1, distanceKm / radiusKm) } as CSSProperties} aria-hidden="true">
                <i />
              </span>
            </>
          )}
        </span>
        <span className={styles.body}>
          <span className={styles.head}>
            <KindTag kind={listing.kind} />
            <span className={cx(styles.price, !listing.price && styles.missing)}>{priceLabel(listing)}</span>
          </span>
          <span className={cx(styles.place, !listing.location && styles.missing)}>{placeLabel(listing)}</span>
          <span className={styles.text}>{listing.text}</span>
        </span>
      </button>
      <div className={styles.meta}>
        <span>{listing.author ? `@${listing.author}` : "Unknown author"}</span>
        <span>{timeAgo(listing.postedAt)}</span>
        {detailNotes(listing).map((note) => (
          <span key={note}>{note}</span>
        ))}
        {listing.permalink && (
          <a href={listing.permalink} target="_blank" rel="noreferrer">
            Open on Threads
          </a>
        )}
      </div>
    </li>
  );
}
