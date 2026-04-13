// ============================
// Runtime API configuration
// Keep one option active.
// ============================

// Localhost profile
export const FRONTEND_BASE = "http://localhost:3000"
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5241"

// VM profile
// Use public port 80 for front <-> back communication on VM.
// export const FRONTEND_BASE = "http://172.20.0.3:80"
// export const API_BASE = "http://172.20.0.3:80"

