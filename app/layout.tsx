import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "AZE Dijital",
  description: "AZE'nin Dijital Gezegeni",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reading the nonce makes every page dynamic, which per-request CSP nonces require.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="tr" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50">{children}</body>
    </html>
  );
}
