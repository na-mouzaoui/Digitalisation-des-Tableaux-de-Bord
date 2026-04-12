import { API_BASE } from "./config"

/**
 * Fetch wrapper that automatically includes JWT token from localStorage
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let token: string | null = null
  try {
    token = localStorage.getItem("jwt")
  } catch {
    // localStorage not available
  }

  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
