import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Faturação Pontevel",
  description: "Registo diário de faturação por posto"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
