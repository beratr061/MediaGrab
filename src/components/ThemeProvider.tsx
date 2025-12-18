import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "mediagrab-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = "system" }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      return stored || defaultTheme;
    }
    return defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    if (theme === "system") {
      return getSystemTheme();
    }
    return theme;
  });

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "system") {
      const systemTheme = getSystemTheme();
      setResolvedTheme(systemTheme);
      root.classList.remove("light", "dark");
      root.classList.add(systemTheme);
    } else {
      setResolvedTheme(theme);
      root.classList.remove("light", "dark");
      root.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? "dark" : "light";
      setResolvedTheme(newTheme);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(newTheme);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
