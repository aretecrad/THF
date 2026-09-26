import { LocationUnavailableError } from "@/application/errors";
import type { LocationProvider } from "@/application/ports";
import type { GeoPoint } from "@/domain/geo";

const TIMEOUT_MS = 10_000;

export class BrowserLocationProvider implements LocationProvider {
  current(): Promise<GeoPoint> {
    return new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        reject(new LocationUnavailableError("unsupported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
        (error) => reject(new LocationUnavailableError(error.code === error.PERMISSION_DENIED ? "denied" : "failed")),
        { enableHighAccuracy: true, timeout: TIMEOUT_MS },
      );
    });
  }
}
