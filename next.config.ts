import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Photos live in Vercel Blob, whose hostname is per-store
    // (<storeId>.public.blob.vercel-storage.com), so the subdomain is a
    // wildcard. Avatars from OAuth providers render through <Avatar>, which
    // is `unoptimized` — those hosts are outside our control and shouldn't
    // become an allowlist we have to maintain.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
