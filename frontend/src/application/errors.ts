export class BackendUnavailableError extends Error {
  constructor() {
    super("The backend is unavailable.");
    this.name = "BackendUnavailableError";
  }
}

export class NotSignedInError extends Error {
  constructor() {
    super("Not signed in.");
    this.name = "NotSignedInError";
  }
}

export class RequestRejectedError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "RequestRejectedError";
  }
}

export type LocationFailure = "unsupported" | "denied" | "failed";

export class LocationUnavailableError extends Error {
  constructor(readonly reason: LocationFailure) {
    super(`Location unavailable: ${reason}`);
    this.name = "LocationUnavailableError";
  }
}
