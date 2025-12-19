import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { invoke } from "@/lib/tauri";
import { Button } from "./ui/button";
import { buttonVariants, springTransition } from "@/lib/animations";

interface PlayButtonProps {
  filePath: string;
  disabled?: boolean;
}

/**
 * Button to open the downloaded file with the default media player
 * Requirements: 4.3 - Display buttons to play the file
 */
export function PlayButton({ filePath, disabled }: PlayButtonProps) {
  const handleClick = async () => {
    try {
      await invoke("open_file", { path: filePath });
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  };

  return (
    <motion.div
      variants={buttonVariants}
      whileHover={disabled ? {} : "hover"}
      whileTap={disabled ? {} : "tap"}
      transition={springTransition}
    >
      <Button
        onClick={handleClick}
        disabled={disabled || !filePath}
        className="flex items-center gap-2"
        size="default"
      >
        <Play className="h-4 w-4" />
        Play
      </Button>
    </motion.div>
  );
}
