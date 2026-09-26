"use client";

import { createContext, useContext, type ReactNode } from "react";
import type {
  AuthGateway,
  ListingsGateway,
  LocationProvider,
  PlacesGateway,
  RefreshGateway,
  SystemGateway,
} from "@/application/ports";

export interface Services {
  readonly auth: AuthGateway;
  readonly listings: ListingsGateway;
  readonly places: PlacesGateway;
  readonly refresh: RefreshGateway;
  readonly system: SystemGateway;
  readonly location: LocationProvider;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext value={services}>{children}</ServicesContext>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error("useServices() must be used inside <ServicesProvider>.");
  return services;
}
