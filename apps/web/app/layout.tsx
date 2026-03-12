import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Petslog - Správa útulku",
  description: "Cloudový systém pro správu útulku - evidence zvířat, krmení, léky, adopce",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
