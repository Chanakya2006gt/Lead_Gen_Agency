import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Engine | Private Client Discovery & High-Conviction Auditor",
  description:
    "Private discovery and qualification command center evaluating local operating businesses against reputation momentum, technical website audits, and multi-tier operational software opportunities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0B0F17] text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
