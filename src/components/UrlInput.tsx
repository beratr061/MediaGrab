import { useState, useRef, useEffect, type DragEvent, type ChangeEvent, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, AlertCircle, Clipboard, ChevronDown, Clock, X } from "lucide-react";
import { validateUrl } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { fadeInVariants, defaultTransition } from "@/lib/animations";
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
  "aria-describedby": ariaDescribedBy 
}: UrlInputProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPasteHint, setShowPasteHint] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>("unknown");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent URLs on mount
  useEffect(() => {
    setRecentUrls(getRecentUrls());
  }, []);

  // Detect platform when URL changes
  useEffect(() => {
    if (value.trim()) {
      setDetectedPlatform(detectPlatform(value));
    } else {
      setDetectedPlatform("unknown");
    }
  }, [value]);

  // Validate on change when touched
  useEffect(() => {
    if (touched && value.length > 0) {
      const result = validateUrl(value);
      setError(result.error);
    } else if (touched && value.length === 0) {
      setError(undefined);
    }
  }, [value, touched]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Check clipboard on focus for paste hint
  const handleFocus = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText && clipboardText.trim().length > 0 && value.length === 0) {
        if (clipboardText.includes("http") || clipboardText.includes("www.")) {
          setShowPasteHint(true);
        }
      }
    } catch {
      // Clipboard access denied
    }
    
    // Show dropdown if there are recent URLs and input is empty
    if (recentUrls.length > 0 && !value) {
      setShowDropdown(true);
    }
  };

  const handleBlur = () => {
    setTouched(true);
    setShowPasteHint(false);
    // Delay hiding dropdown to allow click
    setTimeout(() => setShowDropdown(false), 200);
    
    if (value.length > 0) {
      const result = validateUrl(value);
      setError(result.error);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowPasteHint(false);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onSubmit && !disabled) {
      const result = validateUrl(value);
      if (result.isValid) {
        saveRecentUrl(value.trim());
        setRecentUrls(getRecentUrls());
        onSubmit();
      } else {
        setTouched(true);
        setError(result.error);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    } else if (e.key === "ArrowDown" && showDropdown) {
      e.preventDefault();
      // Focus first dropdown item
    }
  };

  // Drag and drop support
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    const text = e.dataTransfer.getData("text/plain");
    if (text) {
      handleTextInput(text);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleTextInput(text);
      }
    } catch {
      // Clipboard access denied
    }
  };

  const handleTextInput = (text: string) => {
    const trimmed = text.trim();
    const lines = trimmed.split(/[\n\r]+/).map((l) => l.trim()).filter((l) => l.length > 0);
    
    // Check if multiple URLs
    if (lines.length > 1 && onMultipleUrls) {
      const validUrls = lines.filter((line) => validateUrl(line).isValid);
      if (validUrls.length > 1) {
        onMultipleUrls(validUrls);
        return;
      }
    }
    
    // Single URL
    onChange(trimmed);
    setShowPasteHint(false);
    setShowDropdown(false);
    setTouched(true);
  };

  const handleSelectRecent = (url: string) => {
    onChange(url);
    setShowDropdown(false);
    setTouched(true);
    inputRef.current?.focus();
  };

  const handleRemoveRecent = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentUrls.filter((u) => u !== url);
    setRecentUrls(updated);
    localStorage.setItem(RECENT_URLS_KEY, JSON.stringify(updated));
  };

  const toggleDropdown = () => {
    if (recentUrls.length > 0) {
      setShowDropdown(!showDropdown);
    }
  };

  return (
    <div ref={containerRef} className={cn("space-y-2", className)}>
      <div
        className={cn(
          "relative flex items-center rounded-lg border bg-background transition-all duration-200",
          isDragOver && "border-primary bg-primary/5 ring-2 ring-primary/20",
          error && touched && "border-destructive",
          !error && !isDragOver && "border-input hover:border-muted-foreground/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Platform icon or link icon */}
        <div className="flex items-center pl-3">
          {detectedPlatform !== "unknown" ? (
            <PlatformIcon platform={detectedPlatform} size="sm" />
          ) : (
            <Link className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        
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
          aria-invalid={error && touched ? "true" : "false"}
          aria-describedby={ariaDescribedBy || (error && touched ? "url-error" : undefined)}
          autoComplete="off"
          className={cn(
            "flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground",
            disabled && "cursor-not-allowed"
          )}
        />
        
        {/* Paste hint button */}
        <AnimatePresence>
          {showPasteHint && !disabled && (
            <motion.button
              variants={fadeInVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={defaultTransition}
              onClick={handlePasteFromClipboard}
              className="mr-2 flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 transition-colors"
            >
              <Clipboard className="h-3 w-3" />
              Paste
            </motion.button>
          )}
        </AnimatePresence>
        
        {/* Dropdown toggle for recent URLs */}
        {recentUrls.length > 0 && !disabled && (
          <button
            type="button"
            onClick={toggleDropdown}
            className="mr-2 p-1 rounded hover:bg-muted transition-colors"
            aria-label="Show recent URLs"
          >
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              showDropdown && "rotate-180"
            )} />
          </button>
        )}
      </div>
      
      {/* Recent URLs dropdown */}
      <AnimatePresence>
        {showDropdown && recentUrls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={defaultTransition}
            className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
            style={{ maxHeight: "240px", overflowY: "auto" }}
          >
            <div className="p-1">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Recent URLs
              </div>
              {recentUrls.map((url) => {
                const platform = detectPlatform(url);
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => handleSelectRecent(url)}
                    className="w-full flex items-center gap-2 px-2 py-2 text-sm hover:bg-accent rounded-md transition-colors group"
                  >
                    <PlatformIcon platform={platform} size="sm" />
                    <span className="flex-1 truncate text-left">{url}</span>
                    <button
                      onClick={(e) => handleRemoveRecent(url, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                      aria-label="Remove from recent"
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Error message */}
      <AnimatePresence>
        {error && touched && (
          <motion.div
            id="url-error"
            role="alert"
            aria-live="polite"
            variants={fadeInVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={defaultTransition}
            className="flex items-center gap-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { saveRecentUrl };
