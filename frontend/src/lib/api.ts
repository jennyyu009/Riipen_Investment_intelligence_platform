const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiFetch(path: string, options?: RequestInit) {
  if (!API_BASE_URL) {
    throw new Error("Missing VITE_API_BASE_URL");
  }

  const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}${path}`, options);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
