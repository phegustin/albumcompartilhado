import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * cacheComponents DESLIGADO de propósito.
   *
   * O scaffold do Next 16 vem com ele ligado, mas ele:
   *   1) tenta pré-renderizar as páginas estáticamente — e aqui tudo é
   *      dinâmico (fotos chegam em tempo real durante a festa);
   *   2) proíbe `export const runtime = "nodejs"`, que as rotas de arquivo
   *      (/api/media, /api/upload/local) precisam para usar o fs.
   */
  cacheComponents: false,

  // Mantido do scaffold: necessário para o Tailwind v4 funcionar no Turbopack.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
