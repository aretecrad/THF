import type { GeoPoint } from "@/domain/geo";

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export function timeAgo(date: Date | undefined, now: Date = new Date()): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  const seconds = (date.getTime() - now.getTime()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeTime.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export const formatKm = (km: number): string => km.toFixed(1);

export const formatCoordinates = ({ lat, lng }: GeoPoint): string => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

export const formatLookback = (days: number): string => (days === 365 ? "1 year" : `${days} days`);

export const pluralize = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;
