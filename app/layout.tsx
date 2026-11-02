import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Archivo, Bowlby_One } from "next/font/google";
import ServiceWorker from "@/components/ServiceWorker";

// Bowlby One is the typeface inside the original sheep file, so the brand grows out of the character art.
const display = Bowlby_One({ subsets: ["latin"], variable: "--font-display", weight: "400" });
const body = Archivo({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "700", "800"] });

export const metadata: Metadata = {
  title: "Baa-ook Club",
  description: "A cozy place to talk a book over, out loud, with an animated host.",
  appleWebApp: { capable: true, title: "Baa-ook Club", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#c9d6a5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
