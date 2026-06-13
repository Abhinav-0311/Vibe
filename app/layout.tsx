import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vibe - Launch Readiness Auditor",
  description:
    "A production-readiness auditor for AI-built apps and AI coding workspaces.",
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
