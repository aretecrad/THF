"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useReducer, useState } from "react";
import { NotSignedInError } from "@/application/errors";
import type { Account } from "@/domain/account";
import type { GeoPoint } from "@/domain/geo";
import type { EndPoint } from "@/domain/search";
import { cx } from "../class-names";
import { describeError } from "../copy";
import { useListings } from "../hooks/use-listings";
import { useMediaQuery } from "../hooks/use-media-query";
import { useRefresh } from "../hooks/use-refresh";
import { useSearchCriteria } from "../hooks/use-search-criteria";
import { useSystemStatus } from "../hooks/use-system-status";
import { AccountMenu } from "./AccountMenu";
import { Brand } from "./Brand";
import { Button } from "./Button";
import { EndPointForm } from "./EndPointForm";
import { FilterBar } from "./FilterBar";
import { GlassPanel } from "./GlassPanel";
import { ListingList } from "./ListingList";
import type { MapInsets } from "./ListingsMap";
import { RefreshPanel } from "./RefreshPanel";
import styles from "./Dashboard.module.css";

const ListingsMap = dynamic(() => import("./ListingsMap").then((mod) => mod.ListingsMap), {
  ssr: false,
  loading: () => <div className={cx(styles.map, styles.mapLoading)}>Loading map…</div>,
});

const DESKTOP_QUERY = "(min-width: 861px)";
const DESKTOP_INSETS: MapInsets = { top: 88, right: 32, bottom: 32, left: 452 };
const MOBILE_INSETS: MapInsets = { top: 16, right: 16, bottom: 16, left: 16 };

type Props = {
  account: Account | null;
  threadsLoginUrl: string;
  onLoginRequested: () => void;
  onSessionEnded: () => void;
  onLogout: () => void;
  onDeleteData: () => void;
};

export function Dashboard({ account, threadsLoginUrl, onLoginRequested, onSessionEnded, onLogout, onDeleteData }: Props) {
  const guest = account === null;
  const { criteria, update } = useSearchCriteria();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dataVersion, dataChanged] = useReducer((version: number) => version + 1, 0);
  const refresh = useRefresh(dataChanged, !guest);
  const system = useSystemStatus(dataVersion, !guest);
  const listings = useListings(criteria, dataVersion, !guest);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const error = listings.error ?? system.error ?? refresh.error;

  useEffect(() => {
    if (error instanceof NotSignedInError) onSessionEnded();
  }, [error, onSessionEnded]);

  const chooseEndPoint = useCallback(
    (endPoint: EndPoint) => {
      update({ endPoint });
      setSelectedId(null);
    },
    [update],
  );
  const pinEndPoint = useCallback((point: GeoPoint) => chooseEndPoint({ point, label: "Pinned point" }), [chooseEndPoint]);

  return (
    <div className={styles.shell}>
      <div className={styles.contents} inert={guest}>
        <ListingsMap
          className={styles.map}
          endPoint={criteria.endPoint}
          radiusKm={criteria.radiusKm}
          items={guest ? [] : (listings.page?.items ?? [])}
          selectedId={selectedId}
          insets={isDesktop ? DESKTOP_INSETS : MOBILE_INSETS}
          onSelect={setSelectedId}
          onPick={pinEndPoint}
        />
        <div className={styles.column}>
          <GlassPanel as="section" className={styles.controls} aria-label="End point and filters">
            <div className={styles.header}>
              <Brand />
              {account ? (
                <AccountMenu account={account} onLogout={onLogout} onDeleteData={onDeleteData} />
              ) : (
                <Button variant="quiet">Log in</Button>
              )}
            </div>
            <EndPointForm endPoint={criteria.endPoint} onPicked={chooseEndPoint} />
            <FilterBar criteria={criteria} onChange={update} />
          </GlassPanel>
          {error !== null && !(error instanceof NotSignedInError) && (
            <GlassPanel tone="alert" className={styles.alert} role="alert">
              {describeError(error)}
            </GlassPanel>
          )}
          <GlassPanel as="section" className={styles.results} aria-label="Listings by distance">
            <ListingList criteria={criteria} page={listings.page} system={system.status} selectedId={selectedId} onSelect={setSelectedId} guest={guest} />
          </GlassPanel>
        </div>
        <RefreshPanel
          className={styles.refresh}
          account={account}
          threadsLoginUrl={threadsLoginUrl}
          status={refresh.status}
          system={system.status}
          onRefresh={() => void refresh.start(criteria.days)}
        />
      </div>
      {guest && <button type="button" className={styles.guestGate} aria-label="Log in with Threads to use the app" onClick={onLoginRequested} />}
    </div>
  );
}
