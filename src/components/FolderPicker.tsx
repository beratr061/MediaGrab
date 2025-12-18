import { motion } from "framer-motion";
import { Folder, FolderOpen } from "lucide-react";
import { Button } from "./ui/button";
import { buttonVariants, springTransition } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface FolderPickerProps {
  value: string;
  onPick: () => void;
  disabled?: boolean;
  className?: string;
}

export function FolderPicker({ value, onPick, disabled, className }: FolderPickerProps) {
  // Truncate long paths for display
  const displayPath = value.length > 40 
    ? "..." + value.slice(-37) 
    : value;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <motion.div
        variants={buttonVariants}
        whileHover={disabled ? {} : "hover"}
        whileTap={disabled ? {} : "tap"}
        transition={springTransition}
      >
        <Button
          type="button"
          variant="outline"
          onClick={onPick}
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <FolderOpen className="h-4 w-4" />
          Browse
        </Button>
      </motion.div>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-muted/50 px-3 py-2">
        <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span 
          className="truncate text-sm text-muted-foreground"
          title={value}
        >
          {displayPath || "No folder selected"}
        </span>
      </div>
    </div>
  );
}
