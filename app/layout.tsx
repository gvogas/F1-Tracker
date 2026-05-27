import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "F1 Live — Real-Time Timing & Track Map",
  description:
    "Live Formula 1 timing tower and track map powered by OpenF1, with replay and AI commentary.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-zinc-100 antialiased">
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
