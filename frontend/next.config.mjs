import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: "export",
  trailingSlash: true,
  productionBrowserSourceMaps: false,
  turbopack: {
    // Prevent root auto-detection issues when multiple lockfiles exist.
    root: __dirname,
  },
}

export default nextConfig
