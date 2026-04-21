import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SmoothScroll from "../components/SmoothScroll";

const drukWide = localFont({
  src: "../font/DrukWideBold.ttf",
  variable: "--font-druk-wide",
});

export const metadata: Metadata = {
  title: "Futura Studio",
  description: "Profesjonalne nagrania, mixing i mastering. Stwórz swój wymarzony dźwięk w Futura Studio.",
  keywords: "Futura Studio, nagrania, mixing, mastering, produkcja muzyczna, studio muzyczne, muzyka, nagrywanie, realizacja dźwięku, audio, studio nagraniowe",
  authors: [{ name: "Futura Studio" }],
  creator: "Futura Studio",
  publisher: "Futura Studio",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${drukWide.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
