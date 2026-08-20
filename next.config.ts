import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone is for Docker. Vercel needs the default Next.js output
  // or the build fails looking for `.next/next-server.js.nft.json`.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  serverExternalPackages: ["sharp", "undici"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
    ],
  },
};

export default nextConfig;
