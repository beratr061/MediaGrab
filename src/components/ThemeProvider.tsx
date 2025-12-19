import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system" | "high-contrast";

// Accent color presets with HSL values
export type AccentColor = "blue" | "purple" | "green" | "orange" | "pink" | "red" | "teal" | "yellow";

export interface AccentColorConfig {
  name: AccentColor;
  label: string;
  hsl: string; // HSL value without hsl() wrapper, e.g., "217 91% 60%"
  hslDark?: string; // Optional different value for dark mode
}

export const ACCENT_COLORS: AccentColorConfig[] = [
  { name: "blue", label: "Blue", hsl: "217 91% 60%" },
  { name: "purple", label: "Purple", hsl: "262 83% 58%" },
  { name: "green", label: "Green", hsl: "142 71% 45%" },
  { name: "orange", label: "Orange", hsl: "24 95% 53%" },
  { name: "pink", label: "Pink", hsl: "330 81% 60%" },
  { name: "red", label: "Red", hsl: "0 84% 60%" },
  { name: "teal", label: "Teal", hsl: "173 80% 40%" },
  { name: "yellow", label: "Yellow", hsl: "45 93% 47%", hslDark: "45 93% 50%" },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark" | "high-contrast";
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  isHighContrast: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "mediagrab-theme";
const ACCENT_STORAGE_KEY = "mediagrab-accent";

function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  defaultAccent?: AccentColor;
}

function applyAccentColor(color: AccentColor, isDark: boolean) {
  const config = ACCENT_COLORS.find(c => c.name === color);
  if (!config) return;
  
  const hsl = isDark && config.hslDark ? config.hslDark : config.hsl;
  
  const root = document.documentElement;
  root.style.setProperty("--color-primary", `hsl(${hsl})`);
  root.style.setProperty("--color-ring", `hsl(${hsl})`);
}

// Apply smooth theme transition
function enableThemeTransition() {
  const root = document.documentElement;
  root.style.setProperty("--theme-transition", "background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease");
  root.classList.add("theme-transitioning");
  
  // Remove transition class after animation completes
  setTimeout(() => {
    root.classList.remove("theme-transitioning");
  }, 300);
}

export function ThemeProvider({ children, defaultTheme = "system", defaultAccent = "blue" }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      return stored || defaultTheme;
    }
    return defaultTheme;
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(ACCENT_STORAGE_KEY) as AccentColor | null;
      return stored || defaultAccent;
    }
    return defaultAccent;
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark" | "high-contrast">(() => {
    if (theme === "high-contrast") {
      return "high-contrast";
    }
    if (theme === "system") {
      return getSystemTheme();
    }
    return theme;
  });

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "high-contrast") {
      setResolvedTheme("high-contrast");
      root.classList.remove("light", "dark");
      root.classList.add("high-contrast");
      // High contrast uses yellow accent by default
      root.style.setProperty("--color-primary", "hsl(60 100% 50%)");
      root.style.setProperty("--color-ring", "hsl(60 100% 50%)");
    } else if (theme === "system") {
      const systemTheme = getSystemTheme();
      setResolvedTheme(systemTheme);
      root.classList.remove("light", "dark", "high-contrast");
      root.classList.add(systemTheme);
      applyAccentColor(accentColor, systemTheme === "dark");
    } else {
      setResolvedTheme(theme);
      root.classList.remove("light", "dark", "high-contrast");
      root.classList.add(theme);
      applyAccentColor(accentColor, theme === "dark");
    }
  }, [theme, accentColor]);

  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? "dark" : "light";
      setResolvedTheme(newTheme);
      document.documentElement.classList.remove("light", "dark", "high-contrast");
      document.documentElement.classList.add(newTheme);
      applyAccentColor(accentColor, newTheme === "dark");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, accentColor]);

  // Detect system high contrast preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const highContrastQuery = window.matchMedia("(prefers-contrast: more)");
    const handleHighContrastChange = (e: MediaQueryListEvent) => {
      if (e.matches && theme === "system") {
        // Auto-switch to high contrast if system prefers it
        setThemeState("high-contrast");
      }
    };

    // Check on mount
    if (highContrastQuery.matches && theme === "system") {
      setThemeState("high-contrast");
    }

    highContrastQuery.addEventListener("change", handleHighContrastChange);
    return () => highContrastQuery.removeEventListener("change", handleHighContrastChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    enableThemeTransition();
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    setThemeState(newTheme);
  };

  const setAccentColor = (color: AccentColor) => {
    localStorage.setItem(ACCENT_STORAGE_KEY, color);
    setAccentColorState(color);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, accentColor, setAccentColor, isHighContrast: resolvedTheme === "high-contrast" }}>
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
