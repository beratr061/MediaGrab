import { useState, useRef, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeInVariants, defaultTransition } from "@/lib/animations";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SelectProps<T extends string = string> {
  id?: string | undefined;
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  "aria-label"?: string | undefined;
}

export function Select<T extends string = string>({
  id,
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = id ? `${id}-listbox` : undefined;

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2.5 text-sm transition-colors",
          "hover:border-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "ring-2 ring-ring ring-offset-2"
        )}
      >
        <span className="flex items-center gap-2">
          {selectedOption?.icon && <span aria-hidden="true">{selectedOption.icon}</span>}
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            variants={fadeInVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={defaultTransition}
            className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover p-1 shadow-lg"
          >
            {options.map((option, index) => (
              <motion.button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => handleSelect(option.value)}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03, duration: 0.15 }}
                whileHover={{ backgroundColor: "var(--accent)", scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                  option.value === value && "bg-accent"
                )}
              >
                <span className="flex items-center gap-2">
                  {option.icon && <span aria-hidden="true">{option.icon}</span>}
                  {option.label}
                </span>
                {option.value === value && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    aria-hidden="true"
                  >
                    <Check className="h-4 w-4" />
                  </motion.span>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
