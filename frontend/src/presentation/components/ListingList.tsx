"use client";

import type { ReactNode } from "react";
import type { ListingsPage } from "@/domain/listing";
import type { SearchCriteria } from "@/domain/search";
import type { SystemStatus } from "@/domain/system";
import { NOT_AVAILABLE, unlocatedHint, unlocatedNote, withinRadiusHeadline } from "../copy";
import { ListingCard } from "./ListingCard";
import styles from "./ListingList.module.css";

type Props = {
  criteria: SearchCriteria;
  page: ListingsPage | null;
  system: SystemStatus | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  guest?: boolean;
};

export function ListingList({ criteria, page, system, selectedId, onSelect, guest = false }: Props) {
  if (guest) {
    return (
      <EmptyState title="Find houses near you">
        Log in with Threads, set your end point, and see houses for sale and rent posted on Threads, nearest first.
      </EmptyState>
    );
  }
  if (system?.listings === 0) {
    return (
      <EmptyState title="No listings yet">Refresh listings to search Threads for houses for sale and rent.</EmptyState>
    );
  }
  if (!criteria.endPoint) {
    return (
      <EmptyState title="Set your end point">
        Type an address or coordinates, use your location, or click the map. Listings are ranked by distance from that
        point.
      </EmptyState>
    );
  }
  if (!page) return <p className={styles.loading}>Loading listings…</p>;

  const unlocatedCount = page.unlocated.length;
  const cardProps = { radiusKm: criteria.radiusKm, onSelect };
  return (
    <div className={styles.root}>
      <header className={styles.summary}>
        <h2 className={styles.headline}>{withinRadiusHeadline(page.counts.withinRadius ?? 0, criteria.radiusKm)}</h2>
        {unlocatedCount > 0 && <p className={styles.note}>{unlocatedHint(unlocatedCount)}</p>}
      </header>
      <div className={styles.scroll}>
        {page.items.length === 0 ? (
          <EmptyState title={`Nothing within ${criteria.radiusKm} km`}>Try a larger distance or a longer time range.</EmptyState>
        ) : (
          <ol className={styles.items}>
            {page.items.map(({ listing, distanceKm }) => (
              <ListingCard key={listing.id} listing={listing} distanceKm={distanceKm} selected={listing.id === selectedId} {...cardProps} />
            ))}
          </ol>
        )}
        {unlocatedCount > 0 && (
          <section className={styles.unlocated} aria-labelledby="unlocated-heading">
            <header className={styles.sectionHeader}>
              <h3 id="unlocated-heading" className={styles.sectionTitle}>
                Location {NOT_AVAILABLE}
              </h3>
              <p className={styles.note}>{unlocatedNote(unlocatedCount)}</p>
            </header>
            <ul className={styles.items}>
              {page.unlocated.map((listing) => (
                <ListingCard key={listing.id} listing={listing} distanceKm={null} selected={listing.id === selectedId} {...cardProps} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.empty}>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
