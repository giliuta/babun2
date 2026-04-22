import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Babun CRM",
    short_name: "Babun",
    description: "CRM система для AirFix — управление записями, клиентами и бригадами",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4EEE3",
    theme_color: "#2D4A3D",
    lang: "ru",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
