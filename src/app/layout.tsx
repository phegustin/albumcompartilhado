import type { Metadata, Viewport } from "next";

/*
 * Fontes self-hosted (pacotes @fontsource).
 * Motivo: `next/font/google` baixa as fontes do Google durante o build, o que
 * não funciona em ambientes sem acesso à internet aberta (ex.: este sandbox).
 * Assim os arquivos vêm do npm e o build é 100% offline.
 */
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";

import "./globals.css";

export const metadata: Metadata = {
  title: "Álbum Compartilhado",
  description:
    "Galeria compartilhada por QR Code: convidados enviam fotos, vídeos e recados de voz sem baixar nada.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#213028",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
