import { AppShell } from "@/presentation/components/AppShell";
import { Providers } from "./providers";

export default function HomePage() {
  return (
    <Providers>
      <AppShell />
    </Providers>
  );
}
