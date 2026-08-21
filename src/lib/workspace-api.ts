const API_BASE =
  import.meta.env.VITE_WORKSPACE_API_URL ||
  import.meta.env.NEXT_PUBLIC_WORKSPACE_API_URL ||
  "https://cdworkspace-ai-backend.onrender.com";

function joinUrl(path: string): string {
  const base = API_BASE.replace(/\/+$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

async function request<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(joinUrl(path), {
    ...init,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();

  let data: unknown = null;

  if (raw) {
    if (contentType.includes("application/json")) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    } else {
      data = raw;
    }
  }

  if (!response.ok) {
    const detail =
      typeof data === "object" &&
      data !== null &&
      "detail" in data
        ? String((data as { detail: unknown }).detail)
        : typeof data === "string"
          ? data
          : `HTTP ${response.status}`;

    throw new Error(
      `Traveler.dev workspace API ${response.status}: ${detail}`,
    );
  }

  return data as T;
}

export async function health(): Promise<unknown> {
  return request("/health");
}

export async function getWorkspaceCapabilities(): Promise<unknown> {
  return request("/api/workspace/capabilities");
}

export async function searchGithub(
  query: string,
): Promise<unknown> {
  return request("/api/github/search", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export async function searchAndroidDocs(
  query: string,
): Promise<unknown> {
  return request("/api/android/docs/search", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export async function buildWorkspace(
  payload: Record<string, unknown>,
): Promise<unknown> {
  return request("/api/workspace/build", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function testWorkspace(
  payload: Record<string, unknown>,
): Promise<unknown> {
  return request("/api/workspace/test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function runAgent(
  payload: Record<string, unknown>,
): Promise<unknown> {
  return request("/api/agent/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export { API_BASE };
