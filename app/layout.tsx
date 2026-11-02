import "./globals.css";
import { Archivo, Bowlby_One } from "next/font/google";

// Bowlby One is the typeface inside the original sheep file, so the brand grows out of the character art.
const display = Bowlby_One({ subsets: ["latin"], variable: "--font-display", weight: "400" });
const body = Archivo({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "700", "800"] });

export const metadata = { title: "Baa-ook Club", description: "Ask Woolf the sheep anything about your book" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
