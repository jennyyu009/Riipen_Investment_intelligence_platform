const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export async function apiFetch(path: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
