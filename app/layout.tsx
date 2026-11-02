import "./globals.css";
import { Fraunces, Inter } from "next/font/google";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", weight: ["600", "800"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata = { title: "Baa-ook Club", description: "Ask Woolf the sheep anything about your book" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
