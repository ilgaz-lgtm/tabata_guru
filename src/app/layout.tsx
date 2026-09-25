import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import { DemoSensorBridge } from "@/components/DemoSensorBridge";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { BiometricsProvider } from "@/providers/biometrics-provider";
import { SettingsProvider } from "@/providers/settings-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Tabata",
  description: "A minimal Tabata interval timer built for phones, with room for live heart-rate and HRV.",
  applicationName: "Tabata",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Tabata" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#050506",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-ink text-chalk antialiased">
        <SettingsProvider>
          <BiometricsProvider>
            <DemoSensorBridge />
            {children}
          </BiometricsProvider>
        </SettingsProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
