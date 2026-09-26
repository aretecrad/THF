import type { ListingKind } from "@/domain/listing";

export const MAP_COLORS = {
  ink: "#0f1b2d",
  endPoint: "#ffb300",
  halo: "#ffffff",
} as const;

export const KIND_COLORS: Readonly<Record<ListingKind, string>> = {
  sale: "#e0433b",
  rent: "#2f6fe4",
  "sale/rent": "#0f1b2d",
};
