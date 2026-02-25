import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Petslog - Správa útulku",
  description: "Cloudový systém pro správu útulku - evidence zvířat, krmení, léky, adopce",
  icons: {
    icon: "/petslog.png",
    apple: "/petslog.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
