import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OrçaFácil — Orçamentos para autônomos",
  description: "Crie orçamentos profissionais, organize clientes e acompanhe seus serviços.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
