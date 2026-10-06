import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AZE Dijital",
  description: "AZE'nin Dijital Gezegeni",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50">{children}</body>
    </html>
  );
}
