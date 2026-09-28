import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Persona · Your first conversation",
  description: "A personal assistant that gets to know you. Start with a conversation, leave with a little less on your plate.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
