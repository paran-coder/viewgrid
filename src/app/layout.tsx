import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "ViewGrid",
  title: "ViewGrid — 멀티앵글 카메라 스튜디오",
  description:
    "이미지 위에 가상 카메라를 배치해 각도와 화각을 설계하고 3×3 결과 시트를 만드는 브라우저 스튜디오입니다.",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "ViewGrid",
    title: "ViewGrid — 멀티앵글 카메라 스튜디오",
    description:
      "가상 카메라의 각도와 화각을 조절해 일관된 3×3 멀티앵글 이미지를 생성하세요.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ViewGrid 가상 카메라 멀티앵글 스튜디오",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ViewGrid — 멀티앵글 카메라 스튜디오",
    description:
      "가상 카메라의 각도와 화각을 조절해 일관된 3×3 멀티앵글 이미지를 생성하세요.",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "ViewGrid",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#080b0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
