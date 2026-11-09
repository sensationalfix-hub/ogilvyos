import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gym · LifeOS",
  description: "Registra tus entrenamientos, pesos y evolución física en LifeOS.",
  manifest: "/gym.webmanifest",
  appleWebApp: {
    capable: true,
    title: "LifeOS Gym",
    statusBarStyle: "black-translucent",
  },
  icons: { icon: "/gym-icon.svg", apple: "/gym-icon.svg" },
};

export default function GymLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
