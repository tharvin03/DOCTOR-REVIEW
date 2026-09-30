import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3", "exceljs"],
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  poweredByHeader: false,
  // Explicit alias: the tsconfig-paths resolver fails inside "[param]" directories in this setup.
  webpack(config) {
    config.resolve.alias["@"] = root;
    return config;
  },
};
export default nextConfig;
