"use server"

import { cookies } from "next/headers"
import type { User } from "./db"
import { API_BASE } from "./config"

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    const jwt = cookieStore.get("jwt")
    if (!jwt) return null

    const res = await fetch(`${API_BASE}/api/auth/me`, {
      cache: "no-store",
      headers: {
        cookie: `jwt=${jwt.value}`,
      },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.user || null
  } catch (_err) {
    return null
  }
}
