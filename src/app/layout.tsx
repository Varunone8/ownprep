import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ranklab/cse — Your GATE CSE Study Desk",
  description: "A private, CBT-style GATE CSE practice desk with your own question bank, PYQ imports, timed tests and honest progress analytics.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
