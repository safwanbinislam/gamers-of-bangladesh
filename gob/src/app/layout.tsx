import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { ToastContainer } from "@/components/Toast";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GOB — Gamers of Bangladesh",
  description: "Safe escrow trading marketplace for the Bangladeshi gaming community",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-dark-bg text-text-primary">
        <NavBar />
        <main className="flex-1">{children}</main>
        <ToastContainer />
      </body>
    </html>
  );
}
