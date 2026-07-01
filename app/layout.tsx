import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareGuard Privacy Dashboard",
  description: "UI-only prototype for privacy-preserving fall detection monitoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
