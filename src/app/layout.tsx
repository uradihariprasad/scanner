import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Institutional Momentum Scanner | NSE F&O",
  description:
    "Real-time AI-powered Institutional Momentum Scanner for NSE F&O stocks. Detects institutional participation using Volume, Option Chain, OI, and Price Action analysis.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
