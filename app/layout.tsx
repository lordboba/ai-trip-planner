import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas / AI Trip Planner",
  description: "Website-first skeleton for an AI trip planner with OpenAI and Claude-compatible agents.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
