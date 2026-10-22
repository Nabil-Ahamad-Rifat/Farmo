import type { Metadata, Viewport } from "next";
import { Noto_Sans_Bengali, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font: no request to Google at run time, so the CSP stays unchanged.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

// Plus Jakarta Sans has no taka sign (৳); this supplies it (and any Bangla text) at a matching size.
const bengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Farm Manager", template: "%s · Farm Manager" },
  description: "Sales and dues, workers' pay, animals, feed, and clear profit and cash for your dairy farm.",
  applicationName: "Farm Manager",
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${bengali.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
