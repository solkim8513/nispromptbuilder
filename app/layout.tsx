import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NIS Prompt Builder",
  description: "Structured prompt builder for PRDs, implementation prompts, and reviews."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
