export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const existingSessionId = sessionStorage.getItem("route-parcels-session-id");
  const sessionId =
    existingSessionId ??
    `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  if (!existingSessionId) {
    sessionStorage.setItem("route-parcels-session-id", sessionId);
  }

  const headers = new Headers(init?.headers ?? {});
  headers.set("x-session-id", sessionId);

  const response = await fetch(path, { ...init, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Request failed");
  }
  return payload as T;
}
