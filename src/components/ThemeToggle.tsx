import { motion } from "framer-motion";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "./ThemeProvider";
import { buttonVariants, springTransition } from "@/lib/animations";
import { cn } from "@/lib/utils";

const themes: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
      {themes.map(({ value, icon: Icon, label }) => (
        <motion.button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            "relative rounded-md p-2 text-sm transition-colors",
            theme === value
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
          transition={springTransition}
          title={label}
        >
          {theme === value && (
            <motion.div
              layoutId="theme-indicator"
              className="absolute inset-0 rounded-md bg-background shadow-sm"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <Icon className="relative z-10 h-4 w-4" />
        </motion.button>
      ))}
    </div>
  );
}
