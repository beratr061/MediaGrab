import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, AlertCircle, Clipboard, ChevronDown, Clock, X } from "lucide-react";
import { validateUrl, sanitizeUrl } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { PlatformIcon, detectPlatform, type Platform } from "./PlatformIcon";

const RECENT_URLS_KEY = "mediagrab-recent-urls";
const MAX_RECENT_URLS = 10;

interface UrlInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onMultipleUrls?: (urls: string[]) => void;
  disabled?: boolean;
  className?: string;
  "aria-describedby"?: string;
}

function getRecentUrls(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_URLS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentUrl(url: string) {
  try {
    const recent = getRecentUrls().filter((u) => u !== url);
    recent.unshift(url);
    localStorage.setItem(RECENT_URLS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_URLS)));
  } catch {
    // Ignore storage errors
  }
}

export function UrlInput({
  id,
  value,
  onChange,
  onSubmit,
  onMultipleUrls,
  disabled = false,
  className,
  "aria-describedby": ariaDescribedBy,
}: UrlInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPasteHint, setShowPasteHint] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const [platform, setPlatform] = useState<Platform>("unknown");

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent URLs
  useEffect(() => {
    setRecentUrls(getRecentUrls());
  }, []);

  // Detect platform
  useEffect(() => {
    setPlatform(value.trim() ? detectPlatform(value) : "unknown");
  }, [value]);

  // Validate on change
  useEffect(() => {
    if (touched && value) {
      setError(validateUrl(value).error);
    } else {
      setError(undefined);
    }
  }, [value, touched]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleFocus = async () => {
    setIsFocused(true);
    if (recentUrls.length > 0 && !value) setShowDropdown(true);

    try {
      const clip = await navigator.clipboard.readText();
      if (clip && !value && (clip.includes("http") || clip.includes("www."))) {
        setShowPasteHint(true);
      }
    } catch {
      // Clipboard access denied
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    setTouched(true);
    setShowPasteHint(false);
    setTimeout(() => setShowDropdown(false), 150);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowPasteHint(false);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onSubmit && !disabled) {
      const result = validateUrl(value);
      if (result.isValid && result.sanitizedUrl) {
        onChange(result.sanitizedUrl);
        saveRecentUrl(result.sanitizedUrl);
        setRecentUrls(getRecentUrls());
        onSubmit();
      } else {
        setTouched(true);
        setError(result.error);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    const text = e.dataTransfer.getData("text/plain");
    if (text) processInput(text);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) processInput(text);
    } catch {
      // Clipboard access denied
    }
  };

  const processInput = (text: string) => {
    const lines = text.trim().split(/[\n\r]+/).map(sanitizeUrl).filter(Boolean);

    if (lines.length > 1 && onMultipleUrls) {
      const validUrls = lines
        .map((l) => validateUrl(l))
        .filter((r) => r.isValid && r.sanitizedUrl)
        .map((r) => r.sanitizedUrl!);
      if (validUrls.length > 1) {
        onMultipleUrls(validUrls);
        return;
      }
    }

    const result = validateUrl(text.trim());
    onChange(result.sanitizedUrl || text.trim());
    setShowPasteHint(false);
    setShowDropdown(false);
    setTouched(true);
  };

  const selectRecent = (url: string) => {
    onChange(url);
    setShowDropdown(false);
    setTouched(true);
    inputRef.current?.focus();
  };

  const removeRecent = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentUrls.filter((u) => u !== url);
    setRecentUrls(updated);
    localStorage.setItem(RECENT_URLS_KEY, JSON.stringify(updated));
  };

  const hasError = error && touched;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Input Container */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-background px-3 py-2 transition-colors",
          isFocused && !hasError && "border-primary ring-1 ring-primary/20",
          isDragOver && "border-primary bg-primary/5",
          hasError && "border-destructive",
          !isFocused && !hasError && !isDragOver && "border-input hover:border-muted-foreground/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Icon */}
        {platform !== "unknown" ? (
          <PlatformIcon platform={platform} size="sm" />
        ) : (
          <Link className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        {/* Input */}
        <input
          ref={inputRef}
          id={id}
          type="url"
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Paste a video URL here..."
          aria-label="Video URL input"
          aria-invalid={hasError ? "true" : "false"}
          aria-describedby={ariaDescribedBy || (hasError ? "url-error" : undefined)}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
        />

        {/* Paste Hint */}
        <AnimatePresence>
          {showPasteHint && !disabled && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={handlePaste}
              className="flex shrink-0 items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
            >
              <Clipboard className="h-3 w-3" />
              Paste
            </motion.button>
          )}
        </AnimatePresence>

        {/* Dropdown Toggle */}
        {recentUrls.length > 0 && !disabled && (
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="shrink-0 rounded p-1 hover:bg-muted"
            aria-label="Show recent URLs"
          >
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showDropdown && "rotate-180")} />
          </button>
        )}
      </div>

      {/* Recent URLs Dropdown */}
      <AnimatePresence>
        {showDropdown && recentUrls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border bg-popover p-1 shadow-lg"
          >
            <div className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Recent URLs
            </div>
            {recentUrls.map((url) => (
              <div
                key={url}
                role="option"
                tabIndex={0}
                onClick={() => selectRecent(url)}
                onKeyDown={(e) => e.key === "Enter" && selectRecent(url)}
                className="group flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent"
              >
                <PlatformIcon platform={detectPlatform(url)} size="sm" />
                <span className="flex-1 truncate">{url}</span>
                <button
                  type="button"
                  onClick={(e) => removeRecent(url, e)}
                  className="rounded p-1 opacity-0 hover:bg-destructive/10 group-hover:opacity-100"
                  aria-label="Remove from recent"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {hasError && (
          <motion.div
            id="url-error"
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-2 flex items-center gap-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { saveRecentUrl };
