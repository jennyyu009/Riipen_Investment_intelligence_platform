const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL;

export async function apiFetch(path: string, options?: RequestInit) {
  if (!API_BASE_URL) {
    console.error("[API] Missing VITE_API_BASE_URL or VITE_API_URL");
    throw new Error("Missing deployed backend API URL");
  }

  const url = `${API_BASE_URL.replace(/\/$/, "")}${path}`;
  console.info(`[API] ${options?.method || "GET"} ${url}`);

  const response = await fetch(url, options);

  if (!response.ok) {
    console.error(`[API] ${response.status} ${url}`);
    const text = await response.text();
    let message = `API request failed: ${response.status}`;
    let detail: unknown = null;
    if (text) {
      try {
        const data = JSON.parse(text);
        detail = data.detail ?? data.message ?? null;
        if (typeof detail === "string") {
          message = detail;
        } else if (detail && typeof detail === "object" && "message" in detail) {
          message = String((detail as { message?: unknown }).message || message);
        } else {
          message = data.message || message;
        }
      } catch {
        message = text;
      }
    }
    const error = new Error(message) as Error & { status?: number; detail?: unknown; responseText?: string };
    error.status = response.status;
    error.detail = detail;
    error.responseText = text;
    throw error;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  console.info(`[API] Response ${path}`, data);
  return data;
}
