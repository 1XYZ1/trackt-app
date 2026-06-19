import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // avif/webp para los assets servidos vía next/image (logo sidebar, login).
    // Sin remotePatterns: las evidencias de Supabase usan <img> nativo porque su
    // URL es firmada con TTL corto y el optimizer de next/image churnearía.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
