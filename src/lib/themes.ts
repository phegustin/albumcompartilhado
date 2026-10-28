/**
 * Paletas visuais da plataforma.
 *
 * Cada álbum escolhe um tema. As cores são aplicadas como CSS Variables num
 * elemento wrapper, então TODO o tema troca sem recarregar a página e sem
 * precisar de classe condicional espalhada pelo código.
 */

export type ThemeKey =
  | "OLIVE_GOLD"
  | "CLASSIC_NOIR"
  | "TERRACOTTA"
  | "ROSE_QUARTZ"
  | "MIDNIGHT_PARTY";

export type Theme = {
  key: ThemeKey;
  /** Nome bonito mostrado no painel do cliente. */
  label: string;
  /** Corzinha do seletor de tema (preview). */
  swatch: string;
  tokens: {
    bg: string;
    surface: string;
    primary: string;
    accent: string;
    text: string;
    muted: string;
    border: string;
    onPrimary: string;
  };
};

export const THEMES: Record<ThemeKey, Theme> = {
  OLIVE_GOLD: {
    key: "OLIVE_GOLD",
    label: "Olive & Gold",
    swatch: "#213028",
    tokens: {
      bg: "#FAF8F5",
      surface: "#FFFFFF",
      primary: "#213028",
      accent: "#C5A270",
      text: "#1E2421",
      muted: "#6B7269",
      border: "#E7E2D8",
      onPrimary: "#FAF8F5",
    },
  },
  CLASSIC_NOIR: {
    key: "CLASSIC_NOIR",
    label: "Classic Noir",
    swatch: "#141414",
    tokens: {
      bg: "#FFFFFF",
      surface: "#F6F6F5",
      primary: "#141414",
      accent: "#A68A56",
      text: "#1A1A1A",
      muted: "#6E6E6E",
      border: "#E4E4E2",
      onPrimary: "#FFFFFF",
    },
  },
  TERRACOTTA: {
    key: "TERRACOTTA",
    label: "Terracotta",
    swatch: "#8C4A32",
    tokens: {
      bg: "#FDF9F5",
      surface: "#FFFFFF",
      primary: "#8C4A32",
      accent: "#D4A373",
      text: "#2B211E",
      muted: "#7C6A62",
      border: "#EFE2D6",
      onPrimary: "#FDF9F5",
    },
  },
  ROSE_QUARTZ: {
    key: "ROSE_QUARTZ",
    label: "Rose Quartz",
    swatch: "#9C5F6B",
    tokens: {
      bg: "#FDF7F8",
      surface: "#FFFFFF",
      primary: "#9C5F6B",
      accent: "#E3B7A0",
      text: "#2B2124",
      muted: "#7D6A6E",
      border: "#F0DEE2",
      onPrimary: "#FDF7F8",
    },
  },
  MIDNIGHT_PARTY: {
    key: "MIDNIGHT_PARTY",
    label: "Midnight Party",
    swatch: "#7C5CFF",
    tokens: {
      // Tema escuro: feito para festa à noite / pista de dança.
      bg: "#0B1020",
      surface: "#151B31",
      primary: "#E8EAF6",
      accent: "#7C5CFF",
      text: "#E8EAF6",
      muted: "#9AA3C7",
      border: "#242C48",
      onPrimary: "#0B1020",
    },
  },
};

/** Ordem de exibição no seletor de temas. */
export const THEME_ORDER: ThemeKey[] = [
  "OLIVE_GOLD",
  "CLASSIC_NOIR",
  "TERRACOTTA",
  "ROSE_QUARTZ",
  "MIDNIGHT_PARTY",
];

/** Tema usado quando nada foi escolhido. */
export const DEFAULT_THEME: ThemeKey = "OLIVE_GOLD";

export function getTheme(key: string | null | undefined): Theme {
  if (key && key in THEMES) return THEMES[key as ThemeKey];
  return THEMES[DEFAULT_THEME];
}

/**
 * Converte um tema em CSS Variables prontas para o atributo `style`.
 * É assim que uma página inteira "veste" a paleta do casamento.
 */
export function themeStyle(key: string | null | undefined): React.CSSProperties {
  const { tokens } = getTheme(key);
  return {
    "--album-bg": tokens.bg,
    "--album-surface": tokens.surface,
    "--album-primary": tokens.primary,
    "--album-accent": tokens.accent,
    "--album-text": tokens.text,
    "--album-muted": tokens.muted,
    "--album-border": tokens.border,
    "--album-on-primary": tokens.onPrimary,
  } as React.CSSProperties;
}

/**
 * Bloco <style> com as variáveis, para uso em Server Components onde não
 * dá para passar `style` inline (ex.: html/body).
 */
export function themeCss(key: string | null | undefined, selector = ":root"): string {
  const { tokens } = getTheme(key);
  return `${selector}{
  --album-bg:${tokens.bg};
  --album-surface:${tokens.surface};
  --album-primary:${tokens.primary};
  --album-accent:${tokens.accent};
  --album-text:${tokens.text};
  --album-muted:${tokens.muted};
  --album-border:${tokens.border};
  --album-on-primary:${tokens.onPrimary};
}`;
}
