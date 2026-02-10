import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PawShelter - Shelter Management System",
  description: "Cloud-based animal shelter management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
