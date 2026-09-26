"use client";

import { useState, type ReactNode } from "react";
import { createServices } from "@/composition/create-services";
import { ServicesProvider } from "@/presentation/services";

export function Providers({ children }: { children: ReactNode }) {
  const [services] = useState(createServices);
  return <ServicesProvider services={services}>{children}</ServicesProvider>;
}
