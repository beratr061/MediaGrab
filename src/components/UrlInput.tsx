import { useState, useRef, useEffect, type DragEvent, type ChangeEvent, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, AlertCircle, Clipboard } from "lucide-react";
import { validateUrl } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { fadeInVariants, defaultTransition } from "@/lib/animations";

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  className?: string;
}

export function UrlInput({ value, onChange, onSubmit, disabled = false, className }: UrlInputProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPasteHint, setShowPasteHint] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Validate on change when touched
  useEffect(() => {
    if (touched && value.length > 0) {
      const result = validateUrl(value);
      setError(result.error);
    } else if (touched && value.length === 0) {
      setError(undefined);
    }
  }, [value, touched]);

  // Check clipboard on focus for paste hint (Requirement 4.7)
  const handleFocus = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText && clipboardText.trim().length > 0 && value.length === 0) {
        // Check if clipboard contains something that looks like a URL
        if (clipboardText.includes("http") || clipboardText.includes("www.")) {
          setShowPasteHint(true);
        }
      }
    } catch {
      // Clipboard access denied - ignore
    }
  };

  const handleBlur = () => {
    setTouched(true);
    setShowPasteHint(false);
    if (value.length > 0) {
      const result = validateUrl(value);
      setError(result.error);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowPasteHint(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onSubmit && !disabled) {
      const result = validateUrl(value);
      if (result.isValid) {
        onSubmit();
      } else {
        setTouched(true);
        setError(result.error);
      }
    }
  };

  // Drag and drop support (Requirement 4.8)
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
      onChange(text.trim());
      setTouched(true);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onChange(text.trim());
        setShowPasteHint(false);
        setTouched(true);
      }
    } catch {
      // Clipboard access denied
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
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
        <div className="flex items-center pl-3 text-muted-foreground">
          <Link className="h-4 w-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Paste a video URL here..."
          className={cn(
            "flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground",
            disabled && "cursor-not-allowed"
          )}
        />
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
      </div>
      <AnimatePresence>
        {error && touched && (
          <motion.div
            variants={fadeInVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={defaultTransition}
            className="flex items-center gap-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
