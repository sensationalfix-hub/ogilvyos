import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OgilvyOS",
  description: "Centro de mando visual para cuentas, proyectos, tareas, equipo y vacaciones.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
