import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: SITE_NAME.charAt(0).toUpperCase() + SITE_NAME.slice(1),
  description: "Coaching homework",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
