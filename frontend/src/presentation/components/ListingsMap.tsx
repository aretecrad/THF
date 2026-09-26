"use client";

import "leaflet/dist/leaflet.css";
import { latLng, latLngBounds, type CircleMarker as LeafletCircleMarker, type FitBoundsOptions } from "leaflet";
import { useEffect, useRef } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import type { GeoPoint } from "@/domain/geo";
import type { RankedListing } from "@/domain/listing";
import type { EndPoint } from "@/domain/search";
import { cx } from "../class-names";
import { formatKm } from "../format";
import { KIND_COLORS, MAP_COLORS } from "../theme";
import { KindTag } from "./KindTag";
import styles from "./ListingsMap.module.css";

export interface MapInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

type Props = {
  className?: string;
  endPoint: EndPoint | null;
  radiusKm: number;
  items: readonly RankedListing[];
  selectedId: string | null;
  insets: MapInsets;
  onSelect: (id: string) => void;
  onPick: (point: GeoPoint) => void;
};

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const POPUP_TEXT_LIMIT = 180;
const FRAME_ALL_MAX_ZOOM = 13;

export function ListingsMap({ className, endPoint, radiusKm, items, selectedId, insets, onSelect, onPick }: Props) {
  return (
    <MapContainer className={cx(styles.map, className)} center={[0, 0]} zoom={2} zoomControl={false} worldCopyJump>
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <ZoomControl position="bottomright" />
      <PickOnClick onPick={onPick} />
      <FrameSearchArea endPoint={endPoint} radiusKm={radiusKm} items={items} insets={insets} />
      {endPoint && <SearchRadius center={endPoint.point} radiusKm={radiusKm} />}
      {items.map((item) => (
        <ListingMarker key={item.listing.id} item={item} selected={item.listing.id === selectedId} onSelect={onSelect} />
      ))}
      {endPoint && <EndPointMarker point={endPoint.point} />}
    </MapContainer>
  );
}

function PickOnClick({ onPick }: { onPick: (point: GeoPoint) => void }) {
  useMapEvents({
    click(event) {
      const { lat, lng } = event.latlng.wrap();
      onPick({ lat, lng });
    },
  });
  return null;
}

const fitOptions = ({ top, right, bottom, left }: MapInsets): FitBoundsOptions => ({
  paddingTopLeft: [left, top],
  paddingBottomRight: [right, bottom],
});

function FrameSearchArea({ endPoint, radiusKm, items, insets }: Pick<Props, "endPoint" | "radiusKm" | "items" | "insets">) {
  const map = useMap();
  const framedAll = useRef(false);
  const lat = endPoint?.point.lat;
  const lng = endPoint?.point.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    map.fitBounds(latLng(lat, lng).toBounds(radiusKm * 2000), fitOptions(insets));
  }, [map, lat, lng, radiusKm, insets]);

  useEffect(() => {
    if (lat !== undefined || framedAll.current || items.length === 0) return;
    const points = items.map(({ listing }) => [listing.location.point.lat, listing.location.point.lng] as [number, number]);
    map.fitBounds(latLngBounds(points), { ...fitOptions(insets), maxZoom: FRAME_ALL_MAX_ZOOM });
    framedAll.current = true;
  }, [map, lat, items, insets]);

  return null;
}

function SearchRadius({ center, radiusKm }: { center: GeoPoint; radiusKm: number }) {
  return (
    <Circle
      center={[center.lat, center.lng]}
      radius={radiusKm * 1000}
      interactive={false}
      pathOptions={{ color: MAP_COLORS.ink, weight: 1.5, dashArray: "6 6", fillColor: MAP_COLORS.endPoint, fillOpacity: 0.07 }}
    />
  );
}

function EndPointMarker({ point }: { point: GeoPoint }) {
  return (
    <CircleMarker
      center={[point.lat, point.lng]}
      radius={9}
      interactive={false}
      pathOptions={{ color: MAP_COLORS.ink, weight: 3, fillColor: MAP_COLORS.endPoint, fillOpacity: 1, className: styles.marker }}
    />
  );
}

function ListingMarker({ item: { listing, distanceKm }, selected, onSelect }: { item: RankedListing; selected: boolean; onSelect: (id: string) => void }) {
  const ref = useRef<LeafletCircleMarker>(null);

  useEffect(() => {
    if (!selected || !ref.current) return;
    ref.current.bringToFront();
    ref.current.openPopup();
  }, [selected]);

  const { lat, lng } = listing.location.point;
  return (
    <CircleMarker
      ref={ref}
      center={[lat, lng]}
      radius={selected ? 10 : 7}
      bubblingMouseEvents={false}
      pathOptions={{
        color: selected ? MAP_COLORS.ink : MAP_COLORS.halo,
        weight: selected ? 3 : 2,
        fillColor: KIND_COLORS[listing.kind],
        fillOpacity: 0.95,
        className: styles.marker,
      }}
      eventHandlers={{ click: () => onSelect(listing.id) }}
    >
      <Popup>
        <div className={styles.popup}>
          <div className={styles.popupHead}>
            <KindTag kind={listing.kind} />
            <strong>{listing.price ?? "Price not listed"}</strong>
          </div>
          <p>
            {distanceKm !== null && <strong>{formatKm(distanceKm)} km away. </strong>}
            {listing.location.place}
          </p>
          <p className={styles.popupText}>{truncate(listing.text, POPUP_TEXT_LIMIT)}</p>
          {listing.permalink && (
            <a href={listing.permalink} target="_blank" rel="noreferrer">
              Open on Threads
            </a>
          )}
        </div>
      </Popup>
    </CircleMarker>
  );
}

const truncate = (text: string, limit: number): string => (text.length > limit ? `${text.slice(0, limit)}…` : text);
