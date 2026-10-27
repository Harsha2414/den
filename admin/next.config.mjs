import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app lives in the admin/ folder of the Den repo; trace files from here only.
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  poweredByHeader: false,
  // The Docs section reads its Markdown files at request time; ship them with the server code.
  outputFileTracingIncludes: { "/docs": ["./content/docs/**"], "/docs/[slug]": ["./content/docs/**"] },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
      ],
    }];
  },
};
export default nextConfig;
