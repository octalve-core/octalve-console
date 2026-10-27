import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

export const metadata: Metadata = {
  title: "Octalve Console",
  description: "Premium hosting business OS for Octalve Cloud."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider><LocaleProvider>{children}</LocaleProvider></AuthProvider>
      </body>
    </html>
  );
}
