import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tripwise — Hidden Gems in Your Work Trip Gaps",
  description: "Drop your work calendar and discover the best spots to explore between meetings. Save time, skip the research, find hidden gems.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sora:wght@100..800&display=swap"
        />
      </head>
      <body className="bg-cream text-warm-600 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
