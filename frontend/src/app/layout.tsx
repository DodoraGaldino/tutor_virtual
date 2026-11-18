import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import ProfileModal from "@/components/ProfileModal";

export const metadata: Metadata = {
  title: "PET-BSI — Tutor Virtual",
  description: "Assistente inteligente PET-BSI para Sistemas de Informação",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0c0816",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
      </head>
      <body className="bg-[#0c0816] text-[#ede9f6] antialiased h-[100dvh] min-h-[100dvh] overflow-hidden selection:bg-[#7c3aed] selection:text-white">
        <AuthProvider>
          {children}
          <ProfileModal />
        </AuthProvider>
      </body>
    </html>
  );
}
