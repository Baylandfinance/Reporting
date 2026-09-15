import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bayland Finance Reporting",
  description: "Internal reporting and analytics platform for Bayland Finance.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
