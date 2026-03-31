import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "Tripwise — AI Trip Planner",
  description: "AI-powered trip planning with personalized itineraries backed by real reviews.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={sora.variable}>
      <body className="bg-cream text-warm-600 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
