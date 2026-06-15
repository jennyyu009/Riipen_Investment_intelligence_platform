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
    if (text) {
      try {
        const data = JSON.parse(text);
        message = data.detail || data.message || message;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  console.info(`[API] Response ${path}`, data);
  return data;
}
