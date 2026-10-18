import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thoughtfully — plan what matters",
  description: "A thoughtful AI companion for Indian occasions, shopping lists, budgets and everyday planning.",
  applicationName: "Thoughtfully",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#f7f7f2", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
