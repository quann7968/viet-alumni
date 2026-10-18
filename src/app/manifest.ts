import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alumni Connect",
    short_name: "Alumni",
    description: "Reconnect with alumni, find mentors and opportunities.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#2a55d6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
