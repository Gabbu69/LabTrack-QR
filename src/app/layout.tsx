import "@fontsource-variable/inter";
import "@fontsource/saira-condensed/600.css";
import "@fontsource/saira-condensed/700.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "AISAT Davao LabTrack QR",
    template: "%s | AISAT Davao LabTrack QR",
  },
  description: "AISAT Davao QR-based aviation laboratory tool tracking and borrowing management system.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07577f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
