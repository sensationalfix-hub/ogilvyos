import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./os-dock.css";
import "./reference-capture.css";
import { OSDock } from "@/components/os/os-dock";

export const metadata: Metadata = {
  title: "Home · Work, Life y Creative Lab",
  description: "Tu espacio personal para trabajo, vida e ideas.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  appleWebApp: {
    capable: true,
    title: "Home",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f3ed",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}<OSDock /></body></html>;
}
