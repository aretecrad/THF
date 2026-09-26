import { BackendUnavailableError, NotSignedInError, RequestRejectedError } from "@/application/errors";

type Fetch = typeof fetch;
type Query = Readonly<Record<string, string | number | undefined>>;

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly http: Fetch = (input, init) => fetch(input, init),
  ) {}

  get<T>(path: string, query: Query = {}): Promise<T> {
    return this.request<T>(`${path}${toQueryString(query)}`, { method: "GET" });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    const json = body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
    return this.request<T>(path, { method: "POST", ...json });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await this.http(`${this.baseUrl}${path}`, { ...init, cache: "no-store", credentials: "same-origin" });
    } catch {
      throw new BackendUnavailableError();
    }

    const body: unknown = await response.json().catch(() => undefined);
    if (response.ok) return body as T;

    const { message, code } = apiError(body);
    if (code === "not_signed_in") throw new NotSignedInError();
    if (!message) throw new BackendUnavailableError();
    throw new RequestRejectedError(message, response.status, code);
  }
}

function toQueryString(query: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  const text = params.toString();
  return text ? `?${text}` : "";
}

function apiError(body: unknown): { message?: string; code?: string } {
  if (typeof body !== "object" || body === null) return {};
  const { error, code } = body as { error?: unknown; code?: unknown };
  return { message: typeof error === "string" ? error : undefined, code: typeof code === "string" ? code : undefined };
}
