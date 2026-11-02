import type { MetadataRoute } from "next";

// Lets phones install Baa-ook Club to the home screen (and is what a Play Store wrapper builds from).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Baa-ook Club",
    short_name: "Baa-ook Club",
    description: "A cozy place to talk a book over, out loud, with an animated host.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#c9d6a5",
    theme_color: "#c9d6a5",
    categories: ["books", "education", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
