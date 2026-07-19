import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ViewGrid — 멀티앵글 카메라 스튜디오",
    short_name: "ViewGrid",
    description:
      "가상 카메라의 각도와 화각을 조절해 3×3 멀티앵글 이미지 시트를 만드는 브라우저 스튜디오",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#080b0f",
    theme_color: "#080b0f",
    orientation: "any",
    lang: "ko",
    categories: ["photo", "graphics", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
