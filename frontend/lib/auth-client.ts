import { API_BASE } from "./config"

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
    credentials: "include",
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { success: false, error: data.error || data.message || "Email ou mot de passe incorrect" }
  }

  const data = await res.json().catch(() => ({}))
  if (data?.token) {
    try {
      localStorage.setItem("jwt", data.token)
    } catch {
      // ignore storage errors
    }
  }
  return { success: true }
}

export async function logout() {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
  }).catch(() => {})

  try {
    localStorage.removeItem("jwt")
  } catch {
    // ignore storage errors
  }
}
