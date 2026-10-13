import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "???의 사건일지 | 가인과 아벨",
  description: "모바일 인터랙티브 방탈출 웹게임 - ???의 사건일지",
  icons: {
    icon: "/images/clear.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1a1614",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-[#141110] text-[#2c221e] antialiased">
        {children}
      </body>
    </html>
  );
}
