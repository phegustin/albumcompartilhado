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

  /*
   * Endereço secreto do Super Admin.
   *
   * Se ADMIN_PATH estiver definida (ex.: "painel-x7f2k9"), aquele caminho
   * passa a servir o painel e `/admin` devolve 404 (o middleware faz isso).
   *
   * ATENÇÃO: rewrites são resolvidos no BUILD, então ADMIN_PATH precisa
   * existir como variável de ambiente da Vercel antes do deploy.
   */
  async rewrites() {
    const segredo = process.env.ADMIN_PATH?.trim();
    if (!segredo) return [];

    return [
      {
        source: `/${segredo.replace(/^\/+|\/+$/g, "")}`,
        destination: "/admin",
      },
    ];
  },
};

export default nextConfig;
