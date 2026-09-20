import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorkOS",
  description: "Interfaz visual privada sobre el workspace operativo de Notion.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
