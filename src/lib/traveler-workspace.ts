const API_BASE =
  import.meta.env.VITE_WORKSPACE_API_URL ||
  import.meta.env.NEXT_PUBLIC_WORKSPACE_API_URL ||
  "https://cdworkspace-ai-backend.onrender.com";

export { API_BASE };

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();

  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const detail =
      typeof data === "object" &&
      data !== null &&
      "detail" in data
        ? String((data as { detail: unknown }).detail)
        : `HTTP ${response.status}`;

    throw new Error(detail);
  }

  return data as T;
}

export function runAgent(payload: Record<string, unknown>) {
  return request("/api/agent/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function buildWorkspace(payload: Record<string, unknown>) {
  return request("/api/workspace/build", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function testWorkspace(payload: Record<string, unknown>) {
  return request("/api/workspace/test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function searchAndroidDocs(query: string) {
  return request("/api/android/docs/search", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export function buildAndroid(payload: Record<string, unknown>) {
  return request("/api/android/build", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function publishWebsite(payload: Record<string, unknown>) {
  return request("/api/workspace/publish", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function workspaceHealth() {
  return request("/health", {
    method: "GET",
  });
}
